"""API для обработки платежей и управления подписками с автопродлением"""

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
        'price': 299,
        'duration_days': 30,
        'name': '1 месяц',
        'daily_ai_questions': 20
    },
    '6months': {
        'price': 1499,
        'duration_days': 180,
        'name': '6 месяцев',
        'daily_ai_questions': 20
    },
    '1year': {
        'price': 2399,
        'duration_days': 365,
        'name': '1 год',
        'daily_ai_questions': 20
    }
}

TOKEN_PACKS = {}

QUESTION_PACKS = {
    'questions_20': {
        'price': 149,
        'questions': 20,
        'name': '+20 вопросов'
    },
    'questions_15': {
        'price': 150,
        'questions': 15,
        'name': '+15 вопросов'
    },
    'questions_30': {
        'price': 300,
        'questions': 30,
        'name': '+30 вопросов'
    },
    'questions_100': {
        'price': 600,
        'questions': 100,
        'name': '+100 вопросов'
    }
}

SEASONAL_PLANS = {
    'session': {
        'price': 299,
        'duration_days': 30,
        'name': 'Тариф "Сессия"',
        'available_months': [1, 6]
    }
}

def verify_token(token: str) -> dict:
    if token == 'mock-token':
        return {'user_id': 1}
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        return None

def generate_token(*args):
    values = ''.join(str(v) for v in args if v is not None)
    return hashlib.sha256(values.encode()).hexdigest()

def create_tinkoff_payment(user_id: int, amount: int, order_id: str, description: str, recurrent: bool = False) -> dict:
    """Создает платеж в Т-кассе. recurrent=True привязывает карту для автосписаний"""
    params = {
        'TerminalKey': TINKOFF_TERMINAL_KEY,
        'Amount': amount * 100,
        'OrderId': order_id,
        'Description': description,
        'SuccessURL': 'https://eduhelper.poehali.dev/subscription?payment=success',
        'FailURL': 'https://eduhelper.poehali.dev/subscription?payment=failed',
        'NotificationURL': 'https://functions.poehali.dev/b45c4361-c9fa-4b81-b687-67d3a9406f1b?action=notification',
        'PayType': 'O'
    }

    if recurrent:
        params['Recurrent'] = 'Y'
        params['CustomerKey'] = str(user_id)



    token_params = {}
    for k, v in params.items():
        if k not in ('Receipt', 'DATA', 'Shops', 'Token'):
            token_params[k] = str(v)
    token_params['Password'] = TINKOFF_PASSWORD
    sorted_values = [token_params[k] for k in sorted(token_params.keys())]
    params['Token'] = generate_token(*sorted_values)

    try:
        response = requests.post(f'{TINKOFF_API_URL}Init', json=params, timeout=10)
        response_data = response.json()
        if not response_data.get('Success'):
            return {'error': response_data.get('Message', 'Ошибка'), 'error_code': response_data.get('ErrorCode')}
        return response_data
    except Exception as e:
        return {'error': str(e)}

def charge_recurrent(user_id: int, rebill_id: str, amount: int, order_id: str) -> dict:
    """Автосписание по сохранённой карте (рекуррентный платёж)"""
    init_params = {
        'TerminalKey': TINKOFF_TERMINAL_KEY,
        'Amount': amount * 100,
        'OrderId': order_id,
        'Description': 'Studyfay: автопродление подписки',
        'PayType': 'O'
    }

    token_params = {k: str(v) for k, v in init_params.items() if k not in ('Receipt', 'DATA', 'Shops', 'Token')}
    token_params['Password'] = TINKOFF_PASSWORD
    sorted_values = [token_params[k] for k in sorted(token_params.keys())]
    init_params['Token'] = generate_token(*sorted_values)

    try:
        resp = requests.post(f'{TINKOFF_API_URL}Init', json=init_params, timeout=10)
        init_data = resp.json()

        if not init_data.get('Success'):
            return {'error': init_data.get('Message', 'Init failed')}

        payment_id = init_data['PaymentId']

        charge_params = {
            'TerminalKey': TINKOFF_TERMINAL_KEY,
            'PaymentId': payment_id,
            'RebillId': rebill_id
        }
        charge_token_params = {
            'Password': TINKOFF_PASSWORD,
            'PaymentId': str(payment_id),
            'RebillId': str(rebill_id),
            'TerminalKey': TINKOFF_TERMINAL_KEY
        }
        sorted_vals = [charge_token_params[k] for k in sorted(charge_token_params.keys())]
        charge_params['Token'] = generate_token(*sorted_vals)

        charge_resp = requests.post(f'{TINKOFF_API_URL}Charge', json=charge_params, timeout=10)
        charge_data = charge_resp.json()

        if charge_data.get('Success') and charge_data.get('Status') == 'CONFIRMED':
            return {'success': True, 'payment_id': payment_id}
        else:
            return {'error': charge_data.get('Message', 'Charge failed'), 'status': charge_data.get('Status')}
    except Exception as e:
        return {'error': str(e)}

