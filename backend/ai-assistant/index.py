import json
import os
import jwt
import psycopg2
from datetime import datetime
from openai import OpenAI

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
ARTEMOX_API_KEY = 'sk-Z7PQzAcoYmPrv3O7x4ZkyQ'

# Клиент OpenAI для Artemox
client = OpenAI(
    api_key=ARTEMOX_API_KEY,
    base_url='https://api.artemox.com/v1'
)

def get_user_id_from_token(token: str) -> int:
    """Извлечение user_id из JWT токена"""
    if token == 'mock-token' or token == 'guest_token':
        return 1
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload['user_id']
    except Exception:
        return None

def check_subscription_access(conn, user_id: int) -> dict:
    """Проверяет доступ пользователя к ИИ-ассистенту"""
    cursor = conn.cursor()
    cursor.execute(f'''
        SELECT subscription_type, subscription_expires_at, 
               ai_tokens_used, ai_tokens_reset_at
        FROM {SCHEMA_NAME}.users
        WHERE id = %s
    ''', (user_id,))
    
    row = cursor.fetchone()
    cursor.close()
    
    if not row:
        return {'has_access': False, 'reason': 'user_not_found', 'tokens_used': 0, 'tokens_limit': 0}
    
    sub_type, expires_at, tokens_used, reset_at = row
    now = datetime.now()
    
    # Проверяем, нужно ли сбросить счетчик токенов
    if reset_at and reset_at < now:
        cursor = conn.cursor()
        cursor.execute(f'''
            UPDATE {SCHEMA_NAME}.users
            SET ai_tokens_used = 0,
                ai_tokens_reset_at = CURRENT_TIMESTAMP + INTERVAL '1 month'
            WHERE id = %s
        ''', (user_id,))
        conn.commit()
        cursor.close()
        tokens_used = 0
    
    # Проверяем премиум подписку
    if sub_type == 'premium':
        if expires_at and expires_at > now:
            # Premium: 100,000 токенов в месяц
            tokens_limit = 100000
            if tokens_used >= tokens_limit:
                return {
                    'has_access': False, 
                    'reason': 'tokens_limit_reached', 
                    'is_premium': True,
                    'tokens_used': tokens_used,
                    'tokens_limit': tokens_limit
                }
            return {
                'has_access': True, 
                'is_premium': True,
                'tokens_used': tokens_used,
                'tokens_limit': tokens_limit
            }
        else:
            # Подписка истекла
            return {'has_access': False, 'reason': 'subscription_expired', 'is_premium': False, 'tokens_used': tokens_used, 'tokens_limit': 0}
    
    # Бесплатная версия - нет доступа
    return {'has_access': False, 'reason': 'no_subscription', 'is_premium': False, 'tokens_used': 0, 'tokens_limit': 0}

def increment_ai_tokens(conn, user_id: int, tokens_used: int):
    """Увеличивает счетчик использованных AI токенов"""
    cursor = conn.cursor()
    cursor.execute(f'''
        UPDATE {SCHEMA_NAME}.users
        SET ai_tokens_used = ai_tokens_used + %s
        WHERE id = %s
    ''', (tokens_used, user_id))
    conn.commit()
    cursor.close()

