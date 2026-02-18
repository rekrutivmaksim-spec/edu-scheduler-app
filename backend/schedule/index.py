"""API для расписания, задач и помодоро студента"""

import json
import os
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
from rate_limiter import check_rate_limit, get_client_ip
from security_validator import check_ownership, validate_string_field, validate_integer_field


def get_db_connection():
    dsn = os.environ['DATABASE_URL']
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(dsn, options=f'-c search_path={schema}')
    return conn


def verify_token(token: str) -> dict:
    secret = os.environ['JWT_SECRET']
    try:
        return jwt.decode(token, secret, algorithms=['HS256'])
    except:
        return None


def check_premium(conn, user_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT subscription_type, subscription_expires_at, trial_ends_at, is_trial_used
            FROM users WHERE id = %s
        """, (user_id,))
        user = cur.fetchone()
        if not user:
            return False, False

        is_premium = False
        if user['subscription_type'] == 'premium':
            expires = user.get('subscription_expires_at')
            if expires and expires.replace(tzinfo=None) > datetime.now():
                is_premium = True

        is_trial = False
        if not is_premium:
            trial_ends = user.get('trial_ends_at')
            if trial_ends and not user.get('is_trial_used'):
                if trial_ends.replace(tzinfo=None) > datetime.now():
                    is_trial = True

        return is_premium, is_trial


def handler(event: dict, context) -> dict:
    """Обработчик запросов для расписания, задач и помодоро"""
    method = event.get('httpMethod', 'GET')
    client_ip = get_client_ip(event)

    is_allowed, remaining, retry_after = check_rate_limit(f"{client_ip}_schedule", max_requests=120, window_seconds=60)
    if not is_allowed:
        return {
            'statusCode': 429,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
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

    headers = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}

    auth_header = event.get('headers', {}).get('X-Authorization', '')
    token = auth_header.replace('Bearer ', '')

    if not token:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Требуется авторизация'})}

    payload = verify_token(token)
    if not payload:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Недействительный токен'})}

    user_id = payload['user_id']
    path = event.get('queryStringParameters', {}).get('path', '')

    conn = get_db_connection()

    try:
        if method == 'GET' and path == 'schedule':
            return get_schedule(conn, user_id, headers)
        elif method == 'POST' and path == 'schedule':
            body = json.loads(event.get('body', '{}'))
            return add_lesson(conn, user_id, body, headers)
        elif method == 'DELETE' and path == 'schedule':
            lesson_id = event.get('queryStringParameters', {}).get('id')
            return delete_lesson(conn, user_id, lesson_id, headers)
        elif method == 'GET' and path == 'tasks':
            return get_tasks(conn, user_id, headers)
        elif method == 'POST' and path == 'tasks':
            body = json.loads(event.get('body', '{}'))
            return add_task(conn, user_id, body, headers)
        elif method == 'PUT' and path == 'tasks':
            body = json.loads(event.get('body', '{}'))
            return update_task(conn, user_id, body, headers)
        elif method == 'DELETE' and path == 'tasks':
            task_id = event.get('queryStringParameters', {}).get('id')
            return delete_task(conn, user_id, task_id, headers)
        elif method == 'GET' and path == 'pomodoro-stats':
            return get_pomodoro_stats(conn, user_id, headers)
        elif method == 'POST' and path == 'pomodoro-session':
            body = json.loads(event.get('body', '{}'))
            return save_pomodoro_session(conn, user_id, body, headers)
        else:
            return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}
    finally:
        conn.close()


def get_schedule(conn, user_id, headers):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT id, subject, type, start_time, end_time, day_of_week, room, teacher, color, week_type
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


def add_lesson(conn, user_id, body, headers):
    is_premium, is_trial = check_premium(conn, user_id)

    if not is_premium and not is_trial:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) as count FROM schedule WHERE user_id = %s", (user_id,))
            if cur.fetchone()['count'] >= 7:
                return {
                    'statusCode': 403,
                    'headers': headers,
                    'body': json.dumps({'error': 'quota_exceeded', 'message': 'Достигнут лимит занятий (7/7). Перейдите на Premium для безлимитного расписания'})
                }

    week_type = body.get('week_type', 'every')
    if week_type not in ('every', 'even', 'odd'):
        week_type = 'every'

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO schedule (user_id, subject, type, start_time, end_time, day_of_week, room, teacher, color, week_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, subject, type, start_time, end_time, day_of_week, room, teacher, color, week_type
        """, (
            user_id,
            body.get('subject'),
            body.get('type'),
            body.get('start_time'),
            body.get('end_time'),
            body.get('day_of_week'),
            body.get('room'),
            body.get('teacher'),
            body.get('color', 'bg-purple-500'),
            week_type
        ))
        lesson = cur.fetchone()
        conn.commit()
        return {
            'statusCode': 201,
            'headers': headers,
            'body': json.dumps({'lesson': dict(lesson)}, default=str)
        }