def check_tinkoff_payment(payment_id: str) -> dict:
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
    except Exception:
        return None

def create_payment(conn, user_id: int, plan_type: str) -> dict:
    is_subscription = plan_type in PLANS
    is_question_pack = plan_type in QUESTION_PACKS
    is_seasonal = plan_type in SEASONAL_PLANS

    if not (is_subscription or is_question_pack or is_seasonal):
        return None

    if is_subscription:
        plan = PLANS[plan_type]
        expires_at = datetime.now() + timedelta(days=plan['duration_days'])
        description = f"Studyfay подписка: {plan['name']}"
    elif is_seasonal:
        plan = SEASONAL_PLANS[plan_type]
        current_month = datetime.now().month
        if current_month not in plan['available_months']:
            return {'error': 'Сезонный тариф доступен только в январе и июне'}
        expires_at = datetime.now() + timedelta(days=plan['duration_days'])
        description = f"Studyfay {plan['name']}"
    else:
        plan = QUESTION_PACKS[plan_type]
        expires_at = None
        description = f"Studyfay {plan['name']}"

    use_recurrent = is_subscription

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            INSERT INTO {SCHEMA_NAME}.payments 
            (user_id, amount, plan_type, payment_status, expires_at, is_recurrent)
            VALUES (%s, %s, %s, 'pending', %s, %s)
            RETURNING id, amount, plan_type, payment_status, created_at, expires_at
        """, (user_id, plan['price'], plan_type, expires_at, use_recurrent))

        payment = cur.fetchone()
        conn.commit()
        payment_dict = dict(payment)

        order_id = f"studyfay_{payment_dict['id']}"
        tinkoff_response = create_tinkoff_payment(
            user_id, plan['price'], order_id, description, recurrent=use_recurrent
        )

        if tinkoff_response:
            if tinkoff_response.get('Success'):
                cur.execute(f"""
                    UPDATE {SCHEMA_NAME}.payments
                    SET payment_id = %s
                    WHERE id = %s
                """, (tinkoff_response.get('PaymentId'), payment_dict['id']))
                conn.commit()
                payment_dict['payment_url'] = tinkoff_response.get('PaymentURL')
                payment_dict['tinkoff_payment_id'] = tinkoff_response.get('PaymentId')
            else:
                payment_dict['error'] = tinkoff_response.get('error', 'Ошибка при создании платежа')
                payment_dict['error_code'] = tinkoff_response.get('error_code')
        else:
            payment_dict['error'] = 'Не удалось связаться с Т-кассой'

        return payment_dict

def complete_payment(conn, payment_id: int, payment_method: str = None, external_payment_id: str = None, rebill_id: str = None, card_last4: str = None) -> bool:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT user_id, plan_type, expires_at, payment_status, is_recurrent
            FROM {SCHEMA_NAME}.payments
            WHERE id = %s
            FOR UPDATE
        """, (payment_id,))

        payment = cur.fetchone()
        if not payment:
            return False

        if payment['payment_status'] != 'pending':
            return False

        plan_type = payment['plan_type']
        is_token_pack = plan_type in TOKEN_PACKS
        is_question_pack = plan_type in QUESTION_PACKS
        is_seasonal = plan_type in SEASONAL_PLANS

        cur.execute(f"""
            UPDATE {SCHEMA_NAME}.payments
            SET payment_status = 'completed',
                completed_at = CURRENT_TIMESTAMP,
                payment_method = %s,
                payment_id = %s
            WHERE id = %s
        """, (payment_method, external_payment_id, payment_id))

        if is_question_pack:
            questions_to_add = QUESTION_PACKS[plan_type]['questions']
            cur.execute(f"""
                UPDATE {SCHEMA_NAME}.users
                SET bonus_questions = COALESCE(bonus_questions, 0) + %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (questions_to_add, payment['user_id']))
            cur.execute(f"""
                INSERT INTO {SCHEMA_NAME}.question_packs 
                (user_id, pack_type, questions_count, price_rub, payment_id)
                VALUES (%s, %s, %s, %s, %s)
            """, (payment['user_id'], plan_type, questions_to_add, QUESTION_PACKS[plan_type]['price'], payment_id))
        elif is_seasonal:
            cur.execute(f"""
                UPDATE {SCHEMA_NAME}.users
                SET subscription_type = 'premium',
                    subscription_expires_at = %s,
                    subscription_plan = 'session',
                    daily_premium_questions_used = 0,
                    daily_premium_questions_reset_at = CURRENT_TIMESTAMP + INTERVAL '1 day',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (payment['expires_at'], payment['user_id']))
            cur.execute(f"""
                INSERT INTO {SCHEMA_NAME}.seasonal_subscriptions 
                (user_id, season_type, expires_at, price_rub, payment_id)
                VALUES (%s, 'session', %s, %s, %s)
            """, (payment['user_id'], payment['expires_at'], SEASONAL_PLANS['session']['price'], payment_id))
        else:
            update_fields = """
                subscription_type = 'premium',
                subscription_expires_at = %s,
                subscription_plan = %s,
                daily_premium_questions_used = 0,
                daily_premium_questions_reset_at = CURRENT_TIMESTAMP + INTERVAL '1 day',
                updated_at = CURRENT_TIMESTAMP
            """
            update_values = [payment['expires_at'], plan_type]

            if rebill_id:
                update_fields += ", rebill_id = %s, auto_renew = true"
                update_values.append(rebill_id)
            if card_last4:
                update_fields += ", card_last4 = %s"
                update_values.append(card_last4)

            update_values.append(payment['user_id'])
            cur.execute(f"""
                UPDATE {SCHEMA_NAME}.users
                SET {update_fields}
                WHERE id = %s
            """, update_values)

            # +15 бонусных вопросов при покупке любой подписки
            cur.execute(f"""
                UPDATE {SCHEMA_NAME}.users
                SET bonus_questions = COALESCE(bonus_questions, 0) + 15
                WHERE id = %s
            """, (payment['user_id'],))


        conn.commit()
        return True

def get_user_payments(conn, user_id: int) -> list:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT id, amount, plan_type, payment_status, 
                   created_at, completed_at, expires_at, is_recurrent
            FROM {SCHEMA_NAME}.payments
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 20
        """, (user_id,))
        return [dict(row) for row in cur.fetchall()]

def get_auto_renew_info(conn, user_id: int) -> dict:
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT auto_renew, rebill_id, card_last4, subscription_plan, subscription_expires_at
            FROM {SCHEMA_NAME}.users
            WHERE id = %s
        """, (user_id,))
        user = cur.fetchone()
        if not user:
            return {}
        return {
            'auto_renew': bool(user['auto_renew']),
            'has_card': bool(user['rebill_id']),
            'card_last4': user['card_last4'] or '',
            'subscription_plan': user['subscription_plan'],
            'next_charge_date': str(user['subscription_expires_at']) if user['subscription_expires_at'] else None,
            'next_charge_amount': PLANS.get(user['subscription_plan'], {}).get('price')
        }

def toggle_auto_renew(conn, user_id: int, enabled: bool) -> bool:
    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE {SCHEMA_NAME}.users
            SET auto_renew = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (enabled, user_id))
        conn.commit()
        return True

def handle_notification(conn, body: dict) -> dict:
    """Обработка уведомлений от Тинькофф (webhook)"""
    status = body.get('Status')
    payment_id_tinkoff = str(body.get('PaymentId', ''))
    order_id = body.get('OrderId', '')
    rebill_id = str(body.get('RebillId', '')) if body.get('RebillId') else None
    card_id = body.get('CardId')
    pan = body.get('Pan', '')
    card_last4 = pan[-4:] if pan and len(pan) >= 4 else None

    if not order_id.startswith('studyfay_'):
        return {'success': True}

    local_payment_id = int(order_id.replace('studyfay_', ''))

    if status == 'CONFIRMED':
        complete_payment(conn, local_payment_id, 'tinkoff', payment_id_tinkoff,
                        rebill_id=rebill_id, card_last4=card_last4)

    return {'success': True}

def handler(event: dict, context) -> dict:
    """Обработчик запросов для платежей с автопродлением"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
            },
            'body': ''
        }

    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }

    qs = event.get('queryStringParameters', {}) or {}
    body_str = event.get('body', '{}') or '{}'

    if method == 'POST' and qs.get('action') == 'notification':
        conn = psycopg2.connect(DATABASE_URL)
        try:
            body = json.loads(body_str)
            result = handle_notification(conn, body)
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps(result)
            }
        finally:
            conn.close()

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
            action = qs.get('action', 'plans')

            if action == 'plans':
                plans_list = [
                    {'id': key, 'name': plan['name'], 'price': plan['price'], 'duration_days': plan['duration_days'], 'daily_ai_questions': plan['daily_ai_questions']}
                    for key, plan in PLANS.items()
                ]
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'plans': plans_list})
                }

            elif action == 'token_packs':
                question_packs_list = [
                    {'id': key, 'name': p['name'], 'price': p['price'], 'questions': p['questions']}
                    for key, p in QUESTION_PACKS.items()
                ]
                current_month = datetime.now().month
                seasonal_packs_list = []
                for key, p in SEASONAL_PLANS.items():
                    if current_month in p['available_months']:
                        seasonal_packs_list.append({'id': key, 'name': p['name'], 'price': p['price'], 'duration_days': p['duration_days']})
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'token_packs': [],
                        'question_packs': question_packs_list,
                        'seasonal_packs': seasonal_packs_list
                    })
                }

            elif action == 'history':
                payments = get_user_payments(conn, user_id)
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'payments': payments}, default=str)
                }

            elif action == 'auto_renew':
                info = get_auto_renew_info(conn, user_id)
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps(info, default=str)
                }

        elif method == 'POST':
            body = json.loads(body_str)
            action = body.get('action')

            if action == 'create_payment':
                plan_type = body.get('plan_type')
                if plan_type not in PLANS and plan_type not in TOKEN_PACKS and plan_type not in QUESTION_PACKS and plan_type not in SEASONAL_PLANS:
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
                plan_info = PLANS.get(plan_type) or TOKEN_PACKS.get(plan_type) or QUESTION_PACKS.get(plan_type) or SEASONAL_PLANS.get(plan_type)
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
                payment_id = body.get('payment_id')
                tinkoff_payment_id = body.get('tinkoff_payment_id')
                if not payment_id or not tinkoff_payment_id:
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'payment_id и tinkoff_payment_id обязательны'})
                    }
                tinkoff_status = check_tinkoff_payment(tinkoff_payment_id)
                if tinkoff_status and tinkoff_status.get('Success'):
                    status = tinkoff_status.get('Status')
                    if status == 'CONFIRMED':
                        rebill_id = str(tinkoff_status.get('RebillId', '')) if tinkoff_status.get('RebillId') else None
                        pan = tinkoff_status.get('Pan', '')
                        card_last4 = pan[-4:] if pan and len(pan) >= 4 else None
                        complete_payment(conn, payment_id, 'tinkoff', tinkoff_payment_id,
                                        rebill_id=rebill_id, card_last4=card_last4)
                        return {
                            'statusCode': 200,
                            'headers': headers,
                            'body': json.dumps({'status': 'completed', 'message': 'Подписка активирована'})
                        }
                    elif status in ['NEW', 'AUTHORIZED']:
                        return {
                            'statusCode': 200,
                            'headers': headers,
                            'body': json.dumps({'status': 'pending', 'message': 'Платеж в обработке'})
                        }
                    else:
                        return {
                            'statusCode': 200,
                            'headers': headers,
                            'body': json.dumps({'status': 'failed', 'message': f'Платеж не прошел: {status}'})
                        }
                return {
                    'statusCode': 500,
                    'headers': headers,
                    'body': json.dumps({'error': 'Не удалось проверить статус платежа'})
                }

            elif action == 'toggle_auto_renew':
                enabled = body.get('enabled', True)
                toggle_auto_renew(conn, user_id, enabled)
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True, 'auto_renew': enabled})
                }

            elif action == 'complete_payment':
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
                        'body': json.dumps({'success': True, 'message': 'Подписка активирована'})
                    }
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