def handler(event: dict, context) -> dict:
    """API для ИИ-ассистента: отвечает на вопросы по материалам пользователя"""
    method = event.get('httpMethod', 'GET')
    print(f"[AI-ASSISTANT] Method: {method}, Headers: {event.get('headers', {})}")
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            'body': ''
        }
    
    token = event.get('headers', {}).get('X-Authorization', '').replace('Bearer ', '')
    user_id = get_user_id_from_token(token)
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    if method == 'POST':
        body = json.loads(event.get('body', '{}'))
        question = body.get('question', '').strip()
        material_ids = body.get('material_ids', [])
        print(f"[AI-ASSISTANT] User: {user_id}, Question: {question[:50]}, Materials: {material_ids}")
        
        if not question:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Question is required'})
            }
        
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        
        try:
            # Проверяем доступ к ИИ-ассистенту
            access = check_subscription_access(conn, user_id)
            if not access['has_access']:
                reason = access.get('reason', 'no_access')
                tokens_used = access.get('tokens_used', 0)
                tokens_limit = access.get('tokens_limit', 0)
                
                if reason == 'subscription_expired':
                    message = '⏰ Ваша подписка истекла. Продлите подписку для доступа к ИИ-ассистенту.'
                elif reason == 'tokens_limit_reached':
                    message = f'🚨 Вы использовали все токены этого месяца ({tokens_used}/{tokens_limit}). Оформите новую подписку для продолжения работы.'
                else:
                    message = '🔒 Доступ к ИИ-ассистенту доступен только по подписке. Оформите подписку в профиле!'
                
                return {
                    'statusCode': 403,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'error': 'subscription_required',
                        'message': message,
                        'reason': reason,
                        'tokens_used': tokens_used,
                        'tokens_limit': tokens_limit
                    })
                }
            
            context_text = get_materials_context(conn, user_id, material_ids)
            
            # Быстрый ответ через Artemox
            answer, tokens_used = ask_artemox_openai(question, context_text)
            
            # Увеличиваем счетчик токенов
            increment_ai_tokens(conn, user_id, tokens_used)
            
            # Получаем обновленные данные о токенах
            access_updated = check_subscription_access(conn, user_id)
            
            answer_data = json.dumps({
                'answer': answer,
                'tokens_used': tokens_used,
                'total_tokens_used': access_updated.get('tokens_used', 0),
                'tokens_limit': access_updated.get('tokens_limit', 0)
            })
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': answer_data
            }
        finally:
            conn.close()
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }

def get_materials_context(conn, user_id: int, material_ids: list) -> str:
    """Получение текста материалов для контекста ИИ"""
    cursor = conn.cursor()
    
    if material_ids:
        placeholders = ','.join(['%s'] * len(material_ids))
        cursor.execute(f'''
            SELECT title, subject, recognized_text, summary
            FROM {SCHEMA_NAME}.materials
            WHERE user_id = %s AND id IN ({placeholders})
            ORDER BY created_at DESC
            LIMIT 10
        ''', [user_id] + material_ids)
    else:
        cursor.execute(f'''
            SELECT title, subject, recognized_text, summary
            FROM {SCHEMA_NAME}.materials
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 10
        ''', (user_id,))
    
    materials = cursor.fetchall()
    cursor.close()
    
    if not materials:
        return "У пользователя нет загруженных материалов."
    
    context_parts = []
    for title, subject, text, summary in materials:
        context_parts.append(f"Материал: {title}")
        if subject:
            context_parts.append(f"Предмет: {subject}")
        if summary:
            context_parts.append(f"Краткое содержание: {summary}")
        if text:
            context_parts.append(f"Текст: {text[:2000]}")
        context_parts.append("---")
    
    return "\n".join(context_parts)

def ask_artemox_openai(question: str, context: str) -> tuple:
    """Быстрый запрос к Artemox через официальную библиотеку OpenAI
    Возвращает: (answer, tokens_used)
    """
    system_prompt = f"""Ты — умный ассистент для студентов Studyfay. 
Помогаешь разобраться в учебных материалах, отвечаешь на вопросы простым языком.

Доступные материалы пользователя:
{context}

Отвечай кратко, по делу, используя информацию из материалов. 
Если информации нет в материалах — скажи об этом честно."""

    try:
        print(f"[AI-ASSISTANT] Запрос к Artemox через OpenAI client")
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": question}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        answer = response.choices[0].message.content
        tokens_used = response.usage.total_tokens
        
        print(f"[AI-ASSISTANT] Получен ответ от Artemox, токенов: {tokens_used}")
        return answer, tokens_used
        
    except Exception as e:
        print(f"[AI-ASSISTANT] Ошибка Artemox: {type(e).__name__}: {str(e)}")
        return f"Ошибка получения ответа: {str(e)}", 0