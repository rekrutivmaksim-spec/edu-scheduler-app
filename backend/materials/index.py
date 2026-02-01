"""API для работы с учебными материалами: загрузка документов (PDF, DOCX, TXT), извлечение текста, анализ через ИИ"""

import json
import os
import base64
import boto3
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
from openai import OpenAI
import io
from PyPDF2 import PdfReader
from docx import Document

# Максимальный размер файла: 50 МБ
MAX_FILE_SIZE = 50 * 1024 * 1024
# Размер чанка для разбиения больших текстов (символы)
CHUNK_SIZE = 4000


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
    """Проверяет наличие активной подписки для доступа к загрузке материалов"""
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
    
    # Бесплатная версия - нет доступа к загрузке материалов
    return {'has_access': False, 'reason': 'no_subscription'}


def upload_to_s3(file_data: bytes, filename: str, content_type: str) -> str:
    """Загружает файл в S3 и возвращает CDN URL"""
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
        Body=file_data,
        ContentType=content_type
    )
    
    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    return cdn_url


def extract_text_from_pdf(file_data: bytes) -> str:
    """Извлекает текст из PDF файла"""
    try:
        pdf_reader = PdfReader(io.BytesIO(file_data))
        text_parts = []
        for page in pdf_reader.pages:
            text_parts.append(page.extract_text())
        return '\n\n'.join(text_parts)
    except Exception as e:
        print(f"[MATERIALS] Ошибка извлечения текста из PDF: {str(e)}")
        return ""


def extract_text_from_docx(file_data: bytes) -> str:
    """Извлекает текст из DOCX файла"""
    try:
        doc = Document(io.BytesIO(file_data))
        text_parts = [paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip()]
        return '\n\n'.join(text_parts)
    except Exception as e:
        print(f"[MATERIALS] Ошибка извлечения текста из DOCX: {str(e)}")
        return ""


def extract_text_from_txt(file_data: bytes) -> str:
    """Извлекает текст из TXT файла"""
    try:
        # Пробуем разные кодировки
        for encoding in ['utf-8', 'windows-1251', 'cp1251', 'latin-1']:
            try:
                return file_data.decode(encoding)
            except:
                continue
        return file_data.decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"[MATERIALS] Ошибка извлечения текста из TXT: {str(e)}")
        return ""


def extract_text_from_file(file_data: bytes, file_type: str) -> str:
    """Извлекает текст из файла в зависимости от типа"""
    print(f"[MATERIALS] Извлечение текста из файла типа: {file_type}")
    
    if file_type == 'application/pdf' or file_type.endswith('.pdf'):
        return extract_text_from_pdf(file_data)
    elif file_type in ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
                        'application/msword'] or file_type.endswith('.docx'):
        return extract_text_from_docx(file_data)
    elif file_type == 'text/plain' or file_type.endswith('.txt'):
        return extract_text_from_txt(file_data)
    else:
        print(f"[MATERIALS] Неподдерживаемый тип файла: {file_type}")
        return ""


def split_text_into_chunks(text: str, chunk_size: int = CHUNK_SIZE) -> list:
    """Разбивает большой текст на чанки для обработки"""
    if not text:
        return []
    
    # Разбиваем по параграфам
    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk = ""
    
    for para in paragraphs:
        if len(current_chunk) + len(para) + 2 <= chunk_size:
            current_chunk += para + "\n\n"
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = para + "\n\n"
    
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    print(f"[MATERIALS] Текст разбит на {len(chunks)} чанков")
    return chunks


