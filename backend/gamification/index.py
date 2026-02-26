"""API геймификации: стрики, достижения, XP, уровни, квесты, награды за стрик"""

import json
import os
import math
import random
from datetime import datetime, date, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
from rate_limiter import check_rate_limit, get_client_ip
from pywebpush import webpush, WebPushException

VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_EMAIL = os.environ.get('VAPID_EMAIL', 'mailto:admin@studyfay.app')

STREAK_REWARDS = [
    {'streak_days': 3, 'reward_type': 'bonus_questions', 'value': 5, 'title': '3 дня подряд', 'description': '+5 вопросов к ИИ'},
    {'streak_days': 7, 'reward_type': 'bonus_questions', 'value': 10, 'title': 'Неделя стрика', 'description': '+10 вопросов к ИИ'},
    {'streak_days': 14, 'reward_type': 'bonus_questions', 'value': 20, 'title': '2 недели подряд', 'description': '+20 вопросов к ИИ'},
    {'streak_days': 21, 'reward_type': 'premium_days', 'value': 3, 'title': '3 недели стрика', 'description': '3 дня Premium бесплатно'},
    {'streak_days': 30, 'reward_type': 'premium_days', 'value': 7, 'title': 'Месяц стрика', 'description': '7 дней Premium бесплатно'},
    {'streak_days': 60, 'reward_type': 'premium_days', 'value': 14, 'title': '2 месяца стрика', 'description': '14 дней Premium бесплатно'},
    {'streak_days': 90, 'reward_type': 'premium_days', 'value': 30, 'title': '3 месяца стрика', 'description': '30 дней Premium бесплатно'},
    {'streak_days': 180, 'reward_type': 'premium_days', 'value': 60, 'title': 'Полгода стрика', 'description': '60 дней Premium бесплатно'},
    {'streak_days': 365, 'reward_type': 'premium_days', 'value': 180, 'title': 'Год стрика', 'description': '180 дней Premium бесплатно'},
]

QUEST_POOL = [
    {'type': 'complete_tasks', 'title': 'Выполни {n} задач', 'min': 1, 'max': 3, 'xp_min': 20, 'xp_max': 40, 'premium_only': False},
    {'type': 'pomodoro_session', 'title': 'Проведи {n} помодоро-сессий', 'min': 1, 'max': 2, 'xp_min': 25, 'xp_max': 40, 'premium_only': False},
    {'type': 'ask_ai', 'title': 'Задай {n} вопросов ИИ', 'min': 1, 'max': 2, 'xp_min': 20, 'xp_max': 35, 'premium_only': False},
    {'type': 'upload_material', 'title': 'Загрузи материал', 'min': 1, 'max': 1, 'xp_min': 30, 'xp_max': 50, 'premium_only': False},
    {'type': 'daily_checkin', 'title': 'Зайди в приложение', 'min': 1, 'max': 1, 'xp_min': 20, 'xp_max': 20, 'premium_only': False},
]

PREMIUM_QUEST = {
    'type': 'complete_all_quests', 'title': 'Выполни все квесты дня', 'target': 1, 'xp_reward': 100
}


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


def send_push(endpoint, p256dh, auth, notification_data):
    """Отправка push-уведомления через Web Push API"""
    try:
        webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {"p256dh": p256dh, "auth": auth}
            },
            data=json.dumps(notification_data),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_EMAIL}
        )
        return True
    except WebPushException:
        return False
    except Exception:
        return False


