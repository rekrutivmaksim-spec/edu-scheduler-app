"""API для аутентификации пользователей: вход с автоматической регистрацией, сброс пароля"""

import json
import os
import bcrypt
import jwt
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor


def get_db_connection():
    """Создаёт подключение к PostgreSQL базе данных"""
    dsn = os.environ['DATABASE_URL']
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(dsn, options=f'-c search_path={schema}')
    return conn


def generate_token(user_id: int, email: str) -> str:
    """Генерирует JWT токен для пользователя"""
    secret = os.environ['JWT_SECRET']
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, secret, algorithm='HS256')


def verify_token(token: str) -> dict:
    """Проверяет JWT токен и возвращает payload"""
    secret = os.environ['JWT_SECRET']
    try:
        return jwt.decode(token, secret, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def handler(event: dict, context) -> dict:
    """Обработчик запросов аутентификации"""
    method = event.get('httpMethod', 'GET')
    
    # CORS preflight
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
            },
            'body': ''
        }
    
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }
    
    if method == 'POST':
        body = json.loads(event.get('body', '{}'))
        action = body.get('action')
        
        # POST /login - Вход с автоматической регистрацией
        if action == 'login':
            email = body.get('email', '').strip().lower()
            password = body.get('password', '')
            
            if not email or not password:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Email и пароль обязательны'})
                }
            
            # ВАЛИДАЦИЯ EMAIL
            import re
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(email_pattern, email):
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Некорректный формат email'})
                }
            
            if len(password) < 6:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Пароль должен быть минимум 6 символов'})
                }
            
            if len(password) > 100:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Пароль слишком длинный'})
                }
            
            conn = get_db_connection()
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Ищем пользователя
                    cur.execute("""
                        SELECT id, email, password_hash, full_name, university, faculty, course
                        FROM users WHERE email = %s
                    """, (email,))
                    
                    user = cur.fetchone()
                    
                    # Если пользователь существует - проверяем пароль
                    if user:
                        if not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                            return {
                                'statusCode': 401,
                                'headers': headers,
                                'body': json.dumps({'error': 'Неверный пароль'})
                            }
                        
                        # Обновляем last_login_at
                        cur.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = %s", (user['id'],))
                        conn.commit()
                        
                        token = generate_token(user['id'], user['email'])
                        
                        return {
                            'statusCode': 200,
                            'headers': headers,
                            'body': json.dumps({
                                'token': token,
                                'user': {
                                    'id': user['id'],
                                    'email': user['email'],
                                    'full_name': user['full_name'],
                                    'university': user['university'],
                                    'faculty': user['faculty'],
                                    'course': user['course']
                                }
                            })
                        }
                    
                    # Если пользователя нет - создаем автоматически
                    else:
                        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                        full_name = email.split('@')[0]  # Используем часть email как имя
                        
                        import hashlib
                        referral_code = hashlib.md5((email + str(datetime.utcnow().timestamp())).encode()).hexdigest()[:8].upper()
                        
                        cur.execute("""
                            INSERT INTO users (
                                email, password_hash, full_name, last_login_at,
                                trial_ends_at, is_trial_used,
                                ai_tokens_limit, ai_tokens_used, ai_tokens_reset_at,
                                daily_questions_used, daily_questions_reset_at,
                                referral_code
                            )
                            VALUES (
                                %s, %s, %s, CURRENT_TIMESTAMP,
                                CURRENT_TIMESTAMP + INTERVAL '1 day', FALSE,
                                50000, 0, CURRENT_TIMESTAMP + INTERVAL '1 month',
                                0, CURRENT_TIMESTAMP,
                                %s
                            )
                            RETURNING id, email, full_name, university, faculty, course, trial_ends_at
                        """, (email, password_hash, full_name, referral_code))
                        
                        new_user = cur.fetchone()
                        conn.commit()
                        
                        token = generate_token(new_user['id'], new_user['email'])
                        
                        return {
                            'statusCode': 201,
                            'headers': headers,
                            'body': json.dumps({
                                'token': token,
                                'user': {
                                    'id': new_user['id'],
                                    'email': new_user['email'],
                                    'full_name': new_user['full_name'],
                                    'university': new_user['university'],
                                    'faculty': new_user['faculty'],
                                    'course': new_user['course']
                                },
                                'is_new_user': True,
                                'trial_ends_at': str(new_user['trial_ends_at'])
                            }, default=str)
                        }
            finally:
                conn.close()
        
        # POST /reset_password - Сброс пароля (создание нового если пользователя нет)
        elif action == 'reset_password':
            email = body.get('email', '').strip().lower()
            new_password = body.get('new_password', '')
            
            if not email or not new_password:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Email и новый пароль обязательны'})
                }
            
            if len(new_password) < 6:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Пароль должен быть минимум 6 символов'})
                }
            
            password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            conn = get_db_connection()
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Проверяем существует ли пользователь
                    cur.execute("SELECT id, email, full_name FROM users WHERE email = %s", (email,))
                    user = cur.fetchone()
                    
                    if user:
                        # Обновляем пароль существующего пользователя
                        cur.execute("""
                            UPDATE users 
                            SET password_hash = %s, last_login_at = CURRENT_TIMESTAMP
                            WHERE email = %s
                            RETURNING id, email, full_name, university, faculty, course
                        """, (password_hash, email))
                        
                        updated_user = cur.fetchone()
                        conn.commit()
                        
                        token = generate_token(updated_user['id'], updated_user['email'])
                        
                        return {
                            'statusCode': 200,
                            'headers': headers,
                            'body': json.dumps({
                                'token': token,
                                'user': {
                                    'id': updated_user['id'],
                                    'email': updated_user['email'],
                                    'full_name': updated_user['full_name'],
                                    'university': updated_user['university'],
                                    'faculty': updated_user['faculty'],
                                    'course': updated_user['course']
                                },
                                'message': 'Пароль успешно обновлен'
                            })
                        }
                    else:
                        # Создаем нового пользователя если не существует
                        full_name = email.split('@')[0]
                        
                        cur.execute("""
                            INSERT INTO users (email, password_hash, full_name, last_login_at)
                            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
                            RETURNING id, email, full_name, university, faculty, course
                        """, (email, password_hash, full_name))
                        
                        new_user = cur.fetchone()
                        conn.commit()
                        
                        token = generate_token(new_user['id'], new_user['email'])
                        
                        return {
                            'statusCode': 201,
                            'headers': headers,
                            'body': json.dumps({
                                'token': token,
                                'user': {
                                    'id': new_user['id'],
                                    'email': new_user['email'],
                                    'full_name': new_user['full_name'],
                                    'university': new_user['university'],
                                    'faculty': new_user['faculty'],
                                    'course': new_user['course']
                                },
                                'is_new_user': True,
                                'message': 'Аккаунт создан с новым паролем'
                            })
                        }
            finally:
                conn.close()
        
        # POST /update_profile - Обновление профиля
        elif action == 'update_profile':
            auth_header = event.get('headers', {}).get('X-Authorization', '') or event.get('headers', {}).get('Authorization', '')
            token = auth_header.replace('Bearer ', '')
            
            if not token:
                return {
                    'statusCode': 401,
                    'headers': headers,
                    'body': json.dumps({'error': 'Токен не предоставлен'})
                }
            
            payload = verify_token(token)
            
            if not payload:
                return {
                    'statusCode': 401,
                    'headers': headers,
                    'body': json.dumps({'error': 'Недействительный токен'})
                }
            
            full_name = body.get('full_name', '').strip()
            university = body.get('university', '').strip()
            faculty = body.get('faculty', '').strip()
            course = body.get('course', '').strip()
            
            conn = get_db_connection()
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("""
                        UPDATE users 
                        SET full_name = %s, university = %s, faculty = %s, course = %s, updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                        RETURNING id, email, full_name, university, faculty, course
                    """, (full_name, university, faculty, course, payload['user_id']))
                    
                    user = cur.fetchone()
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({
                            'user': {
                                'id': user['id'],
                                'email': user['email'],
                                'full_name': user['full_name'],
                                'university': user['university'],
                                'faculty': user['faculty'],
                                'course': user['course']
                            }
                        })
                    }
            finally:
                conn.close()
    
    # GET /verify - Проверка токена
    elif method == 'GET':
        auth_header = event.get('headers', {}).get('X-Authorization', '') or event.get('headers', {}).get('Authorization', '')
        token = auth_header.replace('Bearer ', '')
        
        if not token:
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Токен не предоставлен'})
            }
        
        payload = verify_token(token)
        
        if not payload:
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Недействительный токен'})
            }
        
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, email, full_name, university, faculty, course, 
                           subscription_type, subscription_expires_at
                    FROM users WHERE id = %s
                """, (payload['user_id'],))
                
                user = cur.fetchone()
                
                if not user:
                    return {
                        'statusCode': 404,
                        'headers': headers,
                        'body': json.dumps({'error': 'Пользователь не найден'})
                    }
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'user': {
                            'id': user['id'],
                            'email': user['email'],
                            'full_name': user['full_name'],
                            'university': user['university'],
                            'faculty': user['faculty'],
                            'course': user['course'],
                            'subscription_type': user['subscription_type'],
                            'subscription_expires_at': user['subscription_expires_at'].isoformat() if user['subscription_expires_at'] else None
                        }
                    })
                }
        finally:
            conn.close()
    
    return {
        'statusCode': 405,
        'headers': headers,
        'body': json.dumps({'error': 'Метод не поддерживается'})
    }