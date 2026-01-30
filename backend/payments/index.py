"""API для обработки платежей и управления подписками"""

import json
import os
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')

PLANS = {
    '1month': {
        'price': 199,
        'duration_days': 30,
        'name': '1 месяц'
    },
    '3months': {
        'price': 499,
        'duration_days': 90,
        'name': '3 месяца'
    },
    '6months': {
        'price': 999,
        'duration_days': 180,
        'name': '6 месяцев'
    }
}

def verify_token(token: str) -> dict:
    """Проверяет JWT токен и возвращает payload"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except:
        return None

def create_payment(conn, user_id: int, plan_type: str) -> dict:
    """Создает запись о платеже"""
    if plan_type not in PLANS:
        return None
    
    plan = PLANS[plan_type]
    expires_at = datetime.now() + timedelta(days=plan['duration_days'])
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            INSERT INTO {SCHEMA_NAME}.payments 
            (user_id, amount, plan_type, payment_status, expires_at)
            VALUES (%s, %s, %s, 'pending', %s)
            RETURNING id, amount, plan_type, payment_status, created_at, expires_at
        """, (user_id, plan['price'], plan_type, expires_at))
        
        payment = cur.fetchone()
        conn.commit()
        
        return dict(payment)

def complete_payment(conn, payment_id: int, payment_method: str = None, external_payment_id: str = None) -> bool:
    """Завершает платеж и активирует подписку"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Получаем информацию о платеже
        cur.execute(f"""
            SELECT user_id, plan_type, expires_at
            FROM {SCHEMA_NAME}.payments
            WHERE id = %s AND payment_status = 'pending'
        """, (payment_id,))
        
        payment = cur.fetchone()
        if not payment:
            return False
        
        # Обновляем статус платежа
        cur.execute(f"""
            UPDATE {SCHEMA_NAME}.payments
            SET payment_status = 'completed',
                completed_at = CURRENT_TIMESTAMP,
                payment_method = %s,
                payment_id = %s
            WHERE id = %s
        """, (payment_method, external_payment_id, payment_id))
        
        # Активируем подписку
        cur.execute(f"""
            UPDATE {SCHEMA_NAME}.users
            SET subscription_type = 'premium',
                subscription_expires_at = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (payment['expires_at'], payment['user_id']))
        
        conn.commit()
        return True

def get_user_payments(conn, user_id: int) -> list:
    """Получает историю платежей пользователя"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT id, amount, plan_type, payment_status, 
                   created_at, completed_at, expires_at
            FROM {SCHEMA_NAME}.payments
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 20
        """, (user_id,))
        
        return [dict(row) for row in cur.fetchall()]

def handler(event: dict, context) -> dict:
    """Обработчик запросов для платежей"""
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
    conn = psycopg2.connect(DATABASE_URL)
    
    try:
        if method == 'GET':
            action = event.get('queryStringParameters', {}).get('action', 'plans')
            
            if action == 'plans':
                # Возвращаем доступные тарифы
                plans_list = [
                    {
                        'id': key,
                        'name': plan['name'],
                        'price': plan['price'],
                        'duration_days': plan['duration_days']
                    }
                    for key, plan in PLANS.items()
                ]
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'plans': plans_list})
                }
            
            elif action == 'history':
                # Возвращаем историю платежей
                payments = get_user_payments(conn, user_id)
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'payments': payments}, default=str)
                }
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action')
            
            if action == 'create_payment':
                plan_type = body.get('plan_type')
                
                if plan_type not in PLANS:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Неверный тип подписки'})
                    }
                
                payment = create_payment(conn, user_id, plan_type)
                
                if not payment:
                    return {
                        'statusCode': 500,
                        'headers': headers,
                        'body': json.dumps({'error': 'Не удалось создать платеж'})
                    }
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'payment': payment,
                        'plan': PLANS[plan_type]
                    }, default=str)
                }
            
            elif action == 'complete_payment':
                # Это для тестового режима - автоматически завершаем платеж
                payment_id = body.get('payment_id')
                
                if not payment_id:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'payment_id обязателен'})
                    }
                
                success = complete_payment(conn, payment_id, 'test', f'test_{payment_id}')
                
                if success:
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({
                            'success': True,
                            'message': 'Подписка активирована'
                        })
                    }
                else:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Платеж не найден или уже обработан'})
                    }
        
        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Маршрут не найден'})
        }
        
    finally:
        conn.close()