def check_user_premium(conn, user_id):
    """Проверяет, является ли пользователь Premium"""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT subscription_type, subscription_expires_at
        FROM users WHERE id = %s
    """, (user_id,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return False, None
    if row['subscription_type'] == 'premium' and row['subscription_expires_at']:
        if row['subscription_expires_at'] >= datetime.now():
            return True, row['subscription_expires_at']
    return False, row.get('subscription_expires_at')


def generate_daily_quests(conn, user_id, is_premium):
    """Генерирует ежедневные квесты. 3 для обычных, 5 для premium."""
    today = date.today()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id FROM daily_quests
        WHERE user_id = %s AND quest_date = %s
        LIMIT 1
    """, (user_id, today))
    existing = cur.fetchone()

    if existing:
        cur.close()
        return get_today_quests(conn, user_id)

    quest_count = 5 if is_premium else 3
    pool = list(QUEST_POOL)
    random.shuffle(pool)
    selected = pool[:quest_count]

    for q in selected:
        target = random.randint(q['min'], q['max'])
        xp_reward = random.randint(q['xp_min'], q['xp_max'])
        title = q['title'].format(n=target)
        cur.execute("""
            INSERT INTO daily_quests (user_id, quest_date, quest_type, quest_title, target_value, current_value, xp_reward, is_completed)
            VALUES (%s, %s, %s, %s, %s, 0, %s, false)
        """, (user_id, today, q['type'], title, target, xp_reward))

    if is_premium:
        cur.execute("""
            INSERT INTO daily_quests (user_id, quest_date, quest_type, quest_title, target_value, current_value, xp_reward, is_completed, is_premium_only)
            VALUES (%s, %s, %s, %s, %s, 0, %s, false, true)
        """, (user_id, today, PREMIUM_QUEST['type'], PREMIUM_QUEST['title'], PREMIUM_QUEST['target'], PREMIUM_QUEST['xp_reward']))

    conn.commit()
    cur.close()
    return get_today_quests(conn, user_id)


def get_today_quests(conn, user_id):
    """Возвращает квесты на сегодня"""
    today = date.today()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, quest_type, quest_title, target_value, current_value, xp_reward, is_completed, is_premium_only, completed_at
        FROM daily_quests
        WHERE user_id = %s AND quest_date = %s
        ORDER BY id
    """, (user_id, today))
    quests = cur.fetchall()
    cur.close()

    result = []
    for q in quests:
        result.append({
            'id': q['id'],
            'type': q['quest_type'],
            'title': q['quest_title'],
            'target': q['target_value'],
            'current': q['current_value'],
            'xp_reward': q['xp_reward'],
            'is_completed': q['is_completed'],
            'is_premium_only': q.get('is_premium_only', False),
            'completed_at': q['completed_at'].isoformat() if q['completed_at'] else None
        })
    return result


def update_quest_progress(conn, user_id, quest_type, value=1):
    """Обновляет прогресс квеста и возвращает информацию о завершении"""
    today = date.today()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT id, target_value, current_value, xp_reward, is_completed
        FROM daily_quests
        WHERE user_id = %s AND quest_date = %s AND quest_type = %s AND is_completed = false
        LIMIT 1
    """, (user_id, today, quest_type))
    quest = cur.fetchone()

    if not quest:
        cur.close()
        return {'quest_completed': False, 'xp_gained': 0}

    new_value = min(quest['current_value'] + value, quest['target_value'])
    completed = new_value >= quest['target_value']
    xp_gained = 0

    if completed:
        cur.execute("""
            UPDATE daily_quests
            SET current_value = %s, is_completed = true, completed_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (new_value, quest['id']))
        xp_gained = quest['xp_reward']

        cur.execute("""
            UPDATE users SET xp_total = xp_total + %s WHERE id = %s RETURNING xp_total
        """, (xp_gained, user_id))
        row = cur.fetchone()
        if row:
            new_level = calculate_level(row['xp_total'])
            cur.execute("UPDATE users SET level = %s WHERE id = %s", (new_level, user_id))

        check_complete_all_quest(conn, cur, user_id)
    else:
        cur.execute("""
            UPDATE daily_quests SET current_value = %s WHERE id = %s
        """, (new_value, quest['id']))

    conn.commit()
    cur.close()
    return {'quest_completed': completed, 'xp_gained': xp_gained}


def check_complete_all_quest(conn, cur, user_id):
    """Проверяет, выполнены ли все обычные квесты, и завершает квест complete_all_quests"""
    today = date.today()

    cur.execute("""
        SELECT COUNT(*) as total, SUM(CASE WHEN is_completed THEN 1 ELSE 0 END) as done
        FROM daily_quests
        WHERE user_id = %s AND quest_date = %s AND quest_type != 'complete_all_quests'
    """, (user_id, today))
    row = cur.fetchone()

    if not row or row['total'] == 0:
        return

    if row['done'] >= row['total']:
        cur.execute("""
            SELECT id, xp_reward, is_completed FROM daily_quests
            WHERE user_id = %s AND quest_date = %s AND quest_type = 'complete_all_quests' AND is_completed = false
            LIMIT 1
        """, (user_id, today))
        all_quest = cur.fetchone()
        if all_quest:
            cur.execute("""
                UPDATE daily_quests
                SET current_value = target_value, is_completed = true, completed_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (all_quest['id'],))

            cur.execute("""
                UPDATE users SET xp_total = xp_total + %s WHERE id = %s RETURNING xp_total
            """, (all_quest['xp_reward'], user_id))
            u = cur.fetchone()
            if u:
                new_level = calculate_level(u['xp_total'])
                cur.execute("UPDATE users SET level = %s WHERE id = %s", (new_level, user_id))


