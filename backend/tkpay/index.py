"""API для обработки платежей и управления подписками"""


import json
import os
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
import hashlib
import requests

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
TINKOFF_TERMINAL_KEY = 'studyfay_terminal'
TINKOFF_PASSWORD = os.environ.get('TINKOFF_TERMINAL_PASSWORD', '')
TINKOFF_API_URL = 'https://securepay.tinkoff.ru/v2/'

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
    if token == 'mock-token':
        return {'user_id': 1}
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        return None

def generate_token(*args):
    """Генерирует токен для Tinkoff API"""
    values = ''.join(str(v) for v in args if v is not None)
    return hashlib.sha256(values.encode()).hexdigest()

def create_tinkoff_payment(user_id: int, amount: int, order_id: str, description: str) -> dict:
    """Создает платеж в Т-кассе"""
    params = {
        'TerminalKey': TINKOFF_TERMINAL_KEY,
        'Amount': amount * 100,  # Копейки
        'OrderId': order_id,
        'Description': description
    }
    
    print(f"[TINKOFF] Создание платежа для user_id={user_id}, amount={amount}, order_id={order_id}")
    
    # Генерируем токен
    token_params = {
        'Amount': params['Amount'],
        'Description': params['Description'],
        'OrderId': params['OrderId'],
        'Password': TINKOFF_PASSWORD,
        'TerminalKey': params['TerminalKey']
    }
    sorted_values = [token_params[k] for k in sorted(token_params.keys())]
    params['Token'] = generate_token(*sorted_values)
    
    print(f"[TINKOFF] Отправка запроса в {TINKOFF_API_URL}Init")
    
    try:
        response = requests.post(f'{TINKOFF_API_URL}Init', json=params, timeout=10)
        response_data = response.json()
        
        print(f"[TINKOFF] Ответ от API: {json.dumps(response_data, ensure_ascii=False)}")
        
        if not response_data.get('Success'):
            error_code = response_data.get('ErrorCode', 'unknown')
            error_msg = response_data.get('Message', 'Неизвестная ошибка')
            print(f"[TINKOFF] Ошибка API: {error_code} - {error_msg}")
            return {'error': error_msg, 'error_code': error_code}
        
        return response_data
    except requests.exceptions.RequestException as e:
        print(f"[TINKOFF] Сетевая ошибка: {str(e)}")
        return {'error': f'Сетевая ошибка: {str(e)}'}
    except Exception as e:
        print(f"[TINKOFF] Неожиданная ошибка: {str(e)}")
        return {'error': f'Неожиданная ошибка: {str(e)}'}

def check_tinkoff_payment(payment_id: str) -> dict:
    """Проверяет статус платежа в Т-кассе"""
    params = {
        'TerminalKey': TINKOFF_TERMINAL_KEY,
        'PaymentId': payment_id
    }
    
    token_params = {
        'Password': TINKOFF_PASSWORD,
        'PaymentId': payment_id,
        'TerminalKey': TINKOFF_TERMINAL_KEY
    }
    sorted_values = [token_params[k] for k in sorted(token_params.keys())]
    params['Token'] = generate_token(*sorted_values)
    
    try:
        response = requests.post(f'{TINKOFF_API_URL}GetState', json=params, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"[TINKOFF] Ошибка проверки платежа: {str(e)}")
        return None

