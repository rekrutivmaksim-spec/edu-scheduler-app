"""Сервис email-уведомлений Studyfay через Resend API.

Actions (POST):
  welcome        — приветственное письмо после регистрации
  trial_ending   — триал заканчивается через 24ч
  payment        — подтверждение оплаты
  reset_password — ссылка/код для сброса пароля

Cron (GET ?cron=...):
  trial_ending   — за 24ч до окончания триала (email)
  reactivation   — реактивация спящих 7/30 дней (email)
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


# ─── Handler ─────────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Email-сервис Studyfay: приветствие, триал, оплата, сброс пароля, реактивация."""
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

    return err(400, 'unknown action')