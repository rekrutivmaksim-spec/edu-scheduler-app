"""API для генерации ИИ-планов подготовки к экзаменам (Premium-only)"""

import json
import os
import re
from datetime import datetime, date, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
from openai import OpenAI
from rate_limiter import check_rate_limit, get_client_ip

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
LLAMA_MODEL = 'meta-llama/llama-4-maverick'

ai_client = OpenAI(
    api_key=OPENROUTER_API_KEY,
    base_url='https://openrouter.ai/api/v1',
    timeout=22.0
)

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
}

OPTIONS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
}


def get_db_connection():
    """Creates a PostgreSQL connection with the configured schema search path."""
    dsn = os.environ['DATABASE_URL']
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(dsn, options=f'-c search_path={schema}')
    return conn


def verify_token(token: str) -> dict:
    """Verifies a JWT token and returns the decoded payload or None."""
    secret = os.environ.get('JWT_SECRET', 'your-secret-key')
    try:
        return jwt.decode(token, secret, algorithms=['HS256'])
    except Exception:
        return None


def check_premium(conn, user_id: int) -> bool:
    """Returns True if user has an active premium subscription."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT subscription_type, subscription_expires_at
        FROM users WHERE id = %s
    """, (user_id,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return False
    if row['subscription_type'] == 'premium' and row['subscription_expires_at']:
        if row['subscription_expires_at'] >= datetime.now():
            return True
    return False


def ensure_tables(conn):
    """Creates study_plans and study_plan_days tables if they do not exist."""
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS study_plans (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            subject VARCHAR(255) NOT NULL,
            exam_date DATE NOT NULL,
            difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',
            notes TEXT,
            total_days INTEGER NOT NULL DEFAULT 0,
            completed_days INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS study_plan_days (
            id SERIAL PRIMARY KEY,
            plan_id INTEGER NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
            day_number INTEGER NOT NULL,
            title VARCHAR(255) NOT NULL,
            topics TEXT NOT NULL,
            minutes INTEGER NOT NULL DEFAULT 60,
            is_completed BOOLEAN NOT NULL DEFAULT FALSE,
            completed_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    cur.close()


def resp(status_code: int, body: dict) -> dict:
    """Helper to build a response dict."""
    return {
        'statusCode': status_code,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, default=str, ensure_ascii=False),
    }


def load_material_context(conn, user_id: int, subject: str) -> str:
    """Loads up to 3 document chunks from user's materials matching subject."""
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT text_content FROM document_chunks
            WHERE material_id IN (
                SELECT id FROM materials
                WHERE user_id = %s AND subject ILIKE %s
            )
            ORDER BY chunk_index
            LIMIT 3
        """, (user_id, f'%{subject}%'))
        rows = cur.fetchall()
        cur.close()
        if rows:
            return '\n\n'.join(row[0] for row in rows if row[0])
        return ''
    except Exception as e:
        print(f"[STUDY-PLAN] Failed to load materials: {e}", flush=True)
        cur.close()
        return ''


def generate_plan_with_ai(subject: str, difficulty: str, days_left: int, context: str) -> list:
    """Calls the AI to generate a structured study plan. Returns list of day dicts."""
    capped_days = min(days_left, 30)

    difficulty_label = {'easy': 'Лёгкая', 'medium': 'Средняя', 'hard': 'Высокая'}.get(difficulty, 'Средняя')

    context_section = context.strip()[:3000] if context else 'Нет загруженных материалов'

    system_prompt = (
        "Ты — ИИ-репетитор. Создай пошаговый план подготовки к экзамену.\n\n"
        f"Предмет: {subject}\n"
        f"Сложность: {difficulty_label}\n"
        f"Дней до экзамена: {capped_days}\n"
        f"Материалы студента: {context_section}\n\n"
        f"Создай план на {capped_days} дней (максимум 30). Для каждого дня укажи:\n"
        "- Номер дня\n"
        "- Название темы\n"
        "- Что изучать (2-3 пункта)\n"
        "- Рекомендуемое время в минутах\n\n"
        "Ответь СТРОГО в JSON формате:\n"
        "[\n"
        '  {"day": 1, "title": "Название", "topics": "Что изучать", "minutes": 60},\n'
        "  ...\n"
        "]"
    )

    print(f"[STUDY-PLAN] Generating plan: subject={subject}, difficulty={difficulty}, days={capped_days}", flush=True)

    response = ai_client.chat.completions.create(
        model=LLAMA_MODEL,
        messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': f'Создай план подготовки к экзамену по предмету "{subject}" на {capped_days} дней.'},
        ],
        temperature=0.7,
        max_tokens=2000,
    )

    raw = response.choices[0].message.content.strip()
    print(f"[STUDY-PLAN] AI raw response length: {len(raw)}", flush=True)

    # Try to extract JSON from the response (may be wrapped in ```json ... ```)
    json_match = re.search(r'\[.*\]', raw, re.DOTALL)
    if not json_match:
        raise ValueError('AI did not return valid JSON array')

    days = json.loads(json_match.group())

    # Validate and normalise
    result = []
    for item in days:
        result.append({
            'day': int(item.get('day', len(result) + 1)),
            'title': str(item.get('title', f'День {len(result) + 1}')),
            'topics': str(item.get('topics', '')),
            'minutes': max(10, min(480, int(item.get('minutes', 60)))),
        })

    return result


# ---------------------------------------------------------------------------
# Action handlers
# ---------------------------------------------------------------------------

def handle_list(conn, user_id: int) -> dict:
    """Returns all study plans for the user."""
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, subject, exam_date, difficulty, total_days, completed_days, created_at, updated_at
        FROM study_plans
        WHERE user_id = %s
        ORDER BY created_at DESC
    """, (user_id,))
    plans = cur.fetchall()
    cur.close()
    return resp(200, {'plans': [dict(p) for p in plans]})


def handle_detail(conn, user_id: int, params: dict) -> dict:
    """Returns a single plan with all its days."""
    plan_id = params.get('plan_id')
    if not plan_id:
        return resp(400, {'error': 'Не указан ID плана'})

    try:
        plan_id = int(plan_id)
    except (ValueError, TypeError):
        return resp(400, {'error': 'ID плана должен быть числом'})

    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT id, subject, exam_date, difficulty, notes, total_days, completed_days, created_at, updated_at
        FROM study_plans
        WHERE id = %s AND user_id = %s
    """, (plan_id, user_id))
    plan = cur.fetchone()
    if not plan:
        cur.close()
        return resp(404, {'error': 'План не найден'})

    cur.execute("""
        SELECT id, day_number, title, topics, minutes, is_completed, completed_at
        FROM study_plan_days
        WHERE plan_id = %s
        ORDER BY day_number
    """, (plan_id,))
    days = cur.fetchall()
    cur.close()

    plan_dict = dict(plan)
    plan_dict['days'] = [dict(d) for d in days]
    return resp(200, {'plan': plan_dict})


def handle_generate(conn, user_id: int, body: dict) -> dict:
    """Generates a new AI-powered study plan and saves it to the database."""
    subject = (body.get('subject') or '').strip()
    exam_date_str = (body.get('exam_date') or '').strip()
    difficulty = (body.get('difficulty') or 'medium').strip().lower()
    notes = (body.get('notes') or '').strip()

    if not subject:
        return resp(400, {'error': 'Укажите предмет'})
    if not exam_date_str:
        return resp(400, {'error': 'Укажите дату экзамена'})
    if difficulty not in ('easy', 'medium', 'hard'):
        return resp(400, {'error': 'Сложность должна быть: easy, medium или hard'})
    if len(subject) > 200:
        return resp(400, {'error': 'Название предмета слишком длинное (макс. 200 символов)'})

    try:
        exam_date = datetime.strptime(exam_date_str, '%Y-%m-%d').date()
    except ValueError:
        return resp(400, {'error': 'Дата экзамена должна быть в формате ГГГГ-ММ-ДД'})

    today = date.today()
    days_left = (exam_date - today).days
    if days_left < 1:
        return resp(400, {'error': 'Дата экзамена должна быть в будущем'})

    # Cap at 30 days for the plan
    capped_days = min(days_left, 30)

    # Limit: max 10 active plans per user
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM study_plans WHERE user_id = %s", (user_id,))
    plan_count = cur.fetchone()[0]
    cur.close()
    if plan_count >= 10:
        return resp(400, {'error': 'Достигнут лимит в 10 планов. Удалите существующий план.'})

    # Load material context
    context = load_material_context(conn, user_id, subject)

    # Generate via AI
    try:
        ai_days = generate_plan_with_ai(subject, difficulty, capped_days, context)
    except Exception as e:
        print(f"[STUDY-PLAN] AI generation error: {e}", flush=True)
        return resp(500, {'error': 'Не удалось сгенерировать план. Попробуйте ещё раз.'})

    if not ai_days:
        return resp(500, {'error': 'ИИ вернул пустой план. Попробуйте ещё раз.'})

    # Save plan
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        INSERT INTO study_plans (user_id, subject, exam_date, difficulty, notes, total_days)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id, subject, exam_date, difficulty, notes, total_days, completed_days, created_at, updated_at
    """, (user_id, subject[:255], exam_date, difficulty, notes[:1000] if notes else None, len(ai_days)))
    plan = dict(cur.fetchone())

    # Save days
    saved_days = []
    for d in ai_days:
        cur.execute("""
            INSERT INTO study_plan_days (plan_id, day_number, title, topics, minutes)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, day_number, title, topics, minutes, is_completed, completed_at
        """, (plan['id'], d['day'], d['title'][:255], d['topics'][:2000], d['minutes']))
        saved_days.append(dict(cur.fetchone()))

    conn.commit()
    cur.close()

    plan['days'] = saved_days
    print(f"[STUDY-PLAN] Plan created: id={plan['id']}, days={len(saved_days)}", flush=True)
    return resp(201, {'plan': plan})


