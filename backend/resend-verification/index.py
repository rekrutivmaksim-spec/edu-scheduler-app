import json
import os
from typing import Dict, Any
from datetime import datetime, timedelta
import secrets
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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

def send_verification_email(email: str, token: str, user_name: str):
    smtp_host = os.environ.get('SMTP_HOST')
    smtp_port = int(os.environ.get('SMTP_PORT', '587'))
    smtp_user = os.environ.get('SMTP_USER')
    smtp_password = os.environ.get('SMTP_PASSWORD')
    
    verify_url = f"https://fitting-room.ru/verify-email?token={token}"
    
    message = MIMEMultipart('alternative')
    message['Subject'] = 'Подтверждение email - Виртуальная примерочная'
    message['From'] = 'virtualfitting@mail.ru'
    message['To'] = email
    
    text_content = f"""
Здравствуйте, {user_name}!

Спасибо за регистрацию в Виртуальной примерочной.

Пожалуйста, подтвердите ваш email, перейдя по ссылке:
{verify_url}

Ссылка действительна в течение 24 часов.

С уважением,
Команда Виртуальной примерочной
"""
    
    html_content = f"""
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #4F46E5;">Подтверждение email</h2>
        <p>Здравствуйте, {user_name}!</p>
        <p>Спасибо за регистрацию в Виртуальной примерочной.</p>
        <p>
            <a href="{verify_url}" 
               style="display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">
                Подтвердить email
            </a>
        </p>
        <p style="color: #666; font-size: 14px;">
            Или скопируйте и вставьте эту ссылку в браузер:<br>
            <span style="color: #4F46E5;">{verify_url}</span>
        </p>
        <p style="color: #666; font-size: 14px;">
            Ссылка действительна в течение 24 часов.
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
    Business: Resend email verification link
    Args: event - dict with httpMethod, body (email)
          context - object with attributes: request_id, function_name
    Returns: HTTP response
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
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
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
        body_str = event.get('body', '{}')
        if not body_str or body_str.strip() == '':
            body_str = '{}'
        
        body_data = json.loads(body_str)
        
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
        
        cursor.execute(
            "SELECT id, name, email_verified FROM users WHERE email = %s",
            (email,)
        )
        user = cursor.fetchone()
        
        if not user:
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'If email exists, verification link will be sent'})
            }
        
        if user['email_verified']:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Email already verified'})
            }
        
        cursor.execute(
            """
            SELECT created_at FROM email_verifications 
            WHERE user_id = %s 
            ORDER BY created_at DESC 
            LIMIT 1
            """,
            (user['id'],)
        )
        last_verification = cursor.fetchone()
        
        if last_verification:
            time_since_last = datetime.now() - last_verification['created_at']
            if time_since_last < timedelta(minutes=1):
                remaining_seconds = int(60 - time_since_last.total_seconds())
                return {
                    'statusCode': 429,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'error': f'Please wait {remaining_seconds} seconds before requesting another email'
                    })
                }
        
        cursor.execute(
            "DELETE FROM email_verifications WHERE user_id = %s AND verified = false",
            (user['id'],)
        )
        
        verification_token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(hours=24)
        
        cursor.execute(
            """
            INSERT INTO email_verifications (user_id, token, expires_at)
            VALUES (%s, %s, %s)
            """,
            (user['id'], verification_token, expires_at)
        )
        
        conn.commit()
        
        send_verification_email(email, verification_token, user['name'])
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'message': 'Verification email sent'})
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