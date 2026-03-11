import json
import os
from typing import Dict, Any
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def get_db_connection():
    # Force redeploy
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)

def send_reset_email(email: str, token: str, user_name: str):
    smtp_host = os.environ.get('SMTP_HOST')
    smtp_port = int(os.environ.get('SMTP_PORT', '587'))
    smtp_user = os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('SMTP_PASSWORD')
    
    reset_url = f"https://fitting-room.ru/reset-password?token={token}"
    
    message = MIMEMultipart('alternative')
    message['Subject'] = 'Сброс пароля - Виртуальная примерочная'
    message['From'] = smtp_user
    message['To'] = email
    
    text_content = f"""
Здравствуйте, {user_name}!

Вы запросили сброс пароля для вашего аккаунта.

Перейдите по ссылке для создания нового пароля:
{reset_url}

Ссылка действительна в течение 1 часа.

Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.

С уважением,
Команда Виртуальной примерочной
"""
    
    html_content = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">Сброс пароля</h2>
        <p>Здравствуйте, {user_name}!</p>
        <p>Вы запросили сброс пароля для вашего аккаунта в Виртуальной примерочной.</p>
        <p>
            <a href="{reset_url}" 
               style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                Сбросить пароль
            </a>
        </p>
        <p style="color: #666; font-size: 14px;">
            Или скопируйте и вставьте эту ссылку в браузер:<br>
            <span style="color: #4F46E5;">{reset_url}</span>
        </p>
        <p style="color: #666; font-size: 14px;">
            Ссылка действительна в течение 1 часа.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #999; font-size: 12px;">
            Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.
        </p>
    </div>
</body>
</html>
"""
    
    text_part = MIMEText(text_content, 'plain', 'utf-8')
    html_part = MIMEText(html_content, 'html', 'utf-8')
    
    message.attach(text_part)
    message.attach(html_part)
    
    if smtp_port == 465:
        with smtplib.SMTP_SSL(smtp_host, smtp_port) as server:
            server.login(smtp_user, smtp_password)
            server.send_message(message)
    else:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(message)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Password reset functionality - request and confirm
    Args: event - dict with httpMethod, body, queryStringParameters
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
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        if method == 'POST':
            body_str = event.get('body', '{}')
            body_data = json.loads(body_str)
            
            action = body_data.get('action')
            
            if action == 'request_reset':
                email = body_data.get('email')
                
                if not email:
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': get_cors_origin(event)
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Email is required'})
                    }
                
                cursor.execute("SELECT id, name FROM users WHERE email = %s", (email,))
                user = cursor.fetchone()
                
                if not user:
                    return {
                        'statusCode': 200,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': get_cors_origin(event)
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'message': 'If email exists, reset link will be sent'})
                    }
                
                token = secrets.token_urlsafe(32)
                expires_at = datetime.now() + timedelta(hours=1)
                
                cursor.execute(
                    """
                    INSERT INTO password_reset_tokens (user_id, token, expires_at)
                    VALUES (%s, %s, %s)
                    """,
                    (user['id'], token, expires_at)
                )
                conn.commit()
                
                send_reset_email(email, token, user['name'])
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'message': 'Reset link sent to email'})
                }
            
            elif action == 'reset_password':
                token = body_data.get('token')
                new_password = body_data.get('new_password')
                
                if not token or not new_password:
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': get_cors_origin(event)
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Token and new password are required'})
                    }
                
                cursor.execute(
                    """
                    SELECT user_id, expires_at, used 
                    FROM password_reset_tokens 
                    WHERE token = %s
                    """,
                    (token,)
                )
                reset_token = cursor.fetchone()
                
                if not reset_token:
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': get_cors_origin(event)
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Invalid token'})
                    }
                
                if reset_token['used']:
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': get_cors_origin(event)
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Token already used'})
                    }
                
                if datetime.now() > reset_token['expires_at']:
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': get_cors_origin(event)
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Token expired'})
                    }
                
                import bcrypt
                password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                
                cursor.execute(
                    "UPDATE users SET password_hash = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s",
                    (password_hash, reset_token['user_id'])
                )
                
                cursor.execute(
                    "UPDATE password_reset_tokens SET used = true WHERE token = %s",
                    (token,)
                )
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'message': 'Password reset successful'})
                }
            
            else:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Invalid action'})
                }
        
        elif method == 'GET':
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
                SELECT expires_at, used 
                FROM password_reset_tokens 
                WHERE token = %s
                """,
                (token,)
            )
            reset_token = cursor.fetchone()
            
            if not reset_token:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'valid': False, 'error': 'Invalid token'})
                }
            
            if reset_token['used']:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'valid': False, 'error': 'Token already used'})
                }
            
            if datetime.now() > reset_token['expires_at']:
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'valid': False, 'error': 'Token expired'})
                }
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://fitting-room.ru'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'valid': True})
            }
        
        else:
            return {
                'statusCode': 405,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://fitting-room.ru'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Method not allowed'})
            }
    
    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://fitting-room.ru'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cursor.close()
        conn.close()