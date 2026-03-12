import json
import os
import jwt
import psycopg2
import hashlib
import base64
from datetime import datetime, timedelta
import urllib.request
import urllib.parse
import urllib.error

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
VK_APP_ID = os.environ.get('VK_APP_ID', '')
VK_APP_SECRET = os.environ.get('VK_APP_SECRET', '')
REDIRECT_URI = 'https://studyfay.ru/auth/vk'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
}

def ok(data):
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(data)}

def err(msg, code=400):
    return {'statusCode': code, 'headers': CORS, 'body': json.dumps({'error': msg})}

def handler(event, context):
    """VK ID OAuth авторизация (id.vk.com, PKCE)"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body', '{}'))
    action = body.get('action')

    if action == 'get_auth_url':
        if not VK_APP_ID:
            return err('VK App ID не настроен')

        code_verifier = body.get('code_verifier', '')
        state = body.get('state', '')

        sha256 = hashlib.sha256(code_verifier.encode('ascii')).digest()
        code_challenge = base64.urlsafe_b64encode(sha256).rstrip(b'=').decode('ascii')

        params = urllib.parse.urlencode({
            'response_type': 'code',
            'client_id': VK_APP_ID,
            'redirect_uri': REDIRECT_URI,
            'state': state,
            'scope': 'vkid.personal_info email',
            'code_challenge': code_challenge,
            'code_challenge_method': 'S256',
        })

        auth_url = f'https://id.vk.com/authorize?{params}'
        print(f"[VK] auth_url={auth_url}")
        return ok({'auth_url': auth_url})

    elif action == 'exchange_code':
        code = body.get('code', '')
        code_verifier = body.get('code_verifier', '')
        device_id = body.get('device_id', '')
        state = body.get('state', '')

        if not code:
            return err('Код авторизации обязателен')
        if not VK_APP_ID or not VK_APP_SECRET:
            return err('VK настройки не заполнены')

        token_params = {
            'grant_type': 'authorization_code',
            'code': code,
            'code_verifier': code_verifier,
            'client_id': VK_APP_ID,
            'redirect_uri': REDIRECT_URI,
        }
        if device_id:
            token_params['device_id'] = device_id
        if state:
            token_params['state'] = state

        try:
            token_body = urllib.parse.urlencode(token_params).encode('utf-8')
            req = urllib.request.Request(
                'https://id.vk.com/oauth2/auth',
                data=token_body,
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )
            response = urllib.request.urlopen(req)
            token_data = json.loads(response.read().decode())
            print(f"[VK] token response keys: {list(token_data.keys())}")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            print(f"[VK] token error: {e.code} {error_body}")
            return err(f'VK token error: {error_body}')

        access_token = token_data.get('access_token')
        if not access_token:
            print(f"[VK] no access_token: {token_data}")
            return err('Не удалось получить токен VK')

        try:
            user_body = urllib.parse.urlencode({
                'access_token': access_token,
                'client_id': VK_APP_ID,
            }).encode('utf-8')
            req = urllib.request.Request(
                'https://id.vk.com/oauth2/user_info',
                data=user_body,
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )
            response = urllib.request.urlopen(req)
            user_info = json.loads(response.read().decode())
            print(f"[VK] user_info keys: {list(user_info.get('user', user_info).keys()) if isinstance(user_info.get('user', user_info), dict) else 'raw'}")

            user_data = user_info.get('user', user_info)
            vk_id = str(user_data.get('user_id', user_data.get('id', '')))
            first_name = user_data.get('first_name', '')
            last_name = user_data.get('last_name', '')
            avatar_url = user_data.get('avatar', user_data.get('photo_200', ''))
            email = user_data.get('email', token_data.get('email', ''))
        except Exception as e:
            print(f"[VK] user_info error: {e}")
            return err('Не удалось получить данные пользователя VK')

        if not vk_id:
            return err('Не удалось определить VK ID')

        full_name = f"{first_name} {last_name}".strip()

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute(f'''
            SELECT id, full_name, email, university, faculty, course, avatar_url, onboarding_completed
            FROM {SCHEMA_NAME}.users WHERE vk_id = %s
        ''', (vk_id,))
        user_row = cur.fetchone()

        if user_row:
            user_id, stored_name, stored_email, university, faculty, course, db_avatar, onboarding_completed = user_row
            cur.execute(f'''
                UPDATE {SCHEMA_NAME}.users SET avatar_url = %s, last_login_at = %s WHERE id = %s
            ''', (avatar_url or db_avatar, datetime.now(), user_id))
            conn.commit()
            full_name = stored_name or full_name
            email = stored_email or email
        else:
            user_email = email or f'vk_{vk_id}@studyfay.app'
            cur.execute(f'''
                INSERT INTO {SCHEMA_NAME}.users
                (vk_id, email, password_hash, full_name, avatar_url, is_guest, onboarding_completed, last_login_at,
                 trial_ends_at, is_trial_used)
                VALUES (%s, %s, '', %s, %s, false, false, %s,
                        %s, false) RETURNING id
            ''', (vk_id, user_email, full_name, avatar_url, datetime.now(),
                  datetime.now() + timedelta(days=3)))
            user_id = cur.fetchone()[0]
            email = user_email
            university = None
            faculty = None
            course = None
            onboarding_completed = False
            conn.commit()

        cur.execute(f'''
            INSERT INTO {SCHEMA_NAME}.oauth_tokens (user_id, provider, access_token)
            VALUES (%s, 'vk', %s)
        ''', (user_id, access_token))
        conn.commit()
        cur.close()
        conn.close()

        token = jwt.encode({
            'user_id': user_id,
            'vk_id': vk_id,
            'exp': datetime.utcnow() + timedelta(days=30)
        }, JWT_SECRET, algorithm='HS256')

        return ok({
            'success': True,
            'token': token,
            'user': {
                'id': user_id,
                'full_name': full_name,
                'email': email,
                'university': university,
                'faculty': faculty,
                'course': course,
                'avatar_url': avatar_url,
                'onboarding_completed': onboarding_completed
            }
        })

    elif action == 'link_account':
        token = body.get('token', '')
        vk_id = body.get('vk_id', '')

        if not token or not vk_id:
            return err('Токен и VK ID обязательны')

        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            user_id = payload.get('user_id')
        except Exception:
            return err('Невалидный токен', 401)

        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()

        cur.execute(f'SELECT id FROM {SCHEMA_NAME}.users WHERE vk_id = %s', (vk_id,))
        existing = cur.fetchone()
        if existing and existing[0] != user_id:
            cur.close()
            conn.close()
            return err('Этот VK-аккаунт уже привязан к другому пользователю')

        cur.execute(f'UPDATE {SCHEMA_NAME}.users SET vk_id = %s WHERE id = %s', (vk_id, user_id))
        conn.commit()
        cur.close()
        conn.close()

        return ok({'success': True})

    return err('Неизвестное действие')