def record_activity(conn, user_id: int, activity_type: str, value: int = 1):
    """Записывает активность, обновляет стрик и прогресс ежедневных квестов"""
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
        'schedule_views': 2,
        'exam_tasks_done': 10
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

    quest_type_map = {
        'tasks_completed': 'complete_tasks',
        'pomodoro_minutes': 'pomodoro_session',
        'ai_questions_asked': 'ask_ai',
        'materials_uploaded': 'upload_material',
        'schedule_views': 'daily_checkin'
    }
    mapped_quest = quest_type_map.get(activity_type)
    if mapped_quest:
        update_quest_progress(conn, user_id, mapped_quest, value)

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
            COALESCE(SUM(materials_uploaded), 0) as total_materials,
            COALESCE(SUM(exam_tasks_done), 0) as total_exam_tasks
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
        'exam_tasks_done': totals['total_exam_tasks'],
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


def get_streak_rewards_data(conn, user_id):
    """Возвращает награды за стрик с информацией о том, какие забраны"""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT * FROM user_streaks WHERE user_id = %s", (user_id,))
    streak = cur.fetchone()
    longest = streak['longest_streak'] if streak else 0

    cur.execute("""
        SELECT streak_days FROM streak_reward_claims WHERE user_id = %s
    """, (user_id,))
    claimed_set = {r['streak_days'] for r in cur.fetchall()}
    cur.close()

    result = []
    for reward in STREAK_REWARDS:
        result.append({
            'streak_days': reward['streak_days'],
            'reward_type': reward['reward_type'],
            'value': reward['value'],
            'title': reward['title'],
            'description': reward['description'],
            'is_available': longest >= reward['streak_days'],
            'is_claimed': reward['streak_days'] in claimed_set
        })
    return result


