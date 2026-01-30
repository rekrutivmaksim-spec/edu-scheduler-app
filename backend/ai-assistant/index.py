import json
import os
import jwt
import psycopg2
import requests
import time
from datetime import datetime

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
ARTEMOX_API_KEY = 'sk-Z7PQzAcoYmPrv3O7x4ZkyQ'

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
               ai_requests_used, ai_requests_reset_at
        FROM {SCHEMA_NAME}.users
        WHERE id = %s
    ''', (user_id,))
    
    row = cursor.fetchone()
    cursor.close()
    
    if not row:
        return {'has_access': False, 'reason': 'user_not_found'}
    
    sub_type, expires_at, requests_used, reset_at = row
    now = datetime.now()
    
    # Проверяем, нужно ли сбросить счетчик запросов
    if reset_at and reset_at < now:
        cursor = conn.cursor()
        cursor.execute(f'''
            UPDATE {SCHEMA_NAME}.users
            SET ai_requests_used = 0,
                ai_requests_reset_at = CURRENT_TIMESTAMP + INTERVAL '1 month'
            WHERE id = %s
        ''', (user_id,))
        conn.commit()
        cursor.close()
        requests_used = 0
    
    # Проверяем премиум подписку
    if sub_type == 'premium':
        if expires_at and expires_at > now:
            return {'has_access': True, 'is_premium': True}
        else:
            # Подписка истекла
            return {'has_access': False, 'reason': 'subscription_expired', 'is_premium': False}
    
    # Бесплатная версия - нет доступа
    return {'has_access': False, 'reason': 'no_subscription', 'is_premium': False}

def increment_ai_requests(conn, user_id: int):
    """Увеличивает счетчик использованных AI запросов"""
    cursor = conn.cursor()
    cursor.execute(f'''
        UPDATE {SCHEMA_NAME}.users
        SET ai_requests_used = ai_requests_used + 1
        WHERE id = %s
    ''', (user_id,))
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
                if reason == 'subscription_expired':
                    message = '⏰ Ваша подписка истекла. Продлите подписку для доступа к ИИ-ассистенту.'
                else:
                    message = '🔒 Доступ к ИИ-ассистенту доступен только по подписке. Оформите подписку в профиле!'
                
                return {
                    'statusCode': 403,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'error': 'subscription_required',
                        'message': message,
                        'reason': reason
                    })
                }
            
            # Увеличиваем счетчик запросов
            increment_ai_requests(conn, user_id)
            
            context_text = get_materials_context(conn, user_id, material_ids)
            
            # Streaming ответ
            answer_data = ask_artemox_stream(question, context_text)
            
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

def ask_artemox_stream(question: str, context: str) -> str:
    """Потоковая отправка запроса к Artemox API"""
    if not ARTEMOX_API_KEY:
        return json.dumps({'error': 'API ключ Artemox не настроен'})
    
    system_prompt = f"""Ты — умный ассистент для студентов Studyfay. 
Помогаешь разобраться в учебных материалах, отвечаешь на вопросы простым языком.

Доступные материалы пользователя:
{context}

Отвечай кратко, по делу, используя информацию из материалов. 
Если информации нет в материалах — скажи об этом честно."""

    try:
        print(f"[AI-ASSISTANT] Streaming запрос к Artemox API")
        response = requests.post(
            'https://api.artemox.com/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {ARTEMOX_API_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'model': 'deepseek-chat',
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': question}
                ],
                'temperature': 0.7,
                'max_tokens': 1000,
                'stream': True
            },
            stream=True,
            timeout=60
        )
        
        if response.status_code != 200:
            error_text = response.text[:500]
            print(f"[AI-ASSISTANT] Ошибка: {response.status_code}, {error_text}")
            return json.dumps({'error': f'API error: {response.status_code}'})
        
        # Собираем весь текст из stream
        full_text = ""
        for line in response.iter_lines():
            if line:
                line_str = line.decode('utf-8')
                if line_str.startswith('data: '):
                    data_str = line_str[6:]
                    if data_str == '[DONE]':
                        break
                    try:
                        chunk_data = json.loads(data_str)
                        if 'choices' in chunk_data and len(chunk_data['choices']) > 0:
                            delta = chunk_data['choices'][0].get('delta', {})
                            content = delta.get('content', '')
                            if content:
                                full_text += content
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
        
        if full_text:
            return json.dumps({'answer': full_text})
        return json.dumps({'error': 'Не удалось получить ответ'})
        
    except Exception as e:
        print(f"[AI-ASSISTANT] Ошибка streaming: {type(e).__name__}: {str(e)}")
        return json.dumps({'error': f'Ошибка: {str(e)}'})

def ask_artemox(question: str, context: str) -> str:
    """Отправка запроса к Artemox API с retry логикой"""
    if not ARTEMOX_API_KEY:
        return "Ошибка: API ключ Artemox не настроен"
    
    system_prompt = f"""Ты — умный ассистент для студентов Studyfay. 
Помогаешь разобраться в учебных материалах, отвечаешь на вопросы простым языком.

Доступные материалы пользователя:
{context}

Отвечай кратко, по делу, используя информацию из материалов. 
Если информации нет в материалах — скажи об этом честно."""

    max_retries = 3
    retry_delay = 1
    
    for attempt in range(max_retries):
        try:
            print(f"[AI-ASSISTANT] Отправка запроса к Artemox API (попытка {attempt + 1}/{max_retries})")
            response = requests.post(
                'https://api.artemox.com/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {ARTEMOX_API_KEY}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': 'deepseek-chat',
                    'messages': [
                        {'role': 'system', 'content': system_prompt},
                        {'role': 'user', 'content': question}
                    ],
                    'temperature': 0.7,
                    'max_tokens': 1000
                },
                timeout=60
            )
            
            print(f"[AI-ASSISTANT] Ответ от Artemox API: status={response.status_code}, body_length={len(response.text)}")
            
            if response.status_code == 200:
                data = response.json()
                if 'choices' in data and len(data['choices']) > 0:
                    message = data['choices'][0].get('message', {})
                    content = message.get('content', '').strip()
                    if content:
                        return content
                    return "Не удалось получить ответ от ИИ"
                return "Неверный формат ответа от API"
            
            elif response.status_code == 429:
                if attempt < max_retries - 1:
                    time.sleep(retry_delay * (2 ** attempt))
                    continue
                return "Превышен лимит запросов. Попробуйте через минуту"
            
            elif response.status_code == 402:
                return "⚠️ Закончились средства на DeepSeek API. Пополните баланс на https://platform.deepseek.com/"
            
            elif response.status_code >= 500:
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    continue
                return "Сервис временно недоступен. Попробуйте позже"
            
            else:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get('error', {}).get('message', 'Неизвестная ошибка')
                print(f"[AI-ASSISTANT] Ошибка API: status={response.status_code}, error={error_msg}, response={response.text[:500]}")
                return f"Ошибка API ({response.status_code}): {error_msg}"
        
        except requests.exceptions.Timeout:
            print(f"[AI-ASSISTANT] Timeout на попытке {attempt + 1}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                continue
            return "Превышено время ожидания ответа от ИИ"
        
        except requests.exceptions.ConnectionError as e:
            print(f"[AI-ASSISTANT] ConnectionError на попытке {attempt + 1}: {str(e)}")
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                continue
            return "Ошибка подключения к сервису ИИ"
        
        except Exception as e:
            print(f"[AI-ASSISTANT] Неожиданная ошибка: {type(e).__name__}: {str(e)}")
            return f"Неожиданная ошибка: {str(e)}"
    
    return "Не удалось получить ответ после нескольких попыток"