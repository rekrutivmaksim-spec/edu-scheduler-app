"""Автоматическое продление подписок — вызывается по крону или вручную"""

import json
import os
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import hashlib
import requests

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
TINKOFF_TERMINAL_KEY = os.environ.get('TINKOFF_TERMINAL_KEY', '')
TINKOFF_PASSWORD = os.environ.get('TINKOFF_TERMINAL_PASSWORD', '')
TINKOFF_API_URL = 'https://securepay.tinkoff.ru/v2/'

PLANS = {
    '1month': {'price': 299, 'duration_days': 30, 'name': '1 месяц'},
    '6months': {'price': 1999, 'duration_days': 180, 'name': '6 месяцев'},
    '1year': {'price': 2699, 'duration_days': 365, 'name': '1 год'}
}

def generate_token(*args):
    values = ''.join(str(v) for v in args if v is not None)
    return hashlib.sha256(values.encode()).hexdigest()

def charge_recurrent(user_id, rebill_id, amount, order_id):
    init_params = {
        'TerminalKey': TINKOFF_TERMINAL_KEY,
        'Amount': amount * 100,
        'OrderId': order_id,
        'Description': 'Studyfay: автопродление подписки',
        'PayType': 'O'
    }
    token_params = dict(init_params)
    token_params['Password'] = TINKOFF_PASSWORD
    sorted_values = [token_params[k] for k in sorted(token_params.keys())]
    init_params['Token'] = generate_token(*sorted_values)

    print(f"[AUTO-CHARGE] Init user={user_id}, rebill={rebill_id}, amount={amount}")

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

    print(f"[AUTO-CHARGE] Charge response: {json.dumps(charge_data, ensure_ascii=False)}")

    if charge_data.get('Success') and charge_data.get('Status') == 'CONFIRMED':
        return {'success': True, 'tinkoff_payment_id': str(payment_id)}
    return {'error': charge_data.get('Message', 'Charge failed'), 'status': charge_data.get('Status')}

def process_renewals(conn):
    results = {'processed': 0, 'success': 0, 'failed': 0, 'skipped': 0, 'details': []}

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT id, email, subscription_plan, subscription_expires_at, rebill_id, card_last4, auto_renew
            FROM {SCHEMA_NAME}.users
            WHERE auto_renew = true
              AND rebill_id IS NOT NULL
              AND subscription_type = 'premium'
              AND subscription_expires_at IS NOT NULL
              AND subscription_expires_at <= NOW() + INTERVAL '1 day'
              AND subscription_plan IN ('1month', '6months', '1year')
            ORDER BY subscription_expires_at ASC
            LIMIT 50
        """)
        users_to_charge = cur.fetchall()

    print(f"[AUTO-CHARGE] Found {len(users_to_charge)} users to renew")

    for user in users_to_charge:
        results['processed'] += 1
        user_id = user['id']
        plan_type = user['subscription_plan']
        plan = PLANS.get(plan_type)

        if not plan:
            results['skipped'] += 1
            results['details'].append({'user_id': user_id, 'status': 'skipped', 'reason': f'Unknown plan: {plan_type}'})
            continue

        new_expires = datetime.now() + timedelta(days=plan['duration_days'])

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f"""
                INSERT INTO {SCHEMA_NAME}.payments 
                (user_id, amount, plan_type, payment_status, expires_at, is_recurrent)
                VALUES (%s, %s, %s, 'pending', %s, true)
                RETURNING id
            """, (user_id, plan['price'], plan_type, new_expires))
            payment_record = cur.fetchone()
            conn.commit()
            local_payment_id = payment_record['id']

        order_id = f"studyfay_{local_payment_id}"

        try:
            result = charge_recurrent(user_id, user['rebill_id'], plan['price'], order_id)

            if result.get('success'):
                with conn.cursor() as cur:
                    cur.execute(f"""
                        UPDATE {SCHEMA_NAME}.payments
                        SET payment_status = 'completed',
                            completed_at = CURRENT_TIMESTAMP,
                            payment_method = 'tinkoff_recurrent',
                            payment_id = %s
                        WHERE id = %s
                    """, (result.get('tinkoff_payment_id'), local_payment_id))

                    cur.execute(f"""
                        UPDATE {SCHEMA_NAME}.users
                        SET subscription_expires_at = %s,
                            ai_questions_used = 0,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    """, (new_expires, user_id))
                    conn.commit()

                results['success'] += 1
                results['details'].append({'user_id': user_id, 'status': 'success', 'amount': plan['price']})
                print(f"[AUTO-CHARGE] user={user_id} renewed until {new_expires}")
            else:
                with conn.cursor() as cur:
                    cur.execute(f"""
                        UPDATE {SCHEMA_NAME}.payments
                        SET payment_status = 'failed',
                            payment_method = 'tinkoff_recurrent',
                            metadata = %s
                        WHERE id = %s
                    """, (json.dumps({'error': result.get('error')}), local_payment_id))

                    cur.execute(f"""
                        UPDATE {SCHEMA_NAME}.users
                        SET auto_renew = false,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    """, (user_id,))
                    conn.commit()

                results['failed'] += 1
                results['details'].append({'user_id': user_id, 'status': 'failed', 'error': result.get('error')})
                print(f"[AUTO-CHARGE] user={user_id} FAILED: {result.get('error')}")

        except Exception as e:
            with conn.cursor() as cur:
                cur.execute(f"""
                    UPDATE {SCHEMA_NAME}.payments
                    SET payment_status = 'failed', metadata = %s
                    WHERE id = %s
                """, (json.dumps({'error': str(e)}), local_payment_id))
                conn.commit()

            results['failed'] += 1
            results['details'].append({'user_id': user_id, 'status': 'error', 'error': str(e)})
            print(f"[AUTO-CHARGE] user={user_id} ERROR: {str(e)}")

    return results

def handler(event: dict, context) -> dict:
    """Автопродление подписок. Вызывать ежедневно по крону или вручную GET/?action=run"""
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

    qs = event.get('queryStringParameters', {}) or {}
    action = qs.get('action', 'status')

    conn = psycopg2.connect(DATABASE_URL)
    try:
        if action == 'run':
            results = process_renewals(conn)
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'message': 'Автопродление выполнено',
                    'results': results
                }, default=str)
            }

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f"""
                SELECT COUNT(*) as total,
                    COUNT(*) FILTER (WHERE subscription_expires_at <= NOW() + INTERVAL '1 day') as expiring_soon
                FROM {SCHEMA_NAME}.users
                WHERE auto_renew = true AND rebill_id IS NOT NULL AND subscription_type = 'premium'
            """)
            stats = cur.fetchone()

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'ready',
                'users_with_auto_renew': stats['total'],
                'expiring_soon': stats['expiring_soon']
            })
        }
    finally:
        conn.close()
