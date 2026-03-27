"""Сервис email-уведомлений Studyfay через Resend API.

Actions (POST):
  welcome        — приветственное письмо после регистрации
  trial_ending   — триал заканчивается через 24ч
  payment        — подтверждение оплаты
  reset_password — ссылка/код для сброса пароля

Cron (GET ?cron=...):
  trial_ending   — за 24ч до окончания триала (email)
  reactivation   — реактивация спящих 7/30 дней (email)
  drip           — 3-дневная drip-кампания (3ч, 24ч, 48ч после регистрации)
  recurring      — повторные напоминания каждые 2 дня неактивным
"""
import os
import json
import urllib.request
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta

RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
DATABASE_URL = os.environ.get('DATABASE_URL', '')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
FROM_EMAIL = 'Studyfay <hello@studyfay.ru>'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
}


def ok(body): return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(body, ensure_ascii=False)}
def err(code, msg): return {'statusCode': code, 'headers': CORS, 'body': json.dumps({'error': msg})}


def send_email(to: str, subject: str, html: str) -> bool:
    """Отправляет письмо через Resend API."""
    if not RESEND_API_KEY or not to:
        return False
    try:
        payload = json.dumps({
            'from': FROM_EMAIL,
            'to': [to],
            'subject': subject,
            'html': html,
        }).encode('utf-8')
        req = urllib.request.Request(
            'https://api.resend.com/emails',
            data=payload,
            headers={'Authorization': f'Bearer {RESEND_API_KEY}', 'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201)
    except Exception as e:
        print(f'[Email Error] {e}')
        return False


def get_conn():
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


# ─── HTML-шаблоны ─────────────────────────────────────────────────────────────

def _base(content: str, preview: str = '') -> str:
    return f"""<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Studyfay</title></head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
{'<div style="display:none;max-height:0;overflow:hidden;">' + preview + '</div>' if preview else ''}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:32px 0;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,0.1);max-width:100%;">
{content}
<tr><td style="background:#f9fafb;padding:16px 40px;text-align:center;border-top:1px solid #f3f4f6;">
  <p style="color:#d1d5db;font-size:12px;margin:0;">© 2025 Studyfay · <a href="https://studyfay.ru/privacy" style="color:#d1d5db;text-decoration:none;">Конфиденциальность</a></p>
</td></tr>
</table></td></tr></table></body></html>"""


def _header(emoji: str, title: str, subtitle: str) -> str:
    return f"""<tr><td style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:36px 40px 28px;text-align:center;">
  <div style="font-size:44px;margin-bottom:10px;">{emoji}</div>
  <h1 style="color:#fff;font-size:24px;font-weight:800;margin:0 0 6px;">{title}</h1>
  <p style="color:rgba(255,255,255,0.75);font-size:14px;margin:0;">{subtitle}</p>
</td></tr>"""


def _btn(href: str, text: str) -> str:
    return f"""<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
  <tr><td align="center"><a href="{href}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#a855f7);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:13px 36px;border-radius:14px;">{text}</a></td></tr>
</table>"""


def _body(inner: str) -> str:
    return f'<tr><td style="padding:32px 40px;">{inner}</td></tr>'


def _hi(name: str) -> str:
    display = name.split('@')[0] if '@' in name else name
    return f'<p style="color:#374151;font-size:16px;margin:0 0 16px;">Привет, <strong>{display}</strong> 👋</p>'


def _text(t: str) -> str:
    return f'<p style="color:#6b7280;font-size:15px;line-height:1.65;margin:0 0 16px;">{t}</p>'


def _box(items: list) -> str:
    rows = ''.join(f'<tr><td style="padding:4px 0;color:#6b7280;font-size:14px;">{i}</td></tr>' for i in items)
    return f'<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;border-radius:14px;padding:18px 22px;margin-bottom:20px;"><tr><td><table width="100%">{rows}</table></td></tr></table>'


# ─── Письмо 1: Приветственное ─────────────────────────────────────────────────

def html_welcome(name: str) -> str:
    return _base(
        _header('🦊', 'Добро пожаловать!', 'Ты теперь в Studyfay — твоём ИИ-репетиторе') +
        _body(
            _hi(name) +
            _text('Ты зарегистрировался и у тебя уже есть <strong style="color:#6366f1;">3 дня Premium бесплатно</strong>. Используй их прямо сейчас!') +
            _box(['🧠 &nbsp;Объяснения любой темы за 2 минуты', '📸 &nbsp;Решение задач по фото', '🔥 &nbsp;Стрик — учись каждый день', '⭐ &nbsp;Уровни и XP за каждый урок']) +
            _btn('https://studyfay.ru', 'Начать учиться →') +
            _text('<span style="color:#9ca3af;font-size:13px;">Если это не ты — просто проигнорируй письмо.</span>')
        ),
        preview='У тебя 3 дня Premium бесплатно — начни прямо сейчас!'
    )


# ─── Письмо 2: Триал заканчивается ───────────────────────────────────────────

def html_trial_ending(name: str) -> str:
    return _base(
        _header('⏰', 'Premium заканчивается завтра', 'Не теряй безлимитный доступ') +
        _body(
            _hi(name) +
            _text('Твои <strong>3 дня бесплатного Premium</strong> заканчиваются завтра. После этого лимит снизится до <strong>3 вопросов в день</strong>.') +
            _box(['✅ &nbsp;Сейчас: безлимитные вопросы ИИ', '✅ &nbsp;Сейчас: решение по фото', '✅ &nbsp;Сейчас: голосовой помощник', '❌ &nbsp;Завтра: только 3 вопроса/день']) +
            _btn('https://studyfay.ru/pricing?source=email_trial', 'Продлить Premium →') +
            _text('<span style="color:#9ca3af;font-size:13px;">Первый месяц — всего 499₽. Отменить можно в любой момент.</span>')
        ),
        preview='Завтра лимит снизится до 3 вопросов в день — продли сейчас'
    )


# ─── Письмо 3: После оплаты ───────────────────────────────────────────────────

def html_payment(name: str, plan: str, expires: str) -> str:
    plan_names = {'1month': '1 месяц', '6months': '6 месяцев', '1year': '1 год', 'session': 'Сессия'}
    plan_label = plan_names.get(plan, plan)
    return _base(
        _header('🎉', 'Оплата прошла успешно!', f'Premium активирован · {plan_label}') +
        _body(
            _hi(name) +
            _text(f'Спасибо! Твой <strong style="color:#6366f1;">Premium</strong> активирован до <strong>{expires}</strong>.') +
            _box(['✅ &nbsp;Безлимитные вопросы ИИ', '✅ &nbsp;Решение задач по фото', '✅ &nbsp;Голосовой помощник', '✅ &nbsp;Приоритетная поддержка']) +
            _btn('https://studyfay.ru', 'Открыть Studyfay →') +
            _text('<span style="color:#9ca3af;font-size:13px;">Вопросы? Пиши на <a href="mailto:hello@studyfay.ru" style="color:#6366f1;">hello@studyfay.ru</a></span>')
        ),
        preview=f'Premium активирован до {expires} — пользуйся без ограничений!'
    )


# ─── Письмо 4: Сброс пароля ───────────────────────────────────────────────────

def html_reset_password(name: str, code: str) -> str:
    return _base(
        _header('🔐', 'Сброс пароля', 'Запрос на изменение пароля') +
        _body(
            _hi(name) +
            _text('Ты запросил сброс пароля. Используй этот код для подтверждения:') +
            f'<div style="background:#f5f3ff;border-radius:16px;padding:24px;text-align:center;margin:0 0 20px;"><span style="font-size:36px;font-weight:900;letter-spacing:8px;color:#6366f1;">{code}</span></div>' +
            _text('Код действителен <strong>15 минут</strong>. Если ты не запрашивал сброс — просто проигнори это письмо.') +
            _text('<span style="color:#9ca3af;font-size:13px;">В целях безопасности код одноразовый.</span>')
        ),
        preview=f'Твой код для сброса пароля: {code}'
    )


# ─── Письмо 5: Реактивация 7 дней ────────────────────────────────────────────

def html_reactivation_7(name: str) -> str:
    return _base(
        _header('🦊', 'Ты давно не учился', 'Лисичка скучает') +
        _body(
            _hi(name) +
            _text('Ты не заходил в Studyfay уже <strong>7 дней</strong>. Экзамены не ждут — вернись и продолжи подготовку!') +
            _box(['🔥 &nbsp;Твой стрик можно восстановить', '🧠 &nbsp;500+ тем ждут тебя', '⭐ &nbsp;XP накапливается — не останавливайся']) +
            _btn('https://studyfay.ru?source=email_reactivation7', 'Вернуться к учёбе →')
        ),
        preview='7 дней без занятий — самое время вернуться!'
    )


# ─── Письмо 6: Реактивация 30 дней ──────────────────────────────────────────

def html_reactivation_30(name: str) -> str:
    return _base(
        _header('💌', 'Мы скучаем по тебе', '30 дней без занятий') +
        _body(
            _hi(name) +
            _text('Целый месяц без Studyfay! Мы подготовили для тебя <strong style="color:#6366f1;">специальный бонус</strong> — вернись и получи дополнительные вопросы.') +
            _btn('https://studyfay.ru?source=email_reactivation30', 'Забрать бонус →') +
            _text('<span style="color:#9ca3af;font-size:13px;">Бонус будет зачислен автоматически при входе.</span>')
        ),
        preview='Месяц без учёбы — возвращайся, мы приготовили бонус!'
    )


# ─── Письмо 7: Drip Day 1 (3ч после регистрации) ────────────────────────────

def html_day1(name: str) -> str:
    return _base(
        _header('🎯', 'Твой первый день в Studyfay', 'Что попробовать сегодня?') +
        _body(
            _hi(name) +
            _text('Ты зарегистрировался несколько часов назад. Вот <strong>3 вещи</strong>, которые стоит попробовать сегодня:') +
            _box([
                '🧠 &nbsp;Задай вопрос ИИ — он объяснит любую тему за 2 минуты',
                '📚 &nbsp;Пройди первый урок — это займёт 5 минут',
                '🔥 &nbsp;Начни стрик — заходи каждый день и получай бонусы',
            ]) +
            _btn('https://studyfay.ru/assistant', 'Задать первый вопрос →') +
            _text('<span style="color:#9ca3af;font-size:13px;">Всё это доступно бесплатно в рамках Premium-триала.</span>')
        ),
        preview='3 вещи, которые стоит попробовать в первый день'
    )


# ─── Письмо 8: Drip Day 2 (24ч после регистрации) ───────────────────────────

def html_day2(name: str) -> str:
    return _base(
        _header('🔥', 'День 2 — твой стрик ждёт!', 'Не останавливайся') +
        _body(
            _hi(name) +
            _text('Вчера ты начал учиться. Сегодня — <strong>второй день</strong>. Если зайдёшь сейчас, получишь стрик 2 дня!') +
            _text('Стрик = <strong style="color:#6366f1;">скидка на Premium</strong>. Чем длиннее серия — тем больше бонусов.') +
            _box([
                '🔥 &nbsp;2 дня подряд = +20 XP бонус',
                '📈 &nbsp;7 дней подряд = максимальный множитель',
                '💎 &nbsp;Длинный стрик = скидка на подписку',
            ]) +
            _btn('https://studyfay.ru', 'Продолжить учёбу →')
        ),
        preview='День 2 — зайди сейчас и получи стрик!'
    )


# ─── Письмо 9: Drip Day 3 (48ч после регистрации) ───────────────────────────

def html_day3(name: str) -> str:
    return _base(
        _header('⚡', 'Последний день Premium', 'Используй по максимуму') +
        _body(
            _hi(name) +
            _text('Твой <strong>бесплатный Premium заканчивается завтра</strong>. Успей попробовать всё, что будет с ограничениями без подписки:') +
            _box([
                '📸 &nbsp;Реши задачу по фото — скинь фотку и получи решение',
                '🧠 &nbsp;Задай сложный вопрос — ИИ разберёт по шагам',
                '📝 &nbsp;Пройди тест — проверь свои знания',
            ]) +
            _text('Завтра всё это будет <strong>с ограничениями</strong> — только 3 вопроса в день.') +
            _btn('https://studyfay.ru', 'Использовать Premium →') +
            _text('<span style="color:#9ca3af;font-size:13px;">Хочешь оставить безлимит? <a href="https://studyfay.ru/pricing?source=email_drip3" style="color:#6366f1;">Продлить Premium</a></span>')
        ),
        preview='Последний день бесплатного Premium — успей использовать!'
    )


# ─── Письмо 10: Recurring reminder (каждые 2 дня) ───────────────────────────

RECURRING_VARIANTS = [
    {
        'subject': 'Не забрасывай учёбу!',
        'emoji': '📚',
        'title': 'Не забрасывай учёбу!',
        'subtitle': 'Всего 5 минут в день меняют всё',
        'text': 'Исследования показывают: <strong>5 минут занятий в день</strong> эффективнее, чем 2 часа раз в неделю. Мозг лучше запоминает при регулярных повторениях.',
        'fact': 'Кривая забывания Эббингауза: без повторения мы забываем 80% материала за 24 часа.',
    },
    {
        'subject': 'Твой мозг скучает по задачам',
        'emoji': '🧠',
        'title': 'Твой мозг скучает по задачам',
        'subtitle': 'Дай ему немного работы',
        'text': 'Каждый день без практики — это шаг назад. Но <strong>достаточно одного вопроса</strong>, чтобы нейронные связи не ослабели.',
        'fact': 'Нейропластичность: мозг формирует новые связи при каждом решении задачи, даже простой.',
    },
    {
        'subject': 'Вернись — всего 5 минут в день',
        'emoji': '💪',
        'title': 'Вернись — всего 5 минут!',
        'subtitle': 'Маленький шаг = большой результат',
        'text': 'Ты уже начал путь к экзаменам. Не останавливайся! <strong>Задай один вопрос ИИ</strong> — и ты уже сделал больше, чем большинство.',
        'fact': 'Ученики, которые занимаются каждый день по 5 минут, сдают экзамены на 23% лучше.',
    },
]


def html_recurring_reminder(name: str, variant_idx: int) -> str:
    v = RECURRING_VARIANTS[variant_idx % len(RECURRING_VARIANTS)]
    return _base(
        _header(v['emoji'], v['title'], v['subtitle']) +
        _body(
            _hi(name) +
            _text(v['text']) +
            _box([f'💡 &nbsp;{v["fact"]}']) +
            _btn('https://studyfay.ru', 'Зайти на 5 минут →')
        ),
        preview=v['text'][:80]
    )


# ─── Письмо 11: Бонусные вопросы ────────────────────────────────────────────

def html_daily_bonus(name: str, hours_left: int) -> str:
    return _base(
        _header('🎁', '+3 бонусных вопроса!', 'Сгорят к полуночи') +
        _body(
            _hi(name) +
            _text(f'Тебе начислены <strong style="color:#6366f1;">3 бонусных вопроса</strong> к ИИ-помощнику. Они сгорят через <strong>{hours_left} часов</strong> — используй сейчас!') +
            _box([
                '🧠 &nbsp;Задай сложный вопрос по любому предмету',
                '📸 &nbsp;Сфоткай задачу — ИИ решит за секунды',
                '⏰ &nbsp;Бонус действует только сегодня',
            ]) +
            _btn('https://studyfay.ru/assistant', 'Использовать бонус →')
        ),
        preview='3 бонусных вопроса — сгорят к полуночи!'
    )


# ─── Cron: триал заканчивается (email) ───────────────────────────────────────

def cron_email_trial_ending() -> dict:
    conn = get_conn()
    try:
        now = datetime.now()
        window_start = now + timedelta(hours=23)
        window_end = now + timedelta(hours=25)
        cur = conn.cursor()
        cur.execute(f'''
            SELECT u.id, u.email, u.full_name
            FROM {SCHEMA}.users u
            WHERE u.trial_ends_at BETWEEN %s AND %s
              AND u.subscription_type != 'premium'
              AND u.email IS NOT NULL
              AND COALESCE(u.trial_reminder_sent, false) = false
        ''', (window_start, window_end))
        users = cur.fetchall()
        sent = 0
        for user in users:
            uid, email, name = user['id'], user['email'], user['full_name'] or user['email']
            if send_email(email, '⏰ Твой Premium заканчивается завтра — Studyfay', html_trial_ending(name)):
                cur.execute(f'UPDATE {SCHEMA}.users SET trial_reminder_sent = true WHERE id = %s', (uid,))
                sent += 1
        conn.commit()
        cur.close()
        return ok({'sent': sent, 'total': len(users)})
    finally:
        conn.close()


# ─── Cron: реактивация (email) ───────────────────────────────────────────────

def cron_email_reactivation() -> dict:
    conn = get_conn()
    try:
        now = datetime.now()
        cur = conn.cursor()

        # 7 дней без входа
        cur.execute(f'''
            SELECT u.id, u.email, u.full_name
            FROM {SCHEMA}.users u
            WHERE u.last_login_at BETWEEN %s AND %s
              AND u.email IS NOT NULL
        ''', (now - timedelta(days=7, hours=2), now - timedelta(days=7)))
        day7 = cur.fetchall()

        # 30 дней без входа
        cur.execute(f'''
            SELECT u.id, u.email, u.full_name
            FROM {SCHEMA}.users u
            WHERE u.last_login_at BETWEEN %s AND %s
              AND u.email IS NOT NULL
        ''', (now - timedelta(days=30, hours=2), now - timedelta(days=30)))
        day30 = cur.fetchall()

        cur.close()
        sent7 = sum(1 for u in day7 if send_email(u['email'], '🦊 Ты давно не учился — Studyfay', html_reactivation_7(u['full_name'] or u['email'])))
        sent30 = sum(1 for u in day30 if send_email(u['email'], '💌 Мы скучаем — Studyfay', html_reactivation_30(u['full_name'] or u['email'])))
        return ok({'day7': sent7, 'day30': sent30})
    finally:
        conn.close()


# ─── Cron: Drip campaign (3-day onboarding emails) ──────────────────────────

def cron_email_drip() -> dict:
    """3-day drip campaign: 3h, 24h, 48h after registration.
    Skip VK fake emails, skip already-active users, skip if trial_ending already sent for day3."""
    conn = get_conn()
    try:
        now = datetime.now()
        cur = conn.cursor()
        result = {'day1': 0, 'day2': 0, 'day3': 0}

        # --- Day 1: 3 hours after registration (window: 2h-5h) ---
        cur.execute(f'''
            SELECT u.id, u.email, u.full_name, u.created_at, u.last_login_at
            FROM {SCHEMA}.users u
            WHERE u.created_at BETWEEN %s AND %s
              AND u.email IS NOT NULL
              AND u.email NOT LIKE '%%@studyfay.app'
              AND (u.last_login_at IS NULL OR u.last_login_at < u.created_at + INTERVAL '1 hour')
        ''', (now - timedelta(hours=5), now - timedelta(hours=2)))
        day1_users = cur.fetchall()

        for user in day1_users:
            email = user['email']
            name = user['full_name'] or email
            if send_email(email, '🎯 Твой первый день в Studyfay — что попробовать?', html_day1(name)):
                result['day1'] += 1

        # --- Day 2: 24 hours after registration (window: 22h-26h) ---
        cur.execute(f'''
            SELECT u.id, u.email, u.full_name, u.created_at, u.last_login_at
            FROM {SCHEMA}.users u
            WHERE u.created_at BETWEEN %s AND %s
              AND u.email IS NOT NULL
              AND u.email NOT LIKE '%%@studyfay.app'
              AND (u.last_login_at IS NULL OR u.last_login_at < u.created_at + INTERVAL '12 hours')
        ''', (now - timedelta(hours=26), now - timedelta(hours=22)))
        day2_users = cur.fetchall()

        for user in day2_users:
            email = user['email']
            name = user['full_name'] or email
            if send_email(email, '🔥 День 2 — твой стрик ждёт! — Studyfay', html_day2(name)):
                result['day2'] += 1

        # --- Day 3: 48 hours after registration (window: 46h-50h) ---
        # Skip if trial_reminder_sent is already true (avoid duplicate with trial_ending email)
        cur.execute(f'''
            SELECT u.id, u.email, u.full_name, u.created_at, u.last_login_at
            FROM {SCHEMA}.users u
            WHERE u.created_at BETWEEN %s AND %s
              AND u.email IS NOT NULL
              AND u.email NOT LIKE '%%@studyfay.app'
              AND COALESCE(u.trial_reminder_sent, false) = false
              AND (u.last_login_at IS NULL OR u.last_login_at < u.created_at + INTERVAL '24 hours')
        ''', (now - timedelta(hours=50), now - timedelta(hours=46)))
        day3_users = cur.fetchall()

        for user in day3_users:
            email = user['email']
            name = user['full_name'] or email
            if send_email(email, '⚡ Последний день Premium — используй по максимуму — Studyfay', html_day3(name)):
                result['day3'] += 1

        cur.close()
        return ok(result)
    finally:
        conn.close()


# ─── Cron: Recurring reminder (every 2 days for inactive users) ─────────────

def cron_email_recurring() -> dict:
    """Send recurring reminders every 2 days to inactive free users.
    Skip VK fake emails, skip users inactive >60 days, skip premium users.
    Uses 2-day windows: 2-4d, 4-6d, 6-8d ... up to 60d based on last_login_at."""
    conn = get_conn()
    try:
        now = datetime.now()
        cur = conn.cursor()
        total_sent = 0

        # Generate 2-day windows from 2d to 60d
        for window_start_days in range(2, 60, 2):
            window_end_days = window_start_days + 2
            variant_idx = (window_start_days // 2) % len(RECURRING_VARIANTS)

            cur.execute(f'''
                SELECT u.id, u.email, u.full_name
                FROM {SCHEMA}.users u
                WHERE u.last_login_at BETWEEN %s AND %s
                  AND u.subscription_type != 'premium'
                  AND u.email IS NOT NULL
                  AND u.email NOT LIKE '%%@studyfay.app'
            ''', (
                now - timedelta(days=window_end_days),
                now - timedelta(days=window_start_days)
            ))
            users = cur.fetchall()

            variant = RECURRING_VARIANTS[variant_idx]
            for user in users:
                email = user['email']
                name = user['full_name'] or email
                subject = f'{variant["emoji"]} {variant["subject"]} — Studyfay'
                if send_email(email, subject, html_recurring_reminder(name, variant_idx)):
                    total_sent += 1

        cur.close()
        return ok({'sent': total_sent})
    finally:
        conn.close()


# ─── Handler ─────────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Email-сервис Studyfay: приветствие, триал, оплата, сброс пароля, реактивация, drip, recurring."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    qs = event.get('queryStringParameters') or {}

    # Cron-задачи
    if method == 'GET' and qs.get('cron'):
        cron = qs['cron']
        if cron == 'trial_ending':
            return cron_email_trial_ending()
        if cron == 'reactivation':
            return cron_email_reactivation()
        if cron == 'drip':
            return cron_email_drip()
        if cron == 'recurring':
            return cron_email_recurring()
        return err(400, 'unknown cron')

    if method != 'POST':
        return err(405, 'method not allowed')

    body = json.loads(event.get('body') or '{}')
    action = body.get('action', '')
    to = body.get('to', '')

    if not to:
        return err(400, 'missing to')

    if action == 'welcome':
        name = body.get('name', to)
        sent = send_email(to, '🦊 Добро пожаловать в Studyfay!', html_welcome(name))
        return ok({'ok': sent})

    if action == 'trial_ending':
        name = body.get('name', to)
        sent = send_email(to, '⏰ Твой Premium заканчивается завтра — Studyfay', html_trial_ending(name))
        return ok({'ok': sent})

    if action == 'payment':
        name = body.get('name', to)
        plan = body.get('plan', '1month')
        expires = body.get('expires', '')
        sent = send_email(to, '🎉 Оплата прошла! Premium активирован — Studyfay', html_payment(name, plan, expires))
        return ok({'ok': sent})

    if action == 'reset_password':
        name = body.get('name', to)
        code = body.get('code', '')
        if not code:
            return err(400, 'missing code')
        sent = send_email(to, f'🔐 Код для сброса пароля: {code} — Studyfay', html_reset_password(name, code))
        return ok({'ok': sent})

    if action == 'reactivation_7':
        name = body.get('name', to)
        sent = send_email(to, '🦊 Ты давно не учился — Studyfay', html_reactivation_7(name))
        return ok({'ok': sent})

    if action == 'reactivation_30':
        name = body.get('name', to)
        sent = send_email(to, '💌 Мы скучаем по тебе — Studyfay', html_reactivation_30(name))
        return ok({'ok': sent})

    if action == 'daily_bonus':
        name = body.get('name', to)
        hours_left = body.get('hours_left', 14)
        sent = send_email(to, '🎁 У тебя 3 бонусных вопроса — сгорят к полуночи! — Studyfay', html_daily_bonus(name, hours_left))
        return ok({'ok': sent})

    return err(400, 'unknown action')