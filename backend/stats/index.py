"""API для получения статистики приложения: счётчик пользователей"""

import json
import os
import psycopg2


def get_db_connection():
    """Создаёт подключение к PostgreSQL базе данных"""
    dsn = os.environ['DATABASE_URL']
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(dsn, options=f'-c search_path={schema}')
    return conn


def handler(event: dict, context) -> dict:
    """Возвращает общую статистику приложения"""
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
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=60'  # Кэш на 1 минуту
    }
    
    conn = get_db_connection()
    
    try:
        with conn.cursor() as cur:
            # Общее количество зарегистрированных пользователей (не гости)
            cur.execute("""
                SELECT COUNT(*) as total
                FROM users
                WHERE (is_guest = false OR is_guest IS NULL)
            """)
            
            total_users = cur.fetchone()[0]
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'total_users': total_users
                })
            }
    finally:
        conn.close()
