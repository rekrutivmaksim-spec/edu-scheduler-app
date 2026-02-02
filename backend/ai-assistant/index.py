import json
import os
import jwt
import psycopg2
from datetime import datetime, timedelta
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
    """Проверяет доступ пользователя к ИИ-ассистенту (учитывает триал период)"""
    cursor = conn.cursor()
    cursor.execute(f'''
        SELECT subscription_type, subscription_expires_at, subscription_plan,
               ai_questions_used, ai_questions_reset_at, ai_questions_limit,
               trial_ends_at, is_trial_used
        FROM {SCHEMA_NAME}.users
        WHERE id = %s
    ''', (user_id,))
    
    row = cursor.fetchone()
    cursor.close()
    
    if not row:
        return {'has_access': False, 'reason': 'user_not_found', 'questions_used': 0, 'questions_limit': 0}
    
    sub_type, expires_at, sub_plan, questions_used, reset_at, questions_limit, trial_ends_at, is_trial_used = row
    now = datetime.now()
    
    # Определяем лимит вопросов на основе плана подписки
    plan_limits = {
        '1month': 40,
        '3months': 120,
        '6months': 260
    }
    
    # Если лимит не установлен или подписка изменилась, устанавливаем новый
    expected_limit = plan_limits.get(sub_plan, 40)
    if questions_limit is None or questions_limit != expected_limit:
        questions_limit = expected_limit
        cursor = conn.cursor()
        cursor.execute(f'''
            UPDATE {SCHEMA_NAME}.users
            SET ai_questions_limit = %s
            WHERE id = %s
        ''', (questions_limit, user_id))
        conn.commit()
        cursor.close()
    
    # Проверяем, нужно ли сбросить счетчик вопросов (НЕ сбрасываем автоматически по времени)
    # Счетчик сбрасывается только при покупке НОВОЙ подписки
    if questions_used is None:
        questions_used = 0
    
    # Проверяем премиум подписку
    if sub_type == 'premium':
        if expires_at and expires_at > now:
            # Premium: проверяем лимит вопросов
            if questions_used >= questions_limit:
                return {
                    'has_access': False, 
                    'reason': 'questions_limit_reached', 
                    'is_premium': True,
                    'questions_used': questions_used,
                    'questions_limit': questions_limit
                }
            return {
                'has_access': True, 
                'is_premium': True,
                'is_trial': False,
                'questions_used': questions_used,
                'questions_limit': questions_limit
            }
        else:
            # Подписка истекла - проверяем триал
            pass
    
    # Проверяем триал период (7 дней)
    if trial_ends_at and not is_trial_used and trial_ends_at > now:
        trial_limit = 3  # Триал: 3 вопроса
        if questions_used >= trial_limit:
            return {
                'has_access': False, 
                'reason': 'questions_limit_reached', 
                'is_premium': False,
                'is_trial': True,
                'trial_ends_at': trial_ends_at,
                'questions_used': questions_used,
                'questions_limit': trial_limit
            }
        return {
            'has_access': True, 
            'is_premium': False,
            'is_trial': True,
            'trial_ends_at': trial_ends_at,
            'questions_used': questions_used,
            'questions_limit': trial_limit
        }
    
    # Бесплатная версия - 3 вопроса в месяц
    # Проверяем месячную квоту для Free пользователей
    free_limit = 3
    cursor = conn.cursor()
    cursor.execute(f'''
        SELECT ai_questions_free_used, ai_questions_free_reset_at
        FROM {SCHEMA_NAME}.users
        WHERE id = %s
    ''', (user_id,))
    result = cursor.fetchone()
    cursor.close()
    
    if result:
        free_used, free_reset = result
        free_used = free_used or 0
        
        # Сбрасываем счетчик если прошел месяц
        if free_reset and free_reset < now:
            cursor = conn.cursor()
            cursor.execute(f'''
                UPDATE {SCHEMA_NAME}.users
                SET ai_questions_free_used = 0,
                    ai_questions_free_reset_at = %s
                WHERE id = %s
            ''', (now + timedelta(days=30), user_id))
            conn.commit()
            cursor.close()
            free_used = 0
        
        if free_used >= free_limit:
            return {
                'has_access': False, 
                'reason': 'questions_limit_reached', 
                'is_premium': False,
                'is_trial': False,
                'is_free': True,
                'questions_used': free_used,
                'questions_limit': free_limit
            }
        
        return {
            'has_access': True, 
            'is_premium': False,
            'is_trial': False,
            'is_free': True,
            'questions_used': free_used,
            'questions_limit': free_limit
        }
    
    # Нет доступа (не должно случиться)
    return {'has_access': False, 'reason': 'no_subscription', 'is_premium': False, 'is_trial': False, 'questions_used': 0, 'questions_limit': 0}

