"""Push-уведомления Studyfay — модель Duolingo: 1 пуш в день, максимум ценности.

Принцип: не больше 1 push в день на пользователя. Приоритеты:
1. Streak-saver (вечер 20:00) — главный крючок возврата
2. Trial ending — монетизация
3. Реактивация (день 3, 7, 30) — возврат ушедших

Cron (GET ?cron=...):
  streak         — стрик сгорит (20:00, самый важный)
  trial_ending   — триал заканчивается через 24ч
  trial_expired  — триал закончился
  reactivation   — 3, 7, 30 дней без активности
  daily_bonus    — начисление бонусных вопросов

POST action=send_test — тестовый пуш
GET (auth) — статус подписки
"""
import json
import os
import jwt
import requests
import psycopg2
from datetime import datetime, timedelta, timezone
from pywebpush import webpush, WebPushException

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'secret')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_CLAIMS = {'sub': 'mailto:support@studyfay.ru'}

RUSTORE_PROJECT_ID = os.environ.get('RUSTORE_PUSH_PROJECT_ID', '')
RUSTORE_SERVICE_TOKEN = os.environ.get('RUSTORE_PUSH_SERVICE_TOKEN', '')
RUSTORE_PUSH_URL = 'https://vkpns.rustore.ru/v1/projects/{project_id}/messages:send'

EMAIL_URL = os.environ.get('EMAIL_FUNCTION_URL', '')

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
    'Content-Type': 'application/json',
}

STREAK_MESSAGES = [
    {'title': '🔥 Серия {streak} {word} сгорит!', 'body': 'Зайди на 2 минуты — один вопрос сохранит всё'},
    {'title': '⚠️ {streak} {word} подряд — не потеряй!', 'body': 'Ты столько старался. 5 минут — и серия в безопасности'},
    {'title': '🔥 Осталось несколько часов!', 'body': 'Серия {streak} {word} обнулится к полуночи. Зайди сейчас'},
    {'title': '😱 Серия горит!', 'body': 'Ещё чуть-чуть — и {streak} {word} подряд обнулятся навсегда'},
]

def ok(body): return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(body, ensure_ascii=False)}
def err(code, msg): return {'statusCode': code, 'headers': CORS, 'body': json.dumps({'error': msg}, ensure_ascii=False)}


