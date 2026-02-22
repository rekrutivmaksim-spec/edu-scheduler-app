import json
import os
import jwt
import httpx
import boto3
import base64
import uuid
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
        'ВАЖНО: отвечай ТОЛЬКО на русском языке, независимо от языка задачи.\n\n'
        'Ты — репетитор. На изображении — задача или упражнение. '
        'Реши её пошагово, объясняя каждый шаг простым языком. '
        'Формат:\n**Решение:**\nШаг 1: ...\nШаг 2: ...\n\n**Ответ:** ...'
    ),
    'cheatsheet': (
        'ВАЖНО: отвечай ТОЛЬКО на русском языке, независимо от языка вопросов.\n\n'
        'Ты — помощник студента. На изображении — экзаменационные билеты или вопросы. '
        'Дай краткий чёткий ответ на КАЖДЫЙ вопрос. '
        'Формат:\n## Вопрос N\n**Ответ:** ...'
    ),
    'summary': (
        'ВАЖНО: отвечай ТОЛЬКО на русском языке.\n\n'
        'Ты — помощник студента. На изображении — страница учебника или конспект. '
        'Сделай структурированный конспект: ключевые понятия, определения, формулы. '
        'Формат: заголовки ##, термины жирным. Пиши кратко.'
    ),
    'flashcards': (
        'ВАЖНО: отвечай ТОЛЬКО на русском языке.\n\n'
        'Ты — помощник студента. На изображении — учебный материал. '
        'Создай 5-10 флэшкарточек по материалу.\n'
        'Формат:\n**Вопрос:** ...\n**Ответ:** ...'
    )
}

VISION_MODEL = 'gpt-4o'
AWS_KEY = os.environ.get('AWS_ACCESS_KEY_ID', '')
AWS_SECRET = os.environ.get('AWS_SECRET_ACCESS_KEY', '')

def upload_to_s3(image_data: str, mime: str) -> str:
    """Загружает base64-изображение в S3 и возвращает публичный URL"""
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=AWS_KEY,
        aws_secret_access_key=AWS_SECRET
    )
    ext = mime.split('/')[-1].replace('jpeg', 'jpg')
    key = f'photo-cheatsheet/{uuid.uuid4()}.{ext}'
    img_bytes = base64.b64decode(image_data)
    s3.put_object(Bucket='files', Key=key, Body=img_bytes, ContentType=mime)
    return f"https://cdn.poehali.dev/projects/{AWS_KEY}/bucket/{key}"

def try_vision_request(image_data: str, mime: str, prompt: str) -> tuple[str, str]:
    """Загружает фото в S3, отправляет URL в gpt-4o, возвращает (text, model_used)"""
    print(f"[vision] uploading to S3, img_len={len(image_data)}", flush=True)
    image_url = upload_to_s3(image_data, mime)
    print(f"[vision] S3 url={image_url}", flush=True)

    payload = {
        'model': VISION_MODEL,
        'messages': [
            {
                'role': 'system',
                'content': 'Ты — помощник студента. Отвечай ТОЛЬКО на русском языке.'
            },
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'image_url',
                        'image_url': {'url': image_url}
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

    print(f"[vision] sending to Artemox model={VISION_MODEL}", flush=True)

    with httpx.Client(timeout=25.0) as client:
        response = client.post(
            'https://api.artemox.com/v1/chat/completions',
            headers={
                'Authorization': f'Bearer {OPENAI_API_KEY}',
                'Content-Type': 'application/json'
            },
            json=payload
        )

    print(f"[vision] status={response.status_code} body={response.text[:400]}", flush=True)

    if response.status_code == 200:
        data = response.json()
        content = (data.get('choices', [{}])[0].get('message') or {}).get('content') or ''
        return content, VISION_MODEL

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

    # Режим проверки соединения
    if body.get('mode') == 'ping':
        print('[ping] testing Artemox connection...', flush=True)
        try:
            with httpx.Client(timeout=15.0) as client:
                r = client.post(
                    'https://api.artemox.com/v1/chat/completions',
                    headers={'Authorization': f'Bearer {OPENAI_API_KEY}', 'Content-Type': 'application/json'},
                    json={'model': 'gpt-4o-mini', 'messages': [{'role': 'user', 'content': 'Say: OK'}], 'max_tokens': 10}
                )
            print(f'[ping] status={r.status_code} body={r.text[:300]}', flush=True)
            data = r.json() if r.status_code == 200 else {}
            reply = (data.get('choices', [{}])[0].get('message') or {}).get('content') or ''
            return ok({'ping': 'ok', 'status': r.status_code, 'reply': reply, 'raw': r.text[:200]})
        except Exception as e:
            return ok({'ping': 'error', 'error': str(e)})

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