"""API для аутентификации пользователей: вход с автоматической регистрацией, сброс пароля (v2: триал 7 дней)"""

import json
import os
import bcrypt
import jwt
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
from rate_limiter import check_rate_limit, check_failed_login, record_failed_login, reset_failed_login, get_client_ip


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
    client_ip = get_client_ip(event)
    
    # Rate limiting: общий лимит 60 запросов/минуту с одного IP
    is_allowed, remaining, retry_after = check_rate_limit(f"{client_ip}_auth", max_requests=60, window_seconds=60)
    if not is_allowed:
        return {
            'statusCode': 429,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Retry-After': str(retry_after)
            },
            'body': json.dumps({
                'error': 'Слишком много запросов. Попробуйте через несколько секунд',
                'retry_after': retry_after
            })
        }
    
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
            
            # ЗАЩИТА ОТ БРУТФОРСА: проверяем блокировку по IP
            is_login_allowed, attempts_left, locked_until = check_failed_login(client_ip, max_attempts=5, lockout_minutes=15)
            if not is_login_allowed:
                minutes_left = int((locked_until - datetime.now()).seconds / 60) + 1
                print(f"[AUTH] IP {client_ip} заблокирован до {locked_until} за брутфорс")
                return {
                    'statusCode': 429,
                    'headers': headers,
                    'body': json.dumps({
                        'error': f'Слишком много неудачных попыток входа. Аккаунт заблокирован на {minutes_left} минут',
                        'locked_until': locked_until.isoformat()
                    }, default=str)
                }
            
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
                            # КРИТИЧЕСКАЯ ЗАЩИТА: записываем неудачную попытку
                            record_failed_login(client_ip)
                            _, attempts_remaining, _ = check_failed_login(client_ip)
                            print(f"[AUTH] Неверный пароль для {email} с IP {client_ip}, осталось попыток: {attempts_remaining}")
                            
                            return {
                                'statusCode': 401,
                                'headers': headers,
                                'body': json.dumps({
                                    'error': 'Неверный пароль',
                                    'attempts_remaining': attempts_remaining
                                })
                            }
                        
                        # Обновляем last_login_at
                        cur.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = %s", (user['id'],))
                        conn.commit()
                        
                        # ЗАЩИТА: сбрасываем счетчик неудачных попыток при успешном входе
                        reset_failed_login(client_ip)
                        print(f"[AUTH] Успешный вход для {email} с IP {client_ip}")
                        
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
                        device_id = body.get('device_id', '').strip()
                        browser_fp = body.get('browser_fp', '').strip()[:64]

                        # --- МНОГОУРОВНЕВАЯ ЗАЩИТА ОТ ДУБЛИКАТОВ ---
                        trial_allowed = True
                        block_reason = None

                        # 1. Проверка по device_id
                        if device_id:
                            cur.execute("""
                                SELECT id FROM users
                                WHERE device_id = %s AND is_trial_used = TRUE
                                LIMIT 1
                            """, (device_id,))
                            if cur.fetchone():
                                trial_allowed = False
                                block_reason = 'device_id'

                        # 2. Проверка по browser fingerprint
                        if trial_allowed and browser_fp:
                            cur.execute("""
                                SELECT COUNT(*) AS cnt FROM users
                                WHERE browser_fp = %s AND is_trial_used = TRUE
                            """, (browser_fp,))
                            fp_count = cur.fetchone()['cnt']
                            if fp_count >= 1:
                                trial_allowed = False
                                block_reason = 'browser_fp'

                        # 3. Проверка по IP — не более 2 триалов с одного IP
                        if trial_allowed:
                            cur.execute("""
                                SELECT COUNT(*) AS cnt FROM users
                                WHERE reg_ip = %s AND is_trial_used = FALSE
                                AND created_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
                            """, (client_ip,))
                            ip_trial_count = cur.fetchone()['cnt']
                            if ip_trial_count >= 2:
                                trial_allowed = False
                                block_reason = 'ip_limit'

                        # 4. Cooldown: не более 3 регистраций с одного IP в сутки
                        cur.execute("""
                            SELECT COUNT(*) AS cnt FROM users
                            WHERE reg_ip = %s AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
                        """, (client_ip,))
                        ip_reg_today = cur.fetchone()['cnt']
                        if ip_reg_today >= 3:
                            print(f"[AUTH] IP {client_ip} превысил лимит регистраций сегодня ({ip_reg_today})", flush=True)
                            return {
                                'statusCode': 429,
                                'headers': headers,
                                'body': json.dumps({'error': 'Слишком много регистраций с вашего IP. Попробуйте завтра.'})
                            }

                        if block_reason:
                            print(f"[AUTH] Триал заблокирован: {block_reason} device={device_id} fp={browser_fp} ip={client_ip}", flush=True)
                        
                        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                        full_name = email.split('@')[0]
                        
                        import secrets as _sec
                        referral_code = _sec.token_hex(4).upper()
                        
                        if trial_allowed:
                            cur.execute("""
                                INSERT INTO users (
                                    email, password_hash, full_name, last_login_at,
                                    trial_ends_at, is_trial_used,
                                    ai_tokens_limit, ai_tokens_used, ai_tokens_reset_at,
                                    daily_questions_used, daily_questions_reset_at,
                                    referral_code, device_id, browser_fp, reg_ip
                                )
                                VALUES (
                                    %s, %s, %s, CURRENT_TIMESTAMP,
                                    CURRENT_TIMESTAMP + INTERVAL '7 days', FALSE,
                                    50000, 0, CURRENT_TIMESTAMP + INTERVAL '1 month',
                                    0, CURRENT_TIMESTAMP,
                                    %s, %s, %s, %s
                                )
                                RETURNING id, email, full_name, university, faculty, course, trial_ends_at
                            """, (email, password_hash, full_name, referral_code, device_id or None, browser_fp or None, client_ip or None))
                        else:
                            cur.execute("""
                                INSERT INTO users (
                                    email, password_hash, full_name, last_login_at,
                                    trial_ends_at, is_trial_used,
                                    ai_tokens_limit, ai_tokens_used, ai_tokens_reset_at,
                                    daily_questions_used, daily_questions_reset_at,
                                    referral_code, device_id, browser_fp, reg_ip
                                )
                                VALUES (
                                    %s, %s, %s, CURRENT_TIMESTAMP,
                                    NULL, TRUE,
                                    0, 0, CURRENT_TIMESTAMP + INTERVAL '1 month',
                                    0, CURRENT_TIMESTAMP,
                                    %s, %s, %s, %s
                                )
                                RETURNING id, email, full_name, university, faculty, course, trial_ends_at
                            """, (email, password_hash, full_name, referral_code, device_id or None, browser_fp or None, client_ip or None))
                        
                        new_user = cur.fetchone()
                        conn.commit()
                        
                        reset_failed_login(client_ip)
                        print(f"[AUTH] Новый пользователь {email} с IP {client_ip}, device_id={device_id}, trial={trial_allowed}")
                        
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
                                'trial_ends_at': str(new_user['trial_ends_at']) if new_user['trial_ends_at'] else None,
                                'trial_available': trial_allowed
                            }, default=str)
                        }
            finally:
                conn.close()
        
        # POST /reset_password - Смена пароля (только для существующих аккаунтов)
        elif action == 'reset_password':
            email = body.get('email', '').strip().lower()
            new_password = body.get('new_password', '')

            # Rate limit: 3 попытки в 10 минут на IP
            is_rp_allowed, _, rp_retry = check_rate_limit(f"{client_ip}_reset", max_requests=3, window_seconds=600)
            if not is_rp_allowed:
                return {
                    'statusCode': 429,
                    'headers': headers,
                    'body': json.dumps({'error': 'Слишком много попыток. Подождите несколько минут', 'retry_after': rp_retry})
                }

            import re as _re
            if not email or not new_password:
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Email и новый пароль обязательны'})}

            if not _re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email):
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Некорректный формат email'})}

            if len(new_password) < 6:
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Пароль должен быть минимум 6 символов'})}

            if len(new_password) > 100:
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Пароль слишком длинный'})}

            password_hash = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

            conn = get_db_connection()
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("SELECT id, email, full_name, university, faculty, course FROM users WHERE email = %s", (email,))
                    user = cur.fetchone()

                    if not user:
                        # Не создаём новый аккаунт — пользователь должен сначала зарегистрироваться через login
                        # Возвращаем 200 (не 404) чтобы не раскрывать наличие email в базе
                        return {
                            'statusCode': 200,
                            'headers': headers,
                            'body': json.dumps({'message': 'Если аккаунт с таким email существует — пароль обновлён'})
                        }

                    cur.execute(
                        "UPDATE users SET password_hash = %s, updated_at = CURRENT_TIMESTAMP WHERE email = %s RETURNING id, email, full_name, university, faculty, course",
                        (password_hash, email)
                    )
                    updated_user = cur.fetchone()
                    conn.commit()

                    token = generate_token(updated_user['id'], updated_user['email'])
                    print(f"[AUTH] Пароль сменён для {email} с IP {client_ip}")

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
                            'message': 'Пароль успешно обновлён'
                        })
                    }
            finally:
                conn.close()
        
        # POST /delete_account - Удаление аккаунта
        elif action == 'delete_account':
            auth_header = event.get('headers', {}).get('X-Authorization', '') or event.get('headers', {}).get('Authorization', '')
            token = auth_header.replace('Bearer ', '')

            if not token:
                return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Токен не предоставлен'})}

            payload = verify_token(token)
            if not payload:
                return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Недействительный токен'})}

            password = body.get('password', '')
            if not password:
                return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Введите пароль для подтверждения'})}

            conn = get_db_connection()
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("SELECT id, email, password_hash FROM users WHERE id = %s", (payload['user_id'],))
                    user = cur.fetchone()

                    if not user:
                        return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Пользователь не найден'})}

                    if user['password_hash'] and not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
                        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Неверный пароль'})}

                    # Удаляем все данные пользователя
                    cur.execute("DELETE FROM schedule WHERE user_id = %s", (user['id'],))
                    cur.execute("DELETE FROM tasks WHERE user_id = %s", (user['id'],))
                    cur.execute("DELETE FROM users WHERE id = %s", (user['id'],))
                    conn.commit()

                    print(f"[AUTH] Аккаунт удалён: {user['email']}, id={user['id']}")
                    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'Аккаунт успешно удалён'})}
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
            grade = body.get('grade', None)
            goal = body.get('goal', None)
            exam_type = body.get('exam_type', None)
            exam_subject = body.get('exam_subject', None)
            exam_date = body.get('exam_date', None)
            onboarding_completed = body.get('onboarding_completed', None)
            
            conn = get_db_connection()
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("""
                        UPDATE users 
                        SET full_name = %s, university = %s, faculty = %s, course = %s,
                            grade = COALESCE(%s, grade),
                            goal = COALESCE(%s, goal),
                            exam_type = COALESCE(%s, exam_type),
                            exam_subject = COALESCE(%s, exam_subject),
                            exam_date = COALESCE(%s::date, exam_date),
                            onboarding_completed = CASE WHEN %s IS NOT NULL THEN %s ELSE onboarding_completed END,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                        RETURNING id, email, full_name, university, faculty, course,
                                  grade, goal, exam_type, exam_subject, exam_date, onboarding_completed
                    """, (full_name, university, faculty, course,
                          grade, goal, exam_type, exam_subject, exam_date,
                          onboarding_completed, onboarding_completed,
                          payload['user_id']))
                    
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
                                'course': user['course'],
                                'grade': user['grade'],
                                'goal': user['goal'],
                                'exam_type': user['exam_type'],
                                'exam_subject': user['exam_subject'],
                                'exam_date': user['exam_date'].isoformat() if user['exam_date'] else None,
                                'onboarding_completed': user['onboarding_completed']
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
                           subscription_type, subscription_expires_at,
                           onboarding_completed, grade, goal, exam_type, exam_subject,
                           exam_date
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
                            'subscription_expires_at': user['subscription_expires_at'].isoformat() if user['subscription_expires_at'] else None,
                            'onboarding_completed': user['onboarding_completed'],
                            'grade': user['grade'],
                            'goal': user['goal'],
                            'exam_type': user['exam_type'],
                            'exam_subject': user['exam_subject'],
                            'exam_date': user['exam_date'].isoformat() if user['exam_date'] else None
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