def handle_complete_day(conn, user_id: int, body: dict) -> dict:
    """Marks a study plan day as completed."""
    plan_id = body.get('plan_id')
    day_id = body.get('day_id')

    if not plan_id or not day_id:
        return resp(400, {'error': 'Не указаны ID плана и дня'})

    try:
        plan_id = int(plan_id)
        day_id = int(day_id)
    except (ValueError, TypeError):
        return resp(400, {'error': 'ID плана и дня должны быть числами'})

    cur = conn.cursor(cursor_factory=RealDictCursor)

    # Verify ownership
    cur.execute("SELECT id FROM study_plans WHERE id = %s AND user_id = %s", (plan_id, user_id))
    if not cur.fetchone():
        cur.close()
        return resp(404, {'error': 'План не найден'})

    # Check the day exists and is not already completed
    cur.execute("""
        SELECT id, is_completed FROM study_plan_days
        WHERE id = %s AND plan_id = %s
    """, (day_id, plan_id))
    day = cur.fetchone()
    if not day:
        cur.close()
        return resp(404, {'error': 'День не найден'})
    if day['is_completed']:
        cur.close()
        return resp(400, {'error': 'День уже выполнен'})

    # Mark as completed
    cur.execute("""
        UPDATE study_plan_days
        SET is_completed = TRUE, completed_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """, (day_id,))

    # Update plan completed_days count
    cur.execute("""
        UPDATE study_plans
        SET completed_days = completed_days + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = %s
    """, (plan_id,))

    conn.commit()

    # Return updated day
    cur.execute("""
        SELECT id, day_number, title, topics, minutes, is_completed, completed_at
        FROM study_plan_days
        WHERE id = %s
    """, (day_id,))
    updated_day = dict(cur.fetchone())
    cur.close()

    return resp(200, {'success': True, 'day': updated_day})


