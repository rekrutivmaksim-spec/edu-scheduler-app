"""API для работы с учебными материалами: загрузка фото, распознавание текста через GPT-4 Vision, создание заметок"""

import json
import os
import base64
import boto3
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
from openai import OpenAI  # Используется совместимый клиент для Deepseek


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


def check_subscription_access(conn, user_id: int) -> dict:
    """Проверяет наличие активной подписки для доступа к сканеру"""
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute(f'''
        SELECT subscription_type, subscription_expires_at
        FROM {schema}.users
        WHERE id = %s
    ''', (user_id,))
    
    user = cursor.fetchone()
    cursor.close()
    
    if not user:
        return {'has_access': False, 'reason': 'user_not_found'}
    
    sub_type = user.get('subscription_type')
    expires_at = user.get('subscription_expires_at')
    now = datetime.now()
    
    # Проверяем премиум подписку
    if sub_type == 'premium':
        if expires_at and expires_at.replace(tzinfo=None) > now:
            return {'has_access': True, 'is_premium': True}
        else:
            return {'has_access': False, 'reason': 'subscription_expired'}
    
    # Бесплатная версия - нет доступа к сканеру
    return {'has_access': False, 'reason': 'no_subscription'}


def upload_to_s3(image_data: bytes, filename: str) -> str:
    """Загружает изображение в S3 и возвращает CDN URL"""
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
    )
    
    key = f"materials/{filename}"
    s3.put_object(
        Bucket='files',
        Key=key,
        Body=image_data,
        ContentType='image/jpeg'
    )
    
    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    return cdn_url


def recognize_text_from_image(image_url: str) -> dict:
    """Использует Deepseek Vision для распознавания текста с изображений"""
    deepseek_key = os.environ.get('DEEPSEEK_API_KEY')
    
    if not deepseek_key:
        print("[MATERIALS] DEEPSEEK_API_KEY не найден")
        return {
            'text': 'Ключ API не настроен',
            'summary': 'Настройте DEEPSEEK_API_KEY для распознавания',
            'subject': 'Общее',
            'title': 'Материал без распознавания',
            'tasks': []
        }
    
    try:
        print(f"[MATERIALS] Начинаю распознавание изображения через Deepseek Vision: {image_url}")
        client = OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com",
            timeout=30.0
        )
        
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """Ты помощник студента. Проанализируй это изображение (доска/конспект/учебный материал).

Верни JSON в таком формате:
{
  "text": "Весь распознанный текст с изображения",
  "summary": "Краткое резюме (2-3 предложения): о чём материал, ключевые темы",
  "subject": "Предмет (например: Математика, Физика, Программирование)",
  "title": "Краткое название материала (макс 50 символов)",
  "tasks": [
    {"title": "Название задачи", "deadline": "YYYY-MM-DD или null"},
    ...
  ]
}

ВАЖНО:
- Если на изображении упомянуты задания/домашка с датами - добавь в tasks
- Если дата не указана - deadline: null
- Если нет заданий - tasks: []
- Весь текст распознавай максимально точно
"""
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": image_url}
                        }
                    ]
                }
            ],
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        print(f"[MATERIALS] Получен ответ от Deepseek: {content[:200]}...")
        
        # Deepseek может вернуть JSON в markdown блоке, очищаем
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0].strip()
        elif '```' in content:
            content = content.split('```')[1].split('```')[0].strip()
        
        result = json.loads(content)
        print(f"[MATERIALS] Распознавание завершено: {result.get('title')}")
        return result
        
    except Exception as e:
        print(f"[MATERIALS] Ошибка распознавания: {str(e)}")
        return {
            'text': f'Ошибка распознавания: {str(e)}',
            'summary': 'Не удалось распознать изображение',
            'subject': 'Общее',
            'title': 'Материал (ошибка распознавания)',
            'tasks': []
        }


