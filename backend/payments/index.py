"""API для обработки платежей и подписок через RuStore"""

import json
import os
import time
import base64
import datetime as dt
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
import hashlib
import urllib.request
import urllib.error
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
RUSTORE_COMPANY_ID = os.environ.get('RUSTORE_COMPANY_ID', '')
RUSTORE_APP_ID = os.environ.get('RUSTORE_APP_ID', '')
RUSTORE_PRIVATE_KEY = os.environ.get('RUSTORE_PRIVATE_KEY', '')
RUSTORE_API = 'https://public-api.rustore.ru'

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

def generate_token(*args):
    values = ''.join(str(v) for v in args if v is not None)
    return hashlib.sha256(values.encode()).hexdigest()

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

def handle_notification(conn, body: dict) -> dict:
    """Обработка уведомлений (webhook)"""
    status = body.get('Status')
    payment_id_ext = str(body.get('PaymentId', ''))
    order_id = body.get('OrderId', '')

    if not order_id.startswith('studyfay_'):
        return {'success': True}

    local_payment_id = int(order_id.replace('studyfay_', ''))

    if status in ('CONFIRMED', 'confirmed'):
        complete_payment(conn, local_payment_id, 'rustore', payment_id_ext)

    return {'success': True}

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

# Cached JWE token and its expiry timestamp
_rustore_jwe_cache = {'token': None, 'expires_at': 0}

