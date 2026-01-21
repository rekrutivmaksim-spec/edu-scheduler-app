"""API для поиска университетов и колледжей России"""

import json
import os
import psycopg2
from psycopg2.extras import RealDictCursor


def get_db_connection():
    """Создаёт подключение к PostgreSQL базе данных"""
    dsn = os.environ['DATABASE_URL']
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(dsn, options=f'-c search_path={schema}')
    return conn


def handler(event: dict, context) -> dict:
    """Поиск университетов по названию"""
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }
    
    if method == 'GET':
        query_params = event.get('queryStringParameters', {}) or {}
        search = query_params.get('q', '').strip()
        limit = min(int(query_params.get('limit', 20)), 50)
        
        if not search or len(search) < 2:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({'error': 'Минимум 2 символа для поиска'})
            }
        
        conn = get_db_connection()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                search_pattern = f'%{search}%'
                cur.execute("""
                    SELECT id, name, short_name, city, region, type
                    FROM universities
                    WHERE name ILIKE %s OR short_name ILIKE %s OR city ILIKE %s
                    ORDER BY 
                        CASE 
                            WHEN name ILIKE %s THEN 1
                            WHEN short_name ILIKE %s THEN 2
                            ELSE 3
                        END,
                        name
                    LIMIT %s
                """, (search_pattern, search_pattern, search_pattern, 
                      f'{search}%', f'{search}%', limit))
                
                universities = cur.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'universities': [dict(u) for u in universities],
                        'count': len(universities)
                    }, ensure_ascii=False)
                }
        finally:
            conn.close()
    
    return {
        'statusCode': 405,
        'headers': headers,
        'body': json.dumps({'error': 'Метод не поддерживается'})
    }
