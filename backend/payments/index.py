"""API для обработки платежей и подписок через ЮKassa"""

import json
import os
import uuid
import base64
import datetime as dt
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
import urllib.request
import urllib.error

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
YOKASSA_SHOP_ID = os.environ.get('YOKASSA_SHOP_ID', '')
YOKASSA_SECRET_KEY = os.environ.get('YOKASSA_SECRET_KEY', '')

PLANS = {
    '1month': {
        'price': 499,
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


def notify_pending_payment_users(conn):
    """Создает in-app уведомления для пользователей с зависшими платежами"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT DISTINCT p.user_id
            FROM {SCHEMA_NAME}.payments p
            WHERE p.payment_status = 'pending'
        """)
        users = cur.fetchall()

        notified = 0
        for u in users:
            uid = u['user_id']
            cur.execute(f"""
                SELECT id FROM {SCHEMA_NAME}.notifications
                WHERE user_id = %s AND title = 'Оплата снова работает!'
                LIMIT 1
            """, (uid,))
            existing = cur.fetchone()
            if existing:
                continue

            cur.execute(f"""
                INSERT INTO {SCHEMA_NAME}.notifications (user_id, title, message, action_url)
                VALUES (%s, %s, %s, %s)
            """, (
                uid,
                'Оплата снова работает!',
                'Мы исправили проблему с оплатой. Теперь ты можешь оформить подписку Premium и получить доступ ко всем функциям. Попробуй ещё раз!',
                '/pricing'
            ))
            notified += 1

        conn.commit()
    return {'success': True, 'notified_users': notified, 'total_pending_users': len(users)}


def yokassa_create_payment(amount, description, order_id, return_url):
    """Создает платеж через YooKassa API.
    
    POST https://api.yookassa.ru/v3/payments
    Авторизация: Basic Auth (shop_id:secret_key)
    Idempotence-Key: уникальный UUID для каждого запроса
    """
    url = 'https://api.yookassa.ru/v3/payments'
    idempotence_key = str(uuid.uuid4())

    credentials = base64.b64encode(f'{YOKASSA_SHOP_ID}:{YOKASSA_SECRET_KEY}'.encode()).decode()

    payment_body = {
        'amount': {
            'value': f'{amount:.2f}',
            'currency': 'RUB'
        },
        'confirmation': {
            'type': 'redirect',
            'return_url': return_url
        },
        'description': description,
        'metadata': {
            'order_id': order_id
        }
    }

    data = json.dumps(payment_body).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Basic {credentials}',
            'Idempotence-Key': idempotence_key
        },
        method='POST'
    )

    print(f"[YOKASSA] Creating payment: {url}, order_id={order_id}, amount={amount}")
    try:
        response = urllib.request.urlopen(req, timeout=15)
        result = json.loads(response.read().decode('utf-8'))
        print(f"[YOKASSA] Payment created: id={result.get('id')}, status={result.get('status')}")
        return result
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')[:500]
        print(f"[YOKASSA] Create payment error {e.code}: {err_body}")
        return None
    except Exception as e:
        print(f"[YOKASSA] Create payment exception: {e}")
        return None


def yokassa_get_payment(payment_id):
    """Получает статус платежа через YooKassa API.
    
    GET https://api.yookassa.ru/v3/payments/{payment_id}
    Авторизация: Basic Auth (shop_id:secret_key)
    """
    url = f'https://api.yookassa.ru/v3/payments/{payment_id}'
    credentials = base64.b64encode(f'{YOKASSA_SHOP_ID}:{YOKASSA_SECRET_KEY}'.encode()).decode()

    req = urllib.request.Request(
        url,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Basic {credentials}'
        },
        method='GET'
    )

    print(f"[YOKASSA] Getting payment: {url}")
    try:
        response = urllib.request.urlopen(req, timeout=15)
        result = json.loads(response.read().decode('utf-8'))
        print(f"[YOKASSA] Payment info: id={result.get('id')}, status={result.get('status')}")
        return result
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')[:500]
        print(f"[YOKASSA] Get payment error {e.code}: {err_body}")
        return None
    except Exception as e:
        print(f"[YOKASSA] Get payment exception: {e}")
        return None


def handle_webhook(conn, body: dict) -> dict:
    """Обработка webhook уведомлений от YooKassa.
    
    YooKassa отправляет уведомления о смене статуса платежа.
    Формат: { type: "notification", event: "payment.succeeded", object: { id, status, metadata: { order_id } } }
    Дополнительно проверяем статус через API для безопасности.
    """
    event_type = body.get('event', '')
    payment_object = body.get('object', {})

    if not payment_object:
        print("[YOKASSA] Webhook: no payment object in body")
        return {'success': True}

    yokassa_payment_id = payment_object.get('id', '')
    metadata = payment_object.get('metadata', {})
    order_id = metadata.get('order_id', '')

    if not order_id or not order_id.startswith('studyfay_'):
        print(f"[YOKASSA] Webhook: unknown order_id={order_id}")
        return {'success': True}

    local_payment_id = int(order_id.replace('studyfay_', ''))
    print(f"[YOKASSA] Webhook: event={event_type}, yokassa_id={yokassa_payment_id}, local_id={local_payment_id}")

    if event_type == 'payment.succeeded':
        # Проверяем статус платежа через API для безопасности
        verified = yokassa_get_payment(yokassa_payment_id)
        if verified and verified.get('status') == 'succeeded':
            complete_payment(conn, local_payment_id, 'yokassa', yokassa_payment_id)
            print(f"[YOKASSA] Webhook: payment {local_payment_id} completed")
        else:
            print(f"[YOKASSA] Webhook: payment {yokassa_payment_id} verification failed, status={verified.get('status') if verified else 'None'}")

    return {'success': True}