def get_user_id(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload['user_id']
    except Exception:
        return None


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def days_word(n):
    if n == 1:
        return 'день'
    if 2 <= n <= 4:
        return 'дня'
    return 'дней'


def send_rustore_push(rustore_token: str, title: str, body: str, url: str = '/') -> bool:
    if not RUSTORE_PROJECT_ID or not RUSTORE_SERVICE_TOKEN:
        return False
    try:
        response = requests.post(
            RUSTORE_PUSH_URL.format(project_id=RUSTORE_PROJECT_ID),
            headers={
                'Authorization': f'Bearer {RUSTORE_SERVICE_TOKEN}',
                'Content-Type': 'application/json',
            },
            json={
                'message': {
                    'token': rustore_token,
                    'notification': {'title': title, 'body': body},
                    'data': {'url': url},
                    'android': {'notification': {'channel_id': 'studyfay_default', 'click_action': url}}
                }
            },
            timeout=10
        )
        return response.status_code in (200, 201)
    except Exception as e:
        print(f'[RuStore Push Error] {e}')
        return False


def send_push(endpoint: str, p256dh: str, auth: str, title: str, body: str, url: str = '/', tag: str = 'general') -> bool:
    if not VAPID_PRIVATE_KEY:
        return False
    try:
        webpush(
            subscription_info={'endpoint': endpoint, 'keys': {'p256dh': p256dh, 'auth': auth}},
            data=json.dumps({'title': title, 'body': body, 'url': url, 'tag': tag}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
        )
        return True
    except WebPushException as e:
        if e.response and e.response.status_code in (404, 410):
            return None
        return False


def send_to_users(conn, user_ids: list, title: str, body: str, url: str = '/', tag: str = 'general') -> dict:
    if not user_ids:
        return {'sent': 0, 'failed': 0}
    cur = conn.cursor()
    placeholders = ','.join(['%s'] * len(user_ids))
    cur.execute(
        f'SELECT user_id, endpoint, p256dh, auth, rustore_token, device_type FROM {SCHEMA}.push_subscriptions WHERE user_id IN ({placeholders})',
        user_ids
    )
    subs = cur.fetchall()
    expired = []
    sent = failed = 0
    for uid, endpoint, p256dh, auth, rustore_token, device_type in subs:
        if device_type == 'android' and rustore_token:
            result = send_rustore_push(rustore_token, title, body, url)
            if result:
                sent += 1
            else:
                failed += 1
        elif endpoint and p256dh and auth:
            result = send_push(endpoint, p256dh, auth, title, body, url, tag)
            if result is True:
                sent += 1
            elif result is None:
                expired.append(endpoint)
            else:
                failed += 1
    if expired:
        for ep in expired:
            cur.execute(f'DELETE FROM {SCHEMA}.push_subscriptions WHERE endpoint = %s', (ep,))
        conn.commit()
    cur.close()
    return {'sent': sent, 'failed': failed}


def _send_streak_email(conn, user_ids: list):
    if not EMAIL_URL or not user_ids:
        return
    cur = conn.cursor()
    placeholders = ','.join(['%s'] * len(user_ids))
    cur.execute(f'''
        SELECT u.id, u.email, u.full_name, us.current_streak
        FROM {SCHEMA}.users u
        JOIN {SCHEMA}.user_streaks us ON u.id = us.user_id
        WHERE u.id IN ({placeholders})
          AND u.email IS NOT NULL
          AND u.email NOT LIKE '%%@studyfay.app'
    ''', user_ids)
    users = cur.fetchall()
    cur.close()
    import urllib.request
    for uid, email, name, streak in users:
        try:
            payload = json.dumps({
                'action': 'streak_save',
                'to': email,
                'name': name or email,
                'streak': streak,
            }).encode('utf-8')
            req = urllib.request.Request(
                EMAIL_URL,
                data=payload,
                headers={'Content-Type': 'application/json'},
                method='POST',
            )
            urllib.request.urlopen(req, timeout=5)
        except Exception as e:
            print(f'[Streak Email Error] {e}')


def handler(event: dict, context) -> dict:
    """Push-уведомления Studyfay: модель Duolingo — 1 пуш/день, streak-saver."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    qs = event.get('queryStringParameters') or {}
    auth_header = event.get('headers', {}).get('X-Authorization') or event.get('headers', {}).get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip()
    user_id = get_user_id(token)

    conn = get_conn()
    try:
        cron = qs.get('cron')
        if method == 'GET' and cron:
            if cron == 'streak':
                return cron_streak(conn)
            if cron == 'trial_ending':
                return cron_trial_ending(conn)
            if cron == 'trial_expired':
                return cron_trial_expired(conn)
            if cron == 'reactivation':
                return cron_reactivation(conn)
            if cron == 'daily_bonus':
                return cron_daily_bonus(conn)
            if cron == 'expire_bonus':
                return cron_expire_bonus(conn)
            return err(400, 'Unknown cron')

        if not user_id:
            return err(401, 'Unauthorized')

        if method == 'POST':
            body = json.loads(event.get('body') or '{}')
            action = body.get('action')
            if action == 'send_test':
                return send_test(conn, user_id)
            if action == 'update_settings':
                cur = conn.cursor()
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.notification_settings
                        (user_id, lessons_reminder, deadline_reminder)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (user_id) DO UPDATE
                    SET lessons_reminder = EXCLUDED.lessons_reminder,
                        deadline_reminder = EXCLUDED.deadline_reminder
                ''', (
                    user_id,
                    body.get('notify_lessons', True),
                    body.get('notify_deadlines', True),
                ))
                conn.commit()
                cur.close()
                return ok({'success': True})

        if method == 'GET':
            action = qs.get('action', '')
            cur = conn.cursor()
            cur.execute(f'SELECT COUNT(*) FROM {SCHEMA}.push_subscriptions WHERE user_id=%s AND (endpoint IS NOT NULL OR rustore_token IS NOT NULL)', (user_id,))
            count = cur.fetchone()[0]
            cur.close()
            if action in ('status', ''):
                return ok({
                    'subscribed': count > 0,
                    'vapid_public_key': VAPID_PUBLIC_KEY,
                    'settings': {
                        'push_notifications': count > 0,
                        'sms_notifications': False,
                        'email_notifications': False,
                        'notify_lessons': True,
                        'notify_deadlines': True,
                        'notify_materials': False,
                        'notify_before_minutes': 30,
                    }
                })

        return err(400, 'Unknown action')
    finally:
        conn.close()


# ═══════════════════════════════════════════════════════════════════════════════
# STREAK-SAVER — главный push, как у Duolingo (20:00)
# ═══════════════════════════════════════════════════════════════════════════════

def cron_streak(conn) -> dict:
    today = datetime.now().date()
    cur = conn.cursor()
    cur.execute(f'''
        SELECT u.id, us.current_streak FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        JOIN {SCHEMA}.user_streaks us ON u.id = us.user_id
        WHERE (ps.endpoint IS NOT NULL OR ps.rustore_token IS NOT NULL)
          AND us.current_streak > 0
          AND us.last_activity_date < %s
    ''', (today,))
    rows = cur.fetchall()
    cur.close()

    sent = failed = 0
    email_user_ids = []
    for uid, streak in rows:
        word = days_word(streak)
        import hashlib
        variant_idx = int(hashlib.md5(f'{uid}{today}'.encode()).hexdigest(), 16) % len(STREAK_MESSAGES)
        msg = STREAK_MESSAGES[variant_idx]
        title = msg['title'].format(streak=streak, word=word)
        body = msg['body'].format(streak=streak, word=word)
        result = send_to_users(conn, [uid], title, body, '/', 'streak_reminder')
        sent += result['sent']
        failed += result['failed']
        if streak >= 2:
            email_user_ids.append(uid)

    _send_streak_email(conn, email_user_ids)

    return ok({'sent': sent, 'failed': failed, 'total': len(rows)})


# ═══════════════════════════════════════════════════════════════════════════════
# МОНЕТИЗАЦИЯ
# ═══════════════════════════════════════════════════════════════════════════════

def cron_trial_ending(conn) -> dict:
    now = datetime.now()
    cur = conn.cursor()
    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE (ps.endpoint IS NOT NULL OR ps.rustore_token IS NOT NULL)
          AND u.trial_ends_at BETWEEN %s AND %s
          AND u.subscription_type != 'premium'
    ''', (now + timedelta(hours=23), now + timedelta(hours=25)))
    user_ids = [r[0] for r in cur.fetchall()]
    cur.close()
    return ok(send_to_users(conn, user_ids,
        '⏰ Завтра останется только 3 вопроса',
        'Безлимит заканчивается через 24 часа. Продли — первый месяц 499 ₽',
        '/pricing?source=push_trial', 'trial_ending'))


def cron_trial_expired(conn) -> dict:
    now = datetime.now()
    cur = conn.cursor()
    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE (ps.endpoint IS NOT NULL OR ps.rustore_token IS NOT NULL)
          AND u.trial_ends_at BETWEEN %s AND %s
          AND u.subscription_type != 'premium'
    ''', (now - timedelta(hours=2), now))
    user_ids = [r[0] for r in cur.fetchall()]
    cur.close()
    return ok(send_to_users(conn, user_ids,
        '😔 Безлимит закончился',
        'Осталось 3 вопроса в день. Вернуть безлимит — 499 ₽/мес',
        '/pricing?source=push_trial_expired', 'trial_expired'))


# ═══════════════════════════════════════════════════════════════════════════════
# РЕАКТИВАЦИЯ (3, 7, 30 дней) — точечно, не спамим
# ═══════════════════════════════════════════════════════════════════════════════

def cron_reactivation(conn) -> dict:
    now = datetime.now()
    cur = conn.cursor()

    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE (ps.endpoint IS NOT NULL OR ps.rustore_token IS NOT NULL)
          AND u.last_login_at BETWEEN %s AND %s
    ''', (now - timedelta(days=3, hours=2), now - timedelta(days=3)))
    day3 = [r[0] for r in cur.fetchall()]

    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE (ps.endpoint IS NOT NULL OR ps.rustore_token IS NOT NULL)
          AND u.last_login_at BETWEEN %s AND %s
    ''', (now - timedelta(days=7, hours=2), now - timedelta(days=7)))
    day7 = [r[0] for r in cur.fetchall()]

    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE (ps.endpoint IS NOT NULL OR ps.rustore_token IS NOT NULL)
          AND u.last_login_at BETWEEN %s AND %s
    ''', (now - timedelta(days=30, hours=2), now - timedelta(days=30)))
    day30 = [r[0] for r in cur.fetchall()]
    cur.close()

    r1 = send_to_users(conn, day3,
        '🦊 Привет! Не забыл про учёбу?',
        '3 дня без занятий — вернись на 5 минут, чтобы не терять прогресс',
        '/', 'reactivation_3d')

    r2 = send_to_users(conn, day7,
        '📚 Неделя без практики',
        'Знания забываются быстро. Один вопрос — и ты снова в форме!',
        '/', 'reactivation_7d')

    r3 = send_to_users(conn, day30,
        '💌 Давно не виделись',
        'Мы добавили много нового! Зайди — дарим 3 бонусных вопроса',
        '/', 'reactivation_30d')

    return ok({'day3': r1, 'day7': r2, 'day30': r3})


# ═══════════════════════════════════════════════════════════════════════════════
# БОНУСЫ
# ═══════════════════════════════════════════════════════════════════════════════

def cron_daily_bonus(conn) -> dict:
    cur = conn.cursor()
    cur.execute(f'''
        UPDATE {SCHEMA}.users
        SET bonus_questions = 3
        WHERE subscription_type != 'premium'
          AND (bonus_questions IS NULL OR bonus_questions < 3)
        RETURNING id
    ''')
    updated_ids = [r[0] for r in cur.fetchall()]
    conn.commit()

    if updated_ids:
        placeholders = ','.join(['%s'] * len(updated_ids))
        cur.execute(f'''
            SELECT DISTINCT ps.user_id FROM {SCHEMA}.push_subscriptions ps
            WHERE ps.user_id IN ({placeholders})
              AND (ps.endpoint IS NOT NULL OR ps.rustore_token IS NOT NULL)
        ''', updated_ids)
        push_user_ids = [r[0] for r in cur.fetchall()]
    else:
        push_user_ids = []

    push_result = send_to_users(conn, push_user_ids,
        '🎁 +3 бонусных вопроса!',
        'Сгорят к полуночи — используй сейчас',
        '/assistant', 'daily_bonus')

    cur.close()
    return ok({'bonus_given': len(updated_ids), 'push': push_result})


def cron_expire_bonus(conn) -> dict:
    cur = conn.cursor()
    cur.execute(f'''
        UPDATE {SCHEMA}.users
        SET bonus_questions = 0
        WHERE bonus_questions > 0
        RETURNING id
    ''')
    reset_ids = [r[0] for r in cur.fetchall()]
    conn.commit()
    cur.close()
    return ok({'reset_count': len(reset_ids)})


# ═══════════════════════════════════════════════════════════════════════════════
# ТЕСТ
# ═══════════════════════════════════════════════════════════════════════════════

def send_test(conn, user_id: int) -> dict:
    result = send_to_users(conn, [user_id],
        '🎓 Studyfay',
        'Push-уведомления работают! Теперь ты не пропустишь ничего важного.',
        '/', 'test')
    return ok(result)
