"""API для работы с учебными материалами: загрузка файлов Word/Excel/PDF, извлечение текста, анализ через Deepseek"""

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
from docx import Document
from openpyxl import load_workbook
from PyPDF2 import PdfReader


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
    
    # Бесплатная версия - нет доступа к загрузке файлов
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


def extract_text_from_docx(file_data: bytes) -> str:
    """Извлекает текст из Word документа"""
    try:
        print("[MATERIALS] Извлечение текста из DOCX")
        doc = Document(io.BytesIO(file_data))
        text = '\n'.join([paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip()])
        print(f"[MATERIALS] Извлечено {len(text)} символов из DOCX")
        return text
    except Exception as e:
        print(f"[MATERIALS] Ошибка извлечения из DOCX: {str(e)}")
        return ""


def extract_text_from_xlsx(file_data: bytes) -> str:
    """Извлекает текст из Excel файла"""
    try:
        print("[MATERIALS] Извлечение текста из XLSX")
        wb = load_workbook(io.BytesIO(file_data), data_only=True)
        text_parts = []
        
        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            text_parts.append(f"=== {sheet_name} ===")
            
            for row in sheet.iter_rows(values_only=True):
                row_text = '\t'.join([str(cell) if cell is not None else '' for cell in row])
                if row_text.strip():
                    text_parts.append(row_text)
        
        text = '\n'.join(text_parts)
        print(f"[MATERIALS] Извлечено {len(text)} символов из XLSX")
        return text
    except Exception as e:
        print(f"[MATERIALS] Ошибка извлечения из XLSX: {str(e)}")
        return ""


def extract_text_from_pdf(file_data: bytes) -> str:
    """Извлекает текст из PDF файла"""
    try:
        print("[MATERIALS] Извлечение текста из PDF")
        pdf_reader = PdfReader(io.BytesIO(file_data))
        text_parts = []
        
        for page_num, page in enumerate(pdf_reader.pages, 1):
            page_text = page.extract_text()
            if page_text.strip():
                text_parts.append(f"=== Страница {page_num} ===")
                text_parts.append(page_text)
        
        text = '\n'.join(text_parts)
        print(f"[MATERIALS] Извлечено {len(text)} символов из PDF")
        return text
    except Exception as e:
        print(f"[MATERIALS] Ошибка извлечения из PDF: {str(e)}")
        return ""


def analyze_text_with_deepseek(text: str, filename: str) -> dict:
    """Анализирует извлеченный текст через Deepseek для извлечения структуры"""
    deepseek_key = os.environ.get('DEEPSEEK_API_KEY')
    
    if not deepseek_key:
        print("[MATERIALS] DEEPSEEK_API_KEY не найден")
        return {
            'text': text,
            'summary': 'Файл загружен, но анализ недоступен',
            'subject': 'Общее',
            'title': filename[:50],
            'tasks': []
        }
    
    if not text or len(text) < 10:
        return {
            'text': 'Текст не извлечен или файл пуст',
            'summary': 'Не удалось извлечь содержимое файла',
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
        
        # Ограничиваем текст для анализа (первые 3000 символов)
        text_preview = text[:3000] if len(text) > 3000 else text
        
        prompt = f"""Ты помощник студента. Проанализируй этот учебный материал из файла "{filename}".

Содержимое файла:
{text_preview}

Верни JSON в таком формате:
{{
  "text": "Исходный текст (можешь улучшить форматирование, но сохрани содержание)",
  "summary": "Краткое резюме (2-3 предложения): о чём материал, ключевые темы",
  "subject": "Предмет (например: Математика, Физика, Программирование, История, Экономика)",
  "title": "Краткое название материала (макс 50 символов)",
  "tasks": [
    {{"title": "Название задачи", "deadline": "YYYY-MM-DD или null"}}
  ]
}}

ВАЖНО:
- Если упомянуты задания/домашка с датами - добавь в tasks
- Если дата не указана - deadline: null
- Если нет заданий - tasks: []
- Определи предмет по содержанию текста
- Создай понятное название для материала
"""
        
        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "user", "content": prompt}
            ],
            max_tokens=2000,
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
        
        # Сохраняем полный текст, если он был сокращен
        result['text'] = text
        
        print(f"[MATERIALS] Анализ завершен: {result.get('title')}")
        return result
        
    except Exception as e:
        print(f"[MATERIALS] Ошибка анализа Deepseek: {str(e)}")
        return {
            'text': text,
            'summary': 'Файл загружен, но автоматический анализ не удался',
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
    
    # POST /upload - Загрузка и анализ файла
    if method == 'POST':
        try:
            # Проверяем подписку перед обработкой файла
            conn = get_db_connection()
            access = check_subscription_access(conn, user_id)
            
            if not access['has_access']:
                conn.close()
                reason = access.get('reason', 'no_access')
                
                if reason == 'subscription_expired':
                    message = '⏰ Ваша подписка истекла. Продлите подписку для загрузки материалов.'
                else:
                    message = '🔒 Загрузка материалов доступна только по подписке. Оформите подписку!'
                
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
            file_type = body.get('file_type', 'application/octet-stream')
            
            if not file_base64:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Файл не предоставлен'})
                }
            
            print(f"[MATERIALS] Начинаю обработку файла {filename} для пользователя {user_id}")
            
            try:
                # Декодируем base64
                if ',' in file_base64:
                    file_data = base64.b64decode(file_base64.split(',')[1])
                else:
                    file_data = base64.b64decode(file_base64)
                print(f"[MATERIALS] Файл декодирован, размер: {len(file_data)} байт")
            except Exception as e:
                print(f"[MATERIALS] Ошибка декодирования: {str(e)}")
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Неверный формат файла'})
                }
            
            # Извлекаем текст в зависимости от типа файла
            file_ext = filename.lower().split('.')[-1]
            
            if file_ext == 'docx' or 'word' in file_type.lower():
                extracted_text = extract_text_from_docx(file_data)
            elif file_ext == 'xlsx' or file_ext == 'xls' or 'excel' in file_type.lower() or 'spreadsheet' in file_type.lower():
                extracted_text = extract_text_from_xlsx(file_data)
            elif file_ext == 'pdf' or 'pdf' in file_type.lower():
                extracted_text = extract_text_from_pdf(file_data)
            else:
                return {
                    'statusCode': 400,
                    'headers': headers,
                    'body': json.dumps({'error': 'Неподдерживаемый формат файла. Поддерживаются: Word (.docx), Excel (.xlsx), PDF'})
                }
            
            # Загружаем файл в S3
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            s3_filename = f"{user_id}_{timestamp}_{filename}"
            print(f"[MATERIALS] Загружаю в S3: {s3_filename}")
            file_url = upload_to_s3(file_data, s3_filename, file_type)
            print(f"[MATERIALS] Загружено в S3: {file_url}")
            
            # Анализируем текст через Deepseek
            print(f"[MATERIALS] Анализирую текст через Deepseek")
            analysis_result = analyze_text_with_deepseek(extracted_text, filename)
            
            # Сохраняем в БД
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
                        analysis_result.get('title', filename[:50]),
                        analysis_result.get('subject'),
                        file_url,
                        analysis_result.get('text'),
                        analysis_result.get('summary')
                    ))
                    
                    material = cur.fetchone()
                    conn.commit()
                    
                    print(f"[MATERIALS] Материал создан: ID={material['id']}")
                    
                    return {
                        'statusCode': 201,
                        'headers': headers,
                        'body': json.dumps({
                            'material': dict(material),
                            'tasks': analysis_result.get('tasks', [])
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