def get_profile_data(conn, user_id: int):
    """Полный профиль геймификации"""
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT xp_total, level, referral_count, subscription_type, subscription_expires_at FROM users WHERE id = %s", (user_id,))
    user = cur.fetchone()
    if not user:
        cur.close()
        return None

    is_premium = False
    if user['subscription_type'] == 'premium' and user['subscription_expires_at']:
        if user['subscription_expires_at'] >= datetime.now():
            is_premium = True

    cur.execute("SELECT * FROM user_streaks WHERE user_id = %s", (user_id,))
    streak = cur.fetchone()

    cur.execute("""
        SELECT
            COALESCE(SUM(tasks_completed), 0) as total_tasks,
            COALESCE(SUM(pomodoro_minutes), 0) as total_pomodoro,
            COALESCE(SUM(ai_questions_asked), 0) as total_ai,
            COALESCE(SUM(materials_uploaded), 0) as total_materials,
            COALESCE(SUM(xp_earned), 0) as total_xp_earned,
            COALESCE(SUM(exam_tasks_done), 0) as total_exam_tasks
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

    daily_quests = generate_daily_quests(conn, user_id, is_premium)
    streak_rewards = get_streak_rewards_data(conn, user_id)

    return {
        'level': current_level,
        'xp_total': current_xp,
        'xp_progress': xp_progress,
        'xp_needed': xp_needed,
        'is_premium': is_premium,
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
            'total_materials': totals['total_materials'],
            'total_exam_tasks': totals['total_exam_tasks'],
            'tutor_savings': int(totals['total_exam_tasks']) * 250
        },
        'achievements': all_ach_list,
        'achievements_unlocked': len(unlocked),
        'achievements_total': total_ach,
        'recent_activity': activity_list,
        'daily_quests': daily_quests,
        'streak_rewards': streak_rewards
    }


def handle_streak_reminders(conn):
    """Находит пользователей с риском потерять стрик и отправляет push-уведомления"""
    yesterday = date.today() - timedelta(days=1)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT us.user_id, us.current_streak, ps.endpoint, ps.p256dh, ps.auth
        FROM user_streaks us
        JOIN push_subscriptions ps ON ps.user_id = us.user_id
        JOIN notification_settings ns ON ns.user_id = us.user_id
        WHERE us.last_activity_date = %s
          AND us.current_streak >= 3
          AND ps.endpoint IS NOT NULL
          AND ns.streak_reminder = true
    """, (yesterday,))

    users = cur.fetchall()
    sent_count = 0

    for u in users:
        notification_data = {
            'title': '\U0001f525 \u041d\u0435 \u043f\u043e\u0442\u0435\u0440\u044f\u0439 \u0441\u0442\u0440\u0438\u043a!',
            'body': f'\u0422\u0432\u043e\u044f \u0441\u0435\u0440\u0438\u044f {u["current_streak"]} \u0434\u043d\u0435\u0439 \u0432 \u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u0438! \u0417\u0430\u0439\u0434\u0438 \u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0438 \u0441\u0442\u0440\u0438\u043a',
            'tag': f'streak-danger-{u["user_id"]}',
            'url': '/'
        }
        ok = send_push(u['endpoint'], u['p256dh'], u['auth'], notification_data)
        if ok:
            sent_count += 1

    cur.close()
    return {'sent': sent_count, 'total_users': len(users)}


