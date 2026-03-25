"""ИИ-репетитор по ошибкам — анализирует слабые места ученика и генерирует персональные задания."""
import json
import os
import jwt
import psycopg2
from openai import OpenAI
import httpx

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')

LLAMA_MODEL = 'llama-4-maverick'
OPENROUTER_BASE_URL = 'https://api.aitunnel.ru/v1/'

_http = httpx.Client(timeout=httpx.Timeout(25.0, connect=5.0))
client = OpenAI(api_key=OPENROUTER_API_KEY, base_url=OPENROUTER_BASE_URL, timeout=25.0, http_client=_http)

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
    'Access-Control-Max-Age': '86400'
}

def ok(body: dict) -> dict:
    return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps(body, ensure_ascii=False)}

def err(code: int, msg: str) -> dict:
    return {'statusCode': code, 'headers': CORS_HEADERS, 'body': json.dumps({'error': msg}, ensure_ascii=False)}

def get_user_id(event: dict) -> int | None:
    auth = event.get('headers', {}).get('X-Authorization') or event.get('headers', {}).get('Authorization') or ''
    token = auth.replace('Bearer ', '').strip()
    if not token:
        auth_lower = {k.lower(): v for k, v in event.get('headers', {}).items()}
        token = (auth_lower.get('x-authorization') or auth_lower.get('authorization') or '').replace('Bearer ', '').strip()
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload.get('user_id') or payload.get('id')
    except Exception:
        return None

def get_conn():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn

def save_answer(user_id: int, subject: str, topic: str, question: str, user_answer: str, is_correct: bool, ai_feedback: str, source: str, mode: str = None):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            f"""INSERT INTO {SCHEMA_NAME}.user_answers
                (user_id, subject, topic, question, user_answer, is_correct, ai_feedback, source, mode)
                VALUES ({user_id}, '{_esc(subject)}', '{_esc(topic)}', '{_esc(question)}', '{_esc(user_answer)}', {is_correct}, '{_esc(ai_feedback)}', '{_esc(source)}', '{_esc(mode or "")}')"""
        )
        cur.close()
    finally:
        conn.close()

def get_weaknesses(user_id: int, subject: str):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(f"""
            SELECT topic, 
                   COUNT(*) as total,
                   SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct_count,
                   SUM(CASE WHEN NOT is_correct THEN 1 ELSE 0 END) as wrong_count
            FROM {SCHEMA_NAME}.user_answers
            WHERE user_id = {user_id} AND subject = '{_esc(subject)}'
            GROUP BY topic
            HAVING SUM(CASE WHEN NOT is_correct THEN 1 ELSE 0 END) > 0
            ORDER BY SUM(CASE WHEN NOT is_correct THEN 1 ELSE 0 END) DESC
            LIMIT 10
        """)
        rows = cur.fetchall()
        cur.close()
        return [{'topic': r[0], 'total': r[1], 'correct': r[2], 'wrong': r[3]} for r in rows]
    finally:
        conn.close()

def get_recent_errors(user_id: int, subject: str, limit: int = 20):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(f"""
            SELECT topic, question, user_answer, ai_feedback
            FROM {SCHEMA_NAME}.user_answers
            WHERE user_id = {user_id} AND subject = '{_esc(subject)}' AND NOT is_correct
            ORDER BY created_at DESC
            LIMIT {limit}
        """)
        rows = cur.fetchall()
        cur.close()
        return [{'topic': r[0], 'question': r[1], 'user_answer': r[2], 'feedback': r[3]} for r in rows]
    finally:
        conn.close()

def get_stats(user_id: int, subject: str):
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute(f"""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN is_correct THEN 1 ELSE 0 END) as correct,
                   SUM(CASE WHEN NOT is_correct THEN 1 ELSE 0 END) as wrong
            FROM {SCHEMA_NAME}.user_answers
            WHERE user_id = {user_id} AND subject = '{_esc(subject)}'
        """)
        row = cur.fetchone()
        cur.close()
        if row:
            return {'total': row[0] or 0, 'correct': row[1] or 0, 'wrong': row[2] or 0}
        return {'total': 0, 'correct': 0, 'wrong': 0}
    finally:
        conn.close()

