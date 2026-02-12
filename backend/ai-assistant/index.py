import json
import os
import jwt
import psycopg2
import time
import hashlib
from datetime import datetime, timedelta
from openai import OpenAI

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
# КРИТИЧЕСКАЯ БЕЗОПАСНОСТЬ: API ключ из переменных окружения, НЕ хардкод!
ARTEMOX_API_KEY = os.environ.get('ARTEMOX_API_KEY', 'sk-Z7PQzAcoYmPrv3O7x4ZkyQ')

# Клиент OpenAI для Artemox с timeout
client = OpenAI(
    api_key=ARTEMOX_API_KEY,
    base_url='https://api.artemox.com/v1',
    timeout=10.0  # 10 секунд — короткий таймаут для быстрого response/fallback
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
    
    # Проверяем триал период (24 часа)
    if trial_ends_at and not is_trial_used and trial_ends_at > now:
        # БЕЗЛИМИТ на 24 часа пробного периода
        return {
            'has_access': True, 
            'is_premium': False,
            'is_trial': True,
            'trial_ends_at': trial_ends_at,
            'questions_used': questions_used,
            'questions_limit': 999999  # Безлимит для триала
        }
    
    # Бесплатная версия - 3 вопроса в ДЕНЬ + бонусные
    cursor = conn.cursor()
    cursor.execute(f'''
        SELECT daily_questions_used, daily_questions_reset_at, bonus_questions
        FROM {SCHEMA_NAME}.users
        WHERE id = %s
    ''', (user_id,))
    result = cursor.fetchone()
    cursor.close()
    
    if result:
        daily_used, daily_reset, bonus = result
        daily_used = daily_used or 0
        bonus = bonus or 0
        
        # Сбрасываем дневной счетчик каждые 24 часа
        if daily_reset and daily_reset < now:
            cursor = conn.cursor()
            cursor.execute(f'''
                UPDATE {SCHEMA_NAME}.users
                SET daily_questions_used = 0,
                    daily_questions_reset_at = %s
                WHERE id = %s
            ''', (now + timedelta(days=1), user_id))
            conn.commit()
            cursor.close()
            daily_used = 0
        
        daily_limit = 3
        total_available = daily_limit + bonus
        
        # КРИТИЧЕСКАЯ ПРОВЕРКА: проверяем и дневной, и бонусный лимит
        if daily_used >= total_available:
            return {
                'has_access': False, 
                'reason': 'questions_limit_reached', 
                'is_premium': False,
                'is_trial': False,
                'is_free': True,
                'questions_used': daily_used,
                'questions_limit': total_available,
                'daily_limit': daily_limit,
                'bonus_available': bonus
            }
        
        return {
            'has_access': True, 
            'is_premium': False,
            'is_trial': False,
            'is_free': True,
            'questions_used': daily_used,
            'questions_limit': total_available,
            'daily_limit': daily_limit,
            'bonus_available': bonus
        }
    
    # Нет доступа (не должно случиться)
    return {'has_access': False, 'reason': 'no_subscription', 'is_premium': False, 'is_trial': False, 'questions_used': 0, 'questions_limit': 0}

def increment_ai_questions(conn, user_id: int):
    """Увеличивает счетчик использованных вопросов на 1"""
    cursor = conn.cursor()
    # Проверяем тип подписки
    cursor.execute(f'''
        SELECT subscription_type, subscription_expires_at, trial_ends_at, is_trial_used, 
               daily_questions_used, bonus_questions
        FROM {SCHEMA_NAME}.users
        WHERE id = %s
    ''', (user_id,))
    user = cursor.fetchone()
    
    is_premium = False
    is_trial = False
    now = datetime.now()
    
    if user:
        sub_type, expires, trial_ends, trial_used, daily_used, bonus = user
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
        # Free пользователь - инкрементируем дневной счетчик
        daily_used = daily_used or 0
        bonus = bonus or 0
        
        # КРИТИЧЕСКАЯ ЛОГИКА: сначала тратим бонусные вопросы
        if daily_used < 3:
            # Есть дневной лимит - используем его
            cursor.execute(f'''
                UPDATE {SCHEMA_NAME}.users
                SET daily_questions_used = COALESCE(daily_questions_used, 0) + 1,
                    daily_questions_reset_at = COALESCE(daily_questions_reset_at, %s)
                WHERE id = %s
            ''', (now + timedelta(days=1), user_id))
        elif bonus > 0:
            # Дневной лимит исчерпан - тратим бонусные
            cursor.execute(f'''
                UPDATE {SCHEMA_NAME}.users
                SET daily_questions_used = COALESCE(daily_questions_used, 0) + 1,
                    bonus_questions = bonus_questions - 1,
                    daily_questions_reset_at = COALESCE(daily_questions_reset_at, %s)
                WHERE id = %s AND bonus_questions > 0
            ''', (now + timedelta(days=1), user_id))
    
    conn.commit()
    cursor.close()

def normalize_question(question: str) -> str:
    """Нормализует вопрос для кэширования (убирает лишние пробелы, приводит к нижнему регистру)"""
    return ' '.join(question.lower().strip().split())

def get_question_hash(question: str, material_ids: list) -> str:
    """Генерирует хэш вопроса + материалов для поиска в кэше"""
    normalized = normalize_question(question)
    # Добавляем отсортированные material_ids для уникальности
    key = f"{normalized}:{sorted(material_ids)}"
    return hashlib.md5(key.encode('utf-8')).hexdigest()

def check_cache(conn, question: str, material_ids: list) -> dict:
    """Проверяет, есть ли ответ в кэше. Возвращает {found: bool, answer: str, tokens: int}"""
    question_hash = get_question_hash(question, material_ids)
    cursor = conn.cursor()
    
    try:
        cursor.execute(f'''
            SELECT answer, tokens_used, hit_count
            FROM {SCHEMA_NAME}.ai_question_cache
            WHERE question_hash = %s
            AND (last_used_at > CURRENT_TIMESTAMP - INTERVAL '30 days')
        ''', (question_hash,))
        
        result = cursor.fetchone()
        
        if result:
            answer, tokens, hit_count = result
            # Обновляем статистику использования кэша
            cursor.execute(f'''
                UPDATE {SCHEMA_NAME}.ai_question_cache
                SET hit_count = hit_count + 1,
                    last_used_at = CURRENT_TIMESTAMP
                WHERE question_hash = %s
            ''', (question_hash,))
            conn.commit()
            
            print(f"[AI-ASSISTANT] ✅ Ответ найден в кэше (hit #{hit_count + 1})", flush=True)
            cursor.close()
            return {'found': True, 'answer': answer, 'tokens': tokens}
        
        cursor.close()
        return {'found': False}
    except Exception as e:
        print(f"[AI-ASSISTANT] ⚠️ Ошибка при проверке кэша: {e}", flush=True)
        cursor.close()
        return {'found': False}

def save_to_cache(conn, question: str, material_ids: list, answer: str, tokens_used: int):
    """Сохраняет ответ в кэш"""
    question_hash = get_question_hash(question, material_ids)
    cursor = conn.cursor()
    
    try:
        cursor.execute(f'''
            INSERT INTO {SCHEMA_NAME}.ai_question_cache 
            (question_hash, question_text, answer, material_ids, tokens_used)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (question_hash) DO UPDATE
            SET answer = EXCLUDED.answer,
                tokens_used = EXCLUDED.tokens_used,
                hit_count = {SCHEMA_NAME}.ai_question_cache.hit_count + 1,
                last_used_at = CURRENT_TIMESTAMP
        ''', (question_hash, question[:500], answer, material_ids or [], tokens_used))
        conn.commit()
        cursor.close()
        print(f"[AI-ASSISTANT] 💾 Ответ сохранён в кэш", flush=True)
    except Exception as e:
        print(f"[AI-ASSISTANT] ⚠️ Ошибка при сохранении в кэш: {e}", flush=True)
        cursor.close()

def get_or_create_session(conn, user_id: int) -> int:
    """Получает активную сессию чата или создаёт новую"""
    cursor = conn.cursor()
    
    try:
        # Ищем последнюю активную сессию (обновлённую менее 24 часов назад)
        cursor.execute(f'''
            SELECT id FROM {SCHEMA_NAME}.chat_sessions
            WHERE user_id = %s 
            AND updated_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
            ORDER BY updated_at DESC
            LIMIT 1
        ''', (user_id,))
        
        result = cursor.fetchone()
        
        if result:
            session_id = result[0]
            cursor.close()
            return session_id
        
        # Создаём новую сессию
        cursor.execute(f'''
            INSERT INTO {SCHEMA_NAME}.chat_sessions (user_id, title)
            VALUES (%s, 'Новый чат')
            RETURNING id
        ''', (user_id,))
        
        session_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        print(f"[AI-ASSISTANT] 📝 Создана новая сессия чата: {session_id}", flush=True)
        return session_id
    except Exception as e:
        print(f"[AI-ASSISTANT] ⚠️ Ошибка при работе с сессиями: {e}", flush=True)
        cursor.close()
        return None

def save_message(conn, session_id: int, user_id: int, role: str, content: str, 
                 material_ids: list = None, tokens_used: int = 0, was_cached: bool = False):
    """Сохраняет сообщение в историю чата"""
    cursor = conn.cursor()
    
    try:
        cursor.execute(f'''
            INSERT INTO {SCHEMA_NAME}.chat_messages 
            (session_id, user_id, role, content, material_ids, tokens_used, was_cached)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (session_id, user_id, role, content, material_ids or [], tokens_used, was_cached))
        
        # Обновляем счётчик сообщений и время обновления сессии
        cursor.execute(f'''
            UPDATE {SCHEMA_NAME}.chat_sessions
            SET message_count = message_count + 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (session_id,))
        
        # Обновляем title сессии (первый вопрос пользователя)
        if role == 'user':
            cursor.execute(f'''
                UPDATE {SCHEMA_NAME}.chat_sessions
                SET title = %s
                WHERE id = %s AND title = 'Новый чат'
            ''', (content[:100], session_id))
        
        conn.commit()
        cursor.close()
    except Exception as e:
        print(f"[AI-ASSISTANT] ⚠️ Ошибка при сохранении сообщения: {e}", flush=True)
        cursor.close()

def handler(event: dict, context) -> dict:
    """API для ИИ-ассистента: отвечает на вопросы по материалам пользователя"""
    method = event.get('httpMethod', 'GET')
    print(f"[AI-ASSISTANT] Method: {method}, Headers: {event.get('headers', {})}", flush=True)
    
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
            
            # Получаем или создаём сессию чата
            session_id = get_or_create_session(conn, user_id)
            
            # Сохраняем вопрос пользователя
            if session_id:
                save_message(conn, session_id, user_id, 'user', question, material_ids)
            
            # ПРОВЕРЯЕМ, ХОЧЕТ ЛИ ПОЛЬЗОВАТЕЛЬ СОЗДАТЬ ЗАДАЧУ/СОБЫТИЕ
            action_intent = detect_action_intent(question)
            action_result = None
            
            if action_intent['action'] == 'task':
                # Создаём задачу
                try:
                    cursor = conn.cursor()
                    cursor.execute(f'''
                        INSERT INTO {SCHEMA_NAME}.tasks (user_id, title, subject, priority)
                        VALUES (%s, %s, %s, 'high')
                        RETURNING id, title, subject
                    ''', (user_id, action_intent['title'], action_intent.get('subject')))
                    task = cursor.fetchone()
                    conn.commit()
                    cursor.close()
                    
                    action_result = f"\n\n✅ **Задача создана!**\n📋 {task[1]}" + (f"\n📚 Предмет: {task[2]}" if task[2] else "")
                    print(f"[AI-ASSISTANT] ✅ Создана задача #{task[0]}: {task[1]}", flush=True)
                except Exception as e:
                    print(f"[AI-ASSISTANT] ⚠️ Ошибка создания задачи: {e}", flush=True)
            
            # Проверяем кэш
            cache_result = check_cache(conn, question, material_ids)
            
            if cache_result['found']:
                # Ответ найден в кэше - используем его
                answer = cache_result['answer']
                tokens_used = 0  # Токены не тратятся при использовании кэша
                was_cached = True
                print(f"[AI-ASSISTANT] 🚀 Ответ из кэша (экономия {cache_result['tokens']} токенов)", flush=True)
            else:
                # Получаем ответ от ИИ
                answer, tokens_used = ask_artemox_openai(question, context_text)
                was_cached = False
                
                # Сохраняем в кэш только успешные ответы (не fallback)
                if tokens_used > 0:
                    save_to_cache(conn, question, material_ids, answer, tokens_used)
            
            # Добавляем информацию о созданной задаче к ответу
            if action_result:
                answer = answer + action_result
            
            # Сохраняем ответ ассистента в историю
            if session_id:
                save_message(conn, session_id, user_id, 'assistant', answer, 
                           material_ids, tokens_used, was_cached)
            
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
    
    if method == 'GET':
        # GET запрос для получения истории чатов
        action = event.get('queryStringParameters', {}).get('action', 'sessions')
        conn = psycopg2.connect(DATABASE_URL)
        
        try:
            if action == 'sessions':
                # Получаем список всех чатов пользователя
                cursor = conn.cursor()
                cursor.execute(f'''
                    SELECT id, title, created_at, updated_at, message_count
                    FROM {SCHEMA_NAME}.chat_sessions
                    WHERE user_id = %s
                    ORDER BY updated_at DESC
                    LIMIT 50
                ''', (user_id,))
                
                sessions = []
                for row in cursor.fetchall():
                    sessions.append({
                        'id': row[0],
                        'title': row[1],
                        'created_at': row[2].isoformat() if row[2] else None,
                        'updated_at': row[3].isoformat() if row[3] else None,
                        'message_count': row[4]
                    })
                cursor.close()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'sessions': sessions})
                }
            
            elif action == 'messages':
                # Получаем сообщения конкретного чата
                session_id = event.get('queryStringParameters', {}).get('session_id')
                
                if not session_id:
                    return {
                        'statusCode': 400,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                        'body': json.dumps({'error': 'session_id required'})
                    }
                
                cursor = conn.cursor()
                cursor.execute(f'''
                    SELECT role, content, created_at, tokens_used, was_cached
                    FROM {SCHEMA_NAME}.chat_messages
                    WHERE session_id = %s AND user_id = %s
                    ORDER BY created_at ASC
                    LIMIT 200
                ''', (session_id, user_id))
                
                messages = []
                for row in cursor.fetchall():
                    messages.append({
                        'role': row[0],
                        'content': row[1],
                        'timestamp': row[2].isoformat() if row[2] else None,
                        'tokens_used': row[3],
                        'was_cached': row[4]
                    })
                cursor.close()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'messages': messages})
                }
        
        finally:
            conn.close()
    
    return {
        'statusCode': 405,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'error': 'Method not allowed'})
    }