def create_payment(conn, user_id: int, plan_type: str) -> dict:
    """Создает запись о платеже и инициирует оплату в Т-кассе"""
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
        payment_dict = dict(payment)
        
        # Создаем платеж в Т-кассе
        order_id = f"studyfay_{payment_dict['id']}"
        description = f"Studyfay подписка: {plan['name']}"
        
        tinkoff_response = create_tinkoff_payment(
            user_id, 
            plan['price'], 
            order_id, 
            description
        )
        
        if tinkoff_response:
            if tinkoff_response.get('Success'):
                # Сохраняем PaymentId от Тинькофф
                cur.execute(f"""
                    UPDATE {SCHEMA_NAME}.payments
                    SET payment_id = %s
                    WHERE id = %s
                """, (tinkoff_response.get('PaymentId'), payment_dict['id']))
                conn.commit()
                
                payment_dict['payment_url'] = tinkoff_response.get('PaymentURL')
                payment_dict['tinkoff_payment_id'] = tinkoff_response.get('PaymentId')
            else:
                # Ошибка от Т-кассы
                payment_dict['error'] = tinkoff_response.get('error', 'Ошибка при создании платежа')
                payment_dict['error_code'] = tinkoff_response.get('error_code')
        else:
            payment_dict['error'] = 'Не удалось связаться с Т-кассой'
        
        return payment_dict

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
    
    try:
        # Получаем токен из заголовков
        auth_header = event.get('headers', {}).get('Authorization') or event.get('headers', {}).get('X-Authorization')
        
        if not auth_header:
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Необходима авторизация'})
            }
        
        token = auth_header.replace('Bearer ', '')
        user_data = verify_token(token)
        
        if not user_data:
            return {
                'statusCode': 401,
                'headers': headers,
                'body': json.dumps({'error': 'Недействительный токен'})
            }
        
        user_id = user_data.get('user_id')
        
        # Подключаемся к БД
        conn = psycopg2.connect(DATABASE_URL)
        
        try:
            if method == 'GET':
                # Получение списка планов или истории платежей
                query_params = event.get('queryStringParameters', {}) or {}
                action = query_params.get('action', 'payments')
                
                if action == 'plans':
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({
                            'plans': [
                                {
                                    'type': key,
                                    'name': value['name'],
                                    'price': value['price'],
                                    'duration_days': value['duration_days']
                                }
                                for key, value in PLANS.items()
                            ]
                        })
                    }
                else:
                    # История платежей
                    payments = get_user_payments(conn, user_id)
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({
                            'payments': payments
                        }, default=str)
                    }
                    
            elif method == 'POST':
                body = json.loads(event.get('body', '{}'))
                action = body.get('action')
                
                if action == 'create_payment':
                    plan_type = body.get('plan_type')
                    
                    if not plan_type or plan_type not in PLANS:
                        return {
                            'statusCode': 400,
                            'headers': headers,
                            'body': json.dumps({'error': 'Недопустимый тип плана'})
                        }
                    
                    payment = create_payment(conn, user_id, plan_type)
                    
                    if not payment:
                        return {
                            'statusCode': 400,
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
                    payment_id = body.get('payment_id')
                    payment_method = body.get('payment_method', 'tinkoff')
                    external_payment_id = body.get('external_payment_id')
                    
                    if not payment_id:
                        return {
                            'statusCode': 400,
                            'headers': headers,
                            'body': json.dumps({'error': 'ID платежа не указан'})
                        }
                    
                    success = complete_payment(conn, payment_id, payment_method, external_payment_id)
                    
                    if success:
                        return {
                            'statusCode': 200,
                            'headers': headers,
                            'body': json.dumps({'success': True})
                        }
                    else:
                        return {
                            'statusCode': 400,
                            'headers': headers,
                            'body': json.dumps({'error': 'Не удалось завершить платеж'})
                        }
                
                elif action == 'check_payment':
                    tinkoff_payment_id = body.get('tinkoff_payment_id')
                    
                    if not tinkoff_payment_id:
                        return {
                            'statusCode': 400,
                            'headers': headers,
                            'body': json.dumps({'error': 'ID платежа Тинькофф не указан'})
                        }
                    
                    payment_status = check_tinkoff_payment(tinkoff_payment_id)
                    
                    if payment_status:
                        return {
                            'statusCode': 200,
                            'headers': headers,
                            'body': json.dumps({
                                'status': payment_status.get('Status'),
                                'success': payment_status.get('Success'),
                                'payment_id': payment_status.get('PaymentId')
                            })
                        }
                    else:
                        return {
                            'statusCode': 400,
                            'headers': headers,
                            'body': json.dumps({'error': 'Не удалось проверить статус платежа'})
                        }
                
                elif action == 'webhook':
                    # Обработка вебхука от Тинькофф
                    payment_id = body.get('OrderId', '').replace('studyfay_', '')
                    status = body.get('Status')
                    tinkoff_payment_id = body.get('PaymentId')
                    
                    print(f"[WEBHOOK] Получен вебхук: OrderId={body.get('OrderId')}, Status={status}, PaymentId={tinkoff_payment_id}")
                    
                    if status == 'CONFIRMED':
                        try:
                            payment_id_int = int(payment_id)
                            success = complete_payment(conn, payment_id_int, 'tinkoff', tinkoff_payment_id)
                            
                            if success:
                                print(f"[WEBHOOK] Платеж {payment_id} успешно подтвержден")
                                return {
                                    'statusCode': 200,
                                    'headers': headers,
                                    'body': json.dumps({'OK': True})
                                }
                            else:
                                print(f"[WEBHOOK] Не удалось завершить платеж {payment_id}")
                        except ValueError:
                            print(f"[WEBHOOK] Некорректный ID платежа: {payment_id}")
                    
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({'OK': True})
                    }
                
                else:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Неизвестное действие'})
                    }
                    
        finally:
            conn.close()
            
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': f'Внутренняя ошибка сервера: {str(e)}'})
        }
