"""API для работы с флеш-карточками: генерация через ИИ, повторение по алгоритму SM-2"""

import json
import os
import jwt
import psycopg2
import httpx
from datetime import datetime, date, timedelta
from openai import OpenAI

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
LLAMA_MODEL = 'llama-4-maverick'

_http = httpx.Client(timeout=httpx.Timeout(22.0, connect=3.0))
ai_client = OpenAI(api_key=OPENROUTER_API_KEY, base_url='https://api.aitunnel.ru/v1/', timeout=22.0, http_client=_http)

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, X-Authorization, Authorization'
}


def ok(body: dict) -> dict:
    return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps(body, ensure_ascii=False)}


def err(status: int, body: dict) -> dict:
    return {'statusCode': status, 'headers': CORS_HEADERS, 'body': json.dumps(body, ensure_ascii=False)}


def get_user_id(token: str):
    if token in ('mock-token', 'guest_token'):
        return 1
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload['user_id']
    except Exception:
        return None


def handler(event, context):
    """Обработчик запросов для флеш-карточек"""

    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    # Авторизация
    headers = event.get('headers', {})
    auth_header = headers.get('X-Authorization') or headers.get('x-authorization') or headers.get('Authorization') or headers.get('authorization') or ''
    token = auth_header.replace('Bearer ', '') if auth_header.startswith('Bearer ') else auth_header

    if not token:
        return err(401, {'error': 'Требуется авторизация'})

    user_id = get_user_id(token)
    if not user_id:
        return err(401, {'error': 'Неверный токен'})

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    conn = psycopg2.connect(DATABASE_URL)

    try:
        if method == 'GET':
            if action == 'sets':
                return handle_get_sets(conn, user_id)
            elif action == 'cards':
                set_id = params.get('set_id')
                if not set_id:
                    return err(400, {'error': 'Не указан set_id'})
                return handle_get_cards(conn, user_id, int(set_id))
            elif action == 'review':
                return handle_get_review(conn, user_id)
            else:
                return err(400, {'error': 'Неизвестное действие'})

        elif method == 'POST':
            body = json.loads(event.get('body', '{}') or '{}')
            action = body.get('action', params.get('action', ''))

            if action == 'generate':
                return handle_generate(conn, user_id, body)
            elif action == 'answer':
                return handle_answer(conn, user_id, body)
            elif action == 'delete_set':
                return handle_delete_set(conn, user_id, body)
            else:
                return err(400, {'error': 'Неизвестное действие'})

        return err(405, {'error': 'Метод не поддерживается'})
    finally:
        conn.close()


def handle_get_sets(conn, user_id):
    """Получить список наборов карточек пользователя"""
    cur = conn.cursor()
    cur.execute(f'''
        SELECT fs.id, fs.subject, fs.material_ids, fs.total_cards, fs.created_at,
               COUNT(f.id) AS card_count,
               COUNT(fp.id) FILTER (WHERE fp.next_review_date <= CURRENT_DATE) AS due_count
        FROM {SCHEMA_NAME}.flashcard_sets fs
        LEFT JOIN {SCHEMA_NAME}.flashcards f ON f.set_id = fs.id
        LEFT JOIN {SCHEMA_NAME}.flashcard_progress fp ON fp.flashcard_id = f.id AND fp.user_id = %s
        WHERE fs.user_id = %s
        GROUP BY fs.id
        ORDER BY fs.created_at DESC
    ''', (user_id, user_id))
    rows = cur.fetchall()
    cur.close()

    sets = []
    for row in rows:
        sets.append({
            'id': row[0],
            'subject': row[1],
            'material_ids': row[2],
            'total_cards': row[3],
            'created_at': row[4].isoformat() if row[4] else None,
            'card_count': row[5],
            'due_count': row[6]
        })

    return ok({'sets': sets})