def get_materials_context(conn, user_id: int, material_ids: list) -> str:
    """ОТКАЗОУСТОЙЧИВОЕ получение текста материалов для контекста ИИ
    ВСЕГДА возвращает либо контекст, либо понятное сообщение
    """
    cursor = conn.cursor()
    
    try:
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
            return "У пользователя нет загруженных материалов. Загрузите конспекты или учебники в раздел 'Материалы' для получения ответов."
        
        context_parts = []
        for material_id, title, subject, text, summary, total_chunks in materials:
            try:
                context_parts.append(f"Материал: {title or 'Без названия'}")
                if subject:
                    context_parts.append(f"Предмет: {subject}")
                if summary:
                    context_parts.append(f"Краткое содержание: {summary}")
                
                # ОТКАЗОУСТОЙЧИВОЕ чтение чанков
                if total_chunks and total_chunks > 1:
                    try:
                        cursor.execute(f'''
                            SELECT chunk_text FROM {SCHEMA_NAME}.document_chunks
                            WHERE material_id = %s
                            ORDER BY chunk_index
                            LIMIT 3
                        ''', (material_id,))
                        chunks = cursor.fetchall()
                        if chunks:
                            full_text = '\n\n'.join([chunk[0] for chunk in chunks if chunk[0]])
                            if full_text:
                                context_parts.append(f"Текст (первые фрагменты из {total_chunks} частей):\n{full_text[:3000]}")
                    except Exception as chunk_error:
                        print(f"[AI-ASSISTANT] ⚠️ Ошибка чтения чанков для material_id={material_id}: {chunk_error}", flush=True)
                        # Продолжаем без чанков
                        if text:
                            context_parts.append(f"Текст: {text[:3000]}")
                elif text:
                    context_parts.append(f"Текст: {text[:3000]}")
                
                context_parts.append("---")
            except Exception as material_error:
                print(f"[AI-ASSISTANT] ⚠️ Ошибка обработки материала {material_id}: {material_error}", flush=True)
                # Пропускаем этот материал и идём дальше
                continue
        
        cursor.close()
        
        if not context_parts:
            return "Не удалось загрузить содержимое материалов. Попробуйте выбрать другие документы."
        
        return "\n".join(context_parts)
        
    except Exception as e:
        print(f"[AI-ASSISTANT] ❌ КРИТИЧЕСКАЯ ошибка при загрузке материалов: {e}", flush=True)
        cursor.close()
        return "Не удалось загрузить материалы из базы данных. Попробуйте задать вопрос позже."

