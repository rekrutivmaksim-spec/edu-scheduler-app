import json
import os
import psycopg2
import boto3
from botocore.config import Config
from typing import Dict, Any, List, Optional
from session_utils import validate_session

def delete_from_s3_if_orphaned(photo_url: str, user_id: str, cursor, schema: str) -> None: 
    '''
    Удаляет фото из S3, если оно не используется в других местах
    '''
    s3_bucket_name = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')
    s3_url_prefix = f'https://storage.yandexcloud.net/{s3_bucket_name}/'
    
    # Проверяем, что это наше хранилище
    if not photo_url or not photo_url.startswith(s3_url_prefix):
        return
    
    # Проверяем наличие в try_on_history
    cursor.execute(
        f"SELECT COUNT(*) as count FROM {schema}.try_on_history WHERE user_id = %s AND result_image = %s",
        (user_id, photo_url)
    )
    history_count = cursor.fetchone()[0]
    
    # Проверяем наличие в lookbooks
    cursor.execute(
        f"SELECT COUNT(*) as count FROM {schema}.lookbooks WHERE user_id = %s AND %s = ANY(photos)",
        (user_id, photo_url)
    )
    lookbooks_count = cursor.fetchone()[0]
    
    # Если фото нигде не используется - удаляем из S3
    if history_count == 0 and lookbooks_count == 0:
        try:
            s3_key = photo_url.replace(s3_url_prefix, '')
            
            s3_client = boto3.client(
                's3',
                endpoint_url='https://storage.yandexcloud.net',
                aws_access_key_id=os.environ.get('S3_ACCESS_KEY'),
                aws_secret_access_key=os.environ.get('S3_SECRET_KEY'),
                region_name='ru-central1',
                config=Config(signature_version='s3v4')
            )
            
            s3_client.delete_object(
                Bucket=s3_bucket_name,
                Key=s3_key
            )
            print(f'[S3] Deleted orphaned photo: {s3_key}')
        except Exception as e:
            print(f'[S3] Failed to delete {photo_url}: {e}')

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Универсальный API для работы с базой данных
    Args: event - dict with httpMethod, body
          context - object with request_id attribute
    Returns: HTTP response with query results
    '''
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Content-Type': 'application/json',
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    # Validate session token
    is_valid, user_id, error_msg = validate_session(event)
    
    if not is_valid:
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': error_msg or 'Unauthorized'})
        }
    
    try:
        body = json.loads(event.get('body', '{}'))
        table = body.get('table')
        action = body.get('action')
        
        # Log basic request info (without sensitive data)
        print(f'[DB-Query] table={table}, action={action}')
        
        if not table or not action:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Credentials': 'true'
                },
                'body': json.dumps({'error': 'Missing table or action'}),
                'isBase64Encoded': False
            }
        
        # Whitelist allowed tables
        allowed_tables = [
            'nanobananapro_tasks',
            'try_on_history',
            'lookbooks',
            'clothing_catalog',
            'users',
            'color_type_history'
        ]
        
        if table not in allowed_tables:
            return {
                'statusCode': 403,
                'headers': {
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Credentials': 'true'
                },
                'body': json.dumps({'error': f'Access to table {table} is not allowed'}),
                'isBase64Encoded': False
            }
        
        # Connect to database
        dsn = os.environ.get('DATABASE_URL')
        if not dsn:
            raise Exception('DATABASE_URL not configured')
        
        conn = psycopg2.connect(dsn)
        cursor = conn.cursor()
        
        schema = 't_p29007832_virtual_fitting_room'
        full_table = f'{schema}.{table}'
        
        result_data = None
        
        if action == 'select':
            # SELECT query
            where = body.get('where', {})
            limit = body.get('limit', 100)
            offset = body.get('offset', 0)
            order_by = body.get('order_by', 'created_at DESC')
            columns_to_select = body.get('columns', [])
            
            # If columns specified, use them; otherwise SELECT *
            if columns_to_select:
                columns_str = ', '.join(columns_to_select)
                query = f'SELECT {columns_str} FROM {full_table}'
            else:
                query = f'SELECT * FROM {full_table}'
            
            params = []
            
            if where:
                where_parts = []
                for key, value in where.items():
                    where_parts.append(f'{key} = %s')
                    params.append(value)
                query += ' WHERE ' + ' AND '.join(where_parts)
            
            query += f' ORDER BY {order_by} LIMIT %s OFFSET %s'
            params.append(limit)
            params.append(offset)
            
            cursor.execute(query, params)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            
            result_data = [dict(zip(columns, row)) for row in rows]
        
        elif action == 'insert':
            # INSERT query
            data = body.get('data', {})
            if not data:
                raise Exception('No data provided for insert')
            
            columns = list(data.keys())
            values = list(data.values())
            placeholders = ', '.join(['%s'] * len(values))
            columns_str = ', '.join(columns)
            
            query = f'INSERT INTO {full_table} ({columns_str}) VALUES ({placeholders}) RETURNING *'
            cursor.execute(query, values)
            
            columns = [desc[0] for desc in cursor.description]
            row = cursor.fetchone()
            result_data = dict(zip(columns, row)) if row else None
            
            conn.commit()
        
        elif action == 'update':
            # UPDATE query
            where = body.get('where', {})
            data = body.get('data', {})
            
            if not where or not data:
                raise Exception('Missing where or data for update')
            
            # user_id уже получен из validate_session выше
            
            # Для lookbooks - проверяем удалённые фото
            removed_photos = []
            if table == 'lookbooks' and 'photos' in data and user_id:
                where_parts = []
                params = []
                for key, value in where.items():
                    where_parts.append(f'{key} = %s')
                    params.append(value)
                
                select_query = f'SELECT photos FROM {full_table} WHERE {" AND ".join(where_parts)}'
                cursor.execute(select_query, params)
                row = cursor.fetchone()
                if row and row[0]:
                    old_photos = set(row[0])
                    new_photos = set(data['photos'])
                    removed_photos = list(old_photos - new_photos)
            
            # Выполняем UPDATE
            set_parts = []
            params = []
            for key, value in data.items():
                set_parts.append(f'{key} = %s')
                params.append(value)
            
            where_parts = []
            for key, value in where.items():
                where_parts.append(f'{key} = %s')
                params.append(value)
            
            query = f'UPDATE {full_table} SET {", ".join(set_parts)} WHERE {" AND ".join(where_parts)} RETURNING *'
            cursor.execute(query, params)
            
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            result_data = [dict(zip(columns, row)) for row in rows]
            
            conn.commit()
            
            # Проверяем и удаляем фото из S3
            if user_id and removed_photos:
                for photo_url in removed_photos:
                    delete_from_s3_if_orphaned(photo_url, user_id, cursor, schema)
        
        elif action == 'delete':
            # DELETE query
            where = body.get('where', {})
            if not where:
                raise Exception('Missing where for delete')
            
            # Используем user_id от session token (строка 97)
            # Для try_on_history - сохраняем result_image перед удалением
            photos_to_check = []
            if table == 'try_on_history' and user_id:
                where_parts = []
                params = []
                for key, value in where.items():
                    where_parts.append(f'{key} = %s')
                    params.append(value)
                
                select_query = f'SELECT result_image FROM {full_table} WHERE {" AND ".join(where_parts)}'
                cursor.execute(select_query, params)
                row = cursor.fetchone()
                if row and row[0]:
                    photos_to_check.append(row[0])
            
            # Для lookbooks - сохраняем photos перед удалением
            elif table == 'lookbooks' and user_id:
                where_parts = []
                params = []
                for key, value in where.items():
                    where_parts.append(f'{key} = %s')
                    params.append(value)
                
                select_query = f'SELECT photos FROM {full_table} WHERE {" AND ".join(where_parts)}'
                cursor.execute(select_query, params)
                row = cursor.fetchone()
                if row and row[0]:
                    photos_to_check.extend(row[0])
            
            # Для color_type_history - сохраняем cdn_url перед удалением
            elif table == 'color_type_history' and user_id:
                where_parts = []
                params = []
                for key, value in where.items():
                    where_parts.append(f'{key} = %s')
                    params.append(value)
                
                select_query = f'SELECT cdn_url FROM {full_table} WHERE {" AND ".join(where_parts)}'
                cursor.execute(select_query, params)
                row = cursor.fetchone()
                if row and row[0]:
                    photos_to_check.append(row[0])
            
            # Выполняем DELETE
            where_parts = []
            params = []
            for key, value in where.items():
                where_parts.append(f'{key} = %s')
                params.append(value)
            
            query = f'DELETE FROM {full_table} WHERE {" AND ".join(where_parts)} RETURNING *'
            cursor.execute(query, params)
            
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            result_data = [dict(zip(columns, row)) for row in rows]
            
            conn.commit()
            
            # Проверяем и удаляем фото из S3
            if user_id and photos_to_check:
                for photo_url in photos_to_check:
                    delete_from_s3_if_orphaned(photo_url, user_id, cursor, schema)
        
        else:
            raise Exception(f'Unknown action: {action}')
        
        cursor.close()
        conn.close()
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Content-Type': 'application/json',
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps({
                'success': True,
                'data': result_data
            }, default=str),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        print(f'[db-query] Error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Content-Type': 'application/json',
                'Access-Control-Allow-Credentials': 'true'
            },
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }