import json
import os
import jwt
import psycopg2
from datetime import datetime, timedelta
import urllib.request
import urllib.parse

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
    """VK OAuth авторизация через oauth.vk.com"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body', '{}'))
    action = body.get('action')

    if action == 'get_auth_url':
        if not VK_APP_ID:
            return err('VK App ID не настроен')

        auth_url = (
            f'https://oauth.vk.com/authorize'
            f'?client_id={VK_APP_ID}'
            f'&display=page'
            f'&redirect_uri={REDIRECT_URI}'
            f'&scope=email'
            f'&response_type=code'
            f'&v=5.131'
        )
        print(f"[VK] auth_url={auth_url}")
        return ok({'auth_url': auth_url})

    elif action == 'exchange_code':
        code = body.get('code', '')
        if not code:
            return err('Код авторизации обязателен')
        if not VK_APP_ID or not VK_APP_SECRET:
            return err('VK настройки не заполнены')

        try:
            params = urllib.parse.urlencode({
                'client_id': VK_APP_ID,
                'client_secret': VK_APP_SECRET,
                'redirect_uri': REDIRECT_URI,
                'code': code
            })
            url = f'https://oauth.vk.com/access_token?{params}'
            print(f"[VK] token request")
            response = urllib.request.urlopen(url)
            token_data = json.loads(response.read().decode())
            print(f"[VK] token response keys: {list(token_data.keys())}")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            print(f"[VK] token error: {e.code} {error_body}")
            return err(f'VK ошибка: {error_body}')
        except Exception as e:
            print(f"[VK] token exception: {e}")
            return err(f'Ошибка обмена кода: {str(e)}')

        access_token = token_data.get('access_token')
        if not access_token:
            return err('Не удалось получить токен VK')

        email = token_data.get('email', '')

        try:
            params = urllib.parse.urlencode({
                'access_token': access_token,
                'v': '5.131',
                'fields': 'photo_200'
            })
            url = f'https://api.vk.com/method/users.get?{params}'
            response = urllib.request.urlopen(url)
            data = json.loads(response.read().decode())
            print(f"[VK] users.get ok")

            if 'response' in data and len(data['response']) > 0:
                user = data['response'][0]
                vk_id = str(user['id'])
                first_name = user.get('first_name', '')
                last_name = user.get('last_name', '')
                avatar_url = user.get('photo_200', '')
            else:
                return err('Не удалось получить данные пользователя VK')
        except Exception as e:
            print(f"[VK] users.get error: {e}")
            return err('Не удалось получить данные пользователя VK')

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
                (vk_id, email, password_hash, full_name, avatar_url, is_guest, onboarding_completed, last_login_at)
                VALUES (%s, %s, '', %s, %s, false, false, %s) RETURNING id
            ''', (vk_id, user_email, full_name, avatar_url, datetime.now()))
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

    return err('Неизвестное действие')