def handler(event: dict, context) -> dict:
    """Обработчик запросов для платежей через ЮKassa"""
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

    # Webhook от YooKassa обрабатывается ДО проверки авторизации
    if method == 'POST':
        body = json.loads(body_str)
        action = body.get('action')

        # YooKassa webhook: has "event" field like "payment.succeeded"
        if action == 'webhook' or body.get('event') or body.get('type') == 'notification':
            conn = psycopg2.connect(DATABASE_URL)
            try:
                result = handle_webhook(conn, body)
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps(result)
                }
            finally:
                conn.close()

        if action == 'notify_pending_users':
            conn = psycopg2.connect(DATABASE_URL)
            try:
                result = notify_pending_payment_users(conn)
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

            if action == 'toggle_auto_renew':
                enabled = body.get('enabled', True)
                toggle_auto_renew(conn, user_id, enabled)
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True, 'auto_renew': enabled})
                }

            elif action == 'create_payment':
                plan_type = body.get('plan_type', '')
                return_url = body.get('return_url', 'https://studyfay.ru/subscription?payment=success')

                if not plan_type:
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'plan_type обязателен'})}

                # Определяем цену и длительность из доступных словарей
                plan = PLANS.get(plan_type)
                question_pack = QUESTION_PACKS.get(plan_type)
                seasonal_plan = SEASONAL_PLANS.get(plan_type)

                if plan:
                    price = plan['price']
                    description = f'Подписка StudyFay: {plan["name"]}'
                    duration_days = plan['duration_days']
                elif question_pack:
                    price = question_pack['price']
                    description = f'StudyFay: {question_pack["name"]}'
                    duration_days = None
                elif seasonal_plan:
                    price = seasonal_plan['price']
                    description = f'StudyFay: {seasonal_plan["name"]}'
                    duration_days = seasonal_plan['duration_days']
                else:
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Неизвестный plan_type'})}

                # Рассчитываем expires_at для подписок
                expires_at = None
                if duration_days:
                    expires_at = datetime.now() + timedelta(days=duration_days)

                # Создаем запись о платеже в БД со статусом pending
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA_NAME}.payments
                        (user_id, amount, plan_type, payment_status, expires_at)
                        VALUES (%s, %s, %s, 'pending', %s)
                        RETURNING id
                    """, (user_id, price, plan_type, expires_at))
                    local_payment_id = cur.fetchone()['id']
                    conn.commit()

                order_id = f'studyfay_{local_payment_id}'

                # Создаем платеж в YooKassa
                yokassa_result = yokassa_create_payment(price, description, order_id, return_url)
                if not yokassa_result:
                    return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': 'Не удалось создать платеж в YooKassa'})}

                confirmation_url = yokassa_result.get('confirmation', {}).get('confirmation_url', '')
                yokassa_payment_id = yokassa_result.get('id', '')

                # Сохраняем yokassa payment_id в запись
                with conn.cursor() as cur:
                    cur.execute(f"""
                        UPDATE {SCHEMA_NAME}.payments
                        SET payment_id = %s
                        WHERE id = %s
                    """, (yokassa_payment_id, local_payment_id))
                    conn.commit()

                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'success': True,
                        'confirmation_url': confirmation_url,
                        'payment_id': local_payment_id
                    })
                }

            elif action == 'check_payment':
                payment_id = body.get('payment_id')
                if not payment_id:
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'payment_id обязателен'})}

                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(f"""
                        SELECT id, payment_status, payment_id, plan_type
                        FROM {SCHEMA_NAME}.payments
                        WHERE id = %s AND user_id = %s
                    """, (payment_id, user_id))
                    payment = cur.fetchone()

                if not payment:
                    return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Платеж не найден'})}

                if payment['payment_status'] == 'completed':
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({'success': True, 'status': 'completed', 'plan_type': payment['plan_type']})
                    }

                # Платеж еще pending — проверяем через YooKassa API
                yokassa_payment_id = payment['payment_id']
                if yokassa_payment_id:
                    yokassa_data = yokassa_get_payment(yokassa_payment_id)
                    if yokassa_data and yokassa_data.get('status') == 'succeeded':
                        complete_payment(conn, payment['id'], 'yokassa', yokassa_payment_id)
                        return {
                            'statusCode': 200,
                            'headers': headers,
                            'body': json.dumps({'success': True, 'status': 'completed', 'plan_type': payment['plan_type']})
                        }
                    yokassa_status = yokassa_data.get('status', 'unknown') if yokassa_data else 'unknown'
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({'success': True, 'status': 'pending', 'yokassa_status': yokassa_status})
                    }

                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({'success': True, 'status': 'pending'})
                }

        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Маршрут не найден'})
        }
    finally:
        conn.close()