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

def get_vk_user_info(access_token: str) -> dict:
    """Получение информации о пользователе VK"""
    try:
        params = urllib.parse.urlencode({
            'access_token': access_token,
            'v': '5.131',
            'fields': 'photo_200'
        })
        
        url = f'https://api.vk.com/method/users.get?{params}'
        response = urllib.request.urlopen(url)
        data = json.loads(response.read().decode())
        
        if 'response' in data and len(data['response']) > 0:
            user = data['response'][0]
            return {
                'vk_id': str(user['id']),
                'first_name': user.get('first_name', ''),
                'last_name': user.get('last_name', ''),
                'avatar_url': user.get('photo_200', '')
            }
        return None
    except Exception:
        return None

def handler(event: dict, context) -> dict:
    """API для VK OAuth авторизации"""
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    try:
        body = json.loads(event.get('body', '{}'))
        action = body.get('action')
        
        # Получение ссылки для авторизации VK
        if action == 'get_auth_url':
            redirect_uri = body.get('redirect_uri', '')
            
            if not VK_APP_ID:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'VK App ID не настроен'})
                }
            
            auth_url = f'https://oauth.vk.com/authorize?client_id={VK_APP_ID}&display=page&redirect_uri={redirect_uri}&scope=email&response_type=code&v=5.131'
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'auth_url': auth_url})
            }
        
        # Обмен кода на токен и вход
        elif action == 'exchange_code':
            code = body.get('code', '')
            redirect_uri = body.get('redirect_uri', '')
            
            if not code:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Код авторизации обязателен'})
                }
            
            if not VK_APP_ID or not VK_APP_SECRET:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'VK настройки не заполнены'})
                }
            
            # Обмениваем код на токен
            try:
                params = urllib.parse.urlencode({
                    'client_id': VK_APP_ID,
                    'client_secret': VK_APP_SECRET,
                    'redirect_uri': redirect_uri,
                    'code': code
                })
                
                url = f'https://oauth.vk.com/access_token?{params}'
                response = urllib.request.urlopen(url)
                token_data = json.loads(response.read().decode())
                
                if 'access_token' not in token_data:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'Не удалось получить токен VK'})
                    }
                
                access_token = token_data['access_token']
                vk_user_id = str(token_data.get('user_id', ''))
                email = token_data.get('email', '')
                
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': f'Ошибка обмена кода: {str(e)}'})
                }
            
            # Получаем данные пользователя
            vk_info = get_vk_user_info(access_token)
            if not vk_info:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Не удалось получить данные пользователя VK'})
                }
            
            conn = psycopg2.connect(DATABASE_URL)
            cur = conn.cursor()
            
            # Ищем пользователя по VK ID
            cur.execute(f'''
                SELECT id, full_name, email, university, faculty, course, avatar_url, onboarding_completed
                FROM {SCHEMA_NAME}.users
                WHERE vk_id = %s
            ''', (vk_info['vk_id'],))
            
            user_row = cur.fetchone()
            
            full_name = f"{vk_info['first_name']} {vk_info['last_name']}".strip()
            
            if user_row:
                user_id, stored_name, stored_email, university, faculty, course, avatar_url, onboarding_completed = user_row
                
                # Обновляем аватарку и время входа
                cur.execute(f'''
                    UPDATE {SCHEMA_NAME}.users
                    SET avatar_url = %s, last_login_at = %s
                    WHERE id = %s
                ''', (vk_info['avatar_url'], datetime.now(), user_id))
                conn.commit()
                
                full_name = stored_name or full_name
                email = stored_email or email
            else:
                # Создаём нового пользователя
                user_email = email or f'vk_{vk_info["vk_id"]}@studyfay.app'
                
                cur.execute(f'''
                    INSERT INTO {SCHEMA_NAME}.users 
                    (vk_id, email, password_hash, full_name, avatar_url, is_guest, onboarding_completed, last_login_at)
                    VALUES (%s, %s, '', %s, %s, false, false, %s)
                    RETURNING id
                ''', (vk_info['vk_id'], user_email, full_name, vk_info['avatar_url'], datetime.now()))
                
                user_id = cur.fetchone()[0]
                email = user_email
                university = None
                faculty = None
                course = None
                onboarding_completed = False
                conn.commit()
            
            # Сохраняем OAuth токен
            cur.execute(f'''
                INSERT INTO {SCHEMA_NAME}.oauth_tokens (user_id, provider, access_token)
                VALUES (%s, 'vk', %s)
            ''', (user_id, access_token))
            conn.commit()
            
            cur.close()
            conn.close()
            
            # Генерируем JWT токен
            token = jwt.encode({
                'user_id': user_id,
                'vk_id': vk_info['vk_id'],
                'exp': datetime.utcnow() + timedelta(days=30)
            }, JWT_SECRET, algorithm='HS256')
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'token': token,
                    'user': {
                        'id': user_id,
                        'full_name': full_name,
                        'email': email,
                        'university': university,
                        'faculty': faculty,
                        'course': course,
                        'avatar_url': vk_info['avatar_url'],
                        'onboarding_completed': onboarding_completed
                    }
                })
            }
        
        else:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Неизвестное действие'})
            }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)})
        }