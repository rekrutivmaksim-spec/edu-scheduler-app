"""API для прогнозирования экзаменационных вопросов на основе материалов студента"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
from openai import OpenAI
from datetime import datetime


def get_db_connection():
    """Создаёт подключение к PostgreSQL базе данных"""
    dsn = os.environ['DATABASE_URL']
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(dsn, options=f'-c search_path={schema}')
    return conn


def verify_token(token: str) -> dict:
    """Проверяет JWT токен и возвращает payload"""
    secret = os.environ['JWT_SECRET']
    try:
        return jwt.decode(token, secret, algorithms=['HS256'])
    except:
        return None


def check_premium_access(conn, user_id: int) -> dict:
    """Проверяет доступ к премиум функциям (включая триал)"""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute('''
        SELECT subscription_type, subscription_expires_at, trial_ends_at, is_trial_used
        FROM users
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


def analyze_materials_with_deepseek(materials: list, past_exams: str = None) -> dict:
    """Анализирует материалы студента и генерирует прогноз вопросов через DeepSeek"""
    deepseek_key = os.environ.get('DEEPSEEK_API_KEY')
    
    if not deepseek_key:
        raise ValueError("Требуется DEEPSEEK_API_KEY для анализа материалов")
    
    print(f"[EXAM-PREDICTOR] Анализ {len(materials)} материалов")
    
    client = OpenAI(
        api_key=deepseek_key,
        base_url="https://api.deepseek.com"
    )
    
    # Собираем весь текст из материалов
    all_text = "\n\n".join([
        f"=== {m['title']} ({m['subject']}) ===\n{m['recognized_text'] or ''}\n{m['summary'] or ''}"
        for m in materials
    ])
    
    if len(all_text.strip()) < 50:
        raise ValueError("Материалы слишком короткие для анализа. Добавьте больше текста.")
    
    print(f"[EXAM-PREDICTOR] Всего текста: {len(all_text)} символов")
    
    past_exams_section = f"\n\n=== ПРОШЛОГОДНИЕ БИЛЕТЫ ===\n{past_exams}" if past_exams else ""
    
    prompt = f"""Ты — AI-ассистент для подготовки к экзамену. Проанализируй учебные материалы студента и спрогнозируй вопросы на экзамене.

МАТЕРИАЛЫ СТУДЕНТА:
{all_text}
{past_exams_section}

ЗАДАЧА:
1. Определи ключевые темы и концепции из материалов
2. Если есть прошлогодние билеты — учти паттерны (какие темы повторяются, стиль вопросов)
3. Выдели, что преподаватель подчёркивал (повторяющиеся темы, акценты)
4. Сгенерируй 20 наиболее вероятных экзаменационных вопросов с вероятностью и готовыми ответами
5. Создай план подготовки на 3 дня

ВАЖНО:
- Вопросы должны быть реалистичными для экзамена (не слишком простые, не слишком сложные)
- Ответы краткие (2-4 предложения), но содержательные
- План подготовки — конкретные действия по дням