def handle_get_cards(conn, user_id, set_id):
    """Получить карточки набора с прогрессом пользователя"""
    # Проверяем принадлежность набора
    cur = conn.cursor()
    cur.execute(f'SELECT id FROM {SCHEMA_NAME}.flashcard_sets WHERE id = %s AND user_id = %s', (set_id, user_id))
    if not cur.fetchone():
        cur.close()
        return err(404, {'error': 'Набор не найден'})

    cur.execute(f'''
        SELECT f.id, f.question, f.answer, f.difficulty, f.topics,
               fp.ease_factor, fp.interval_days, fp.repetitions,
               fp.next_review_date, fp.last_reviewed_at
        FROM {SCHEMA_NAME}.flashcards f
        LEFT JOIN {SCHEMA_NAME}.flashcard_progress fp ON fp.flashcard_id = f.id AND fp.user_id = %s
        WHERE f.set_id = %s
        ORDER BY f.created_at
    ''', (user_id, set_id))
    rows = cur.fetchall()
    cur.close()

    cards = []
    for row in rows:
        cards.append({
            'id': row[0],
            'question': row[1],
            'answer': row[2],
            'difficulty': row[3],
            'topics': row[4],
            'progress': {
                'ease_factor': float(row[5]) if row[5] is not None else 2.5,
                'interval_days': row[6] if row[6] is not None else 0,
                'repetitions': row[7] if row[7] is not None else 0,
                'next_review_date': row[8].isoformat() if row[8] else None,
                'last_reviewed_at': row[9].isoformat() if row[9] else None
            }
        })

    return ok({'cards': cards})


def handle_get_review(conn, user_id):
    """Получить карточки для повторения сегодня"""
    cur = conn.cursor()
    cur.execute(f'''
        SELECT f.id, f.question, f.answer, f.difficulty, f.topics, f.set_id,
               fp.ease_factor, fp.interval_days, fp.repetitions,
               fp.next_review_date, fp.last_reviewed_at,
               fs.subject
        FROM {SCHEMA_NAME}.flashcard_progress fp
        JOIN {SCHEMA_NAME}.flashcards f ON f.id = fp.flashcard_id
        JOIN {SCHEMA_NAME}.flashcard_sets fs ON fs.id = f.set_id
        WHERE fp.user_id = %s AND fp.next_review_date <= CURRENT_DATE
        ORDER BY fp.next_review_date ASC
        LIMIT 50
    ''', (user_id,))
    rows = cur.fetchall()
    cur.close()

    cards = []
    for row in rows:
        cards.append({
            'id': row[0],
            'question': row[1],
            'answer': row[2],
            'difficulty': row[3],
            'topics': row[4],
            'set_id': row[5],
            'ease_factor': float(row[6]) if row[6] is not None else 2.5,
            'interval_days': row[7],
            'repetitions': row[8],
            'next_review_date': row[9].isoformat() if row[9] else None,
            'last_reviewed_at': row[10].isoformat() if row[10] else None,
            'subject': row[11]
        })

    return ok({'cards': cards, 'total_due': len(cards)})


