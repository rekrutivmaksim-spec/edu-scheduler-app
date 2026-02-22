import json
import os
import jwt
import base64
import httpx
from datetime import datetime

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
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

def handler(event: dict, context) -> dict:
    """Распознаёт фото билетов/учебников и генерирует шпаргалку через Gemini Flash"""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    auth_header = event.get('headers', {}).get('X-Authorization') or event.get('headers', {}).get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip()
    user_id = get_user_id(token)
    if not user_id:
        return err(401, {'error': 'Необходима авторизация'})

    if not GEMINI_API_KEY:
        return err(503, {'error': 'Gemini API не настроен'})

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return err(400, {'error': 'Неверный формат запроса'})

    image_data = body.get('image_data', '')
    mode = body.get('mode', 'cheatsheet')

    if not image_data:
        return err(400, {'error': 'Нет изображения'})

    if image_data.startswith('data:'):
        image_data = image_data.split(',', 1)[1]

    PROMPTS = {
        'cheatsheet': (
            'Ты — помощник студента. На фото — экзаменационные билеты или вопросы к экзамену. '
            'Твоя задача: дай краткий, чёткий ответ на КАЖДЫЙ вопрос. '
            'Формат:\n## Билет/Вопрос N\n**Краткий ответ:** ...\n\n'
            'Пиши по-русски. Отвечай только по содержимому фото. '
            'Если вопросов нет — сделай краткий конспект того, что видишь.'
        ),
        'summary': (
            'Ты — помощник студента. На фото — страница учебника или конспект лекции. '
            'Сделай структурированный конспект: выдели ключевые понятия, определения, формулы. '
            'Формат: заголовки с ##, ключевые термины жирным, определения с тире. '
            'Пиши кратко и по делу, по-русски.'
        ),
        'flashcards': (
            'Ты — помощник студента. На фото — учебный материал. '
            'Создай набор флэшкарточек для запоминания. '
            'Формат каждой карточки:\n**Вопрос:** ...\n**Ответ:** ...\n\n'
            'Сделай 5-10 карточек по самым важным понятиям. Пиши по-русски.'
        )
    }

    prompt = PROMPTS.get(mode, PROMPTS['cheatsheet'])

    payload = {
        'contents': [{
            'parts': [
                {'text': prompt},
                {
                    'inline_data': {
                        'mime_type': 'image/jpeg',
                        'data': image_data
                    }
                }
            ]
        }],
        'generationConfig': {
            'temperature': 0.3,
            'maxOutputTokens': 2048
        }
    }

    with httpx.Client(timeout=30.0) as client:
        response = client.post(
            f'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )

    if response.status_code != 200:
        return err(502, {'error': 'Ошибка Gemini API', 'detail': response.text[:200]})

    data = response.json()
    text = data.get('candidates', [{}])[0].get('content', {}).get('parts', [{}])[0].get('text', '')

    if not text:
        return err(502, {'error': 'Gemini не вернул ответ'})

    return ok({
        'result': text,
        'mode': mode,
        'generated_at': datetime.utcnow().isoformat()
    })
