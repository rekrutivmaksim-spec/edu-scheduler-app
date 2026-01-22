"""API для управления подписками и проверки лимитов"""

import json
import os
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt


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


def check_subscription_status(user_id: int, conn) -> dict:
    """Проверяет статус подписки пользователя"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT subscription_type, subscription_expires_at,
                   materials_quota_used, materials_quota_reset_at
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        user = cur.fetchone()
        
        if not user:
            return {'is_premium': False, 'subscription_type': 'free'}
        
        is_premium = False
        if user['subscription_type'] == 'premium':
            if user['subscription_expires_at']:
                if user['subscription_expires_at'] > datetime.now():
                    is_premium = True
                else:
                    cur.execute("""
                        UPDATE users 
                        SET subscription_type = 'free', subscription_expires_at = NULL
                        WHERE id = %s
                    """, (user_id,))
                    conn.commit()
            else:
                is_premium = True
        
        if user['materials_quota_reset_at'] and user['materials_quota_reset_at'] < datetime.now():
            cur.execute("""
                UPDATE users 
                SET materials_quota_used = 0,
                    materials_quota_reset_at = CURRENT_TIMESTAMP + INTERVAL '1 month'
                WHERE id = %s
            """, (user_id,))
            conn.commit()
            user['materials_quota_used'] = 0
        
        return {
            'is_premium': is_premium,
            'subscription_type': user['subscription_type'],
            'subscription_expires_at': user['subscription_expires_at'].isoformat() if user['subscription_expires_at'] else None,
            'materials_quota_used': user['materials_quota_used'] or 0,
            'materials_quota_reset_at': user['materials_quota_reset_at'].isoformat() if user['materials_quota_reset_at'] else None
        }


def get_limits(conn, user_id: int) -> dict:
    """Получает текущие лимиты пользователя"""
    status = check_subscription_status(user_id, conn)
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT COUNT(*) as count FROM schedule WHERE user_id = %s", (user_id,))
        schedule_count = cur.fetchone()['count']
        
        cur.execute("SELECT COUNT(*) as count FROM tasks WHERE user_id = %s AND completed = false", (user_id,))
        tasks_count = cur.fetchone()['count']
    
    if status['is_premium']:
        return {
            **status,
            'limits': {
                'schedule': {'used': schedule_count, 'max': None, 'unlimited': True},
                'tasks': {'used': tasks_count, 'max': None, 'unlimited': True},
                'materials': {'used': status['materials_quota_used'], 'max': None, 'unlimited': True},
                'exam_predictions': {'unlimited': True}
            }
        }
    else:
        return {
            **status,
            'limits': {
                'schedule': {'used': schedule_count, 'max': 10, 'unlimited': False},
                'tasks': {'used': tasks_count, 'max': 20, 'unlimited': False},
                'materials': {'used': status['materials_quota_used'], 'max': 3, 'unlimited': False},
                'exam_predictions': {'unlimited': False, 'available': False}
            }
        }


def handler(event: dict, context) -> dict:
    """Обработчик запросов для подписок"""
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
    conn = get_db_connection()
    
    try:
        if method == 'GET':
            action = event.get('queryStringParameters', {}).get('action', 'status')
            
            if action == 'status':
                status = check_subscription_status(user_id, conn)
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps(status, default=str)
                }
            
            elif action == 'limits':
                limits = get_limits(conn, user_id)
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps(limits, default=str)
                }
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action')
            
            if action == 'upgrade_demo':
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE users 
                        SET subscription_type = 'premium',
                            subscription_expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days'
                        WHERE id = %s
                    """, (user_id,))
                    conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'message': 'Премиум активирован на 7 дней (демо)',
                        'subscription_type': 'premium',
                        'expires_at': (datetime.now().timestamp() + 7*24*60*60)
                    })
                }
        
        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Маршрут не найден'})
        }
        
    finally:
        conn.close()
