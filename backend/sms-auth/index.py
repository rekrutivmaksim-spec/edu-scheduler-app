import json
import os
import jwt
import psycopg2
import random
import string
from datetime import datetime, timedelta

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
SMS_RU_API_KEY = os.environ.get('SMS_RU_API_KEY', '')

def send_sms(phone: str, code: str) -> bool:
    """Отправка SMS через SMS.RU (или тестовый режим)"""
    if not SMS_RU_API_KEY:
        return True
    
    try:
        import urllib.request
        import urllib.parse
        
        params = urllib.parse.urlencode({
            'api_id': SMS_RU_API_KEY,
            'to': phone,
            'msg': f'Ваш код для входа в Studyfay: {code}',
            'json': 1
        })
        
        url = f'https://sms.ru/sms/send?{params}'
        response = urllib.request.urlopen(url)
        data = json.loads(response.read().decode())
        
        return data.get('status') == 'OK'
    except Exception:
        return False

def generate_code() -> str:
    """Генерация 6-значного кода"""
    return ''.join(random.choices(string.digits, k=6))

def handler(event: dict, context) -> dict:
    """API для SMS-авторизации: отправка и проверка кодов"""
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
        
        conn = psycopg2.connect(DATABASE_URL)
        cur = conn.cursor()
        
        # Отправка SMS-кода
        if action == 'send_code':
            phone = body.get('phone', '').strip()
            
            if not phone or len(phone) < 10:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Некорректный номер телефона'})
                }
            
            # Очищаем номер (оставляем только цифры и +)
            phone = ''.join(c for c in phone if c.isdigit() or c == '+')
            if not phone.startswith('+'):
                phone = '+' + phone
            
            # Генерируем код
            code = generate_code()
            expires_at = datetime.now() + timedelta(minutes=5)
            
            # Сохраняем в БД
            cur.execute(f'''
                INSERT INTO {SCHEMA_NAME}.sms_codes (phone, code, expires_at)
                VALUES (%s, %s, %s)
            ''', (phone, code, expires_at))
            conn.commit()
            
            # Отправляем SMS
            sms_sent = send_sms(phone, code)
            
            cur.close()
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'message': 'Код отправлен',
                    'test_mode': not SMS_RU_API_KEY,
                    'test_code': code if not SMS_RU_API_KEY else None
                })
            }
        
        # Проверка SMS-кода и вход
        elif action == 'verify_code':
            phone = body.get('phone', '').strip()
            code = body.get('code', '').strip()
            
            if not phone or not code:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Телефон и код обязательны'})
                }
            
            # Очищаем номер
            phone = ''.join(c for c in phone if c.isdigit() or c == '+')
            if not phone.startswith('+'):
                phone = '+' + phone
            
            # Проверяем код
            cur.execute(f'''
                SELECT id, code, expires_at, verified, attempts
                FROM {SCHEMA_NAME}.sms_codes
                WHERE phone = %s
                ORDER BY created_at DESC
                LIMIT 1
            ''', (phone,))
            
            row = cur.fetchone()
            
            if not row:
                cur.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Код не найден. Запросите новый код'})
                }
            
            sms_id, stored_code, expires_at, verified, attempts = row
            
            # Проверяем срок действия
            if datetime.now() > expires_at:
                cur.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Код истёк. Запросите новый код'})
                }
            
            # Проверяем попытки
            if attempts >= 3:
                cur.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Слишком много попыток. Запросите новый код'})
                }
            
            # Проверяем код
            if code != stored_code:
                cur.execute(f'''
                    UPDATE {SCHEMA_NAME}.sms_codes
                    SET attempts = attempts + 1
                    WHERE id = %s
                ''', (sms_id,))
                conn.commit()
                cur.close()
                conn.close()
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': f'Неверный код. Осталось попыток: {2 - attempts}'})
                }
            
            # Код верный! Помечаем как использованный
            cur.execute(f'''
                UPDATE {SCHEMA_NAME}.sms_codes
                SET verified = true
                WHERE id = %s
            ''', (sms_id,))
            conn.commit()
            
            # Ищем или создаём пользователя
            cur.execute(f'''
                SELECT id, full_name, email, university, faculty, course, avatar_url, onboarding_completed
                FROM {SCHEMA_NAME}.users
                WHERE phone = %s
            ''', (phone,))
            
            user_row = cur.fetchone()
            
            if user_row:
                user_id, full_name, email, university, faculty, course, avatar_url, onboarding_completed = user_row
                
                # Обновляем время последнего входа
                cur.execute(f'''
                    UPDATE {SCHEMA_NAME}.users
                    SET last_login_at = %s, phone_verified = true
                    WHERE id = %s
                ''', (datetime.now(), user_id))
                conn.commit()
            else:
                # Создаём нового пользователя
                cur.execute(f'''
                    INSERT INTO {SCHEMA_NAME}.users 
                    (phone, phone_verified, email, password_hash, full_name, is_guest, onboarding_completed, last_login_at)
                    VALUES (%s, true, %s, '', '', false, false, %s)
                    RETURNING id
                ''', (phone, f'user_{phone}@studyfay.app', datetime.now()))
                
                user_id = cur.fetchone()[0]
                full_name = ''
                email = None
                university = None
                faculty = None
                course = None
                avatar_url = None
                onboarding_completed = False
                conn.commit()
            
            cur.close()
            conn.close()
            
            # Генерируем JWT токен
            token = jwt.encode({
                'user_id': user_id,
                'phone': phone,
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
                        'phone': phone,
                        'full_name': full_name,
                        'email': email,
                        'university': university,
                        'faculty': faculty,
                        'course': course,
                        'avatar_url': avatar_url,
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