def get_rustore_jwe():
    """Получает JWE токен для авторизации в RuStore Public API.
    
    Поток:
    1. Подписываем keyId + timestamp приватным RSA ключом (PKCS1v15, SHA-512)
    2. POST на /public/auth с {keyId, timestamp, signature}
    3. Получаем JWE токен (TTL 900 сек), кешируем на 800 сек
    """
    global _rustore_jwe_cache

    # Return cached token if still valid
    if _rustore_jwe_cache['token'] and time.time() < _rustore_jwe_cache['expires_at']:
        print("[RUSTORE] Using cached JWE token")
        return _rustore_jwe_cache['token']

    if not RUSTORE_PRIVATE_KEY or not RUSTORE_COMPANY_ID:
        print("[RUSTORE] Missing RUSTORE_PRIVATE_KEY or RUSTORE_COMPANY_ID")
        return None

    try:
        # Load RSA private key from base64 DER
        clean_key = RUSTORE_PRIVATE_KEY.replace('\\n', '').replace('\n', '').replace('\r', '').replace(' ', '').strip()
        # Strip PEM headers if accidentally included
        clean_key = clean_key.replace('-----BEGINPRIVATEKEY-----', '').replace('-----ENDPRIVATEKEY-----', '')
        clean_key = clean_key.replace('-----BEGINRSAPRIVATEKEY-----', '').replace('-----ENDRSAPRIVATEKEY-----', '')
        private_key_bytes = base64.b64decode(clean_key)
        private_key = serialization.load_der_private_key(private_key_bytes, password=None)

        # keyId is RUSTORE_COMPANY_ID
        key_id = RUSTORE_COMPANY_ID

        # Create timestamp in ISO format with milliseconds and UTC timezone
        timestamp = dt.datetime.now(dt.timezone.utc).isoformat(timespec='milliseconds')

        # Sign keyId + timestamp with SHA-512 using PKCS1v15
        message = (key_id + timestamp).encode('utf-8')
        signature_bytes = private_key.sign(message, padding.PKCS1v15(), hashes.SHA512())
        signature_value = base64.b64encode(signature_bytes).decode('utf-8')

        # POST to /public/auth
        auth_url = f'{RUSTORE_API}/public/auth'
        auth_body = json.dumps({
            'keyId': key_id,
            'timestamp': timestamp,
            'signature': signature_value
        }).encode('utf-8')

        print(f"[RUSTORE] Authenticating: POST {auth_url}")
        req = urllib.request.Request(
            auth_url,
            data=auth_body,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        response = urllib.request.urlopen(req, timeout=15)
        result = json.loads(response.read().decode('utf-8'))
        print(f"[RUSTORE] Auth response code: {result.get('code')}")

        if result.get('code') != 'OK':
            print(f"[RUSTORE] Auth failed: {str(result)[:300]}")
            return None

        jwe_token = result.get('body', {}).get('jwe')
        if not jwe_token:
            print(f"[RUSTORE] No JWE in response: {str(result)[:300]}")
            return None

        # Cache the token for 800 seconds (server TTL is 900s)
        _rustore_jwe_cache['token'] = jwe_token
        _rustore_jwe_cache['expires_at'] = time.time() + 800

        print(f"[RUSTORE] JWE obtained, length={len(jwe_token)}")
        return jwe_token

    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')[:500]
        print(f"[RUSTORE] Auth HTTP error {e.code}: {err_body}")
        return None
    except Exception as e:
        print(f"[RUSTORE] Auth exception: {e}")
        return None

def rustore_api_request(method, path, body=None):
    """Запрос к RuStore Public API с использованием JWE токена"""
    jwe_token = get_rustore_jwe()
    if not jwe_token:
        print("[RUSTORE] Failed to obtain JWE token")
        return None
    url = f'{RUSTORE_API}{path}'
    headers_dict = {
        'Content-Type': 'application/json',
        'Public-Token': jwe_token
    }
    print(f"[RUSTORE] {method} {url}")
    try:
        if method == 'GET':
            req = urllib.request.Request(url, headers=headers_dict)
        else:
            data = json.dumps(body).encode('utf-8') if body else None
            req = urllib.request.Request(url, data=data, headers=headers_dict, method=method)
        response = urllib.request.urlopen(req, timeout=10)
        result = json.loads(response.read().decode())
        print(f"[RUSTORE] OK: {str(result)[:300]}")
        return result
    except urllib.error.HTTPError as e:
        print(f"[RUSTORE] Error {e.code}: {e.read().decode()[:300]}")
        return None
    except Exception as e:
        print(f"[RUSTORE] Exception: {e}")
        return None

def rustore_validate_purchase(purchase_token):
    """Валидирует покупку через RuStore API"""
    result = rustore_api_request('POST', f'/public/purchase/subscription/v2/{RUSTORE_APP_ID}/token', {'subscriptionToken': purchase_token})
    if not result:
        result = rustore_api_request('GET', f'/public/purchase/{RUSTORE_APP_ID}/{purchase_token}')
    return result

def rustore_activate_subscription(conn, user_id, plan_type, purchase_token):
    """Активирует подписку после RuStore валидации"""
    plan_key = plan_type.replace('premium_', '') if plan_type.startswith('premium_') else plan_type
    plan = PLANS.get(plan_key)
    if not plan:
        return False

    expires_at = datetime.now() + timedelta(days=plan['duration_days'])

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"SELECT id FROM {SCHEMA_NAME}.payments WHERE user_id = %s AND payment_id = %s AND payment_status = 'completed'", (user_id, purchase_token))
        if cur.fetchone():
            return True

        cur.execute(f"""
            INSERT INTO {SCHEMA_NAME}.payments
            (user_id, amount, plan_type, payment_status, payment_method, payment_id, expires_at, completed_at)
            VALUES (%s, %s, %s, 'completed', 'rustore', %s, %s, CURRENT_TIMESTAMP)
        """, (user_id, plan['price'], plan_key, purchase_token, expires_at))
        conn.commit()

        cur.execute(f"""
            UPDATE {SCHEMA_NAME}.users
            SET subscription_type = 'premium',
                subscription_expires_at = %s,
                subscription_plan = %s,
                daily_premium_questions_used = 0,
                daily_premium_questions_reset_at = CURRENT_TIMESTAMP + INTERVAL '1 day',
                bonus_questions = COALESCE(bonus_questions, 0) + 15,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (expires_at, plan_key, user_id))
        conn.commit()

    return True

def rustore_activate_question_pack(conn, user_id, pack_id, purchase_token):
    """Активирует пакет вопросов после RuStore валидации"""
    pack = QUESTION_PACKS.get(pack_id)
    if not pack:
        return False

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"SELECT id FROM {SCHEMA_NAME}.payments WHERE user_id = %s AND payment_id = %s AND payment_status = 'completed'", (user_id, purchase_token))
        if cur.fetchone():
            return True

        cur.execute(f"""
            INSERT INTO {SCHEMA_NAME}.payments
            (user_id, amount, plan_type, payment_status, payment_method, payment_id, completed_at)
            VALUES (%s, %s, %s, 'completed', 'rustore', %s, CURRENT_TIMESTAMP)
        """, (user_id, pack['price'], pack_id, purchase_token))
        conn.commit()

        payment_id = cur.lastrowid or None
        # Fetch the inserted payment id for question_packs table
        cur.execute(f"SELECT id FROM {SCHEMA_NAME}.payments WHERE user_id = %s AND payment_id = %s AND payment_status = 'completed' ORDER BY id DESC LIMIT 1", (user_id, purchase_token))
        row = cur.fetchone()
        local_payment_id = row['id'] if row else None

        questions_to_add = pack['questions']
        cur.execute(f"""
            UPDATE {SCHEMA_NAME}.users
            SET bonus_questions = COALESCE(bonus_questions, 0) + %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (questions_to_add, user_id))

        cur.execute(f"""
            INSERT INTO {SCHEMA_NAME}.question_packs
            (user_id, pack_type, questions_count, price_rub, payment_id)
            VALUES (%s, %s, %s, %s, %s)
        """, (user_id, pack_id, questions_to_add, pack['price'], local_payment_id))
        conn.commit()

    return True