def delete_lesson(conn, user_id, lesson_id, headers):
    if not check_ownership(conn, 'schedule', int(lesson_id), user_id):
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Доступ запрещен'})}

    with conn.cursor() as cur:
        cur.execute("DELETE FROM schedule WHERE id = %s AND user_id = %s", (lesson_id, user_id))
        conn.commit()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'Занятие удалено'})}


def get_tasks(conn, user_id, headers):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT id, title, description, subject, deadline, priority, completed, created_at,
                   recurrence, recurrence_day, parent_task_id
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


def add_task(conn, user_id, body, headers):
    is_premium, is_trial = check_premium(conn, user_id)

    if not is_premium and not is_trial:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT COUNT(*) as count FROM tasks WHERE user_id = %s AND completed = false", (user_id,))
            if cur.fetchone()['count'] >= 10:
                return {
                    'statusCode': 403,
                    'headers': headers,
                    'body': json.dumps({'error': 'quota_exceeded', 'message': 'Достигнут лимит задач (10/10). Перейдите на Premium для безлимитных задач'})
                }

    recurrence = body.get('recurrence')
    if recurrence and recurrence not in ('daily', 'weekly', 'biweekly', 'monthly'):
        recurrence = None
    recurrence_day = body.get('recurrence_day')

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO tasks (user_id, title, description, subject, deadline, priority, recurrence, recurrence_day)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, title, description, subject, deadline, priority, completed, created_at, recurrence, recurrence_day
        """, (
            user_id,
            body.get('title'),
            body.get('description'),
            body.get('subject'),
            body.get('deadline'),
            body.get('priority', 'medium'),
            recurrence,
            recurrence_day
        ))
        task = cur.fetchone()

        if task['deadline']:
            deadline_dt = task['deadline']
            for ntype, delta in [('1hour', timedelta(hours=1)), ('1day', timedelta(days=1)), ('3days', timedelta(days=3))]:
                notify_time = deadline_dt - delta
                if notify_time > datetime.now():
                    cur.execute("""
                        INSERT INTO task_notifications (user_id, task_id, notification_type, notification_time)
                        VALUES (%s, %s, %s, %s)
                    """, (user_id, task['id'], ntype, notify_time))

        conn.commit()
        return {
            'statusCode': 201,
            'headers': headers,
            'body': json.dumps({'task': dict(task)}, default=str)
        }


def update_task(conn, user_id, body, headers):
    task_id = body.get('id')

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            UPDATE tasks
            SET title = %s, description = %s, subject = %s, deadline = %s,
                priority = %s, completed = %s, updated_at = CURRENT_TIMESTAMP,
                recurrence = %s, recurrence_day = %s
            WHERE id = %s AND user_id = %s
            RETURNING id, title, description, subject, deadline, priority, completed, created_at, recurrence, recurrence_day
        """, (
            body.get('title'),
            body.get('description'),
            body.get('subject'),
            body.get('deadline'),
            body.get('priority'),
            body.get('completed'),
            body.get('recurrence'),
            body.get('recurrence_day'),
            task_id,
            user_id
        ))
        task = cur.fetchone()

        if task and task['completed'] and task.get('recurrence'):
            next_deadline = calc_next_deadline(task['deadline'], task['recurrence'], task.get('recurrence_day'))
            if next_deadline:
                cur.execute("""
                    INSERT INTO tasks (user_id, title, description, subject, deadline, priority, recurrence, recurrence_day, parent_task_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    user_id,
                    task['title'],
                    task['description'],
                    task['subject'],
                    next_deadline,
                    task['priority'],
                    task['recurrence'],
                    task.get('recurrence_day'),
                    task['id']
                ))

        conn.commit()
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'task': dict(task)}, default=str)
        }


def calc_next_deadline(current_deadline, recurrence, recurrence_day):
    if not current_deadline:
        return None
    dt = current_deadline if isinstance(current_deadline, datetime) else datetime.fromisoformat(str(current_deadline))

    if recurrence == 'daily':
        return dt + timedelta(days=1)
    elif recurrence == 'weekly':
        return dt + timedelta(weeks=1)
    elif recurrence == 'biweekly':
        return dt + timedelta(weeks=2)
    elif recurrence == 'monthly':
        month = dt.month + 1
        year = dt.year
        if month > 12:
            month = 1
            year += 1
        day = min(dt.day, 28)
        return dt.replace(year=year, month=month, day=day)
    return None


def delete_task(conn, user_id, task_id, headers):
    if not check_ownership(conn, 'tasks', int(task_id), user_id):
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Доступ запрещен'})}

    with conn.cursor() as cur:
        cur.execute("DELETE FROM tasks WHERE id = %s AND user_id = %s", (task_id, user_id))
        conn.commit()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'Задача удалена'})}


def get_pomodoro_stats(conn, user_id, headers):
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


def save_pomodoro_session(conn, user_id, body, headers):
    subject = body.get('subject', '')
    duration = body.get('duration', 25)

    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO pomodoro_sessions (user_id, subject, duration)
            VALUES (%s, %s, %s)
        """, (user_id, subject, duration))
        conn.commit()
        return {
            'statusCode': 201,
            'headers': headers,
            'body': json.dumps({'message': 'Сессия сохранена'})
        }
