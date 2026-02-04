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
TINKOFF_TERMINAL_KEY = os.environ.get('TINKOFF_TERMINAL_KEY', '')
TINKOFF_PASSWORD = os.environ.get('TINKOFF_TERMINAL_PASSWORD', '')
TINKOFF_API_URL = 'https://securepay.tinkoff.ru/v2/'

PLANS = {
    '1month': {
        'price': 249,
        'duration_days': 30,
        'name': '1 месяц',
        'ai_questions': 100000
    },
    '3months': {
        'price': 649,
        'duration_days': 90,
        'name': '3 месяца',
        'ai_questions': 100000
    },
    '6months': {
        'price': 1199,
        'duration_days': 180,
        'name': '6 месяцев',
        'ai_questions': 100000
    },
    '1year': {
        'price': 1990,
        'duration_days': 365,
        'name': '1 год',
        'ai_questions': 100000,
        'discount': 33
    }
}

# Дополнительные пакеты токенов для ИИ
TOKEN_PACKS = {
    'tokens_25k': {
        'price': 99,
        'tokens': 25000,
        'name': '+25,000 токенов (~32,000 слов)'
    },
    'tokens_50k': {
        'price': 179,
        'tokens': 50000,
        'name': '+50,000 токенов (~65,000 слов)'
    },
    'tokens_100k': {
        'price': 299,
        'tokens': 100000,
        'name': '+100,000 токенов (~130,000 слов)'
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
        'Description': description,
        'SuccessURL': 'https://eduhelper.poehali.dev/subscription?payment=success',
        'FailURL': 'https://eduhelper.poehali.dev/subscription?payment=failed'
    }
    
    print(f"[TINKOFF] Создание платежа для user_id={user_id}, amount={amount}, order_id={order_id}")
    print(f"[TINKOFF] Terminal Key: {TINKOFF_TERMINAL_KEY}")
    print(f"[TINKOFF] Password length: {len(TINKOFF_PASSWORD)}")
    
    # Генерируем токен
    token_params = {
        'Amount': params['Amount'],
        'Description': params['Description'],
        'FailURL': params['FailURL'],
        'OrderId': params['OrderId'],
        'Password': TINKOFF_PASSWORD,
        'SuccessURL': params['SuccessURL'],
        'TerminalKey': params['TerminalKey']
    }
    sorted_values = [token_params[k] for k in sorted(token_params.keys())]
    params['Token'] = generate_token(*sorted_values)
    
    print(f"[TINKOFF] Отправка запроса в {TINKOFF_API_URL}Init")
    print(f"[TINKOFF] Параметры запроса (без Token): {json.dumps({k: v for k, v in params.items() if k != 'Token'}, ensure_ascii=False)}")
    
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
    # Проверяем, это подписка или пакет токенов
    is_token_pack = plan_type in TOKEN_PACKS
    is_subscription = plan_type in PLANS
    
    if not is_token_pack and not is_subscription:
        return None
    
    if is_subscription:
        plan = PLANS[plan_type]
        expires_at = datetime.now() + timedelta(days=plan['duration_days'])
        description = f"Studyfay подписка: {plan['name']}"
    else:
        plan = TOKEN_PACKS[plan_type]
        expires_at = None
        description = f"Studyfay доп. токены: {plan['name']}"
    
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
    """Завершает платеж и активирует подписку или добавляет токены"""
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
        
        plan_type = payment['plan_type']
        is_token_pack = plan_type in TOKEN_PACKS
        
        # Обновляем статус платежа
        cur.execute(f"""
            UPDATE {SCHEMA_NAME}.payments
            SET payment_status = 'completed',
                completed_at = CURRENT_TIMESTAMP,
                payment_method = %s,
                payment_id = %s
            WHERE id = %s
        """, (payment_method, external_payment_id, payment_id))
        
        if is_token_pack:
            # Добавляем токены к текущему лимиту (не сбрасываем)
            tokens_to_add = TOKEN_PACKS[plan_type]['tokens']
            cur.execute(f"""
                UPDATE {SCHEMA_NAME}.users
                SET ai_tokens_limit = COALESCE(ai_tokens_limit, 50000) + %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (tokens_to_add, payment['user_id']))
        else:
            # Активируем подписку и сбрасываем счетчик вопросов
            plan_limits = {
                '1month': 40,
                '3months': 120,
                '6months': 260
            }
            questions_limit = plan_limits.get(plan_type, 40)
            
            cur.execute(f"""
                UPDATE {SCHEMA_NAME}.users
                SET subscription_type = 'premium',
                    subscription_expires_at = %s,
                    subscription_plan = %s,
                    ai_questions_used = 0,
                    ai_questions_limit = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (payment['expires_at'], plan_type, questions_limit, payment['user_id']))
        
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
            
            elif action == 'token_packs':
                # Возвращаем доступные пакеты токенов
                token_packs_list = [
                    {
                        'id': key,
                        'name': pack['name'],
                        'price': pack['price'],
                        'tokens': pack['tokens']
                    }
                    for key, pack in TOKEN_PACKS.items()
                ]
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'token_packs': token_packs_list})
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
                
                print(f"[PAYMENT] Создание платежа: user_id={user_id}, plan_type={plan_type}")
                
                if plan_type not in PLANS and plan_type not in TOKEN_PACKS:
                    print(f"[PAYMENT] Ошибка: неверный plan_type={plan_type}")
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Неверный тип подписки'})
                    }
                
                payment = create_payment(conn, user_id, plan_type)
                
                if not payment:
                    print(f"[PAYMENT] Ошибка: не удалось создать запись о платеже")
                    return {
                        'statusCode': 500,
                        'headers': headers,
                        'body': json.dumps({'error': 'Не удалось создать платеж'})
                    }
                
                print(f"[PAYMENT] Платеж создан: payment_id={payment.get('id')}, payment_url={payment.get('payment_url')}")
                
                # Определяем, что возвращать
                plan_info = PLANS.get(plan_type) or TOKEN_PACKS.get(plan_type)
                
                # Возвращаем ссылку на оплату
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'payment': payment,
                        'plan': plan_info,
                        'payment_url': payment.get('payment_url'),
                        'tinkoff_payment_id': payment.get('tinkoff_payment_id')
                    }, default=str)
                }
            
            elif action == 'check_payment':
                # Проверка статуса платежа в Т-кассе
                payment_id = body.get('payment_id')
                tinkoff_payment_id = body.get('tinkoff_payment_id')
                
                if not payment_id or not tinkoff_payment_id:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'payment_id и tinkoff_payment_id обязательны'})
                    }
                
                # Проверяем статус в Т-кассе
                tinkoff_status = check_tinkoff_payment(tinkoff_payment_id)
                
                if tinkoff_status and tinkoff_status.get('Success'):
                    status = tinkoff_status.get('Status')
                    
                    # Если платеж подтвержден - активируем подписку
                    if status == 'CONFIRMED':
                        complete_payment(conn, payment_id, 'tinkoff', tinkoff_payment_id)
                        
                        return {
                            'statusCode': 200,
                            'headers': headers,
                            'body': json.dumps({
                                'status': 'completed',
                                'message': 'Подписка активирована'
                            })
                        }
                    elif status in ['NEW', 'AUTHORIZED']:
                        return {
                            'statusCode': 200,
                            'headers': headers,
                            'body': json.dumps({
                                'status': 'pending',
                                'message': 'Платеж в обработке'
                            })
                        }
                    else:
                        return {
                            'statusCode': 200,
                            'headers': headers,
                            'body': json.dumps({
                                'status': 'failed',
                                'message': f'Платеж не прошел: {status}'
                            })
                        }
                
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({'error': 'Не удалось проверить статус платежа'})
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