def generate_training(user_id: int, subject: str):
    weaknesses = get_weaknesses(user_id, subject)
    if not weaknesses:
        return {'has_data': False, 'message': 'Пока недостаточно данных. Пройди несколько уроков или тестов, и я проанализирую твои ошибки.'}

    errors = get_recent_errors(user_id, subject, 30)
    stats = get_stats(user_id, subject)

    weak_summary = '\n'.join([f"- {w['topic']}: {w['wrong']} ошибок из {w['total']} ответов" for w in weaknesses[:5]])
    error_examples = '\n'.join([f"Тема: {e['topic']}, Задание: {e['question'][:150]}, Ответ ученика: {e['user_answer'][:100]}" for e in errors[:10]])

    prompt = f"""Ты — ИИ-репетитор. Проанализируй ошибки ученика по предмету "{subject}" и дай рекомендации.

Статистика: {stats['total']} ответов, {stats['correct']} правильных, {stats['wrong']} ошибок.

Слабые темы:
{weak_summary}

Примеры ошибок:
{error_examples}

Задача:
1. Определи 3 главные слабости (конкретные навыки/типы задач)
2. Для каждой слабости дай краткое объяснение, почему ученик ошибается
3. Сгенерируй по 2 задания на каждую слабость (от простого к сложному)

Формат ответа — строго JSON:
{{
  "weaknesses": [
    {{
      "topic": "название слабости",
      "description": "краткое объяснение проблемы",
      "tasks": [
        {{"question": "текст задания 1", "hint": "подсказка"}},
        {{"question": "текст задания 2", "hint": "подсказка"}}
      ]
    }}
  ],
  "summary": "общий совет ученику (1-2 предложения)"
}}"""

    try:
        resp = client.chat.completions.create(
            model=LLAMA_MODEL,
            messages=[
                {'role': 'system', 'content': 'Ты опытный репетитор. Отвечай строго в формате JSON без markdown.'},
                {'role': 'user', 'content': prompt}
            ],
            temperature=0.7,
            max_tokens=2000
        )
        raw = resp.choices[0].message.content.strip()
        raw = raw.replace('```json', '').replace('```', '').strip()
        data = json.loads(raw)
        data['has_data'] = True
        data['stats'] = stats
        data['weak_topics'] = weaknesses[:5]
        return data
    except Exception as e:
        print(f"[weak-training] AI error: {e}", flush=True)
        return {
            'has_data': True,
            'stats': stats,
            'weak_topics': weaknesses[:5],
            'weaknesses': [{'topic': w['topic'], 'description': f"Ошибки: {w['wrong']} из {w['total']}", 'tasks': []} for w in weaknesses[:3]],
            'summary': 'Рекомендую повторить эти темы.'
        }

def chat_about_weakness(user_id: int, subject: str, topic: str, question: str, history: list):
    errors = get_recent_errors(user_id, subject, 10)
    error_context = '\n'.join([f"- {e['question'][:100]}: ответил '{e['user_answer'][:80]}'" for e in errors if e['topic'] == topic][:5])

    system_prompt = f"""Ты — терпеливый репетитор по предмету "{subject}". 
Тема тренировки: "{topic}".

Ошибки ученика по этой теме:
{error_context if error_context else "Данных пока мало, задавай задания по теме."}

Правила:
- Давай задания по одному
- После ответа ученика: проверь, объясни ошибку если есть, дай следующее задание
- Начинай с простого, усложняй постепенно
- Отвечай кратко и по делу (2-4 предложения)
- Если ученик ответил правильно — похвали и усложни
- Если неправильно — объясни просто и дай похожее задание
- Не используй LaTeX, таблицы, специальные символы"""

    msgs = [{'role': 'system', 'content': system_prompt}]
    for m in history[-8:]:
        msgs.append({'role': m.get('role', 'user'), 'content': m.get('content', '')})
    msgs.append({'role': 'user', 'content': question})

    try:
        resp = client.chat.completions.create(
            model=LLAMA_MODEL,
            messages=msgs,
            temperature=0.7,
            max_tokens=800
        )
        answer = resp.choices[0].message.content.strip()
        is_correct = _detect_correct(answer)
        return {'answer': answer, 'is_correct': is_correct}
    except Exception as e:
        print(f"[weak-training] chat error: {e}", flush=True)
        return {'answer': 'Ошибка соединения. Попробуй ещё раз.', 'is_correct': None}

def _detect_correct(text: str) -> bool | None:
    t = text.lower()
    if any(w in t for w in ['правильно', 'верно!', 'молодец', 'отлично!', 'всё верно', 'все верно']):
        return True
    if any(w in t for w in ['неверно', 'ошибка', 'неправильно', 'не совсем', 'к сожалению']):
        return False
    return None

def _esc(s: str) -> str:
    if s is None:
        return ''
    return str(s).replace("'", "''").replace("\\", "\\\\")

def handler(event: dict, context) -> dict:
    """ИИ-репетитор по ошибкам — анализ слабых мест и персональная тренировка."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    user_id = get_user_id(event)
    if not user_id:
        return err(401, 'Требуется авторизация')

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        body = {}

    action = body.get('action', '')

    if action == 'save_answer':
        save_answer(
            user_id=user_id,
            subject=body.get('subject', ''),
            topic=body.get('topic', ''),
            question=body.get('question', ''),
            user_answer=body.get('user_answer', ''),
            is_correct=body.get('is_correct', False),
            ai_feedback=body.get('ai_feedback', ''),
            source=body.get('source', 'session'),
            mode=body.get('mode')
        )
        return ok({'saved': True})

    if action == 'get_weaknesses':
        subject = body.get('subject', '')
        weaknesses = get_weaknesses(user_id, subject)
        stats = get_stats(user_id, subject)
        return ok({'weaknesses': weaknesses, 'stats': stats, 'has_data': len(weaknesses) > 0})

    if action == 'generate_training':
        subject = body.get('subject', '')
        result = generate_training(user_id, subject)
        return ok(result)

    if action == 'chat':
        subject = body.get('subject', '')
        topic = body.get('topic', '')
        question = body.get('question', '')
        history = body.get('history', [])
        result = chat_about_weakness(user_id, subject, topic, question, history)
        return ok(result)

    if action == 'get_stats':
        subject = body.get('subject', '')
        stats = get_stats(user_id, subject)
        return ok(stats)

    return err(400, f'Неизвестное действие: {action}')
