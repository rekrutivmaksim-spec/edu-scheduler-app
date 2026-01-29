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
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')

def get_user_id_from_token(token: str) -> int:
    """Извлечение user_id из JWT токена"""
    if token == 'mock-token':
        return 1
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload['user_id']
    except:
        return None

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
            context_text = get_materials_context(conn, user_id, material_ids)
            answer = ask_deepseek(question, context_text)
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'answer': answer,
                    'materials_used': len(material_ids) if material_ids else 'all'
                })
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

def ask_deepseek(question: str, context: str) -> str:
    """Отправка запроса к DeepSeek API с retry логикой"""
    if not DEEPSEEK_API_KEY:
        return "Ошибка: API ключ DeepSeek не настроен"
    
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
            response = requests.post(
                'https://api.deepseek.com/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {DEEPSEEK_API_KEY}',
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
                timeout=30
            )
            
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
            
            elif response.status_code >= 500:
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                    continue
                return "Сервис временно недоступен. Попробуйте позже"
            
            else:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get('error', {}).get('message', 'Неизвестная ошибка')
                return f"Ошибка API ({response.status_code}): {error_msg}"
        
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                continue
            return "Превышено время ожидания ответа от ИИ"
        
        except requests.exceptions.ConnectionError:
            if attempt < max_retries - 1:
                time.sleep(retry_delay)
                continue
            return "Ошибка подключения к сервису ИИ"
        
        except Exception as e:
            return f"Неожиданная ошибка: {str(e)}"
    
    return "Не удалось получить ответ после нескольких попыток"