def handler(event: dict, context) -> dict:
    """Обработчик запросов для работы с материалами"""
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
    
    # POST /upload - Загрузка и распознавание фото
    if method == 'POST':
        try:
            # Проверяем подписку перед обработкой изображения
            conn = get_db_connection()
            access = check_subscription_access(conn, user_id)
            
            if not access['has_access']:
                conn.close()
                reason = access.get('reason', 'no_access')
                
                if reason == 'subscription_expired':
                    message = '⏰ Ваша подписка истекла. Продлите подписку для использования сканера.'
                else:
                    message = '🔒 Сканер доступен только по подписке. Оформите подписку!'
                
                return {
                    'statusCode': 403,
                    'headers': headers,
                    'body': json.dumps({
                        'error': 'subscription_required',
                        'message': message,
                        'reason': reason
                    })
                }
            
            conn.close()
            
            body = json.loads(event.get('body', '{}'))
            image_base64 = body.get('image')
            
            if not image_base64:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Изображение не предоставлено'})
                }
            
            print(f"[MATERIALS] Начинаю обработку изображения для пользователя {user_id}")
            
            try:
                image_data = base64.b64decode(image_base64.split(',')[1] if ',' in image_base64 else image_base64)
                print(f"[MATERIALS] Изображение декодировано, размер: {len(image_data)} байт")
            except Exception as e:
                print(f"[MATERIALS] Ошибка декодирования: {str(e)}")
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Неверный формат изображения'})
                }
            
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"{user_id}_{timestamp}.jpg"
            
            print(f"[MATERIALS] Загружаю в S3: {filename}")
            image_url = upload_to_s3(image_data, filename)
            print(f"[MATERIALS] Загружено в S3: {image_url}")
            
            print(f"[MATERIALS] Запускаю распознавание")
            recognition_result = recognize_text_from_image(image_url)
            
            conn = get_db_connection()
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    print(f"[MATERIALS] Сохраняю в БД")
                    cur.execute("""
                        INSERT INTO materials (user_id, title, subject, image_url, recognized_text, summary)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING id, title, subject, image_url, recognized_text, summary, created_at
                    """, (
                        user_id,
                        recognition_result.get('title', 'Без названия'),
                        recognition_result.get('subject'),
                        image_url,
                        recognition_result.get('text'),
                        recognition_result.get('summary')
                    ))
                    
                    material = cur.fetchone()
                    conn.commit()
                    
                    print(f"[MATERIALS] Материал создан: ID={material['id']}")
                    
                    return {
                        'statusCode': 201,
                        'headers': headers,
                        'body': json.dumps({
                            'material': dict(material),
                            'tasks': recognition_result.get('tasks', [])
                        }, default=str)
                    }
            finally:
                conn.close()
                
        except Exception as e:
            print(f"[MATERIALS] Критическая ошибка: {str(e)}")
            import traceback
            traceback.print_exc()
            return {
                'statusCode': 500,
                'headers': headers,
                'body': json.dumps({'error': f'Ошибка обработки: {str(e)}'})
            }
    
    # GET /materials - Получить все материалы пользователя
    elif method == 'GET':
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT id, title, subject, image_url, recognized_text, summary, created_at
                    FROM materials
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                """, (user_id,))
                
                materials = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'materials': [dict(m) for m in materials]}, default=str)
                }
        finally:
            conn.close()
    
    # DELETE /materials/:id - Удалить материал
    elif method == 'DELETE':
        material_id = event.get('queryStringParameters', {}).get('id')
        
        if not material_id:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'ID материала не указан'})
            }
        
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM materials
                    WHERE id = %s AND user_id = %s
                """, (material_id, user_id))
                
                conn.commit()
                
                if cur.rowcount == 0:
                    return {
                        'statusCode': 404,
                        'headers': headers,
                        'body': json.dumps({'error': 'Материал не найден'})
                    }
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'message': 'Материал удалён'})
                }
        finally:
            conn.close()
    
    return {
        'statusCode': 405,
        'headers': headers,
        'body': json.dumps({'error': 'Метод не поддерживается'})
    }