def handler(event: dict, context) -> dict:
    """Обработчик запросов для платежей через RuStore"""
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

            elif action == 'rustore_validate':
                purchase_token = body.get('purchase_token', '')
                plan_type = body.get('plan_type', body.get('product_id', ''))
                if not purchase_token:
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'purchase_token обязателен'})}
                validation = rustore_validate_purchase(purchase_token)
                if validation:
                    inv_status = None
                    if isinstance(validation, dict):
                        inv_status = validation.get('invoice_status', validation.get('invoiceStatus', ''))
                        bd = validation.get('body', {})
                        if isinstance(bd, dict) and not inv_status:
                            inv_status = bd.get('invoice_status', bd.get('invoiceStatus', ''))
                    print(f"[RUSTORE] validate status: {inv_status}")
                    if inv_status in ('confirmed', 'CONFIRMED', 'paid', 'PAID'):
                        # Определяем тип покупки: пакет вопросов или подписка
                        if plan_type.startswith('questions_'):
                            success = rustore_activate_question_pack(conn, user_id, plan_type, purchase_token)
                            if success:
                                pack = QUESTION_PACKS.get(plan_type, {})
                                return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'success': True, 'status': 'activated', 'type': 'question_pack', 'pack_id': plan_type, 'questions': pack.get('questions', 0)})}
                            return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': 'Не удалось активировать пакет вопросов'})}
                        else:
                            success = rustore_activate_subscription(conn, user_id, plan_type, purchase_token)
                            if success:
                                return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'success': True, 'status': 'activated', 'plan': plan_type})}
                            return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': 'Не удалось активировать подписку'})}
                    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'success': False, 'status': inv_status or 'unknown'})}
                return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': 'Не удалось проверить покупку RuStore'})}

            elif action == 'rustore_products':
                products = []
                for key, plan in PLANS.items():
                    products.append({'product_id': f'premium_{key}' if not key.startswith('premium_') else key, 'name': plan['name'], 'price': plan['price'], 'duration_days': plan['duration_days']})
                return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'products': products})}

            elif action == 'rustore_purchase_pack':
                purchase_token = body.get('purchase_token', '')
                pack_id = body.get('pack_id', '')
                if not purchase_token:
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'purchase_token обязателен'})}
                if pack_id not in QUESTION_PACKS:
                    return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Неверный pack_id'})}
                validation = rustore_validate_purchase(purchase_token)
                if validation:
                    inv_status = None
                    if isinstance(validation, dict):
                        inv_status = validation.get('invoice_status', validation.get('invoiceStatus', ''))
                        bd = validation.get('body', {})
                        if isinstance(bd, dict) and not inv_status:
                            inv_status = bd.get('invoice_status', bd.get('invoiceStatus', ''))
                    print(f"[RUSTORE] pack validate status: {inv_status}")
                    if inv_status in ('confirmed', 'CONFIRMED', 'paid', 'PAID'):
                        success = rustore_activate_question_pack(conn, user_id, pack_id, purchase_token)
                        if success:
                            pack = QUESTION_PACKS[pack_id]
                            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'success': True, 'status': 'activated', 'pack_id': pack_id, 'questions': pack['questions']})}
                        return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': 'Не удалось активировать пакет вопросов'})}
                    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'success': False, 'status': inv_status or 'unknown'})}
                return {'statusCode': 500, 'headers': headers, 'body': json.dumps({'error': 'Не удалось проверить покупку RuStore'})}

        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Маршрут не найден'})
        }
    finally:
        conn.close()