def handle_delete(conn, user_id: int, body: dict) -> dict:
    """Deletes a study plan and all its days (cascade)."""
    plan_id = body.get('plan_id')
    if not plan_id:
        return resp(400, {'error': 'Не указан ID плана'})

    try:
        plan_id = int(plan_id)
    except (ValueError, TypeError):
        return resp(400, {'error': 'ID плана должен быть числом'})

    cur = conn.cursor()

    # Verify ownership
    cur.execute("SELECT id FROM study_plans WHERE id = %s AND user_id = %s", (plan_id, user_id))
    if not cur.fetchone():
        cur.close()
        return resp(404, {'error': 'План не найден'})

    cur.execute("DELETE FROM study_plan_days WHERE plan_id = %s", (plan_id,))
    cur.execute("DELETE FROM study_plans WHERE id = %s AND user_id = %s", (plan_id, user_id))
    conn.commit()
    cur.close()

    return resp(200, {'success': True, 'message': 'План удалён'})


# ---------------------------------------------------------------------------
# Main handler
# ---------------------------------------------------------------------------

def handler(event: dict, context) -> dict:
    """Main entry point for the study-plan cloud function."""
    method = event.get('httpMethod', 'GET')
    client_ip = get_client_ip(event)

    # Rate limiting
    is_allowed, remaining, retry_after = check_rate_limit(
        f"{client_ip}_study_plan", max_requests=60, window_seconds=60
    )
    if not is_allowed:
        return {
            'statusCode': 429,
            'headers': CORS_HEADERS,
            'body': json.dumps({'error': 'Слишком много запросов', 'retry_after': retry_after}),
        }

    # CORS preflight
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': OPTIONS_HEADERS,
            'body': '',
        }

    # Auth
    auth_header = event.get('headers', {}).get('X-Authorization', '')
    token = auth_header.replace('Bearer ', '')
    if not token:
        return resp(401, {'error': 'Требуется авторизация'})

    payload = verify_token(token)
    if not payload:
        return resp(401, {'error': 'Неверный токен'})

    user_id = payload.get('user_id')
    if not user_id:
        return resp(401, {'error': 'Некорректные данные токена'})

    # DB connection
    conn = get_db_connection()

    try:
        # Ensure tables exist
        ensure_tables(conn)

        # Premium check for all actions
        if not check_premium(conn, user_id):
            return resp(403, {'error': 'План подготовки доступен только для Премиум', 'message': 'План подготовки доступен только для Премиум-подписчиков'})

        params = event.get('queryStringParameters', {}) or {}
        action = params.get('action', '')

        if method == 'GET':
            if action == 'list':
                return handle_list(conn, user_id)
            elif action == 'detail':
                return handle_detail(conn, user_id, params)
            else:
                return resp(400, {'error': 'Неизвестное действие. Используйте: list, detail'})

        elif method == 'POST':
            body = {}
            if event.get('body'):
                try:
                    body = json.loads(event['body'])
                except (json.JSONDecodeError, TypeError):
                    return resp(400, {'error': 'Некорректный формат данных'})

            post_action = body.get('action', '')

            if post_action == 'generate':
                return handle_generate(conn, user_id, body)
            elif post_action == 'complete_day':
                return handle_complete_day(conn, user_id, body)
            elif post_action == 'delete':
                return handle_delete(conn, user_id, body)
            else:
                return resp(400, {'error': 'Неизвестное действие. Используйте: generate, complete_day, delete'})

        else:
            return resp(405, {'error': 'Метод не разрешён'})

    except Exception as e:
        print(f"[STUDY-PLAN] Unhandled error: {e}", flush=True)
        return resp(500, {'error': 'Внутренняя ошибка сервера'})
    finally:
        conn.close()