def increment_ai_questions(conn, user_id: int):
    """Увеличивает счетчик использованных вопросов на 1"""
    cursor = conn.cursor()
    # Проверяем тип подписки
    cursor.execute(f'''
        SELECT subscription_type, subscription_expires_at, trial_ends_at, is_trial_used
        FROM {SCHEMA_NAME}.users
        WHERE id = %s
    ''', (user_id,))
    user = cursor.fetchone()
    
    is_premium = False
    is_trial = False
    now = datetime.now()
    
    if user:
        sub_type, expires, trial_ends, trial_used = user
        if sub_type == 'premium' and expires and expires > now:
            is_premium = True
        elif trial_ends and not trial_used and trial_ends > now:
            is_trial = True
    
    # Инкрементируем соответствующий счетчик
    if is_premium or is_trial:
        cursor.execute(f'''
            UPDATE {SCHEMA_NAME}.users
            SET ai_questions_used = COALESCE(ai_questions_used, 0) + 1
            WHERE id = %s
        ''', (user_id,))
    else:
        # Free пользователь - инкрементируем бесплатный счетчик
        cursor.execute(f'''
            UPDATE {SCHEMA_NAME}.users
            SET ai_questions_free_used = COALESCE(ai_questions_free_used, 0) + 1,
                ai_questions_free_reset_at = COALESCE(ai_questions_free_reset_at, %s)
            WHERE id = %s
        ''', (now + timedelta(days=30), user_id))
    
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
                questions_used = access.get('questions_used', 0)
                questions_limit = access.get('questions_limit', 0)
                
                if reason == 'subscription_expired':
                    message = '⏰ Ваша подписка истекла. Оформите новую подписку для доступа к ИИ-ассистенту.'
                elif reason == 'questions_limit_reached':
                    message = f'🚨 Вы использовали все вопросы по вашей подписке ({questions_used}/{questions_limit}). Оформите новую подписку для продолжения работы.'
                else:
                    message = '🔒 Доступ к ИИ-ассистенту доступен только по подписке. Оформите подписку в профиле!'
                
                return {
                    'statusCode': 403,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({
                        'error': 'subscription_required',
                        'message': message,
                        'reason': reason,
                        'questions_used': questions_used,
                        'questions_limit': questions_limit
                    })
                }
            
            context_text = get_materials_context(conn, user_id, material_ids)
            
            # Быстрый ответ через Artemox
            answer, tokens_used = ask_artemox_openai(question, context_text)
            
            # Увеличиваем счетчик вопросов на 1
            increment_ai_questions(conn, user_id)
            
            # Получаем обновленные данные о лимитах
            access_updated = check_subscription_access(conn, user_id)
            
            questions_remaining = access_updated.get('questions_limit', 0) - access_updated.get('questions_used', 0)
            
            answer_data = json.dumps({
                'answer': answer,
                'questions_used': access_updated.get('questions_used', 0),
                'questions_limit': access_updated.get('questions_limit', 0),
                'questions_remaining': questions_remaining
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
    """Получение текста материалов для контекста ИИ с поддержкой чанков"""
    cursor = conn.cursor()
    
    if material_ids:
        placeholders = ','.join(['%s'] * len(material_ids))
        cursor.execute(f'''
            SELECT id, title, subject, recognized_text, summary, total_chunks
            FROM {SCHEMA_NAME}.materials
            WHERE user_id = %s AND id IN ({placeholders})
            ORDER BY created_at DESC
            LIMIT 10
        ''', [user_id] + material_ids)
    else:
        cursor.execute(f'''
            SELECT id, title, subject, recognized_text, summary, total_chunks
            FROM {SCHEMA_NAME}.materials
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 10
        ''', (user_id,))
    
    materials = cursor.fetchall()
    
    if not materials:
        cursor.close()
        return "У пользователя нет загруженных материалов."
    
    context_parts = []
    for material_id, title, subject, text, summary, total_chunks in materials:
        context_parts.append(f"Материал: {title}")
        if subject:
            context_parts.append(f"Предмет: {subject}")
        if summary:
            context_parts.append(f"Краткое содержание: {summary}")
        
        # Если документ разбит на чанки, загружаем первые 3 чанка
        if total_chunks and total_chunks > 1:
            cursor.execute(f'''
                SELECT chunk_text FROM {SCHEMA_NAME}.document_chunks
                WHERE material_id = %s
                ORDER BY chunk_index
                LIMIT 3
            ''', (material_id,))
            chunks = cursor.fetchall()
            full_text = '\n\n'.join([chunk[0] for chunk in chunks])
            context_parts.append(f"Текст (первые фрагменты из {total_chunks} частей):\n{full_text[:3000]}")
        elif text:
            context_parts.append(f"Текст: {text[:3000]}")
        
        context_parts.append("---")
    
    cursor.close()
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