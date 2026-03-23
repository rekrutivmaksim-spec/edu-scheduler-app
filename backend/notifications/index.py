"""
Push-уведомления Studyfay — 5 категорий по плану:
1. Онбординг (приветствие, первый вопрос, активация триала)
2. Удержание (streak, ежедневное задание)
3. Монетизация (окончание триала, лимиты, скидки)
4. Виральность (рефералка)
5. Реактивация (3, 7, 30 дней без активности)

Cron-эндпоинты (вызываются планировщиком):
GET ?cron=onboarding         — приветствие + напоминание задать вопрос
GET ?cron=streak             — напоминание о сгорающей серии (каждый день 20:00)
GET ?cron=trial_ending       — триал заканчивается через 24ч
GET ?cron=trial_expired      — триал только что закончился
GET ?cron=reactivation       — реактивация спящих (3/7/30 дней)
GET ?cron=referral_promo     — предложение рефералки (7 день)
GET ?cron=discount           — скидка на 3й день после окончания триала
POST action=send_test        — тестовый пуш текущему пользователю
GET  action=status           — статус подписки
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

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
    'Content-Type': 'application/json',
}

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
            return None  # expired subscription
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


def handler(event: dict, context) -> dict:
    """Обработчик push-уведомлений Studyfay"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    qs = event.get('queryStringParameters') or {}
    auth_header = event.get('headers', {}).get('X-Authorization') or event.get('headers', {}).get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip()
    user_id = get_user_id(token)

    conn = get_conn()
    try:
        # ── Cron-задачи ───────────────────────────────────────────────────────
        cron = qs.get('cron')
        if method == 'GET' and cron:
            if cron == 'onboarding':
                return cron_onboarding(conn)
            if cron == 'streak':
                return cron_streak(conn)
            if cron == 'trial_ending':
                return cron_trial_ending(conn)
            if cron == 'trial_expired':
                return cron_trial_expired(conn)
            if cron == 'reactivation':
                return cron_reactivation(conn)
            if cron == 'referral_promo':
                return cron_referral_promo(conn)
            if cron == 'discount':
                return cron_discount(conn)
            return err(400, 'Unknown cron')

        if not user_id:
            return err(401, 'Unauthorized')

        # ── POST-действия ─────────────────────────────────────────────────────
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

        # ── GET статус / настройки ────────────────────────────────────────────
        if method == 'GET':
            action = qs.get('action', '')
            cur = conn.cursor()
            cur.execute(f'SELECT COUNT(*) FROM {SCHEMA}.push_subscriptions WHERE user_id=%s AND endpoint IS NOT NULL', (user_id,))
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
# 1. ОНБОРДИНГ
# ═══════════════════════════════════════════════════════════════════════════════

def cron_onboarding(conn) -> dict:
    """
    Приветствие — сразу после регистрации (первые 5 минут).
    Напоминание — через 2 часа если не задал вопрос.
    """
    now = datetime.now()
    cur = conn.cursor()

    # Приветствие: зарегистрировались 2-5 минут назад, ещё не задали вопрос
    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE ps.endpoint IS NOT NULL
          AND u.created_at BETWEEN %s AND %s
          AND u.ai_questions_used = 0
    ''', (now - timedelta(minutes=5), now - timedelta(minutes=2)))
    welcome_users = [r[0] for r in cur.fetchall()]

    # Напоминание: зарегистрировались 2-2.5 часа назад, всё ещё не задали вопрос
    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE ps.endpoint IS NOT NULL
          AND u.created_at BETWEEN %s AND %s
          AND u.ai_questions_used = 0
    ''', (now - timedelta(hours=2, minutes=30), now - timedelta(hours=2)))
    reminder_users = [r[0] for r in cur.fetchall()]
    cur.close()

    r1 = send_to_users(conn, welcome_users,
        '👋 Привет! Добро пожаловать в Studyfay',
        'У тебя 3 дня Premium бесплатно. Задай первый вопрос — я помогу разобраться!',
        '/assistant', 'onboarding_welcome')

    r2 = send_to_users(conn, reminder_users,
        '🤔 Не знаешь, с чего начать?',
        'Попробуй спросить: «как решить уравнение x² – 5x + 6 = 0» — я объясню по шагам',
        '/assistant', 'onboarding_hint')

    return ok({'welcome': r1, 'reminder': r2})


