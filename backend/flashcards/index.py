"""API для генерации умных карточек из материалов студента"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
from openai import OpenAI
from datetime import datetime

ARTEMOX_API_KEY = 'sk-Z7PQzAcoYmPrv3O7x4ZkyQ'
client = OpenAI(
    api_key=ARTEMOX_API_KEY,
    base_url='https://api.artemox.com/v1'
)


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


def generate_flashcards_from_materials(materials: list) -> dict:
    """Генерирует карточки для запоминания через Artemox"""
    print(f"[FLASHCARDS] Генерация карточек из {len(materials)} материалов")
    
    # Собираем весь текст из материалов
    all_text = "\n\n".join([
        f"=== {m['title']} ({m['subject']}) ===\n{m['recognized_text'] or ''}\n{m['summary'] or ''}"
        for m in materials
    ])
    
    if len(all_text.strip()) < 50:
        raise ValueError("Материалы слишком короткие для анализа. Добавьте больше текста.")
    
    print(f"[FLASHCARDS] Всего текста: {len(all_text)} символов")
    
    prompt = f"""Ты — AI-эксперт по созданию учебных карточек. Проанализируй материалы и создай карточки для запоминания.

МАТЕРИАЛЫ СТУДЕНТА:
{all_text}

ЗАДАЧА:
1. Извлеки ключевые концепции, термины, формулы, факты
2. Создай 20-30 карточек в формате "вопрос → ответ"
3. Карточки должны быть разной сложности: легкие, средние, сложные
4. Вопросы — короткие и конкретные
5. Ответы — точные и информативные (2-4 предложения)

ТРЕБОВАНИЯ К КАРТОЧКАМ:
✅ Вопрос должен быть четким и однозначным
✅ Ответ должен быть кратким, но полным
✅ Используй примеры из материалов
✅ Покрывай разные темы материала
✅ Распределение сложности: 40% легких, 40% средних, 20% сложных

ПРИМЕРЫ ХОРОШИХ КАРТОЧЕК:

Вопрос: "Что такое алгоритм быстрой сортировки?"
Ответ: "Алгоритм сортировки методом разделения. Выбирается опорный элемент, массив делится на элементы меньше и больше опорного, затем рекурсивно сортируются части. Средняя сложность O(n log n)."

Вопрос: "В чем разница между TCP и UDP?"
Ответ: "TCP — протокол с гарантией доставки, устанавливает соединение, медленнее. UDP — без гарантии доставки, без установки соединения, быстрее. TCP для важных данных, UDP для стриминга."

Верни JSON в формате:
{{
  "subject": "Название предмета",
  "total_cards": 25,
  "cards": [
    {{
      "id": 1,
      "question": "Вопрос на лицевой стороне карточки",
      "answer": "Ответ на обратной стороне",
      "difficulty": "easy|medium|hard",
      "topics": ["Тема 1", "Тема 2"]
    }},
    ...
  ],
  "study_tips": ["Совет 1: Повторяй карточки каждый день", "Совет 2: Начни с легких"]
}}
"""
    
    try:
        print(f"[FLASHCARDS] Отправка запроса в Artemox API...")
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=4000,
            temperature=0.7,
            response_format={"type": "json_object"},
            timeout=90.0
        )
        
        print(f"[FLASHCARDS] Успешно получен ответ от Artemox, токенов использовано: {response.usage.total_tokens}")
        result = json.loads(response.choices[0].message.content)
        print(f"[FLASHCARDS] JSON распарсен успешно, карточек сгенерировано: {len(result.get('cards', []))}")
        return result
    except Exception as e:
        print(f"[FLASHCARDS] Ошибка Artemox: {type(e).__name__}: {e}")
        error_str = str(e)
        
        if 'Insufficient Balance' in error_str or '402' in error_str:
            raise Exception("⚠️ Генерация карточек временно недоступна: закончился баланс Artemox API. Попробуйте позже.")
        elif 'timeout' in error_str.lower():
            raise Exception("⏱️ Превышено время ожидания. Попробуйте с меньшим количеством материалов.")
        elif '401' in error_str or 'Unauthorized' in error_str:
            raise Exception("🔑 Ошибка API ключа Artemox. Проверьте настройки.")
        else:
            raise Exception(f"Не удалось сгенерировать карточки: {error_str[:200]}")


def handler(event: dict, context) -> dict:
    """Обработчик запросов для генерации карточек"""
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
    
    # POST /generate - Создать карточки
    if method == 'POST':
        body = json.loads(event.get('body', '{}'))
        subject = body.get('subject', '').strip()
        material_ids = body.get('material_ids', [])
        
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
                    'body': json.dumps({'error': '🔒 Умные Карточки доступны только в Premium подписке'})
                }
            
            # Получаем материалы
            print(f"[FLASHCARDS] Запрос материалов для user_id={user_id}, material_ids={material_ids}")
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            placeholders = ','.join(['%s'] * len(material_ids))
            cursor.execute(f'''
                SELECT id, title, subject, recognized_text, summary, total_chunks
                FROM materials
                WHERE user_id = %s AND id IN ({placeholders})
            ''', [user_id] + material_ids)
            
            materials = cursor.fetchall()
            cursor.close()
            
            if not materials:
                return {
                    'statusCode': 404,
                    'headers': headers,
                    'body': json.dumps({'error': 'Материалы не найдены'})
                }
            
            print(f"[FLASHCARDS] Найдено материалов: {len(materials)}")
            for m in materials:
                text_len = len(m.get('recognized_text') or '') + len(m.get('summary') or '')
                print(f"[FLASHCARDS] Материал {m['id']}: {text_len} символов")
            
            # Генерируем карточки
            print(f"[FLASHCARDS] Начинаем генерацию карточек через Artemox...")
            flashcards = generate_flashcards_from_materials([dict(m) for m in materials])
            
            # Сохраняем сет карточек в БД
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO flashcard_sets (user_id, subject, material_ids, total_cards, created_at)
                VALUES (%s, %s, %s, %s, NOW())
                RETURNING id
            ''', (user_id, subject, material_ids, flashcards.get('total_cards', len(flashcards.get('cards', [])))))
            
            set_id = cursor.fetchone()[0]
            
            # Сохраняем карточки
            for card in flashcards.get('cards', []):
                cursor.execute('''
                    INSERT INTO flashcards (set_id, question, answer, difficulty, topics)
                    VALUES (%s, %s, %s, %s, %s)
                ''', (set_id, card['question'], card['answer'], card['difficulty'], card.get('topics', [])))
            
            conn.commit()
            cursor.close()
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'set_id': set_id,
                    'subject': flashcards.get('subject'),
                    'total_cards': flashcards.get('total_cards'),
                    'cards': flashcards.get('cards'),
                    'study_tips': flashcards.get('study_tips', [])
                })
            }
        except Exception as e:
            print(f"[FLASHCARDS] Ошибка анализа: {type(e).__name__}: {e}")
            conn.rollback()
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': str(e)})
            }
        finally:
            conn.close()
    
    return {
        'statusCode': 405,
        'headers': headers,
        'body': json.dumps({'error': 'Метод не поддерживается'})
    }