def handler(event: dict, context) -> dict:
    """Обработчик запросов геймификации: стрики, XP, достижения, квесты, награды за стрик и push-уведомления"""
    method = event.get('httpMethod', 'GET')
    client_ip = get_client_ip(event)

    is_allowed, remaining, retry_after = check_rate_limit(f"{client_ip}_gamification", max_requests=120, window_seconds=60)
    if not is_allowed:
        return {
            'statusCode': 429,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u043e\u0432', 'retry_after': retry_after})
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

    # Check for cron actions that don't need auth
    if method == 'POST':
        try:
            body_raw = json.loads(event.get('body', '{}'))
        except:
            body_raw = {}
        if body_raw.get('action') == 'send_streak_reminders':
            conn = get_db_connection()
            try:
                result = handle_streak_reminders(conn)
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True, **result})
                }
            except Exception as e:
                return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}
            finally:
                conn.close()

    auth_header = event.get('headers', {}).get('X-Authorization', '')
    token = auth_header.replace('Bearer ', '')
    if not token:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': '\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u0430\u0432\u0442\u043e\u0440\u0438\u0437\u0430\u0446\u0438\u044f'})}

    payload = verify_token(token)
    if not payload:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': '\u041d\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u044c\u043d\u044b\u0439 \u0442\u043e\u043a\u0435\u043d'})}

    user_id = payload.get('user_id')
    conn = get_db_connection()

    try:
        if method == 'GET':
            action = (event.get('queryStringParameters') or {}).get('action', 'profile')

            if action == 'profile':
                profile = get_profile_data(conn, user_id)
                if not profile:
                    return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d'})}
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps(profile, default=str)}

            elif action == 'leaderboard':
                period = (event.get('queryStringParameters') or {}).get('period', 'all')
                cur = conn.cursor(cursor_factory=RealDictCursor)

                if period == 'today':
                    cur.execute("""
                        SELECT u.id, u.full_name, u.university, u.level, u.xp_total,
                               u.subscription_type,
                               COALESCE(us.current_streak, 0) as streak,
                               COALESCE(da.xp_earned, 0) as xp_period
                        FROM users u
                        LEFT JOIN user_streaks us ON us.user_id = u.id
                        LEFT JOIN daily_activity da ON da.user_id = u.id AND da.activity_date = CURRENT_DATE
                        WHERE u.is_guest = false AND COALESCE(da.xp_earned, 0) > 0
                        ORDER BY xp_period DESC
                        LIMIT 50
                    """)
                elif period == 'week':
                    cur.execute("""
                        SELECT u.id, u.full_name, u.university, u.level, u.xp_total,
                               u.subscription_type,
                               COALESCE(us.current_streak, 0) as streak,
                               COALESCE(SUM(da.xp_earned), 0) as xp_period
                        FROM users u
                        LEFT JOIN user_streaks us ON us.user_id = u.id
                        LEFT JOIN daily_activity da ON da.user_id = u.id
                            AND da.activity_date >= DATE_TRUNC('week', CURRENT_DATE)
                        WHERE u.is_guest = false
                        GROUP BY u.id, u.full_name, u.university, u.level, u.xp_total,
                                 u.subscription_type, us.current_streak
                        HAVING COALESCE(SUM(da.xp_earned), 0) > 0
                        ORDER BY xp_period DESC
                        LIMIT 50
                    """)
                else:
                    cur.execute("""
                        SELECT u.id, u.full_name, u.university, u.level, u.xp_total,
                               u.subscription_type,
                               COALESCE(us.current_streak, 0) as streak,
                               u.xp_total as xp_period
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
                        'xp': int(l['xp_period']),
                        'xp_total': l['xp_total'],
                        'streak': l['streak'],
                        'is_me': l['id'] == user_id,
                        'subscription_type': l.get('subscription_type', 'free')
                    })

                return {'statusCode': 200, 'headers': headers, 'body': json.dumps(result, default=str)}

            elif action == 'quests':
                is_premium, _ = check_user_premium(conn, user_id)
                quests = generate_daily_quests(conn, user_id, is_premium)
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'quests': quests}, default=str)}

            elif action == 'streak_rewards':
                rewards = get_streak_rewards_data(conn, user_id)
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'streak_rewards': rewards}, default=str)}

            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': '\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u043e\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435'})}

        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action', '')

            if action == 'track':
                activity_type = body.get('type', '')
                value = min(int(body.get('value', 1)), 100)
                valid_types = ['tasks_completed', 'pomodoro_minutes', 'ai_questions_asked', 'materials_uploaded', 'schedule_views', 'exam_tasks_done']
                if activity_type not in valid_types:
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': '\u041d\u0435\u0432\u0435\u0440\u043d\u044b\u0439 \u0442\u0438\u043f \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u0438'})}

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
                is_premium, _ = check_user_premium(conn, user_id)
                generate_daily_quests(conn, user_id, is_premium)

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

            elif action == 'update_quest':
                quest_type = body.get('type', '')
                value = int(body.get('value', 1))
                if not quest_type:
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': '\u0422\u0438\u043f \u043a\u0432\u0435\u0441\u0442\u0430 \u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u0435\u043d'})}
                result = update_quest_progress(conn, user_id, quest_type, value)
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps(result, default=str)}

            elif action == 'use_freeze':
                is_premium, _ = check_user_premium(conn, user_id)
                if not is_premium:
                    return {
                        'statusCode': 403,
                        'headers': headers,
                        'body': json.dumps({'error': '\u0417\u0430\u043c\u043e\u0440\u043e\u0437\u043a\u0430 \u0441\u0442\u0440\u0438\u043a\u0430 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u0442\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f Premium'})
                    }

                today = date.today()
                cur = conn.cursor(cursor_factory=RealDictCursor)

                cur.execute("""
                    SELECT id FROM streak_freeze_log
                    WHERE user_id = %s AND freeze_date = %s
                    LIMIT 1
                """, (user_id, today))
                already_used = cur.fetchone()
                if already_used:
                    cur.close()
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': '\u0417\u0430\u043c\u043e\u0440\u043e\u0437\u043a\u0430 \u0443\u0436\u0435 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f'})
                    }

                week_start = today - timedelta(days=today.weekday())
                cur.execute("""
                    SELECT COUNT(*) as cnt FROM streak_freeze_log
                    WHERE user_id = %s AND freeze_date >= %s
                """, (user_id, week_start))
                week_count = cur.fetchone()['cnt']
                if week_count >= 1:
                    cur.close()
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': '\u041b\u0438\u043c\u0438\u0442 \u0437\u0430\u043c\u043e\u0440\u043e\u0437\u043e\u043a \u043d\u0430 \u044d\u0442\u0443 \u043d\u0435\u0434\u0435\u043b\u044e \u0438\u0441\u0447\u0435\u0440\u043f\u0430\u043d'})
                    }

                cur.execute("""
                    INSERT INTO streak_freeze_log (user_id, freeze_date)
                    VALUES (%s, %s)
                """, (user_id, today))

                cur.execute("""
                    UPDATE user_streaks
                    SET last_activity_date = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = %s
                """, (today, user_id))

                conn.commit()
                cur.close()

                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True, 'message': '\u0421\u0442\u0440\u0438\u043a \u0437\u0430\u043c\u043e\u0440\u043e\u0436\u0435\u043d \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f'})
                }

            elif action == 'claim_streak_reward':
                streak_days = int(body.get('streak_days', 0))
                reward_def = None
                for r in STREAK_REWARDS:
                    if r['streak_days'] == streak_days:
                        reward_def = r
                        break

                if not reward_def:
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': '\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u0430\u044f \u043d\u0430\u0433\u0440\u0430\u0434\u0430'})}

                cur = conn.cursor(cursor_factory=RealDictCursor)

                cur.execute("SELECT longest_streak FROM user_streaks WHERE user_id = %s", (user_id,))
                streak_row = cur.fetchone()
                longest = streak_row['longest_streak'] if streak_row else 0

                if longest < streak_days:
                    cur.close()
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': '\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u044b\u0439 \u0441\u0442\u0440\u0438\u043a'})}

                cur.execute("""
                    SELECT id FROM streak_reward_claims
                    WHERE user_id = %s AND streak_days = %s
                    LIMIT 1
                """, (user_id, streak_days))
                already_claimed = cur.fetchone()
                if already_claimed:
                    cur.close()
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': '\u041d\u0430\u0433\u0440\u0430\u0434\u0430 \u0443\u0436\u0435 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0430'})}

                if reward_def['reward_type'] == 'bonus_questions':
                    cur.execute("""
                        UPDATE users SET bonus_questions = bonus_questions + %s WHERE id = %s
                    """, (reward_def['value'], user_id))
                elif reward_def['reward_type'] == 'premium_days':
                    cur.execute("""
                        UPDATE users
                        SET subscription_type = 'premium',
                            subscription_expires_at = GREATEST(COALESCE(subscription_expires_at, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP) + interval '%s days'
                        WHERE id = %s
                    """ % (int(reward_def['value']), int(user_id)))

                cur.execute("""
                    INSERT INTO streak_reward_claims (user_id, streak_days, reward_type, reward_value)
                    VALUES (%s, %s, %s, %s)
                """, (user_id, streak_days, reward_def['reward_type'], reward_def['value']))

                conn.commit()
                cur.close()

                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'success': True,
                        'reward': {
                            'type': reward_def['reward_type'],
                            'value': reward_def['value'],
                            'title': reward_def['title'],
                            'description': reward_def['description']
                        }
                    })
                }

            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': '\u041d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u043e\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435'})}

    except Exception as e:
        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': str(e)})}
    finally:
        conn.close()