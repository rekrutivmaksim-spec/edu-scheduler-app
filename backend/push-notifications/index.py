"""
Push-уведомления: подписка и отправка Web Push через VAPID.
POST /subscribe — сохранить подписку браузера
POST /send — отправить push пользователю (внутренний вызов)
DELETE /unsubscribe — удалить подписку
"""
import json
import os
import jwt
import psycopg2
from pywebpush import webpush, WebPushException

DATABASE_URL = os.environ['DATABASE_URL']
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'secret')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_CLAIMS = {'sub': 'mailto:support@studyfay.ru'}

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    # ── Подписка ─────────────────────────────────────────────────────────────
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
            f'''INSERT INTO {SCHEMA}.push_subscriptions (user_id, endpoint, p256dh, auth)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT DO NOTHING''',
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

        if not target_user_id or not VAPID_PRIVATE_KEY:
            return err(400, 'user_id и VAPID ключи обязательны')

        conn = get_conn()
        cur = conn.cursor()
        cur.execute(f'SELECT endpoint, p256dh, auth FROM {SCHEMA}.push_subscriptions WHERE user_id=%s', (target_user_id,))
        subs = cur.fetchall()
        cur.close()
        conn.close()

        sent = 0
        failed_endpoints = []
        for endpoint, p256dh, auth_key in subs:
            try:
                webpush(
                    subscription_info={
                        'endpoint': endpoint,
                        'keys': {'p256dh': p256dh, 'auth': auth_key}
                    },
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
        return ok({'subscribed': count > 0, 'count': count})

    return err(400, 'Неизвестный запрос')