Верни JSON в формате:
{{
  "subject": "Название предмета",
  "key_topics": ["Тема 1", "Тема 2", ...],
  "questions": [
    {{
      "question": "Текст вопроса",
      "probability": 95,
      "answer": "Краткий ответ на вопрос",
      "topics": ["Тема 1", "Тема 2"],
      "difficulty": "medium"
    }},
    ...
  ],
  "study_plan": {{
    "day_1": {{
      "focus": "Темы высокого приоритета",
      "tasks": ["Задача 1", "Задача 2"],
      "topics": ["Тема 1", "Тема 2"]
    }},
    "day_2": {{...}},
    "day_3": {{...}}
  }},
  "exam_tips": ["Совет 1", "Совет 2", "Совет 3"]
}}
"""
    
    try:
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000,
            temperature=0.7,
            response_format={"type": "json_object"},
            timeout=60.0
        )
        
        result = json.loads(response.choices[0].message.content)
        return result
    except Exception as e:
        print(f"[EXAM-PREDICTOR] Ошибка DeepSeek: {e}")
        raise Exception(f"Не удалось сгенерировать прогноз: {str(e)[:200]}")


def handler(event: dict, context) -> dict:
    """Обработчик запросов для прогнозирования экзаменационных вопросов"""
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    
    # POST /predict - Создать прогноз вопросов
    if method == 'POST':
        body = json.loads(event.get('body', '{}'))
        subject = body.get('subject', '').strip()
        material_ids = body.get('material_ids', [])
        past_exams = body.get('past_exams', '').strip()
        
        if not subject or not material_ids:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Укажите предмет и выберите материалы'})
            }
        
        conn = get_db_connection()
        try:
            # Проверяем премиум доступ
            access = check_premium_access(conn, user_id)
            if not access['has_access']:
                return {
                    'statusCode': 403,
                    'headers': headers,
                    'body': json.dumps({'error': '🔒 AI-прогноз экзаменов доступен только в Premium подписке'})
                }
            
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                # Получаем материалы студента
                print(f"[EXAM-PREDICTOR] Запрос материалов для user_id={user_id}, material_ids={material_ids}")
                
                cur.execute("""
                    SELECT id, title, subject, recognized_text, summary
                    FROM materials
                    WHERE user_id = %s AND id = ANY(%s)
                """, (user_id, material_ids))
                
                materials = cur.fetchall()
                print(f"[EXAM-PREDICTOR] Найдено материалов: {len(materials)}")
                
                if not materials:
                    return {
                        'statusCode': 404,
                        'headers': headers,
                        'body': json.dumps({'error': 'Материалы не найдены'})
                    }
                
                # Проверяем, есть ли текст в материалах
                for mat in materials:
                    text_len = len(mat.get('recognized_text') or '') + len(mat.get('summary') or '')
                    print(f"[EXAM-PREDICTOR] Материал {mat['id']}: {text_len} символов")
                
                # Анализируем материалы через DeepSeek
                print(f"[EXAM-PREDICTOR] Начинаем анализ через DeepSeek...")
                try:
                    prediction = analyze_materials_with_deepseek(
                        [dict(m) for m in materials],
                        past_exams if past_exams else None
                    )
                    print(f"[EXAM-PREDICTOR] Анализ завершен, вопросов: {len(prediction.get('questions', []))}")
                except Exception as e:
                    print(f"[EXAM-PREDICTOR] Ошибка анализа: {type(e).__name__}: {e}")
                    import traceback
                    traceback.print_exc()
                    return {
                        'statusCode': 500,
                        'headers': headers,
                        'body': json.dumps({'error': f'Ошибка генерации прогноза: {str(e)[:200]}'})
                    }
                
                # Сохраняем прогноз в БД
                cur.execute("""
                    INSERT INTO exam_predictions (user_id, subject, material_ids, predicted_questions, study_plan, past_exams_text)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, created_at
                """, (
                    user_id,
                    subject,
                    material_ids,
                    json.dumps(prediction),
                    json.dumps(prediction.get('study_plan', {})),
                    past_exams if past_exams else None
                ))
                
                saved = cur.fetchone()
                conn.commit()
                
                return {
                    'statusCode': 201,
                    'headers': headers,
                    'body': json.dumps({
                        'prediction_id': saved['id'],
                        'prediction': prediction,
                        'created_at': str(saved['created_at'])
                    }, default=str)
                }
        except Exception as e:
            print(f"[EXAM-PREDICTOR] Общая ошибка: {e}")
            import traceback
            traceback.print_exc()
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': f'Ошибка сервера: {str(e)[:200]}'})
            }
        finally:
            conn.close()
    
    # GET /predictions - Получить все прогнозы пользователя
    elif method == 'GET':
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, subject, material_ids, predicted_questions, study_plan, created_at
                    FROM exam_predictions
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                """, (user_id,))
                
                predictions = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'predictions': [dict(p) for p in predictions]
                    }, default=str)
                }
        finally:
            conn.close()
    
    return {
        'statusCode': 405,
        'headers': headers,
        'body': json.dumps({'error': 'Метод не поддерживается'})
    }