def handle_generate(conn, user_id, body):
    """Генерация карточек через ИИ на основе материалов"""
    material_ids = body.get('material_ids', [])
    if not material_ids:
        return err(400, {'error': 'Не указаны material_ids'})

    # Получаем тексты материалов
    cur = conn.cursor()
    placeholders = ','.join(['%s'] * len(material_ids))
    cur.execute(
        f'SELECT id, title, subject, recognized_text, summary FROM {SCHEMA_NAME}.materials WHERE id IN ({placeholders}) AND user_id = %s',
        material_ids + [user_id]
    )
    materials = cur.fetchall()

    if not materials:
        cur.close()
        return err(404, {'error': 'Материалы не найдены'})

    # Собираем текст и определяем предмет
    texts = []
    subject = None
    for mid, title, subj, text, summary in materials:
        if not subject and subj:
            subject = subj
        content = summary or (text[:3000] if text else '')
        if content:
            texts.append(f"# {title or 'Документ'}\n{content}")

    if not texts:
        cur.close()
        return err(400, {'error': 'Материалы не содержат текста'})

    combined_text = '\n\n'.join(texts)[:6000]
    subject = subject or 'Общее'

    # Вызываем ИИ для генерации карточек
    prompt = f"""На основе учебного материала создай ровно 10 флеш-карточек для запоминания.
Верни JSON массив: [{{"question":"вопрос","answer":"ответ","difficulty":"easy|medium|hard"}}]
Только JSON, без обёрток.

Материал:
{combined_text}"""

    try:
        response = ai_client.chat.completions.create(
            model=LLAMA_MODEL,
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=2000,
            temperature=0.7
        )
        ai_text = response.choices[0].message.content.strip()
    except Exception as e:
        cur.close()
        return err(500, {'error': f'Ошибка ИИ: {str(e)}'})

    # Парсим JSON из ответа ИИ
    if '```json' in ai_text:
        ai_text = ai_text.split('```json')[1].split('```')[0].strip()
    elif '```' in ai_text:
        ai_text = ai_text.split('```')[1].split('```')[0].strip()

    # Пытаемся найти JSON массив
    start = ai_text.find('[')
    end = ai_text.rfind(']')
    if start != -1 and end != -1:
        ai_text = ai_text[start:end + 1]

    try:
        cards_data = json.loads(ai_text)
    except json.JSONDecodeError:
        cur.close()
        return err(500, {'error': 'Не удалось разобрать ответ ИИ'})

    if not isinstance(cards_data, list):
        cur.close()
        return err(500, {'error': 'ИИ вернул неверный формат'})

    # Ограничиваем 10 карточками
    cards_data = cards_data[:10]

    # Создаём набор
    cur.execute(
        f'INSERT INTO {SCHEMA_NAME}.flashcard_sets (user_id, subject, material_ids, total_cards) VALUES (%s, %s, %s, %s) RETURNING id',
        (user_id, subject, material_ids, len(cards_data))
    )
    set_id = cur.fetchone()[0]

    # Сохраняем карточки
    saved_cards = []
    today = date.today()
    for card in cards_data:
        question = card.get('question', '').strip()
        answer = card.get('answer', '').strip()
        difficulty = card.get('difficulty', 'medium')
        if difficulty not in ('easy', 'medium', 'hard'):
            difficulty = 'medium'

        if not question or not answer:
            continue

        cur.execute(
            f'INSERT INTO {SCHEMA_NAME}.flashcards (set_id, question, answer, difficulty) VALUES (%s, %s, %s, %s) RETURNING id',
            (set_id, question, answer, difficulty)
        )
        card_id = cur.fetchone()[0]

        # Создаём начальный прогресс
        cur.execute(
            f'''INSERT INTO {SCHEMA_NAME}.flashcard_progress (user_id, flashcard_id, ease_factor, interval_days, repetitions, next_review_date)
                VALUES (%s, %s, 2.5, 0, 0, %s)
                ON CONFLICT (user_id, flashcard_id) DO NOTHING''',
            (user_id, card_id, today)
        )

        saved_cards.append({
            'id': card_id,
            'question': question,
            'answer': answer,
            'difficulty': difficulty
        })

    # Обновляем total_cards точным числом
    cur.execute(
        f'UPDATE {SCHEMA_NAME}.flashcard_sets SET total_cards = %s WHERE id = %s',
        (len(saved_cards), set_id)
    )
    conn.commit()
    cur.close()

    return ok({
        'set_id': set_id,
        'subject': subject,
        'cards': saved_cards,
        'total': len(saved_cards)
    })


