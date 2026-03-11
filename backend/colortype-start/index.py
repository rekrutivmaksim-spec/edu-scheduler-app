import json
import os
import psycopg2
from typing import Dict, Any
import uuid
from datetime import datetime
from session_utils import validate_session

COLORTYPE_COST = 50

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Запуск анализа цветотипа внешности и возврат task_id без ожидания результата
    Args: event - dict с httpMethod, body (person_image)
          context - object с атрибутом request_id
    Returns: HTTP response с task_id
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
                'Access-Control-Allow-Headers': 'Content-Type',
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
    
    import time
    request_timestamp = time.time()
    request_id = f"{context.request_id[:8]}-{int(request_timestamp * 1000)}"
    print(f'[COLORTYPE-START-{request_id}] ========== NEW REQUEST ==========')
    
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
    
    print(f'[COLORTYPE-START-{request_id}] User ID: {user_id}')
    
    body_data = json.loads(event.get('body', '{}'))
    person_image = body_data.get('person_image')
    eye_color = body_data.get('eye_color', 'brown')  # Default to brown
    
    if not person_image:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'person_image is required'})
        }
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # Check user balance and unlimited access
        cursor.execute('SELECT balance, unlimited_access FROM users WHERE id = %s', (user_id,))
        user_row = cursor.fetchone()
        
        if not user_row:
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'User not found'})
            }
        
        balance = float(user_row[0])
        unlimited_access = user_row[1]
        
        cost = 0 if unlimited_access else COLORTYPE_COST
        
        # Check balance only if not unlimited
        if not unlimited_access:
            if balance < cost:
                cursor.close()
                conn.close()
                return {
                    'statusCode': 402,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Insufficient balance', 'required': cost, 'current': balance})
                }
            
            # Deduct balance
            cursor.execute('UPDATE users SET balance = balance - %s WHERE id = %s', (cost, user_id))
            print(f'[COLORTYPE-START-{request_id}] Deducted {cost} rubles from user {user_id}')
        else:
            print(f'[COLORTYPE-START-{request_id}] User has unlimited access, skipping payment')
        
        # Deduplication: check for identical request in last 10ms (0.01 sec)
        person_prefix = person_image[:100] if len(person_image) > 100 else person_image
        
        print(f'[COLORTYPE-START-{request_id}] Checking for duplicates in last 10ms...')
        cursor.execute('''
            SELECT id, created_at FROM color_type_history
            WHERE user_id = %s
              AND status IN ('pending', 'processing')
              AND LEFT(person_image, 100) = %s
              AND created_at > NOW() - INTERVAL '0.01 seconds'
            ORDER BY created_at DESC
            LIMIT 1
        ''', (user_id, person_prefix))
        
        existing = cursor.fetchone()
        print(f'[COLORTYPE-START-{request_id}] Duplicate check result: {"FOUND" if existing else "NOT FOUND"}')
        
        if existing:
            existing_task_id, existing_created = existing
            print(f'[COLORTYPE-START-{request_id}] ✓ DEDUPLICATED! Returning existing task {existing_task_id} (created {existing_created})')
            print(f'[COLORTYPE-START-{request_id}] ========== REQUEST COMPLETED (DEDUPLICATED) ==========')
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({
                    'task_id': existing_task_id,
                    'status': 'pending',
                    'estimated_time_seconds': 60,
                    'deduplicated': True
                })
            }
        
        # Create task
        task_id = str(uuid.uuid4())
        print(f'[COLORTYPE-START-{request_id}] ✓ NEW TASK! Creating task {task_id}')
        
        cursor.execute('''
            INSERT INTO color_type_history (id, user_id, status, person_image, cost, created_at, eye_color)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (
            task_id,
            user_id,
            'pending',
            person_image,
            cost,
            datetime.utcnow(),
            eye_color
        ))
        
        # Record balance transaction
        if cost > 0:
            balance_after = balance - cost
            cursor.execute('''
                INSERT INTO balance_transactions
                (user_id, type, amount, balance_before, balance_after, description, color_type_id)
                VALUES (%s, 'charge', %s, %s, %s, 'Определение цветотипа', %s)
            ''', (user_id, -cost, balance, balance_after, task_id))
            print(f'[COLORTYPE-START-{request_id}] Recorded balance transaction: -{cost} rubles')
        elif unlimited_access:
            cursor.execute('''
                INSERT INTO balance_transactions
                (user_id, type, amount, balance_before, balance_after, description, color_type_id)
                VALUES (%s, 'charge', 0, %s, %s, 'Определение цветотипа (безлимитный доступ)', %s)
            ''', (user_id, balance, balance, task_id))
            print(f'[COLORTYPE-START-{request_id}] Recorded balance transaction: 0 rubles (unlimited)')
        
        conn.commit()
        print(f'[COLORTYPE-START-{request_id}] Task {task_id} saved to database')
        cursor.close()
        conn.close()
        
        # Trigger worker
        try:
            import urllib.request
            worker_url = f'https://functions.poehali.dev/c13ce63e-ae23-419d-84f1-b6958e4ea586?task_id={task_id}'
            req = urllib.request.Request(worker_url, method='GET')
            urllib.request.urlopen(req, timeout=2)
            print(f'[COLORTYPE-START-{request_id}] Worker triggered for task {task_id}')
        except Exception as e:
            print(f'[COLORTYPE-START-{request_id}] Worker trigger failed (non-critical): {e}')
        
        print(f'[COLORTYPE-START-{request_id}] ========== REQUEST COMPLETED ==========')
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'task_id': task_id,
                'status': 'pending',
                'estimated_time_seconds': 60
            })
        }
        
    except Exception as e:
        print(f'[COLORTYPE-START-{request_id}] ERROR: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }