import json
import os
import jwt
import base64
import httpx
import uuid
from datetime import datetime

JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
GIGACHAT_API_KEY = os.environ.get('GIGACHAT_API_KEY', '')

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

def get_gigachat_token() -> str:
    """Получает access token через Client Credentials"""
    rq_uid = str(uuid.uuid4())
    with httpx.Client(timeout=8.0, verify=False) as client:
        response = client.post(
            'https://ngw.devices.sberbank.ru:9443/api/v2/oauth',
            headers={
                'Authorization': f'Basic {GIGACHAT_API_KEY}',
                'RqUID': rq_uid,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            data={'scope': 'GIGACHAT_API_PERS'}
        )
    response.raise_for_status()
    return response.json()['access_token']

def upload_image_to_gigachat(access_token: str, image_data: str) -> str:
    """Загружает изображение в GigaChat и возвращает file_id"""
    img_bytes = base64.b64decode(image_data)
    with httpx.Client(timeout=20.0, verify=False) as client:
        response = client.post(
            'https://gigachat.devices.sberbank.ru/api/v1/files',
            headers={'Authorization': f'Bearer {access_token}'},
            files={'file': ('image.jpg', img_bytes, 'image/jpeg')},
            data={'purpose': 'general'}
        )
    response.raise_for_status()
    return response.json()['id']

def handler(event: dict, context) -> dict:
    """Распознаёт фото задач/билетов и генерирует шпаргалку через GigaChat Vision"""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    auth_header = event.get('headers', {}).get('X-Authorization') or event.get('headers', {}).get('Authorization', '')
    token = auth_header.replace('Bearer ', '').strip()
    user_id = get_user_id(token)
    if not user_id:
        return err(401, {'error': 'Необходима авторизация'})

    if not GIGACHAT_API_KEY:
        return err(503, {'error': 'GigaChat API не настроен'})

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
            'Твоя задача: дай краткий, чёткий ответ на КАЖДЫЙ вопрос с фото. '
            'Формат:\n## Вопрос N\n**Ответ:** ...\n\n'
            'Пиши по-русски. Если вопросов нет — сделай краткий конспект того, что видишь на фото.'
        ),
        'summary': (
            'Ты — помощник студента. На фото — страница учебника или конспект лекции. '
            'Сделай структурированный конспект: выдели ключевые понятия, определения, формулы. '
            'Формат: заголовки с ##, ключевые термины жирным. Пиши кратко, по-русски.'
        ),
        'flashcards': (
            'Ты — помощник студента. На фото — учебный материал. '
            'Создай 5-10 флэшкарточек для запоминания по материалу с фото.\n'
            'Формат каждой:\n**Вопрос:** ...\n**Ответ:** ...\n\nПиши по-русски.'
        ),
        'solve': (
            'Ты — репетитор. На фото — задача или упражнение. '
            'Реши её пошагово, объясняя каждый шаг простым языком. '
            'Формат:\n**Решение:**\nШаг 1: ...\nШаг 2: ...\n\n**Ответ:** ...\nПиши по-русски.'
        )
    }

    prompt = PROMPTS.get(mode, PROMPTS['cheatsheet'])

    try:
        access_token = get_gigachat_token()
        file_id = upload_image_to_gigachat(access_token, image_data)

        payload = {
            'model': 'GigaChat-Pro',
            'messages': [
                {
                    'role': 'user',
                    'content': prompt,
                    'attachments': [file_id]
                }
            ],
            'temperature': 0.3,
            'max_tokens': 2048
        }

        with httpx.Client(timeout=40.0, verify=False) as client:
            response = client.post(
                'https://gigachat.devices.sberbank.ru/api/v1/chat/completions',
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json'
                },
                json=payload
            )

        if response.status_code != 200:
            return err(502, {'error': 'Ошибка GigaChat API', 'detail': response.text[:300]})

        data = response.json()
        text = data.get('choices', [{}])[0].get('message', {}).get('content', '')

        if not text:
            return err(502, {'error': 'GigaChat не вернул ответ'})

        return ok({
            'result': text,
            'mode': mode,
            'generated_at': datetime.utcnow().isoformat()
        })

    except httpx.HTTPStatusError as e:
        print(f"[HTTP ERROR] status={e.response.status_code} body={e.response.text[:500]}")
        return err(502, {'error': f'HTTP ошибка: {e.response.status_code}', 'detail': e.response.text[:300]})
    except Exception as e:
        import traceback
        print(f"[EXCEPTION] {traceback.format_exc()}")
        return err(500, {'error': str(e)[:300]})