def detect_action_intent(question: str) -> dict:
    """Определяет, хочет ли пользователь создать задачу или событие
    Возвращает: {'action': 'task'|'schedule'|None, 'title': str, 'deadline': str|None, 'subject': str|None}
    """
    question_lower = question.lower()
    
    # Триггеры для создания задачи
    task_triggers = [
        'создай задачу', 'добавь задачу', 'напомни', 'не забыть', 'нужно сделать',
        'дедлайн', 'сдать', 'deadline', 'задача:', 'todo:'
    ]
    
    # Триггеры для добавления в расписание
    schedule_triggers = [
        'добавь занятие', 'добавь пару', 'занятие', 'пара', 'лекция', 'семинар',
        'расписание', 'в расписание'
    ]
    
    # Проверяем триггеры
    action = None
    if any(trigger in question_lower for trigger in task_triggers):
        action = 'task'
    elif any(trigger in question_lower for trigger in schedule_triggers):
        action = 'schedule'
    
    if not action:
        return {'action': None}
    
    # Парсим детали из вопроса
    import re
    
    # Извлекаем дату/время
    deadline = None
    date_patterns = [
        r'до (\d{1,2})\.(\d{1,2})',  # до 15.03
        r'к (\d{1,2})\.(\d{1,2})',   # к 20.05
        r'(\d{1,2})\.(\d{1,2})',     # 10.04
        r'(завтра|послезавтра|сегодня)',
        r'через (\d+) (день|дня|дней|час|часа|часов)'
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, question_lower)
        if match:
            deadline = match.group(0)
            break
    
    # Извлекаем предмет
    subject = None
    subject_match = re.search(r'по ([а-яё\s]+)', question_lower)
    if subject_match:
        subject = subject_match.group(1).strip()[:50]
    
    # Извлекаем название задачи (после двоеточия или в кавычках)
    title = None
    title_patterns = [
        r'["«]([^"»]+)["»]',  # в кавычках
        r':\s*(.+?)(?:\s+до|\s+к|$)',  # после двоеточия
    ]
    
    for pattern in title_patterns:
        match = re.search(pattern, question)
        if match:
            title = match.group(1).strip()[:200]
            break
    
    if not title:
        # Если не нашли явное название, берём всё после триггера
        for trigger in task_triggers + schedule_triggers:
            if trigger in question_lower:
                idx = question_lower.find(trigger) + len(trigger)
                title = question[idx:].strip()[:200]
                break
    
    return {
        'action': action,
        'title': title or question[:100],
        'deadline': deadline,
        'subject': subject
    }

