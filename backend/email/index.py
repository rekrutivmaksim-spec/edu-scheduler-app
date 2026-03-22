import os
import json
import urllib.request
import urllib.error


RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
FROM_EMAIL = 'Studyfay <hello@studyfay.ru>'


def send_email(to: str, subject: str, html: str) -> bool:
    """Отправляет письмо через Resend API. Возвращает True если успешно."""
    if not RESEND_API_KEY:
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
            headers={
                'Authorization': f'Bearer {RESEND_API_KEY}',
                'Content-Type': 'application/json',
            },
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201)
    except Exception:
        return False


def welcome_email_html(name: str) -> str:
    """HTML приветственного письма."""
    display_name = name.split('@')[0] if '@' in name else name
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Добро пожаловать в Studyfay!</title>
</head>
<body style="margin:0;padding:0;background:#f5f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f3ff;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(99,102,241,0.1);">

          <!-- Шапка -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:40px 40px 32px;text-align:center;">
              <div style="font-size:48px;margin-bottom:12px;">🦊</div>
              <h1 style="color:#ffffff;font-size:26px;font-weight:800;margin:0 0 8px;">Добро пожаловать!</h1>
              <p style="color:rgba(255,255,255,0.8);font-size:15px;margin:0;">Ты теперь в Studyfay — твоём ИИ-репетиторе</p>
            </td>
          </tr>

          <!-- Тело -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="color:#374151;font-size:16px;margin:0 0 20px;">Привет, <strong>{display_name}</strong> 👋</p>
              <p style="color:#6b7280;font-size:15px;line-height:1.6;margin:0 0 28px;">
                Ты зарегистрировался в Studyfay — и у тебя уже есть <strong style="color:#6366f1;">3 дня Premium бесплатно</strong>.
                Используй их по максимуму!
              </p>

              <!-- Что можно делать -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#f5f3ff;border-radius:16px;padding:20px 24px;">
                    <p style="color:#374151;font-weight:700;font-size:14px;margin:0 0 12px;">Что тебя ждёт:</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr><td style="padding:5px 0;color:#6b7280;font-size:14px;">🧠 &nbsp;Объяснения любой темы за 2 минуты</td></tr>
                      <tr><td style="padding:5px 0;color:#6b7280;font-size:14px;">📸 &nbsp;Решение задач по фото</td></tr>
                      <tr><td style="padding:5px 0;color:#6b7280;font-size:14px;">🔥 &nbsp;Стрик — учись каждый день</td></tr>
                      <tr><td style="padding:5px 0;color:#6b7280;font-size:14px;">⭐ &nbsp;Уровни и XP за каждый урок</td></tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td align="center">
                    <a href="https://studyfay.ru" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#a855f7);color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:16px;">
                      Начать учиться →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">
                Если это не ты зарегистрировался — просто проигнорируй письмо.
              </p>
            </td>
          </tr>

          <!-- Подвал -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="color:#d1d5db;font-size:12px;margin:0;">
                © 2025 Studyfay · <a href="https://studyfay.ru/privacy" style="color:#d1d5db;">Политика конфиденциальности</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def handler(event: dict, context) -> dict:
    """Внутренний сервис отправки email через Resend."""
    headers = {'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': {**headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'}, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    action = body.get('action', '')
    to = body.get('to', '')

    if not to:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'missing to'})}

    if action == 'welcome':
        name = body.get('name', to)
        ok = send_email(to, '🦊 Добро пожаловать в Studyfay!', welcome_email_html(name))
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'ok': ok})}

    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'unknown action'})}
