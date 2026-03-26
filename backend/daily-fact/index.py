"""Факт дня — генерация интересного факта по предмету пользователя через ИИ."""
import json
import os
import jwt
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import date
import httpx

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'secret')
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
API_URL = 'https://api.aitunnel.ru/v1/chat/completions'
MODEL = 'llama-4-maverick'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
    'Content-Type': 'application/json',
}

SUBJECT_NAMES = {
    'ru': 'русский язык',
    'math_prof': 'математика (профильная)',
    'math_base': 'математика (базовая)',
    'physics': 'физика',
    'chemistry': 'химия',
    'biology': 'биология',
    'history': 'история',
    'social': 'обществознание',
    'informatics': 'информатика',
    'english': 'английский язык',
    'geography': 'география',
    'literature': 'литература',
}

SUBJECT_EMOJIS = {
    'ru': '📝', 'math_prof': '📐', 'math_base': '🔢', 'physics': '⚛️',
    'chemistry': '🧪', 'biology': '🧬', 'history': '🏛️', 'social': '⚖️',
    'informatics': '💻', 'english': '🇬🇧', 'geography': '🌍', 'literature': '📖',
}

def ok(body):
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(body, ensure_ascii=False)}

def err(code, msg):
    return {'statusCode': code, 'headers': CORS, 'body': json.dumps({'error': msg}, ensure_ascii=False)}

def get_user_id(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])['user_id']
    except Exception:
        return None

def generate_fact(subject_key):
    subject_name = SUBJECT_NAMES.get(subject_key, 'наука')
    emoji = SUBJECT_EMOJIS.get(subject_key, '🧠')

    prompt = f"""Придумай один ШОКИРУЮЩИЙ и малоизвестный факт по предмету «{subject_name}», который 99% школьников НЕ знают.

Требования:
- Факт должен вызвать реакцию «Ого, серьёзно?!» — никаких банальностей вроде «медузы бессмертны» или «вода кипит при 100 градусах»
- Конкретные цифры, даты, имена — чтобы было похоже на инсайдерское знание
- Полезно для ЕГЭ/ОГЭ — можно использовать в сочинении или для запоминания
- Максимум 2 предложения, до 180 символов
- Без вступлений типа «Знаете ли вы» — сразу факт

Ответь ТОЛЬКО JSON: {{"text": "...", "emoji": "..."}}
Emoji — один символ, отражающий суть факта."""

    try:
        http = httpx.Client(timeout=httpx.Timeout(15.0, connect=5.0))
        resp = http.post(
            API_URL,
            json={
                'model': MODEL,
                'messages': [
                    {'role': 'system', 'content': 'Ты эксперт по редким и малоизвестным фактам для школьников. Генерируй только то, что реально удивит. Никакой банальщины. Отвечай строго JSON.'},
                    {'role': 'user', 'content': prompt},
                ],
                'temperature': 1.0,
                'max_tokens': 250,
            },
            headers={'Authorization': f'Bearer {OPENROUTER_API_KEY}', 'Content-Type': 'application/json'},
        )
        http.close()

        if resp.status_code == 200:
            raw = resp.json()['choices'][0]['message']['content'].strip()
            raw = raw.replace('```json', '').replace('```', '').strip()
            data = json.loads(raw)
            return data.get('text', '')[:300], data.get('emoji', emoji)
    except Exception as e:
        print(f'[DailyFact] AI error: {e}')

    return None, emoji

def get_or_create_fact(conn, subject_key):
    today = date.today()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        f'SELECT fact_text, emoji FROM {SCHEMA}.daily_facts WHERE subject = %s AND fact_date = %s',
        (subject_key, today)
    )
    row = cur.fetchone()
    if row:
        cur.close()
        return row['fact_text'], row['emoji']

    text, emoji = generate_fact(subject_key)
    if not text:
        cur.close()
        return None, None

    try:
        cur.execute(
            f'INSERT INTO {SCHEMA}.daily_facts (subject, fact_text, emoji, fact_date) VALUES (%s, %s, %s, %s) ON CONFLICT (subject, fact_date) DO NOTHING RETURNING fact_text, emoji',
            (subject_key, text, emoji, today)
        )
        conn.commit()
        inserted = cur.fetchone()
        cur.close()
        if inserted:
            return inserted['fact_text'], inserted['emoji']
        cur2 = conn.cursor(cursor_factory=RealDictCursor)
        cur2.execute(
            f'SELECT fact_text, emoji FROM {SCHEMA}.daily_facts WHERE subject = %s AND fact_date = %s',
            (subject_key, today)
        )
        row2 = cur2.fetchone()
        cur2.close()
        if row2:
            return row2['fact_text'], row2['emoji']
    except Exception as e:
        print(f'[DailyFact] DB error: {e}')
        conn.rollback()
        cur.close()

    return text, emoji

def handler(event: dict, context) -> dict:
    """Генерация и отдача «факта дня» по предмету пользователя."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    auth_header = event.get('headers', {}).get('X-Authorization') or event.get('headers', {}).get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip()
    user_id = get_user_id(token)

    if not user_id:
        return err(401, 'Unauthorized')

    conn = psycopg2.connect(DATABASE_URL)
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(f'SELECT exam_subject FROM {SCHEMA}.users WHERE id = %s', (user_id,))
        user = cur.fetchone()
        cur.close()

        subject = (user or {}).get('exam_subject') or 'ru'
        text, emoji = get_or_create_fact(conn, subject)

        if not text:
            return ok({'fact': None})

        return ok({
            'fact': {
                'text': text,
                'emoji': emoji,
                'subject': subject,
                'subject_name': SUBJECT_NAMES.get(subject, 'Наука'),
                'date': str(date.today()),
            }
        })
    finally:
        conn.close()