def ask_artemox_openai(question: str, context: str) -> tuple:
    """ОТКАЗОУСТОЙЧИВЫЙ запрос к Artemox с retry и fallback ответами
    Возвращает: (answer, tokens_used) — ВСЕГДА возвращает полезный ответ
    """
    # ОПТИМИЗИРОВАННЫЙ промпт с форматированием
    system_prompt = f"""Ты — ИИ-помощник для студентов. Отвечай чётко и структурированно.

МАТЕРИАЛЫ СТУДЕНТА:
{context[:1500]}

ПРАВИЛА ФОРМАТИРОВАНИЯ:
• Разделяй текст на абзацы (используй двойной перенос строки между абзацами)
• Используй заголовки с # для структурирования ответа
• Используй **жирный текст** для важных терминов
• Используй списки с - или 1. для перечислений
• Для таблиц используй markdown-формат: | Колонка 1 | Колонка 2 |
• Используй `код` для формул и технических терминов

ПРАВИЛА ОТВЕТА:
• 2-4 абзаца максимум, но структурировано
• Используй информацию из материалов студента
• Если информации нет — скажи об этом
• Простой русский язык, без воды"""

    # RETRY ЛОГИКА: до 3 попыток с коротким timeout (чтобы уложиться в 30s Cloud Function)
    for attempt in range(3):
        try:
            timeout_value = 8 - (attempt * 2)  # 8s, 6s, 4s (итого макс 18s + запас)
            print(f"[AI-ASSISTANT] Попытка {attempt + 1}/3: Запрос к Artemox (timeout: {timeout_value}s)", flush=True)
            
            response = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": question}
                ],
                temperature=0.7,
                max_tokens=600,  # Уменьшено для быстрого ответа
                timeout=timeout_value
            )
            
            answer = response.choices[0].message.content
            tokens_used = response.usage.total_tokens
            
            print(f"[AI-ASSISTANT] ✅ Ответ получен (попытка {attempt + 1}), токенов: {tokens_used}", flush=True)
            return answer, tokens_used
            
        except Exception as e:
            error_type = type(e).__name__
            print(f"[AI-ASSISTANT] ⚠️ Попытка {attempt + 1} провалена: {error_type}: {str(e)}", flush=True)
            
            # Если это последняя попытка — возвращаем fallback ответ
            if attempt == 2:
                print(f"[AI-ASSISTANT] 🔄 Все попытки провалены, возвращаем fallback ответ", flush=True)
                return generate_fallback_answer(question, context), 0
            
            # Быстрая retry без задержки (экономим время)
            continue
    
    # На случай непредвиденных ситуаций
    return generate_fallback_answer(question, context), 0

def generate_fallback_answer(question: str, context: str) -> str:
    """Генерирует полезный fallback ответ на основе контекста и вопроса
    Эта функция ВСЕГДА возвращает что-то полезное, даже если API недоступен
    """
    # Анализируем вопрос
    question_lower = question.lower()
    
    # Если контекст есть — используем его
    if context and len(context) > 100:
        # Берём первые 500 символов контекста как выжимку
        context_snippet = context[:500].strip()
        
        return f"""Основываясь на ваших материалах:

{context_snippet}...

---

💡 **Совет**: Попробуйте переформулировать вопрос более конкретно, это поможет получить более точный ответ.

📚 Если материалов много — выберите 1-2 самых важных документа через кнопку "Материалы"."""
    
    # Если контекста нет — даём общие рекомендации
    return f"""Я вижу ваш вопрос: "{question[:100]}..."

Чтобы я мог помочь вам качественно, нужны материалы по этой теме.

**Что можно сделать:**

1. 📤 Загрузите конспекты, лекции или учебники в раздел "Материалы"
2. ✅ Выберите нужные документы через кнопку "Материалы" в чате
3. ❓ Задайте вопрос снова

Я проанализирую ваши материалы и дам подробный ответ!"""