def handle_answer(conn, user_id, body):
    """Обработка ответа по алгоритму SM-2"""
    flashcard_id = body.get('flashcard_id')
    quality = body.get('quality')

    if flashcard_id is None or quality is None:
        return err(400, {'error': 'Не указаны flashcard_id и quality'})

    quality = int(quality)
    if quality < 0 or quality > 5:
        return err(400, {'error': 'quality должен быть от 0 до 5'})

    cur = conn.cursor()

    # Проверяем что карточка существует и принадлежит пользователю
    cur.execute(
        f'''SELECT f.id FROM {SCHEMA_NAME}.flashcards f
            JOIN {SCHEMA_NAME}.flashcard_sets fs ON fs.id = f.set_id
            WHERE f.id = %s AND fs.user_id = %s''',
        (flashcard_id, user_id)
    )
    if not cur.fetchone():
        cur.close()
        return err(404, {'error': 'Карточка не найдена'})

    # Получаем текущий прогресс или значения по умолчанию
    cur.execute(
        f'SELECT ease_factor, interval_days, repetitions FROM {SCHEMA_NAME}.flashcard_progress WHERE user_id = %s AND flashcard_id = %s',
        (user_id, flashcard_id)
    )
    row = cur.fetchone()

    if row:
        ease_factor = float(row[0])
        interval_days = row[1]
        repetitions = row[2]
    else:
        ease_factor = 2.5
        interval_days = 0
        repetitions = 0

    # Алгоритм SM-2
    # Обновляем ease_factor
    ease_factor = ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    ease_factor = max(1.3, ease_factor)

    if quality >= 3:
        repetitions += 1
        if repetitions == 1:
            interval_days = 1
        elif repetitions == 2:
            interval_days = 6
        else:
            interval_days = round(interval_days * ease_factor)
    else:
        repetitions = 0
        interval_days = 1

    next_review = date.today() + timedelta(days=interval_days)
    now = datetime.now()

    # Upsert прогресса
    cur.execute(
        f'''INSERT INTO {SCHEMA_NAME}.flashcard_progress (user_id, flashcard_id, ease_factor, interval_days, repetitions, next_review_date, last_reviewed_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id, flashcard_id) DO UPDATE SET
                ease_factor = EXCLUDED.ease_factor,
                interval_days = EXCLUDED.interval_days,
                repetitions = EXCLUDED.repetitions,
                next_review_date = EXCLUDED.next_review_date,
                last_reviewed_at = EXCLUDED.last_reviewed_at''',
        (user_id, flashcard_id, ease_factor, interval_days, repetitions, next_review, now)
    )
    conn.commit()
    cur.close()

    return ok({
        'flashcard_id': flashcard_id,
        'ease_factor': round(ease_factor, 2),
        'interval_days': interval_days,
        'repetitions': repetitions,
        'next_review_date': next_review.isoformat()
    })


def handle_delete_set(conn, user_id, body):
    """Удалить набор карточек и все связанные карточки"""
    set_id = body.get('set_id')
    if not set_id:
        return err(400, {'error': 'Не указан set_id'})

    cur = conn.cursor()

    # Проверяем принадлежность
    cur.execute(f'SELECT id FROM {SCHEMA_NAME}.flashcard_sets WHERE id = %s AND user_id = %s', (set_id, user_id))
    if not cur.fetchone():
        cur.close()
        return err(404, {'error': 'Набор не найден'})

    # Удаляем прогресс по карточкам этого набора
    cur.execute(
        f'''DELETE FROM {SCHEMA_NAME}.flashcard_progress
            WHERE flashcard_id IN (SELECT id FROM {SCHEMA_NAME}.flashcards WHERE set_id = %s) AND user_id = %s''',
        (set_id, user_id)
    )

    # Удаляем карточки
    cur.execute(f'DELETE FROM {SCHEMA_NAME}.flashcards WHERE set_id = %s', (set_id,))

    # Удаляем набор
    cur.execute(f'DELETE FROM {SCHEMA_NAME}.flashcard_sets WHERE id = %s AND user_id = %s', (set_id, user_id))

    conn.commit()
    cur.close()

    return ok({'deleted': True, 'set_id': set_id})