def analyze_document_with_deepseek(full_text: str, filename: str) -> dict:
    """Анализирует документ через Deepseek для извлечения структуры"""
    deepseek_key = os.environ.get('DEEPSEEK_API_KEY')
    
    if not deepseek_key:
        print("[MATERIALS] DEEPSEEK_API_KEY не найден")
        return {
            'summary': 'Документ загружен, но анализ недоступен',
            'subject': 'Общее',
            'title': filename[:50],
            'tasks': []
        }
    
    if not full_text or len(full_text) < 10:
        return {
            'summary': 'Не удалось извлечь текст из документа',
            'subject': 'Общее',
            'title': filename[:50],
            'tasks': []
        }
    
    try:
        print("[MATERIALS] Отправка текста в Deepseek для анализа")
        client = OpenAI(
            api_key=deepseek_key,
            base_url="https://api.deepseek.com",
            timeout=30.0
        )
        
        # Берем первые 3000 символов для анализа (чтобы уложиться в лимиты)
        text_preview = full_text[:3000]
        
        prompt = f"""Ты помощник студента. Проанализируй этот учебный документ.

Название файла: {filename}

Начало текста документа:
{text_preview}

Верни JSON в таком формате:
{{
  "summary": "Краткое резюме документа (2-3 предложения): о чём материал, ключевые темы",
  "subject": "Предмет (например: Математика, Физика, Программирование, История, ВКР)",
  "title": "Краткое название материала (макс 50 символов)",
  "tasks": [
    {{"title": "Название задачи", "deadline": "YYYY-MM-DD или null"}}
  ]
}}

ВАЖНО:
- Если упомянуты задания/сроки - добавь в tasks
- Если дата не указана - deadline: null
- Если нет заданий - tasks: []
- Определи предмет по содержанию
"""
        
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        print(f"[MATERIALS] Получен анализ от Deepseek: {content[:200]}...")
        
        # Deepseek может вернуть JSON в markdown блоке
        if '```json' in content:
            content = content.split('```json')[1].split('```')[0].strip()
        elif '```' in content:
            content = content.split('```')[1].split('```')[0].strip()
        
        result = json.loads(content)
        print(f"[MATERIALS] Анализ завершен: {result.get('title')}")
        return result
        
    except Exception as e:
        print(f"[MATERIALS] Ошибка анализа Deepseek: {str(e)}")
        return {
            'summary': 'Документ загружен, но автоматический анализ не удался',
            'subject': 'Общее',
            'title': filename[:50],
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
    
    # POST /upload - Загрузка документа
    if method == 'POST':
        try:
            # Проверяем подписку
            conn = get_db_connection()
            access = check_subscription_access(conn, user_id)
            
            if not access['has_access']:
                conn.close()
                reason = access.get('reason', 'no_access')
                
                if reason == 'subscription_expired':
                    message = '⏰ Ваша подписка истекла. Продлите подписку для загрузки материалов.'
                else:
                    message = '🔒 Загрузка материалов доступна только по подписке!'
                
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
            file_base64 = body.get('file')
            filename = body.get('filename', 'document')
            file_type = body.get('fileType', 'application/octet-stream')
            
            if not file_base64:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Файл не предоставлен'})
                }
            
            print(f"[MATERIALS] Начинаю обработку файла: {filename}, тип: {file_type}")
            
            try:
                file_data = base64.b64decode(file_base64.split(',')[1] if ',' in file_base64 else file_base64)
                file_size = len(file_data)
                print(f"[MATERIALS] Файл декодирован, размер: {file_size} байт")
                
                if file_size > MAX_FILE_SIZE:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': f'Файл слишком большой. Максимум: {MAX_FILE_SIZE // 1024 // 1024} МБ'})
                    }
                    
            except Exception as e:
                print(f"[MATERIALS] Ошибка декодирования: {str(e)}")
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Неверный формат файла'})
                }
            
            # Извлекаем текст из файла
            print("[MATERIALS] Извлечение текста из документа")
            full_text = extract_text_from_file(file_data, file_type)
            
            if not full_text:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Не удалось извлечь текст из документа. Проверьте формат файла.'})
                }
            
            # Разбиваем на чанки
            chunks = split_text_into_chunks(full_text)
            
            # Загружаем файл в S3
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            safe_filename = f"{user_id}_{timestamp}_{filename}"
            print(f"[MATERIALS] Загружаю в S3: {safe_filename}")
            file_url = upload_to_s3(file_data, safe_filename, file_type)
            print(f"[MATERIALS] Загружено в S3: {file_url}")
            
            # Анализируем документ
            print("[MATERIALS] Анализирую документ через Deepseek")
            analysis = analyze_document_with_deepseek(full_text, filename)
            
            # Сохраняем в БД
            conn = get_db_connection()
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    print("[MATERIALS] Сохраняю материал в БД")
                    cur.execute("""
                        INSERT INTO materials 
                        (user_id, title, subject, file_url, recognized_text, summary, file_type, file_size, total_chunks)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id, title, subject, file_url, summary, file_type, file_size, total_chunks, created_at
                    """, (
                        user_id,
                        analysis.get('title', filename[:50]),
                        analysis.get('subject'),
                        file_url,
                        full_text[:10000],  # Сохраняем первые 10k символов в recognized_text
                        analysis.get('summary'),
                        file_type,
                        file_size,
                        len(chunks)
                    ))
                    
                    material = cur.fetchone()
                    material_id = material['id']
                    
                    # Сохраняем чанки
                    print(f"[MATERIALS] Сохраняю {len(chunks)} чанков в БД")
                    for idx, chunk in enumerate(chunks):
                        cur.execute("""
                            INSERT INTO document_chunks (material_id, chunk_index, chunk_text)
                            VALUES (%s, %s, %s)
                        """, (material_id, idx, chunk))
                    
                    conn.commit()
                    
                    print(f"[MATERIALS] Материал создан: ID={material_id}, чанков={len(chunks)}")
                    
                    return {
                        'statusCode': 201,
                        'headers': headers,
                        'body': json.dumps({
                            'material': dict(material),
                            'tasks': analysis.get('tasks', []),
                            'chunks_count': len(chunks)
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
                    SELECT id, title, subject, file_url, recognized_text, summary, 
                           file_type, file_size, total_chunks, created_at
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
                # Сначала удаляем чанки
                cur.execute("""
                    DELETE FROM document_chunks
                    WHERE material_id IN (
                        SELECT id FROM materials WHERE id = %s AND user_id = %s
                    )
                """, (material_id, user_id))
                
                # Удаляем материал
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
