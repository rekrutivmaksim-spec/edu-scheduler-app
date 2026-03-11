import json
import os
from typing import Dict, Any
from datetime import datetime, timedelta
import secrets

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    import psycopg2cffi as psycopg2
    from psycopg2cffi.extras import RealDictCursor

def get_db_connection():
    # Force redeploy
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)

def generate_session_token() -> str:
    return secrets.token_urlsafe(32)

def save_session_to_db(cursor, conn, user_id: str, token: str, ip_address: str, user_agent: str):
    '''
    Save session token to database for validation and revocation
    '''
    expires_at = datetime.now() + timedelta(days=7)
    cursor.execute(
        """
        INSERT INTO sessions (user_id, token, expires_at, ip_address, user_agent)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (user_id, token, expires_at, ip_address, user_agent)
    )
    conn.commit()

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Email verification for new users
    Args: event - dict with httpMethod, queryStringParameters (token)
          context - object with attributes: request_id, function_name
    Returns: HTTP response
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
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        query_params = event.get('queryStringParameters') or {}
        token = query_params.get('token')
        
        if not token:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Token is required'})
            }
        
        cursor.execute(
            """
            SELECT user_id, expires_at, verified 
            FROM email_verifications 
            WHERE token = %s
            """,
            (token,)
        )
        verification = cursor.fetchone()
        
        if not verification:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Invalid verification token'})
            }
        
        if verification['verified']:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Email already verified'})
            }
        
        if datetime.now() > verification['expires_at']:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Verification token expired'})
            }
        
        cursor.execute(
            "UPDATE users SET email_verified = true WHERE id = %s RETURNING id, email, name, created_at",
            (verification['user_id'],)
        )
        
        user = cursor.fetchone()
        
        cursor.execute(
            "UPDATE email_verifications SET verified = true WHERE token = %s",
            (token,)
        )
        
        conn.commit()
        
        # Generate and save session
        session_token = generate_session_token()
        
        # Get IP and user agent
        headers = event.get('headers', {})
        x_forwarded_for = headers.get('x-forwarded-for') or headers.get('X-Forwarded-For', '')
        x_real_ip = headers.get('x-real-ip') or headers.get('X-Real-IP', '')
        
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0].strip()
        elif x_real_ip:
            ip_address = x_real_ip
        else:
            ip_address = event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
        
        user_agent = headers.get('user-agent', 'unknown')
        
        # Save session to DB
        save_session_to_db(cursor, conn, str(user['id']), session_token, ip_address, user_agent)
        
        # Set session token in httpOnly cookie
        cookie_value = f"session_token={session_token}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800"
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true',
                'X-Set-Cookie': cookie_value
            },
            'isBase64Encoded': False,
            'body': json.dumps({
                'message': 'Email verified successfully',
                'user': {
                    'id': str(user['id']),
                    'email': user['email'],
                    'name': user['name'],
                    'created_at': user['created_at'].isoformat(),
                    'email_verified': True
                }
            })
        }
    
    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cursor.close()
        conn.close()