# ═══════════════════════════════════════════════════════════════════════════════
# 2. УДЕРЖАНИЕ
# ═══════════════════════════════════════════════════════════════════════════════

def cron_streak(conn) -> dict:
    """
    Каждый день в 20:00 — напоминание тем, кто ещё не зашёл сегодня и имеет streak > 0.
    """
    today = datetime.now().date()
    cur = conn.cursor()
    cur.execute(f'''
        SELECT u.id, us.current_streak FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        JOIN {SCHEMA}.user_streaks us ON u.id = us.user_id
        WHERE ps.endpoint IS NOT NULL
          AND us.current_streak > 0
          AND us.last_activity_date < %s
    ''', (today,))
    rows = cur.fetchall()
    cur.close()

    sent = failed = 0
    for uid, streak in rows:
        days_word = 'день' if streak == 1 else ('дня' if streak < 5 else 'дней')
        if streak >= 30:
            title = f'🔥 {streak} {days_word} — это огромный результат!'
            body = 'Не дай серии сгореть сегодня ночью. Зайди на 2 минуты — один вопрос сохранит всё!'
        elif streak >= 7:
            title = f'⚠️ Серия {streak} {days_word} сгорит через несколько часов!'
            body = 'Ты столько старался. Сделай одно занятие прямо сейчас — это займёт 5 минут.'
        else:
            title = f'🔥 Твоя серия {streak} {days_word} в опасности!'
            body = 'Зайди и реши хотя бы один вопрос — серия сохранится и ты получишь +10 XP'
        result = send_to_users(conn, [uid], title, body, '/', 'streak_reminder')
        sent += result['sent']
        failed += result['failed']

    return ok({'sent': sent, 'failed': failed})


# ═══════════════════════════════════════════════════════════════════════════════
# 3. МОНЕТИЗАЦИЯ
# ═══════════════════════════════════════════════════════════════════════════════

def cron_trial_ending(conn) -> dict:
    """
    За 24 часа до окончания триала.
    """
    now = datetime.now()
    window_start = now + timedelta(hours=23)
    window_end = now + timedelta(hours=25)
    cur = conn.cursor()
    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE ps.endpoint IS NOT NULL
          AND u.trial_ends_at BETWEEN %s AND %s
          AND u.subscription_type != 'premium'
    ''', (window_start, window_end))
    user_ids = [r[0] for r in cur.fetchall()]
    cur.close()

    return ok(send_to_users(conn, user_ids,
        '⏰ Завтра останется только 3 вопроса в день',
        'Твой безлимит заканчивается через 24 часа. Продли сейчас — первый месяц всего 299 ₽ 🔥',
        '/pricing?source=push_trial_ending', 'trial_ending'))


def cron_trial_expired(conn) -> dict:
    """
    В день окончания триала (trial_ends_at < now, subscription != premium).
    """
    now = datetime.now()
    cur = conn.cursor()
    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE ps.endpoint IS NOT NULL
          AND u.trial_ends_at BETWEEN %s AND %s
          AND u.subscription_type != 'premium'
    ''', (now - timedelta(hours=2), now))
    user_ids = [r[0] for r in cur.fetchall()]
    cur.close()

    return ok(send_to_users(conn, user_ids,
        '😔 Безлимит закончился — осталось 3 вопроса',
        'Вернуть безлимит легко: первый месяц всего 299 ₽. Не останавливайся! 🚀',
        '/pricing?source=push_trial_expired', 'trial_expired'))


