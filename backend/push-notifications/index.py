"""
Push-уведомления: подписка и отправка Web Push (браузер) + RuStore Push (APK).
POST ?action=subscribe        — сохранить Web Push подписку браузера
POST ?action=subscribe_rustore — сохранить RuStore Push токен (APK)
POST ?action=send             — отправить push пользователю (внутренний вызов)
DELETE ?action=unsubscribe    — удалить подписку
GET ?action=vapid_key         — получить VAPID публичный ключ
GET                           — статус подписки
"""
import json
import os
import jwt
import requests
import psycopg2
from pywebpush import webpush, WebPushException

DATABASE_URL = os.environ['DATABASE_URL']
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'secret')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_CLAIMS = {'sub': 'mailto:support@studyfay.ru'}

RUSTORE_PROJECT_ID = os.environ.get('RUSTORE_PUSH_PROJECT_ID', '')
RUSTORE_SERVICE_TOKEN = os.environ.get('RUSTORE_PUSH_SERVICE_TOKEN', '')
RUSTORE_PUSH_URL = 'https://vkpns.rustore.ru/v1/projects/{project_id}/messages:send'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
    'Content-Type': 'application/json',
}

def ok(body): return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(body, ensure_ascii=False)}
def err(status, msg): return {'statusCode': status, 'headers': CORS, 'body': json.dumps({'error': msg}, ensure_ascii=False)}


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
                    'notification': {
                        'title': title,
                        'body': body,
                    },
                    'data': {
                        'url': url,
                    },
                    'android': {
                        'notification': {
                            'channel_id': 'studyfay_default',
                            'click_action': url,
                        }
                    }
                }
            },
            timeout=10
        )
        return response.status_code == 200
    except Exception:
        return False


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    auth = event.get('headers', {}).get('X-Authorization') or event.get('headers', {}).get('Authorization', '')
    token = auth.replace('Bearer ', '').strip()
    user_id = get_user_id(token)

    method = event.get('httpMethod', 'GET')
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            pass

    action = body.get('action') or event.get('queryStringParameters', {}).get('action', '')

    # ── Подписка RuStore (APK) ────────────────────────────────────────────────
    if method == 'POST' and action == 'subscribe_rustore':
        if not user_id:
            return err(401, 'Unauthorized')

        rustore_token = body.get('rustore_token', '')
        if not rustore_token:
            return err(400, 'rustore_token обязателен')

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f'''INSERT INTO {SCHEMA}.push_subscriptions (user_id, rustore_token, device_type)
                VALUES (%s, %s, 'android')
                ON CONFLICT (rustore_token) DO UPDATE
                SET user_id = EXCLUDED.user_id, device_type = 'android' ''',
            (user_id, rustore_token)
        )
        conn.commit()
        cur.close()
        conn.close()
        return ok({'ok': True})

    # ── Подписка Web Push (браузер) ───────────────────────────────────────────
    if method == 'POST' and action == 'subscribe':
        if not user_id:
            return err(401, 'Unauthorized')

        endpoint = body.get('endpoint', '')
        p256dh = body.get('p256dh', '')
        auth_key = body.get('auth', '')

        if not endpoint or not p256dh or not auth_key:
            return err(400, 'endpoint, p256dh и auth обязательны')

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f'''INSERT INTO {SCHEMA}.push_subscriptions (user_id, endpoint, p256dh, auth, device_type)
                VALUES (%s, %s, %s, %s, 'web')
                ON CONFLICT (user_id, endpoint) DO UPDATE
                SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth''',
            (user_id, endpoint, p256dh, auth_key)
        )
        conn.commit()
        cur.close()
        conn.close()
        return ok({'ok': True})

    # ── Отписка ──────────────────────────────────────────────────────────────
    if method == 'DELETE' or action == 'unsubscribe':
        if not user_id:
            return err(401, 'Unauthorized')

        endpoint = body.get('endpoint', '')
        conn = get_conn()
        cur = conn.cursor()
        if endpoint:
            cur.execute(f'DELETE FROM {SCHEMA}.push_subscriptions WHERE user_id=%s AND endpoint=%s', (user_id, endpoint))
        else:
            cur.execute(f'DELETE FROM {SCHEMA}.push_subscriptions WHERE user_id=%s', (user_id,))
        conn.commit()
        cur.close()
        conn.close()
        return ok({'ok': True})

    # ── Отправка push (внутренний вызов) ──────────────────────────────────────
    if method == 'POST' and action == 'send':
        target_user_id = body.get('user_id')
        title = body.get('title', 'Studyfay')
        msg_body = body.get('body', '')
        url = body.get('url', '/')
        tag = body.get('tag', 'general')

        if not target_user_id:
            return err(400, 'user_id обязателен')

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            f'SELECT endpoint, p256dh, auth, rustore_token, device_type FROM {SCHEMA}.push_subscriptions WHERE user_id=%s',
            (target_user_id,)
        )
        subs = cur.fetchall()
        cur.close()
        conn.close()

        sent = 0
        failed_endpoints = []
        for endpoint, p256dh, auth_key, rustore_token, device_type in subs:
            if device_type == 'android' and rustore_token:
                result = send_rustore_push(rustore_token, title, msg_body, url)
                if result:
                    sent += 1
            elif endpoint and p256dh and auth_key and VAPID_PRIVATE_KEY:
                try:
                    webpush(
                        subscription_info={'endpoint': endpoint, 'keys': {'p256dh': p256dh, 'auth': auth_key}},
                        data=json.dumps({'title': title, 'body': msg_body, 'url': url, 'tag': tag}),
                        vapid_private_key=VAPID_PRIVATE_KEY,
                        vapid_claims=VAPID_CLAIMS,
                    )
                    sent += 1
                except WebPushException as e:
                    if e.response and e.response.status_code in (404, 410):
                        failed_endpoints.append(endpoint)

        if failed_endpoints:
            conn2 = get_conn()
            cur2 = conn2.cursor()
            for ep in failed_endpoints:
                cur2.execute(f'DELETE FROM {SCHEMA}.push_subscriptions WHERE endpoint=%s', (ep,))
            conn2.commit()
            cur2.close()
            conn2.close()

        return ok({'sent': sent, 'failed': len(failed_endpoints)})

    # ── VAPID публичный ключ (без авторизации) ───────────────────────────────
    if method == 'GET' and action == 'vapid_key':
        return ok({'vapid_public_key': VAPID_PUBLIC_KEY})

    # ── Статус подписки ───────────────────────────────────────────────────────
    if method == 'GET':
        if not user_id:
            return err(401, 'Unauthorized')
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f'SELECT COUNT(*) FROM {SCHEMA}.push_subscriptions WHERE user_id=%s', (user_id,))
        count = cur.fetchone()[0]
        cur.close()
        conn.close()
        return ok({'subscribed': count > 0, 'count': count, 'vapid_public_key': VAPID_PUBLIC_KEY})

    return err(400, 'Неизвестный запрос')
