import json
import os
import psycopg2
from typing import Dict, Any
import uuid
from datetime import datetime
from session_utils import validate_session

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Start async NanoBanana generation and return task_id immediately
    # Force redeploy
    Args: event - dict with httpMethod, body (person_image, garments, custom_prompt)
          context - object with request_id attribute
    Returns: HTTP response with task_id (no waiting)
    '''
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    # Generate unique request ID for tracking
    import time
    request_timestamp = time.time()
    request_id = f"{context.request_id[:8]}-{int(request_timestamp * 1000)}"
    print(f'[START-{request_id}] ========== NEW REQUEST RECEIVED ==========')
    print(f'[START-{request_id}] Timestamp: {request_timestamp}')
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    # Validate session token
    is_valid, user_id, error_msg = validate_session(event)
    
    if not is_valid:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': error_msg or 'Unauthorized'})
        }
    
    print(f'[START-{request_id}] User ID: {user_id}')
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'User ID required'})
        }
    
    body_data = json.loads(event.get('body', '{}'))
    person_image = body_data.get('person_image')
    garments = body_data.get('garments', [])
    prompt_hints = body_data.get('custom_prompt', '')
    
    if not person_image:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'person_image is required'})
        }
    
    if not garments or len(garments) == 0:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'At least one garment is required'})
        }
    
    if len(garments) > 2:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Максимум 2 вещи за раз для NanoBanana'})
        }
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Deduplication: check for identical request in last 10ms (0.01 sec)
        person_prefix = person_image[:100] if len(person_image) > 100 else person_image
        garments_str = json.dumps(garments)
        garments_prefix = garments_str[:200] if len(garments_str) > 200 else garments_str
        
        print(f'[START-{request_id}] Checking for duplicates in last 10ms...')
        cursor.execute('''
            SELECT id, created_at FROM nanobananapro_tasks
            WHERE user_id = %s
              AND status IN ('pending', 'processing')
              AND LEFT(person_image, 100) = %s
              AND LEFT(garments::text, 200) = %s
              AND created_at > NOW() - INTERVAL '0.01 seconds'
            ORDER BY created_at DESC
            LIMIT 1
        ''', (user_id, person_prefix, garments_prefix))
        
        existing = cursor.fetchone()
        print(f'[START-{request_id}] Duplicate check result: {"FOUND" if existing else "NOT FOUND"}')
        
        if existing:
            existing_task_id, existing_created = existing
            print(f'[START-{request_id}] ✓ DEDUPLICATED! Returning existing task {existing_task_id} (created {existing_created})')
            print(f'[START-{request_id}] ========== REQUEST COMPLETED (DEDUPLICATED) ==========')
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({
                    'task_id': existing_task_id,
                    'status': 'pending',
                    'estimated_time_seconds': 30,
                    'deduplicated': True
                })
            }
        
        task_id = str(uuid.uuid4())
        print(f'[START-{request_id}] ✓ NEW TASK! Creating task {task_id} for user {user_id}')
        
        cursor.execute('''
            INSERT INTO nanobananapro_tasks (id, user_id, status, person_image, garments, prompt_hints, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (
            task_id,
            user_id,
            'pending',
            person_image,
            json.dumps(garments),
            prompt_hints,
            datetime.utcnow()
        ))
        
        conn.commit()
        print(f'[START-{request_id}] Task {task_id} saved to database')
        cursor.close()
        conn.close()
        
        try:
            import urllib.request
            worker_url = f'https://functions.poehali.dev/1f4c772e-0425-4fe4-98a6-baa3979ba94d?task_id={task_id}'
            req = urllib.request.Request(worker_url, method='GET')
            urllib.request.urlopen(req, timeout=2)
            print(f'[START-{request_id}] Worker triggered for task {task_id}')
        except Exception as e:
            print(f'[START-{request_id}] Worker trigger failed (non-critical): {e}')
        
        print(f'[START-{request_id}] ========== REQUEST COMPLETED (NEW TASK) ==========')
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'task_id': task_id,
                'status': 'pending',
                'estimated_time_seconds': 30
            })
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }