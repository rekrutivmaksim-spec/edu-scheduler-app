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
        elif method == 'POST' and path == 'auto-tasks':
            return generate_auto_tasks(conn, user_id, headers)
        elif method == 'GET' and path == 'suggestions':
            return get_suggestions(conn, user_id, headers)
        elif method == 'POST' and path == 'suggestion-action':
            body = json.loads(event.get('body', '{}'))
            return handle_suggestion_action(conn, user_id, body, headers)
        elif method == 'GET' and path == 'dashboard':
            return get_dashboard(conn, user_id, headers)
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
    duration = int(body.get('duration', 25))
    task_id = body.get('task_id')

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO pomodoro_sessions (user_id, subject, duration, task_id)
            VALUES (%s, %s, %s, %s)
            RETURNING id
        """, (user_id, subject, duration, task_id))
        session = cur.fetchone()

        # Обновляем daily_activity — нужно для достижений и квестов по помодоро
        today = datetime.now().date()
        cur.execute("""
            INSERT INTO daily_activity (user_id, activity_date, pomodoro_minutes)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, activity_date)
            DO UPDATE SET pomodoro_minutes = daily_activity.pomodoro_minutes + %s
        """, (user_id, today, duration, duration))

        # XP за помодоро: 1 XP за минуту
        xp_gained = duration
        cur.execute("""
            UPDATE daily_activity SET xp_earned = xp_earned + %s
            WHERE user_id = %s AND activity_date = %s
        """, (xp_gained, user_id, today))
        cur.execute("""
            UPDATE users SET xp_total = xp_total + %s WHERE id = %s
        """, (xp_gained, user_id))

        conn.commit()
        return {
            'statusCode': 201,
            'headers': headers,
            'body': json.dumps({
                'message': 'Сессия сохранена',
                'session_id': session['id'],
                'xp_gained': xp_gained
            })
        }


def generate_auto_tasks(conn, user_id, headers):
    """Генерация подготовительных задач из расписания (экзамены, дедлайны)"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT id, subject, type, day_of_week, start_time
            FROM schedule WHERE user_id = %s
        """, (user_id,))
        lessons = cur.fetchall()

        cur.execute("""
            SELECT id, title, subject, deadline
            FROM tasks WHERE user_id = %s AND completed = false AND deadline IS NOT NULL
            ORDER BY deadline ASC
        """, (user_id,))
        existing_tasks = cur.fetchall()

        cur.execute("""
            SELECT subject FROM tasks
            WHERE user_id = %s AND auto_generated = true AND created_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
        """, (user_id,))
        recent_auto = set(r['subject'] for r in cur.fetchall() if r['subject'])

        created = []
        now = datetime.now()
        today_dow = now.weekday()

        for task in existing_tasks:
            if not task['deadline']:
                continue
            deadline = task['deadline']
            if isinstance(deadline, str):
                deadline = datetime.fromisoformat(deadline)
            days_left = (deadline - now).days

            if days_left <= 7 and days_left > 0:
                subj = task['subject'] or task['title']
                auto_key = f"prep_{task['id']}"
                if auto_key in recent_auto:
                    continue

                if days_left <= 1:
                    prep_title = f"Финальная подготовка: {task['title']}"
                    priority = 'high'
                elif days_left <= 3:
                    prep_title = f"Подготовка к дедлайну: {task['title']}"
                    priority = 'high'
                else:
                    prep_title = f"Начать подготовку: {task['title']}"
                    priority = 'medium'

                prep_deadline = deadline - timedelta(days=max(1, days_left // 2))
                cur.execute("""
                    INSERT INTO tasks (user_id, title, subject, deadline, priority, auto_generated, source_type, source_id)
                    VALUES (%s, %s, %s, %s, %s, true, 'task', %s)
                    RETURNING id, title, subject, deadline, priority
                """, (user_id, prep_title, task['subject'], prep_deadline, priority, task['id']))
                new_task = cur.fetchone()
                if new_task:
                    created.append(dict(new_task))

        for lesson in lessons:
            if lesson['type'] in ('экзамен', 'exam', 'зачёт', 'зачет', 'zachet'):
                subj = lesson['subject']
                if subj in recent_auto:
                    continue

                days_until = (lesson['day_of_week'] - today_dow) % 7
                if days_until == 0:
                    days_until = 7

                if days_until <= 7:
                    exam_date = now + timedelta(days=days_until)
                    prep_tasks = [
                        (f"Повторить билеты по {subj}", exam_date - timedelta(days=min(3, days_until)), 'high'),
                        (f"Просмотреть конспекты по {subj}", exam_date - timedelta(days=min(5, days_until)), 'medium'),
                    ]
                    for title, deadline, priority in prep_tasks:
                        cur.execute("""
                            INSERT INTO tasks (user_id, title, subject, deadline, priority, auto_generated, source_type, source_id)
                            VALUES (%s, %s, %s, %s, %s, true, 'schedule', %s)
                            RETURNING id, title, subject, deadline, priority
                        """, (user_id, title, subj, deadline, priority, lesson['id']))
                        new_task = cur.fetchone()
                        if new_task:
                            created.append(dict(new_task))

        conn.commit()
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'created': [dict(t) for t in created], 'count': len(created)}, default=str)
        }


def get_suggestions(conn, user_id, headers):
    """Получить умные подсказки для пользователя"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        suggestions = []
        now = datetime.now()
        today_dow = now.weekday()

        cur.execute("""
            SELECT subject, type, start_time, day_of_week FROM schedule
            WHERE user_id = %s ORDER BY day_of_week, start_time
        """, (user_id,))
        lessons = cur.fetchall()

        cur.execute("""
            SELECT id, title, subject, deadline, priority, completed FROM tasks
            WHERE user_id = %s AND completed = false
            ORDER BY deadline ASC NULLS LAST
        """, (user_id,))
        active_tasks = cur.fetchall()

        cur.execute("""
            SELECT subject, SUM(duration) as total_min, COUNT(*) as sessions
            FROM pomodoro_sessions WHERE user_id = %s
            AND completed_at > CURRENT_TIMESTAMP - INTERVAL '14 days'
            GROUP BY subject ORDER BY total_min DESC
        """, (user_id,))
        pomodoro_stats = cur.fetchall()

        try:
            cur.execute("""
                SELECT gs.name as subject_name, g.grade as grade_value
                FROM grades g JOIN grade_subjects gs ON g.subject_id = gs.id
                WHERE gs.user_id = %s ORDER BY g.created_at DESC
            """, (user_id,))
            grades = cur.fetchall()
        except Exception:
            grades = []

        grade_map = {}
        for g in grades:
            if g['subject_name'] not in grade_map:
                grade_map[g['subject_name']] = []
            grade_map[g['subject_name']].append(g['grade_value'])

        pomodoro_map = {p['subject']: p for p in pomodoro_stats}
        studied_subjects = set(pomodoro_map.keys())

        all_subjects = set(l['subject'] for l in lessons)
        neglected = all_subjects - studied_subjects
        for subj in neglected:
            suggestions.append({
                'type': 'neglected_subject',
                'title': f'Ты давно не занимался «{subj}»',
                'description': f'Запусти помодорку по этому предмету',
                'action': 'start_pomodoro',
                'action_data': {'subject': subj},
                'priority': 5
            })

        for task in active_tasks:
            if not task['deadline']:
                continue
            deadline = task['deadline']
            if isinstance(deadline, str):
                deadline = datetime.fromisoformat(deadline)
            days_left = (deadline - now).days
            if days_left <= 2 and days_left >= 0:
                suggestions.append({
                    'type': 'urgent_deadline',
                    'title': f'До дедлайна «{task["title"]}» — {days_left} дн.',
                    'description': 'Начни подготовку прямо сейчас',
                    'action': 'focus_task',
                    'action_data': {'task_id': task['id'], 'subject': task.get('subject', '')},
                    'priority': 10
                })

        tomorrow_dow = (today_dow + 1) % 7
        tomorrow_lessons = [l for l in lessons if l['day_of_week'] == tomorrow_dow]
        for lesson in tomorrow_lessons:
            if lesson['type'] in ('экзамен', 'exam', 'зачёт', 'зачет', 'zachet'):
                suggestions.append({
                    'type': 'exam_tomorrow',
                    'title': f'Завтра {lesson["type"]} по «{lesson["subject"]}»',
                    'description': 'Сгенерировать краткий конспект?',
                    'action': 'generate_summary',
                    'action_data': {'subject': lesson['subject']},
                    'priority': 15
                })

        for subj, values in grade_map.items():
            avg = sum(v for v in values if v) / len([v for v in values if v]) if values else 0
            if avg < 3.5 and avg > 0:
                suggestions.append({
                    'type': 'low_grade',
                    'title': f'Низкий балл по «{subj}» ({avg:.1f})',
                    'description': 'Подтяни этот предмет — запусти помодорку',
                    'action': 'start_pomodoro',
                    'action_data': {'subject': subj},
                    'priority': 7
                })

        suggestions.sort(key=lambda s: -s.get('priority', 0))

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'suggestions': suggestions[:10]}, default=str)
        }


def handle_suggestion_action(conn, user_id, body, headers):
    action = body.get('action')
    data = body.get('data', {})

    if action == 'dismiss':
        suggestion_id = data.get('suggestion_id')
        if suggestion_id:
            with conn.cursor() as cur:
                cur.execute("UPDATE smart_suggestions SET is_dismissed = true WHERE id = %s AND user_id = %s",
                            (suggestion_id, user_id))
                conn.commit()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'success': True})}

    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'success': True})}


def get_dashboard(conn, user_id, headers):
    """Единый дашборд - состояние студента"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT full_name, xp_total, level, subscription_type, subscription_expires_at
            FROM users WHERE id = %s
        """, (user_id,))
        user = cur.fetchone()
        if not user:
            return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'User not found'})}

        cur.execute("""
            SELECT COUNT(*) as total, SUM(CASE WHEN completed THEN 1 ELSE 0 END) as done
            FROM tasks WHERE user_id = %s
        """, (user_id,))
        task_stats = cur.fetchone()

        cur.execute("""
            SELECT COUNT(*) as today_done FROM tasks
            WHERE user_id = %s AND completed = true
            AND updated_at::date = CURRENT_DATE
        """, (user_id,))
        today_tasks = cur.fetchone()

        cur.execute("""
            SELECT id, title, subject, deadline, priority FROM tasks
            WHERE user_id = %s AND completed = false
            ORDER BY CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                     deadline ASC NULLS LAST
            LIMIT 5
        """, (user_id,))
        upcoming_tasks = cur.fetchall()

        cur.execute("""
            SELECT COUNT(*) as sessions, COALESCE(SUM(duration), 0) as minutes
            FROM pomodoro_sessions
            WHERE user_id = %s AND completed_at::date = CURRENT_DATE
        """, (user_id,))
        today_pomodoro = cur.fetchone()

        cur.execute("""
            SELECT COALESCE(SUM(duration), 0) as total_minutes, COUNT(*) as total_sessions
            FROM pomodoro_sessions WHERE user_id = %s
        """, (user_id,))
        all_pomodoro = cur.fetchone()

        cur.execute("""
            SELECT completed_at::date as day, SUM(duration) as minutes
            FROM pomodoro_sessions
            WHERE user_id = %s AND completed_at > CURRENT_TIMESTAMP - INTERVAL '7 days'
            GROUP BY completed_at::date ORDER BY day
        """, (user_id,))
        week_focus = cur.fetchall()

        cur.execute("""
            SELECT current_streak, longest_streak, last_activity_date
            FROM user_streaks WHERE user_id = %s
        """, (user_id,))
        streak = cur.fetchone() or {'current_streak': 0, 'longest_streak': 0, 'last_activity_date': None}

        cur.execute("""
            SELECT COUNT(*) as unlocked FROM user_achievements WHERE user_id = %s
        """, (user_id,))
        ach_count = cur.fetchone()

        cur.execute("""
            SELECT a.code, a.title, a.icon, a.xp_reward, ua.unlocked_at
            FROM user_achievements ua JOIN achievements a ON ua.achievement_id = a.id
            WHERE ua.user_id = %s ORDER BY ua.unlocked_at DESC LIMIT 3
        """, (user_id,))
        recent_achievements = cur.fetchall()

        try:
            cur.execute("""
                SELECT gs.name as subject_name, AVG(g.grade) as avg_grade
                FROM grades g JOIN grade_subjects gs ON g.subject_id = gs.id
                WHERE gs.user_id = %s AND g.grade IS NOT NULL
                GROUP BY gs.name
            """, (user_id,))
            subject_grades = cur.fetchall()
        except Exception:
            subject_grades = []

        all_grades = [float(g['avg_grade']) for g in subject_grades if g['avg_grade']]
        gpa = sum(all_grades) / len(all_grades) if all_grades else 0

        scholarship_forecast = None
        if gpa >= 4.5:
            scholarship_forecast = 'Повышенная стипендия'
        elif gpa >= 4.0:
            scholarship_forecast = 'Обычная стипендия'
        elif gpa >= 3.0 and gpa > 0:
            scholarship_forecast = 'Без стипендии'

        xp = user['xp_total'] or 0
        level = user['level'] or 1
        xp_current_level = (level - 1) ** 2 * 50
        xp_next_level = level ** 2 * 50
        xp_progress = xp - xp_current_level
        xp_needed = xp_next_level - xp_current_level

        cur.execute("""
            SELECT subject, type, start_time, end_time, room, teacher
            FROM schedule WHERE user_id = %s AND day_of_week = %s
            ORDER BY start_time
        """, (user_id, datetime.now().weekday()))
        today_schedule = cur.fetchall()

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'user': {
                    'name': user['full_name'],
                    'level': level,
                    'xp_total': xp,
                    'xp_progress': xp_progress,
                    'xp_needed': xp_needed,
                    'is_premium': user['subscription_type'] == 'premium'
                },
                'gpa': round(gpa, 2) if gpa else None,
                'scholarship_forecast': scholarship_forecast,
                'streak': {
                    'current': streak['current_streak'],
                    'longest': streak['longest_streak']
                },
                'tasks': {
                    'total': task_stats['total'] or 0,
                    'completed': task_stats['done'] or 0,
                    'today_done': today_tasks['today_done'] or 0,
                    'upcoming': [dict(t) for t in upcoming_tasks]
                },
                'pomodoro': {
                    'today_sessions': today_pomodoro['sessions'] or 0,
                    'today_minutes': today_pomodoro['minutes'] or 0,
                    'total_minutes': all_pomodoro['total_minutes'] or 0,
                    'total_sessions': all_pomodoro['total_sessions'] or 0,
                    'week_chart': [{'day': str(d['day']), 'minutes': d['minutes']} for d in week_focus]
                },
                'achievements': {
                    'unlocked': ach_count['unlocked'] or 0,
                    'recent': [dict(a) for a in recent_achievements]
                },
                'today_schedule': [dict(s) for s in today_schedule],
                'subject_grades': [{'subject': g['subject_name'], 'avg': round(float(g['avg_grade']), 1)} for g in subject_grades]
            }, default=str)
        }