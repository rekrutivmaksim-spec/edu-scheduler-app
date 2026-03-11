import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
import boto3
from botocore.config import Config
from session_utils import validate_session

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)

def delete_user_folder_from_s3(user_id: str) -> int:
    '''
    Delete all files in user's S3 folder
    Returns: number of deleted files
    '''
    try:
        s3_client = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            aws_access_key_id=os.environ.get('S3_ACCESS_KEY'),
            aws_secret_access_key=os.environ.get('S3_SECRET_KEY'),
            region_name='ru-central1',
            config=Config(signature_version='s3v4')
        )
        
        s3_bucket_name = os.environ.get('S3_BUCKET_NAME')
        user_folder_prefix = f'images/lookbooks/{user_id}/'
        
        deleted_count = 0
        continuation_token = None
        
        # List and delete all files in user's folder (may require pagination)
        while True:
            list_params = {
                'Bucket': s3_bucket_name,
                'Prefix': user_folder_prefix
            }
            
            if continuation_token:
                list_params['ContinuationToken'] = continuation_token
            
            response = s3_client.list_objects_v2(**list_params)
            
            if 'Contents' in response:
                for obj in response['Contents']:
                    s3_client.delete_object(
                        Bucket=s3_bucket_name,
                        Key=obj['Key']
                    )
                    deleted_count += 1
            
            # Check if there are more files to list
            if response.get('IsTruncated'):
                continuation_token = response.get('NextContinuationToken')
            else:
                break
        
        return deleted_count
    except Exception as e:
        print(f'Error deleting S3 folder for user {user_id}: {str(e)}')
        return 0

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Delete user account and all related data
    Args: event - dict with httpMethod, headers
          context - object with attributes: request_id, function_name
    Returns: HTTP response
    '''
    # Force redeploy to restore environment variables
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'DELETE')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'DELETE':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    # Validate session token from cookie or X-Session-Token header
    is_valid, user_id, error_msg = validate_session(event)
    
    if not is_valid:
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': error_msg or 'Unauthorized'})
        }
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("SELECT id FROM users WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            return {
                'statusCode': 404,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Access-Control-Allow-Credentials': 'true'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'User not found'})
            }
        
        cursor.execute("DELETE FROM try_on_history WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM lookbooks WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM email_verifications WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM password_reset_tokens WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM payment_transactions WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM nanobananapro_tasks WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM replicate_tasks WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM seedream_tasks WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM history_api_debug_log WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM sessions WHERE user_id = %s", (user_id,))
        cursor.execute("DELETE FROM login_attempts WHERE email = (SELECT email FROM users WHERE id = %s)", (user_id,))
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        
        conn.commit()
        
        # Delete user's S3 folder after successful DB deletion
        deleted_files_count = delete_user_folder_from_s3(user_id)
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'message': 'Account deleted successfully'})
        }
    
    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cursor.close()
        conn.close()