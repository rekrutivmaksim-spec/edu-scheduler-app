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

def get_recent_facts(conn, user_id, limit=20):
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute(
        f'SELECT fact_text FROM {SCHEMA}.daily_facts WHERE user_id = %s ORDER BY fact_date DESC LIMIT %s',
        (user_id, limit)
    )
    rows = cur.fetchall()
    cur.close()
    return [r['fact_text'] for r in rows]

def generate_fact(subject_key, recent_facts=None):
    subject_name = SUBJECT_NAMES.get(subject_key, 'наука')
    emoji = SUBJECT_EMOJIS.get(subject_key, '🧠')

    recent_block = ''
    if recent_facts:
        recent_list = '\n'.join(f'- {f}' for f in recent_facts[:15])
        recent_block = f'\n\nНЕ ПОВТОРЯЙ эти факты (уже были):\n{recent_list}\n'

    prompt = f"""Придумай один простой, но неожиданный факт по предмету «{subject_name}».

Стиль: как в приложении Яндекс Путешествия — короткий факт, который вроде бы простой, но большинство людей его не знает. Вызывает реакцию «О, а я не знал!».

Примеры такого стиля (НЕ используй эти факты, придумай свой):
- «На Северном полюсе нет пингвинов — они живут только в Южном полушарии»
- «Великая Китайская стена не видна из космоса невооружённым глазом»
- «Банан — это ягода, а клубника — нет»

Требования:
- Факт должен быть ПРАВДИВЫМ и проверяемым
- Простой язык, понятный школьнику
- Одно-два предложения, до 150 символов
- Без вступлений («Знаете ли вы», «Интересно, что») — сразу факт
- Связан с предметом «{subject_name}»{recent_block}

Ответь ТОЛЬКО JSON: {{"text": "...", "emoji": "..."}}
Emoji — один символ, отражающий суть факта."""

    try:
        http = httpx.Client(timeout=httpx.Timeout(15.0, connect=5.0))
        resp = http.post(
            API_URL,
            json={
                'model': MODEL,
                'messages': [
                    {'role': 'system', 'content': 'Ты генератор коротких познавательных фактов. Твои факты простые, правдивые и вызывают удивление — «вроде очевидно, а я не знал». Никакой экзотики и выдумок. Отвечай строго JSON.'},
                    {'role': 'user', 'content': prompt},
                ],
                'temperature': 0.9,
                'max_tokens': 200,
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

def get_or_create_fact(conn, user_id, subject_key):
    today = date.today()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        f'SELECT fact_text, emoji FROM {SCHEMA}.daily_facts WHERE user_id = %s AND subject = %s AND fact_date = %s',
        (user_id, subject_key, today)
    )
    row = cur.fetchone()
    if row:
        cur.close()
        return row['fact_text'], row['emoji']

    recent_facts = get_recent_facts(conn, user_id)
    text, emoji = generate_fact(subject_key, recent_facts)
    if not text:
        cur.close()
        return None, None

    try:
        cur.execute(
            f'INSERT INTO {SCHEMA}.daily_facts (user_id, subject, fact_text, emoji, fact_date) VALUES (%s, %s, %s, %s, %s) ON CONFLICT (user_id, subject, fact_date) DO NOTHING RETURNING fact_text, emoji',
            (user_id, subject_key, text, emoji, today)
        )
        conn.commit()
        inserted = cur.fetchone()
        cur.close()
        if inserted:
            return inserted['fact_text'], inserted['emoji']
        cur2 = conn.cursor(cursor_factory=RealDictCursor)
        cur2.execute(
            f'SELECT fact_text, emoji FROM {SCHEMA}.daily_facts WHERE user_id = %s AND subject = %s AND fact_date = %s',
            (user_id, subject_key, today)
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
        text, emoji = get_or_create_fact(conn, user_id, subject)

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