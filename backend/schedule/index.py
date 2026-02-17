"""API для расписания и задач студента"""

import json
import os
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
from rate_limiter import check_rate_limit, get_client_ip
from security_validator import check_ownership, validate_string_field, validate_integer_field


def get_db_connection():
    """Создаёт подключение к PostgreSQL базе данных"""
    dsn = os.environ['DATABASE_URL']
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(dsn, options=f'-c search_path={schema}')
    return conn


def verify_token(token: str) -> dict:
    """Проверяет JWT токен и возвращает payload"""
    secret = os.environ['JWT_SECRET']
    try:
        return jwt.decode(token, secret, algorithms=['HS256'])
    except:
        return None


def handler(event: dict, context) -> dict:
    """Обработчик запросов для расписания и задач"""
    method = event.get('httpMethod', 'GET')
    client_ip = get_client_ip(event)
    
    # Rate limiting
    is_allowed, remaining, retry_after = check_rate_limit(f"{client_ip}_schedule", max_requests=120, window_seconds=60)
    if not is_allowed:
        return {
            'statusCode': 429,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': 'Слишком много запросов', 'retry_after': retry_after})
        }
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
            },
            'body': ''
        }
    
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }
    
    hdrs = event.get('headers', {})
    auth_header = hdrs.get('X-Authorization') or hdrs.get('x-authorization') or hdrs.get('Authorization') or hdrs.get('authorization') or ''
    token = auth_header.replace('Bearer ', '')
    
    if not token:
        return {
            'statusCode': 401,
            'headers': headers,
            'body': json.dumps({'error': 'Требуется авторизация'})
        }
    
    payload = verify_token(token)
    if not payload:
        return {
            'statusCode': 401,
            'headers': headers,
            'body': json.dumps({'error': 'Недействительный токен'})
        }
    
    user_id = payload['user_id']
    path = event.get('queryStringParameters', {}).get('path', '')
    
    conn = get_db_connection()
    
    try:
        # GET /schedule - Получить расписание
        if method == 'GET' and path == 'schedule':
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, subject, type, start_time, end_time, day_of_week, room, teacher, color
                    FROM schedule
                    WHERE user_id = %s
                    ORDER BY day_of_week, start_time
                """, (user_id,))
                
                schedule = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'schedule': [dict(s) for s in schedule]}, default=str)
                }
        
        # POST /schedule - Добавить занятие
        elif method == 'POST' and path == 'schedule':
            body = json.loads(event.get('body', '{}'))
            
            # Проверяем лимит для Free пользователей
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT subscription_type, subscription_expires_at, trial_ends_at, is_trial_used
                    FROM users WHERE id = %s
                """, (user_id,))
                user = cur.fetchone()
                
                is_premium = False
                if user and user['subscription_type'] == 'premium':
                    expires = user.get('subscription_expires_at')
                    if expires and expires.replace(tzinfo=None) > datetime.now():
                        is_premium = True
                
                # Проверяем триал
                is_trial = False
                if not is_premium and user:
                    trial_ends = user.get('trial_ends_at')
                    if trial_ends and not user.get('is_trial_used'):
                        if trial_ends.replace(tzinfo=None) > datetime.now():
                            is_trial = True
                
                # Для Free проверяем лимит в 7 занятий
                if not is_premium and not is_trial:
                    cur.execute("SELECT COUNT(*) as count FROM schedule WHERE user_id = %s", (user_id,))
                    schedule_count = cur.fetchone()['count']
                    if schedule_count >= 7:
                        return {
                            'statusCode': 403,
                            'headers': headers,
                            'body': json.dumps({'error': 'quota_exceeded', 'message': '📚 Достигнут лимит занятий (7/7). Перейдите на Premium для безлимитного расписания'})
                        }
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO schedule (user_id, subject, type, start_time, end_time, day_of_week, room, teacher, color)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id, subject, type, start_time, end_time, day_of_week, room, teacher, color
                """, (
                    user_id,
                    body.get('subject'),
                    body.get('type'),
                    body.get('start_time'),
                    body.get('end_time'),
                    body.get('day_of_week'),
                    body.get('room'),
                    body.get('teacher'),
                    body.get('color', 'bg-purple-500')
                ))
                
                lesson = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': headers,
                    'body': json.dumps({'lesson': dict(lesson)}, default=str)
                }
        
        # DELETE /schedule - Удалить занятие
        elif method == 'DELETE' and path == 'schedule':
            lesson_id = event.get('queryStringParameters', {}).get('id')
            
            # ЗАЩИТА ОТ IDOR
            if not check_ownership(conn, 'schedule', int(lesson_id), user_id):
                return {
                    'statusCode': 403,
                    'headers': headers,
                    'body': json.dumps({'error': 'Доступ запрещен'})
                }
            
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM schedule
                    WHERE id = %s AND user_id = %s
                """, (lesson_id, user_id))
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'message': 'Занятие удалено'})
                }
        
        # GET /tasks - Получить задачи
        elif method == 'GET' and path == 'tasks':
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, title, description, subject, deadline, priority, completed, created_at
                    FROM tasks
                    WHERE user_id = %s
                    ORDER BY completed ASC, deadline ASC NULLS LAST, created_at DESC
                """, (user_id,))
                
                tasks = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'tasks': [dict(t) for t in tasks]}, default=str)
                }
        
        # POST /tasks - Создать задачу
        elif method == 'POST' and path == 'tasks':
            body = json.loads(event.get('body', '{}'))
            
            # Проверяем лимит для Free пользователей
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT subscription_type, subscription_expires_at, trial_ends_at, is_trial_used
                    FROM users WHERE id = %s
                """, (user_id,))
                user = cur.fetchone()
                
                is_premium = False
                if user and user['subscription_type'] == 'premium':
                    expires = user.get('subscription_expires_at')
                    if expires and expires.replace(tzinfo=None) > datetime.now():
                        is_premium = True
                
                # Проверяем триал
                is_trial = False
                if not is_premium and user:
                    trial_ends = user.get('trial_ends_at')
                    if trial_ends and not user.get('is_trial_used'):
                        if trial_ends.replace(tzinfo=None) > datetime.now():
                            is_trial = True
                
                # Для Free проверяем лимит в 10 активных задач
                if not is_premium and not is_trial:
                    cur.execute("SELECT COUNT(*) as count FROM tasks WHERE user_id = %s AND completed = false", (user_id,))
                    tasks_count = cur.fetchone()['count']
                    if tasks_count >= 10:
                        return {
                            'statusCode': 403,
                            'headers': headers,
                            'body': json.dumps({'error': 'quota_exceeded', 'message': '✅ Достигнут лимит задач (10/10). Перейдите на Premium для безлимитных задач'})
                        }
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO tasks (user_id, title, description, subject, deadline, priority)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, title, description, subject, deadline, priority, completed, created_at
                """, (
                    user_id,
                    body.get('title'),
                    body.get('description'),
                    body.get('subject'),
                    body.get('deadline'),
                    body.get('priority', 'medium')
                ))
                
                task = cur.fetchone()
                
                # Планируем уведомления, если есть deadline
                if task['deadline']:
                    from datetime import datetime, timedelta
                    deadline_dt = task['deadline']
                    
                    # За 1 час
                    one_hour_before = deadline_dt - timedelta(hours=1)
                    if one_hour_before > datetime.now():
                        cur.execute("""
                            INSERT INTO task_notifications (user_id, task_id, notification_type, notification_time)
                            VALUES (%s, %s, '1hour', %s)
                        """, (user_id, task['id'], one_hour_before))
                    
                    # За 1 день
                    one_day_before = deadline_dt - timedelta(days=1)
                    if one_day_before > datetime.now():
                        cur.execute("""
                            INSERT INTO task_notifications (user_id, task_id, notification_type, notification_time)
                            VALUES (%s, %s, '1day', %s)
                        """, (user_id, task['id'], one_day_before))
                    
                    # За 3 дня
                    three_days_before = deadline_dt - timedelta(days=3)
                    if three_days_before > datetime.now():
                        cur.execute("""
                            INSERT INTO task_notifications (user_id, task_id, notification_type, notification_time)
                            VALUES (%s, %s, '3days', %s)
                        """, (user_id, task['id'], three_days_before))
                
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': headers,
                    'body': json.dumps({'task': dict(task)}, default=str)
                }
        
        # PUT /tasks - Обновить задачу
        elif method == 'PUT' and path == 'tasks':
            body = json.loads(event.get('body', '{}'))
            task_id = body.get('id')
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    UPDATE tasks
                    SET title = %s, description = %s, subject = %s, deadline = %s, 
                        priority = %s, completed = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s AND user_id = %s
                    RETURNING id, title, description, subject, deadline, priority, completed, created_at
                """, (
                    body.get('title'),
                    body.get('description'),
                    body.get('subject'),
                    body.get('deadline'),
                    body.get('priority'),
                    body.get('completed'),
                    task_id,
                    user_id
                ))
                
                task = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'task': dict(task)}, default=str)
                }
        
        # DELETE /tasks - Удалить задачу
        elif method == 'DELETE' and path == 'tasks':
            task_id = event.get('queryStringParameters', {}).get('id')
            
            # ЗАЩИТА ОТ IDOR
            if not check_ownership(conn, 'tasks', int(task_id), user_id):
                return {
                    'statusCode': 403,
                    'headers': headers,
                    'body': json.dumps({'error': 'Доступ запрещен'})
                }
            
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM tasks
                    WHERE id = %s AND user_id = %s
                """, (task_id, user_id))
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'message': 'Задача удалена'})
                }
        
        # GET /pomodoro-stats - Получить статистику помодоро
        elif method == 'GET' and path == 'pomodoro-stats':
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, subject, duration, completed_at
                    FROM pomodoro_sessions
                    WHERE user_id = %s
                    ORDER BY completed_at DESC
                    LIMIT 100
                """, (user_id,))
                
                sessions = cur.fetchall()
                
                total_sessions = len(sessions)
                total_minutes = sum(s['duration'] for s in sessions)
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'sessions': [dict(s) for s in sessions],
                        'total_sessions': total_sessions,
                        'total_minutes': total_minutes
                    }, default=str)
                }
        
        # POST /pomodoro-session - Сохранить сессию помодоро
        elif method == 'POST' and path == 'pomodoro-session':
            body = json.loads(event.get('body', '{}'))
            subject = body.get('subject', '')
            duration = body.get('duration', 25)
            
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO pomodoro_sessions (user_id, subject, duration, completed_at)
                    VALUES (%s, %s, %s, NOW())
                """, (user_id, subject, duration))
                
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': headers,
                    'body': json.dumps({'success': True})
                }
        
        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Маршрут не найден'})
        }
        
    finally:
        conn.close()