def cron_discount(conn) -> dict:
    """
    Через 3 дня после окончания триала — скидка 40%.
    """
    now = datetime.now()
    cur = conn.cursor()
    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE ps.endpoint IS NOT NULL
          AND u.trial_ends_at BETWEEN %s AND %s
          AND u.subscription_type != 'premium'
    ''', (now - timedelta(days=3, hours=2), now - timedelta(days=3)))
    user_ids = [r[0] for r in cur.fetchall()]
    cur.close()

    return ok(send_to_users(conn, user_ids,
        '🔥 Только сегодня: первый месяц за 299₽',
        'Специально для тебя — скидка 40% на Premium. Предложение сгорает через 24 часа!',
        '/pricing?source=push_discount', 'discount'))


# ═══════════════════════════════════════════════════════════════════════════════
# 4. ВИРАЛЬНОСТЬ
# ═══════════════════════════════════════════════════════════════════════════════

def cron_referral_promo(conn) -> dict:
    """
    На 7й день после регистрации — предложение рефералки (если ещё не приглашал).
    """
    now = datetime.now()
    cur = conn.cursor()
    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE ps.endpoint IS NOT NULL
          AND u.created_at BETWEEN %s AND %s
          AND COALESCE(u.referral_count, 0) = 0
    ''', (now - timedelta(days=7, hours=2), now - timedelta(days=7)))
    user_ids = [r[0] for r in cur.fetchall()]
    cur.close()

    return ok(send_to_users(conn, user_ids,
        '👫 Пригласи друга — получи 7 дней Premium',
        'Друг тоже получит бонус при регистрации. Поделись своей ссылкой!',
        '/referral?source=push', 'referral_promo'))


# ═══════════════════════════════════════════════════════════════════════════════
# 5. РЕАКТИВАЦИЯ
# ═══════════════════════════════════════════════════════════════════════════════

def cron_reactivation(conn) -> dict:
    """
    3 дня без активности — мягкое напоминание.
    7 дней — предложение триала (если не использован).
    30 дней — щедрый бонус.
    """
    now = datetime.now()
    cur = conn.cursor()

    # 3 дня
    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE ps.endpoint IS NOT NULL
          AND u.last_login_at BETWEEN %s AND %s
    ''', (now - timedelta(days=3, hours=2), now - timedelta(days=3)))
    day3 = [r[0] for r in cur.fetchall()]

    # 7 дней (и триал не использован)
    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE ps.endpoint IS NOT NULL
          AND u.last_login_at BETWEEN %s AND %s
          AND (u.is_trial_used = FALSE OR u.is_trial_used IS NULL)
    ''', (now - timedelta(days=7, hours=2), now - timedelta(days=7)))
    day7_no_trial = [r[0] for r in cur.fetchall()]

    # 7 дней (триал уже был)
    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE ps.endpoint IS NOT NULL
          AND u.last_login_at BETWEEN %s AND %s
          AND u.is_trial_used = TRUE
    ''', (now - timedelta(days=7, hours=2), now - timedelta(days=7)))
    day7_with_trial = [r[0] for r in cur.fetchall()]

    # 30 дней
    cur.execute(f'''
        SELECT u.id FROM {SCHEMA}.users u
        JOIN {SCHEMA}.push_subscriptions ps ON u.id = ps.user_id
        WHERE ps.endpoint IS NOT NULL
          AND u.last_login_at BETWEEN %s AND %s
    ''', (now - timedelta(days=30, hours=2), now - timedelta(days=30)))
    day30 = [r[0] for r in cur.fetchall()]
    cur.close()

    r1 = send_to_users(conn, day3,
        '🦊 Привет! Я скучаю по тебе...',
        'Твой помощник ждёт тебя 3 дня. Зайди на 2 минуты — порешаем задачу вместе!',
        '/', 'reactivation_3d')

    r2 = send_to_users(conn, day7_no_trial,
        '📸 Ты ещё не пробовал Premium!',
        'Решай задачи по фото и голосу — попробуй 3 дня бесплатно 🎁',
        '/pricing?source=push_reactivation', 'reactivation_7d_trial')

    r3 = send_to_users(conn, day7_with_trial,
        '📚 Знаешь, что нового в Studyfay?',
        'Мы добавили пробные экзамены и флэшкарты. Зайди и проверь!',
        '/', 'reactivation_7d')

    r4 = send_to_users(conn, day30,
        '🐱 Твой друг очень скучает...',
        'Ты не заходил целый месяц. Возвращайся — дарим 100 вопросов к ИИ в подарок 🎁',
        '/', 'reactivation_30d')

    return ok({'day3': r1, 'day7_no_trial': r2, 'day7': r3, 'day30': r4})


# ═══════════════════════════════════════════════════════════════════════════════
# ТЕСТ
# ═══════════════════════════════════════════════════════════════════════════════

def send_test(conn, user_id: int) -> dict:
    result = send_to_users(conn, [user_id],
        '🎓 Studyfay',
        'Push-уведомления работают! Теперь ты не пропустишь ничего важного.',
        '/', 'test')
    return ok(result)