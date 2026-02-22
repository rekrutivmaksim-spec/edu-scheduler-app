import json
import os
import jwt
import httpx
from datetime import datetime

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

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

PROMPTS = {
    'solve': (
        'Ты — репетитор. На изображении — задача или упражнение. '
        'Реши её пошагово, объясняя каждый шаг простым языком. '
        'Формат:\n**Решение:**\nШаг 1: ...\nШаг 2: ...\n\n**Ответ:** ...\n\nПиши по-русски.'
    ),
    'cheatsheet': (
        'Ты — помощник студента. На изображении — экзаменационные билеты или вопросы. '
        'Дай краткий чёткий ответ на КАЖДЫЙ вопрос. '
        'Формат:\n## Вопрос N\n**Ответ:** ...\n\nПиши по-русски.'
    ),
    'summary': (
        'Ты — помощник студента. На изображении — страница учебника или конспект. '
        'Сделай структурированный конспект: ключевые понятия, определения, формулы. '
        'Формат: заголовки ##, термины жирным. Пиши кратко, по-русски.'
    ),
    'flashcards': (
        'Ты — помощник студента. На изображении — учебный материал. '
        'Создай 5-10 флэшкарточек по материалу.\n'
        'Формат:\n**Вопрос:** ...\n**Ответ:** ...\n\nПиши по-русски.'
    )
}

VISION_MODEL = 'gpt-4o-mini'

def try_vision_request(image_data: str, mime: str, prompt: str) -> tuple[str, str]:
    """Отправляет фото в gpt-4o-mini через Artemox и возвращает (text, model_used)"""
    payload = {
        'model': VISION_MODEL,
        'messages': [
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'image_url',
                        'image_url': {'url': f'data:{mime};base64,{image_data}'}
                    },
                    {
                        'type': 'text',
                        'text': prompt
                    }
                ]
            }
        ],
        'temperature': 0.3,
        'max_tokens': 2048
    }

    with httpx.Client(timeout=60.0) as client:
        response = client.post(
            'https://api.artemox.com/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {OPENAI_API_KEY}',
                'Content-Type': 'application/json'
            },
            json=payload
        )

    print(f"[vision] model={VISION_MODEL} status={response.status_code}", flush=True)

    if response.status_code == 200:
        data = response.json()
        text = data.get('choices', [{}])[0].get('message', {}).get('content', '')
        return text, VISION_MODEL

    print(f"[vision] error: {response.text[:300]}", flush=True)
    return '', ''

def handler(event: dict, context) -> dict:
    """Распознаёт фото задач/билетов через vision-модель и генерирует решение/шпаргалку"""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    auth_header = event.get('headers', {}).get('X-Authorization') or event.get('headers', {}).get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip()
    user_id = get_user_id(token)
    if not user_id:
        return err(401, {'error': 'Необходима авторизация'})

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception:
        return err(400, {'error': 'Неверный формат запроса'})

    image_data = body.get('image_data', '')
    mode = body.get('mode', 'solve')

    if not image_data:
        return err(400, {'error': 'Нет изображения'})

    if image_data.startswith('data:'):
        mime = image_data.split(';')[0].replace('data:', '')
        image_data = image_data.split(',', 1)[1]
    else:
        mime = 'image/jpeg'

    prompt = PROMPTS.get(mode, PROMPTS['solve'])

    try:
        text, model_used = try_vision_request(image_data, mime, prompt)

        if not text:
            return err(502, {'error': 'Функция распознавания фото временно недоступна. Попробуй ввести задачу текстом в ИИ-ассистенте.'})

        return ok({
            'result': text,
            'mode': mode,
            'model': model_used,
            'generated_at': datetime.utcnow().isoformat()
        })

    except httpx.TimeoutException:
        return err(504, {'error': 'Превышено время ожидания. Попробуй ещё раз.'})
    except Exception as e:
        import traceback
        print(f"[EXCEPTION] {traceback.format_exc()}", flush=True)
        return err(500, {'error': str(e)[:300]})