"""API для генерации шпаргалок из материалов студента"""

import json
import os
import jwt
import psycopg2
from psycopg2.extras import RealDictCursor
from openai import OpenAI

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
ARTEMOX_API_KEY = 'sk-Z7PQzAcoYmPrv3O7x4ZkyQ'


def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except:
        return None


def check_premium_access(conn, user_id: int) -> dict:
    """Проверяет доступ к премиум функциям (включая триал)"""
    from datetime import datetime
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(f'''
        SELECT subscription_type, subscription_expires_at, trial_ends_at, is_trial_used
        FROM {SCHEMA_NAME}.users
        WHERE id = %s
    ''', (user_id,))
    
    user = cursor.fetchone()
    cursor.close()
    
    if not user:
        return {'has_access': False, 'reason': 'user_not_found'}
    
    now = datetime.now()
    
    # Проверяем премиум
    if user.get('subscription_type') == 'premium':
        expires = user.get('subscription_expires_at')
        if expires and expires.replace(tzinfo=None) > now:
            return {'has_access': True, 'is_premium': True, 'is_trial': False}
    
    # Проверяем триал
    trial_ends = user.get('trial_ends_at')
    if trial_ends and not user.get('is_trial_used'):
        if trial_ends.replace(tzinfo=None) > now:
            return {'has_access': True, 'is_premium': False, 'is_trial': True}
    
    return {'has_access': False, 'reason': 'no_premium'}


def get_material_content(conn, material_id: int, user_id: int) -> dict:
    """Получает содержимое материала"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(f'''
        SELECT title, subject, recognized_text, total_chunks
        FROM {SCHEMA_NAME}.materials
        WHERE id = %s AND user_id = %s
    ''', (material_id, user_id))
    
    material = cursor.fetchone()
    if not material:
        return None
    
    # Если материал разбит на чанки, собираем их
    if material.get('total_chunks') and material['total_chunks'] > 1:
        cursor.execute(f'''
            SELECT chunk_text FROM {SCHEMA_NAME}.document_chunks
            WHERE material_id = %s
            ORDER BY chunk_index
        ''', (material_id,))
        chunks = cursor.fetchall()
        full_text = '\n\n'.join([chunk['chunk_text'] for chunk in chunks])
        material['recognized_text'] = full_text
    
    cursor.close()
    return dict(material)


def generate_cheat_sheet(material_data: dict) -> str:
    """Генерирует шпаргалку через Artemox"""
    if not ARTEMOX_API_KEY:
        return "Ошибка: не настроен ключ Artemox"
    
    client = OpenAI(api_key=ARTEMOX_API_KEY, base_url="https://api.artemox.com/v1", timeout=30.0)
    
    text = material_data.get('recognized_text', '')[:6000]  # Берем первые 6000 символов
    title = material_data.get('title', 'Материал')
    subject = material_data.get('subject', '')
    
    prompt = f"""Ты помощник студента. Создай КОМПАКТНУЮ шпаргалку по материалу "{title}" {f'({subject})' if subject else ''}.

Текст материала:
{text}

Создай шпаргалку в формате:

**КЛЮЧЕВЫЕ ПОНЯТИЯ**
• Термин 1: краткое определение
• Термин 2: краткое определение

**ФОРМУЛЫ И ПРАВИЛА** (если есть)
• Формула/правило с кратким пояснением

**ГЛАВНОЕ ДЛЯ ЗАПОМИНАНИЯ**
• Важный факт 1
• Важный факт 2

Требования:
- Максимум 300 слов
- Только самое важное
- Сжато и конкретно
- Удобно для быстрого повторения"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1200,
            temperature=0.5
        )
        return response.choices[0].message.content
    except Exception as e:
        print(f"[CHEAT-SHEET] Ошибка Artemox: {e}")
        error_str = str(e)
        
        # Человекопонятное сообщение об ошибке
        if 'Insufficient Balance' in error_str or '402' in error_str:
            return "⚠️ Шпаргалка временно недоступна: закончился баланс Artemox API. Попробуйте позже или обратитесь к администратору."
        elif 'timeout' in error_str.lower():
            return "⏱️ Превышено время ожидания. Попробуйте с более коротким материалом."
        else:
            return f"❌ Ошибка генерации шпаргалки: {error_str[:200]}"


def handler(event: dict, context) -> dict:
    """Обработчик запросов генерации шпаргалок"""
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
            },
            'body': ''
        }
    
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }
    
    auth_header = event.get('headers', {}).get('X-Authorization', '')
    token = auth_header.replace('Bearer ', '')
    
    if not token:
        return {
            'statusCode': 401,
            'headers': headers,
            'body': json.dumps({'error': 'Требуется авторизация'})
        }
    
    payload = verify_token(token)
    if not payload:
        return {
            'statusCode': 401,
            'headers': headers,
            'body': json.dumps({'error': 'Недействительный токен'})
        }
    
    user_id = payload['user_id']
    
    if method == 'POST':
        body = json.loads(event.get('body', '{}'))
        material_id = body.get('material_id')
        
        if not material_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Укажите material_id'})
            }
        
        conn = psycopg2.connect(DATABASE_URL)
        try:
            # Проверяем доступ к премиум функциям
            access = check_premium_access(conn, user_id)
            if not access['has_access']:
                return {
                    'statusCode': 403,
                    'headers': headers,
                    'body': json.dumps({'error': '🔒 Генерация шпаргалок доступна только в Premium подписке'})
                }
            
            # Получаем материал
            material = get_material_content(conn, material_id, user_id)
            
            if not material:
                return {
                    'statusCode': 404,
                    'headers': headers,
                    'body': json.dumps({'error': 'Материал не найден'})
                }
            
            # Генерируем шпаргалку
            print(f"[CHEAT-SHEET] Генерация для материала {material_id}")
            cheat_sheet = generate_cheat_sheet(material)
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'material_id': material_id,
                    'title': material.get('title'),
                    'subject': material.get('subject'),
                    'cheat_sheet': cheat_sheet
                })
            }
        finally:
            conn.close()
    
    return {
        'statusCode': 405,
        'headers': headers,
        'body': json.dumps({'error': 'Метод не поддерживается'})
    }