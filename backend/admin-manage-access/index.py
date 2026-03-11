'''
Business: Admin endpoint to grant unlimited access to users
Args: event with httpMethod, headers (X-Admin-Token JWT), body (user_email, unlimited_access)
Returns: Success confirmation or error
'''

import json
import os
import psycopg2
import jwt
from typing import Dict, Any

def verify_admin_jwt(provided_token: str) -> tuple[bool, str]:
    '''
    Verify JWT token for admin authentication
    Returns: (is_valid, error_message)
    '''
    if not provided_token:
        return (False, 'Token required')
    
    try:
        secret_key = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        payload = jwt.decode(provided_token, secret_key, algorithms=['HS256'])
        
        if not payload.get('admin'):
            return (False, 'Invalid token')
        
        return (True, '')
    except jwt.ExpiredSignatureError:
        return (False, 'Token expired')
    except jwt.InvalidTokenError:
        return (False, 'Invalid token')
    except Exception as e:
        return (False, f'Token verification failed: {str(e)}')

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
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
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    headers = event.get('headers', {})
    cookie_header = headers.get('x-cookie') or headers.get('X-Cookie') or headers.get('cookie') or headers.get('Cookie', '')
    
    admin_token = None
    if cookie_header:
        cookies = cookie_header.split('; ')
        for cookie in cookies:
            if cookie.startswith('admin_token='):
                admin_token = cookie.split('=', 1)[1]
                break
    
    is_valid, error_msg = verify_admin_jwt(admin_token)
    
    if not is_valid:
        return {
            'statusCode': 403,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': error_msg})
        }
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            cur.execute('''
                SELECT id, email, name, balance, free_tries_used, unlimited_access 
                FROM t_p29007832_virtual_fitting_room.users 
                ORDER BY created_at DESC
            ''')
            
            users = []
            for row in cur.fetchall():
                users.append({
                    'id': str(row[0]),
                    'email': row[1],
                    'name': row[2],
                    'balance': float(row[3]) if row[3] else 0,
                    'free_tries_used': row[4] or 0,
                    'unlimited_access': row[5] or False
                })
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'users': users})
            }
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            user_email = body_data.get('user_email')
            unlimited_access = body_data.get('unlimited_access')
            balance = body_data.get('balance')
            
            if not user_email:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Требуется user_email'})
                }
            
            # Build dynamic UPDATE query
            update_fields = []
            params = []
            
            if unlimited_access is not None:
                update_fields.append('unlimited_access = %s')
                params.append(unlimited_access)
            
            if balance is not None:
                update_fields.append('balance = %s')
                params.append(float(balance))
            
            if not update_fields:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Требуется хотя бы одно поле для обновления (unlimited_access или balance)'})
                }
            
            update_fields.append('updated_at = CURRENT_TIMESTAMP')
            params.append(user_email)
            
            query = f'''
                UPDATE t_p29007832_virtual_fitting_room.users 
                SET {', '.join(update_fields)}
                WHERE email = %s
                RETURNING id, email, name, balance, unlimited_access
            '''
            
            cur.execute(query, params)
            
            result = cur.fetchone()
            
            if not result:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Пользователь не найден'})
                }
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({
                    'success': True,
                    'user_id': str(result[0]),
                    'email': result[1],
                    'name': result[2],
                    'balance': float(result[3]) if result[3] else 0,
                    'unlimited_access': result[4] or False
                })
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Метод не поддерживается'})
        }
    
    finally:
        cur.close()
        conn.close()