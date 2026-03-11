import json
import jwt
import os
from datetime import datetime, timedelta
from typing import Dict, Any

SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'fitting-room-admin-2024')

def get_cors_origin(event: Dict[str, Any]) -> str:
    origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
    allowed_origins = ['https://fitting-room.ru', 'https://p29007832.vercel.app']
    return origin if origin in allowed_origins else 'https://fitting-room.ru'

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Выдача JWT токенов для админ-панели
    Args: event с httpMethod и body (password)
    Returns: JWT токен или ошибка
    '''
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
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    try:
        body_data = json.loads(event.get('body', '{}'))
        password = body_data.get('password', '')
        
        print(f'[DEBUG] Received password length: {len(password) if password else 0}')
        print(f'[DEBUG] Expected password exists: {ADMIN_PASSWORD is not None}')
        print(f'[DEBUG] Expected password length: {len(ADMIN_PASSWORD) if ADMIN_PASSWORD else 0}')
        print(f'[DEBUG] Passwords match: {password == ADMIN_PASSWORD}')
        
        if not password:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Access-Control-Allow-Credentials': 'true'
                },
                'body': json.dumps({'error': 'Password required'}),
                'isBase64Encoded': False
            }
        
        if password != ADMIN_PASSWORD:
            return {
                'statusCode': 401,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Access-Control-Allow-Credentials': 'true'
                },
                'body': json.dumps({'error': 'Invalid password'}),
                'isBase64Encoded': False
            }
        
        expiry = datetime.utcnow() + timedelta(hours=24)
        token_payload = {
            'admin': True,
            'exp': expiry,
            'iat': datetime.utcnow()
        }
        
        token = jwt.encode(token_payload, SECRET_KEY, algorithm='HS256')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true',
                'X-Set-Cookie': f'admin_token={token}; HttpOnly; Secure; SameSite=None; Max-Age=86400; Path=/'
            },
            'body': json.dumps({
                'success': True,
                'message': 'Authenticated'
            }),
            'isBase64Encoded': False
        }
        
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps({'error': 'Invalid JSON'}),
            'isBase64Encoded': False
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }