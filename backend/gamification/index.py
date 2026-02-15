"""API геймификации: стрики, достижения, XP и уровни"""

import json
import os
import math
from datetime import datetime, date, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
from rate_limiter import check_rate_limit, get_client_ip


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


def calculate_level(xp: int) -> int:
    if xp <= 0:
        return 1
    return min(100, int(1 + math.sqrt(xp / 50)))


def xp_for_level(level: int) -> int:
    return (level - 1) ** 2 * 50


def record_activity(conn, user_id: int, activity_type: str, value: int = 1):
    """Записывает активность и обновляет стрик"""
    today = date.today()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        INSERT INTO daily_activity (user_id, activity_date, {col})
        VALUES (%s, %s, %s)
        ON CONFLICT (user_id, activity_date)
        DO UPDATE SET {col} = daily_activity.{col} + %s
        RETURNING *
    """.format(col=activity_type), (user_id, today, value, value))

    xp_map = {
        'tasks_completed': 15,
        'pomodoro_minutes': 1,
        'ai_questions_asked': 5,
        'materials_uploaded': 25,
        'schedule_views': 2
    }
    xp_gained = value * xp_map.get(activity_type, 5)

    cur.execute("""
        UPDATE daily_activity SET xp_earned = xp_earned + %s
        WHERE user_id = %s AND activity_date = %s
    """, (xp_gained, user_id, today))

    cur.execute("""
        INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date, total_active_days)
        VALUES (%s, 1, 1, %s, 1)
        ON CONFLICT (user_id)
        DO UPDATE SET
            current_streak = CASE
                WHEN user_streaks.last_activity_date = %s THEN user_streaks.current_streak
                WHEN user_streaks.last_activity_date = %s - 1 THEN user_streaks.current_streak + 1
                ELSE 1
            END,
            longest_streak = GREATEST(
                user_streaks.longest_streak,
                CASE
                    WHEN user_streaks.last_activity_date = %s THEN user_streaks.current_streak
                    WHEN user_streaks.last_activity_date = %s - 1 THEN user_streaks.current_streak + 1
                    ELSE 1
                END
            ),
            last_activity_date = %s,
            total_active_days = CASE
                WHEN user_streaks.last_activity_date = %s THEN user_streaks.total_active_days
                ELSE user_streaks.total_active_days + 1
            END,
            updated_at = CURRENT_TIMESTAMP
    """, (user_id, today, today, today, today, today, today, today))

    cur.execute("""
        UPDATE users SET xp_total = xp_total + %s WHERE id = %s RETURNING xp_total
    """, (xp_gained, user_id))
    row = cur.fetchone()
    new_xp = row['xp_total'] if row else 0
    new_level = calculate_level(new_xp)

    cur.execute("UPDATE users SET level = %s WHERE id = %s", (new_level, user_id))

    conn.commit()
    cur.close()

    return {'xp_gained': xp_gained, 'total_xp': new_xp, 'level': new_level}


def check_achievements(conn, user_id: int):
    """Проверяет и разблокирует новые достижения"""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT * FROM user_streaks WHERE user_id = %s", (user_id,))
    streak = cur.fetchone()

    cur.execute("""
        SELECT
            COALESCE(SUM(tasks_completed), 0) as total_tasks,
            COALESCE(SUM(pomodoro_minutes), 0) as total_pomodoro,
            COALESCE(SUM(ai_questions_asked), 0) as total_ai,
            COALESCE(SUM(materials_uploaded), 0) as total_materials
        FROM daily_activity WHERE user_id = %s
    """, (user_id,))
    totals = cur.fetchone()

    cur.execute("SELECT xp_total, level, referral_count FROM users WHERE id = %s", (user_id,))
    user = cur.fetchone()

    cur.execute("""
        SELECT achievement_id FROM user_achievements WHERE user_id = %s
    """, (user_id,))
    unlocked_ids = {r['achievement_id'] for r in cur.fetchall()}

    cur.execute("SELECT * FROM achievements ORDER BY sort_order")
    all_achievements = cur.fetchall()

    progress_map = {
        'streak_days': streak['current_streak'] if streak else 0,
        'tasks_completed': totals['total_tasks'],
        'pomodoro_minutes': totals['total_pomodoro'],
        'ai_questions': totals['total_ai'],
        'materials_uploaded': totals['total_materials'],
        'level_reached': user['level'] if user else 1,
        'referrals': user['referral_count'] if user else 0,
        'first_login': 1,
        'night_activity': 0,
        'morning_activity': 0,
    }

    now = datetime.now()
    if 0 <= now.hour < 5:
        progress_map['night_activity'] = 1
    if 5 <= now.hour < 7:
        progress_map['morning_activity'] = 1

    newly_unlocked = []

    for ach in all_achievements:
        if ach['id'] in unlocked_ids:
            continue

        req_type = ach['requirement_type']
        req_value = ach['requirement_value']
        current = progress_map.get(req_type, 0)

        if current >= req_value:
            cur.execute("""
                INSERT INTO user_achievements (user_id, achievement_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
            """, (user_id, ach['id']))

            if ach['xp_reward'] > 0:
                cur.execute("""
                    UPDATE users SET xp_total = xp_total + %s WHERE id = %s RETURNING xp_total
                """, (ach['xp_reward'], user_id))
                row = cur.fetchone()
                if row:
                    new_level = calculate_level(row['xp_total'])
                    cur.execute("UPDATE users SET level = %s WHERE id = %s", (new_level, user_id))

            newly_unlocked.append({
                'code': ach['code'],
                'title': ach['title'],
                'description': ach['description'],
                'icon': ach['icon'],
                'xp_reward': ach['xp_reward'],
                'category': ach['category']
            })

    conn.commit()
    cur.close()

    return newly_unlocked


def get_profile_data(conn, user_id: int):
    """Полный профиль геймификации"""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT xp_total, level, referral_count FROM users WHERE id = %s", (user_id,))
    user = cur.fetchone()
    if not user:
        cur.close()
        return None

    cur.execute("SELECT * FROM user_streaks WHERE user_id = %s", (user_id,))
    streak = cur.fetchone()

    cur.execute("""
        SELECT
            COALESCE(SUM(tasks_completed), 0) as total_tasks,
            COALESCE(SUM(pomodoro_minutes), 0) as total_pomodoro,
            COALESCE(SUM(ai_questions_asked), 0) as total_ai,
            COALESCE(SUM(materials_uploaded), 0) as total_materials,
            COALESCE(SUM(xp_earned), 0) as total_xp_earned
        FROM daily_activity WHERE user_id = %s
    """, (user_id,))
    totals = cur.fetchone()

    cur.execute("""
        SELECT a.*, ua.unlocked_at
        FROM user_achievements ua
        JOIN achievements a ON a.id = ua.achievement_id
        WHERE ua.user_id = %s
        ORDER BY ua.unlocked_at DESC
    """, (user_id,))
    unlocked = cur.fetchall()

    cur.execute("SELECT COUNT(*) as total FROM achievements")
    total_ach = cur.fetchone()['total']

    cur.execute("""
        SELECT activity_date, xp_earned, tasks_completed, pomodoro_minutes
        FROM daily_activity
        WHERE user_id = %s AND activity_date >= CURRENT_DATE - 30
        ORDER BY activity_date DESC
    """, (user_id,))
    recent_activity = cur.fetchall()

    cur.execute("SELECT * FROM achievements ORDER BY sort_order")
    all_achievements = cur.fetchall()

    cur.close()

    current_level = user['level']
    current_xp = user['xp_total']
    next_level_xp = xp_for_level(current_level + 1)
    current_level_xp = xp_for_level(current_level)
    xp_progress = current_xp - current_level_xp
    xp_needed = next_level_xp - current_level_xp

    progress_map = {
        'streak_days': streak['current_streak'] if streak else 0,
        'tasks_completed': totals['total_tasks'],
        'pomodoro_minutes': totals['total_pomodoro'],
        'ai_questions': totals['total_ai'],
        'materials_uploaded': totals['total_materials'],
        'level_reached': current_level,
        'referrals': user['referral_count'] or 0,
        'first_login': 1,
        'night_activity': 0,
        'morning_activity': 0,
    }

    unlocked_codes = {a['code'] for a in unlocked}
    all_ach_list = []
    for ach in all_achievements:
        req_type = ach['requirement_type']
        current_val = progress_map.get(req_type, 0)
        all_ach_list.append({
            'code': ach['code'],
            'title': ach['title'],
            'description': ach['description'],
            'icon': ach['icon'],
            'category': ach['category'],
            'xp_reward': ach['xp_reward'],
            'requirement_value': ach['requirement_value'],
            'current_progress': min(current_val, ach['requirement_value']),
            'is_unlocked': ach['code'] in unlocked_codes,
            'unlocked_at': None
        })

    for a in all_ach_list:
        for u in unlocked:
            if u['code'] == a['code']:
                a['unlocked_at'] = u['unlocked_at'].isoformat() if u['unlocked_at'] else None
                break

    activity_list = []
    for row in recent_activity:
        activity_list.append({
            'date': row['activity_date'].isoformat(),
            'xp': row['xp_earned'],
            'tasks': row['tasks_completed'],
            'pomodoro': row['pomodoro_minutes']
        })

    return {
        'level': current_level,
        'xp_total': current_xp,
        'xp_progress': xp_progress,
        'xp_needed': xp_needed,
        'streak': {
            'current': streak['current_streak'] if streak else 0,
            'longest': streak['longest_streak'] if streak else 0,
            'last_activity': streak['last_activity_date'].isoformat() if streak and streak['last_activity_date'] else None,
            'total_days': streak['total_active_days'] if streak else 0,
            'freeze_available': streak['streak_freeze_available'] if streak else 0
        },
        'stats': {
            'total_tasks': totals['total_tasks'],
            'total_pomodoro_minutes': totals['total_pomodoro'],
            'total_ai_questions': totals['total_ai'],
            'total_materials': totals['total_materials']
        },
        'achievements': all_ach_list,
        'achievements_unlocked': len(unlocked),
        'achievements_total': total_ach,
        'recent_activity': activity_list
    }


def handler(event: dict, context) -> dict:
    """Обработчик запросов геймификации: стрики, XP, достижения"""
    method = event.get('httpMethod', 'GET')
    client_ip = get_client_ip(event)

    is_allowed, remaining, retry_after = check_rate_limit(f"{client_ip}_gamification", max_requests=120, window_seconds=60)
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
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
            },
            'body': ''
        }

    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }

    auth_header = event.get('headers', {}).get('X-Authorization', '')
    token = auth_header.replace('Bearer ', '')
    if not token:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Требуется авторизация'})}

    payload = verify_token(token)
    if not payload:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Недействительный токен'})}

    user_id = payload.get('user_id')
    conn = get_db_connection()

    try:
        if method == 'GET':
            action = (event.get('queryStringParameters') or {}).get('action', 'profile')

            if action == 'profile':
                profile = get_profile_data(conn, user_id)
                if not profile:
                    return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Пользователь не найден'})}
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps(profile, default=str)}

            elif action == 'leaderboard':
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("""
                    SELECT u.id, u.full_name, u.university, u.level, u.xp_total,
                           COALESCE(us.current_streak, 0) as streak
                    FROM users u
                    LEFT JOIN user_streaks us ON us.user_id = u.id
                    WHERE u.is_guest = false
                    ORDER BY u.xp_total DESC
                    LIMIT 50
                """)
                leaders = cur.fetchall()
                cur.close()

                result = []
                for i, l in enumerate(leaders):
                    result.append({
                        'rank': i + 1,
                        'name': l['full_name'],
                        'university': l['university'],
                        'level': l['level'],
                        'xp': l['xp_total'],
                        'streak': l['streak'],
                        'is_me': l['id'] == user_id
                    })

                return {'statusCode': 200, 'headers': headers, 'body': json.dumps(result, default=str)}

            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Неизвестное действие'})}

        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action', '')

            if action == 'track':
                activity_type = body.get('type', '')
                value = min(int(body.get('value', 1)), 100)
                valid_types = ['tasks_completed', 'pomodoro_minutes', 'ai_questions_asked', 'materials_uploaded', 'schedule_views']
                if activity_type not in valid_types:
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Неверный тип активности'})}

                result = record_activity(conn, user_id, activity_type, value)
                new_achievements = check_achievements(conn, user_id)

                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'success': True,
                        'xp_gained': result['xp_gained'],
                        'total_xp': result['total_xp'],
                        'level': result['level'],
                        'new_achievements': new_achievements
                    })
                }

            elif action == 'checkin':
                result = record_activity(conn, user_id, 'schedule_views', 1)
                new_achievements = check_achievements(conn, user_id)
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("SELECT * FROM user_streaks WHERE user_id = %s", (user_id,))
                streak = cur.fetchone()
                cur.close()

                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'success': True,
                        'streak': {
                            'current': streak['current_streak'] if streak else 1,
                            'longest': streak['longest_streak'] if streak else 1
                        },
                        'xp_gained': result['xp_gained'],
                        'level': result['level'],
                        'new_achievements': new_achievements
                    })
                }

            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Неизвестное действие'})}

    except Exception as e:
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}
    finally:
        conn.close()
