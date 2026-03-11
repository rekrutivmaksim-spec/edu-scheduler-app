import json
import os
import psycopg2
import requests
from typing import Dict, Any
from datetime import datetime

def check_fal_status(response_url: str) -> dict:
    '''Check status directly on fal.ai'''
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')
    
    headers = {
        'Authorization': f'Key {fal_api_key}',
        'Content-Type': 'application/json'
    }
    
    response = requests.get(
        response_url,
        headers=headers,
        timeout=10
    )
    
    if response.status_code == 200:
        return response.json()
    
    raise Exception(f'Failed to check status: {response.status_code}')

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Check NanoBanana task status with optional force_check
    # Force redeploy
    Args: event - dict with httpMethod, queryStringParameters (task_id, force_check)
          context - object with request_id attribute
    Returns: HTTP response with task status and result_url if completed
    '''
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    params = event.get('queryStringParameters', {}) or {}
    print(f'[Status] Query params: {params}')
    task_id = params.get('task_id')
    force_check = params.get('force_check') == 'true'
    print(f'[Status] task_id={task_id}, force_check={force_check}')
    
    if not task_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'task_id is required'})
        }
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT status, result_url, error_message, fal_response_url
            FROM nanobananapro_tasks
            WHERE id = %s
        ''', (task_id,))
        
        row = cursor.fetchone()
        
        if not row:
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Task not found'})
            }
        
        status, result_url, error_message, fal_response_url = row
        
        if force_check and status == 'processing' and fal_response_url:
            print(f'[Status] Force checking task {task_id} on fal.ai')
            try:
                fal_data = check_fal_status(fal_response_url)
                fal_status = fal_data.get('status', fal_data.get('state', 'UNKNOWN'))
                
                print(f'[Status] fal.ai status: {fal_status}')
                
                if fal_status == 'COMPLETED' or 'images' in fal_data or 'image' in fal_data:
                    # Extract result URL
                    if 'images' in fal_data and len(fal_data['images']) > 0:
                        new_result_url = fal_data['images'][0]['url']
                    elif 'image' in fal_data:
                        if isinstance(fal_data['image'], dict):
                            new_result_url = fal_data['image']['url']
                        else:
                            new_result_url = fal_data['image']
                    else:
                        new_result_url = None
                    
                    if new_result_url:
                        print(f'[Status] Task completed! Updating DB with fal.ai URL: {new_result_url[:50]}...')
                        cursor.execute('''
                            UPDATE nanobananapro_tasks
                            SET status = 'completed', result_url = %s, updated_at = %s
                            WHERE id = %s
                        ''', (new_result_url, datetime.utcnow(), task_id))
                        conn.commit()
                        
                        status = 'completed'
                        result_url = new_result_url
                        print(f'[Status] DB updated, worker will upload to S3 in background')
                    
                elif fal_status in ['FAILED', 'EXPIRED']:
                    error_msg = fal_data.get('error', 'Generation failed')
                    print(f'[Status] Task failed: {error_msg}')
                    cursor.execute('''
                        UPDATE nanobananapro_tasks
                        SET status = 'failed', error_message = %s, updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
                    
                    status = 'failed'
                    error_message = error_msg
                
            except Exception as e:
                print(f'[Status] Force check error: {str(e)}')
        
        cursor.close()
        conn.close()
        
        response_data = {
            'task_id': task_id,
            'status': status,
            'result_url': result_url,
            'error_message': error_message
        }
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps(response_data)
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }