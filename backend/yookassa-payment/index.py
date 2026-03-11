import json
import os
import psycopg2
import uuid
from typing import Dict, Any
import requests
import base64

YOOKASSA_API = 'https://api.yookassa.ru/v3'
MIN_TOPUP = 50

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    print(f"[DEBUG] Received event: {json.dumps(event)}")
    
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'GET')
    path: str = event.get('path', '')
    url: str = event.get('url', '')
    request_id = event.get('requestContext', {}).get('requestId', '')
    print(f"[DEBUG] Method: {method}, Path: '{path}', URL: '{url}', RequestID: {request_id}")
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    try:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'body': json.dumps({'error': f'Database connection error: {str(e)}'}),
            'isBase64Encoded': False
        }
    
    try:
        # Определяем тип POST запроса
        body_data = json.loads(event.get('body', '{}')) if method == 'POST' else {}
        print(f"[DEBUG] POST body_data keys: {list(body_data.keys())}")
        
        # ЮКасса отправляет webhook в формате: {"type": "notification", "event": "payment.succeeded", "object": {...}}
        # Обычный запрос на создание платежа содержит: {"user_id": "...", "amount": 30}
        is_webhook = (body_data.get('type') == 'notification' and 'event' in body_data and 'object' in body_data)
        print(f"[DEBUG] is_webhook={is_webhook}")
        
        if method == 'POST' and not is_webhook:
            print("[DEBUG] Processing payment creation request")
            user_id = body_data.get('user_id')
            amount = body_data.get('amount')
            print(f"[DEBUG] user_id={user_id}, amount={amount}")
            
            if not user_id or not amount:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': 'Требуется user_id и amount'}),
                    'isBase64Encoded': False
                }
            
            if amount < MIN_TOPUP:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': f'Минимальная сумма пополнения — {MIN_TOPUP} рублей'}),
                    'isBase64Encoded': False
                }
            
            print("[DEBUG] Getting user email from DB")
            cur.execute('''
                SELECT email FROM t_p29007832_virtual_fitting_room.users 
                WHERE id = %s
            ''', (user_id,))
            user_row = cur.fetchone()
            if not user_row:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': 'Пользователь не найден'}),
                    'isBase64Encoded': False
                }
            user_email = user_row[0]
            print(f"[DEBUG] User email: {user_email}")
            
            print("[DEBUG] Inserting transaction into DB")
            cur.execute('''
                INSERT INTO t_p29007832_virtual_fitting_room.payment_transactions 
                (user_id, amount, status, payment_method) 
                VALUES (%s, %s, 'pending', 'yookassa') 
                RETURNING id
            ''', (user_id, amount))
            
            transaction = cur.fetchone()
            transaction_id = str(transaction[0])
            conn.commit()
            print(f"[DEBUG] Transaction created: {transaction_id}")
            
            site_url = os.environ.get('SITE_URL', 'https://fitting-room.ru')
            shop_id = os.environ.get('YUKASSA_SHOP_ID')
            secret_key = os.environ.get('YUKASSA_SECRET_KEY')
            print(f"[DEBUG] shop_id exists: {bool(shop_id)}, secret_key exists: {bool(secret_key)}")
            
            if not shop_id or not secret_key:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': 'ЮКасса не настроена. Ожидаем подключения.'}),
                    'isBase64Encoded': False
                }
            
            idempotence_key = str(uuid.uuid4())
            
            payment_data = {
                'amount': {
                    'value': f'{amount:.2f}',
                    'currency': 'RUB'
                },
                'confirmation': {
                    'type': 'redirect',
                    'return_url': f'{site_url}/profile?tab=wallet'
                },
                'capture': True,
                'description': f'Пополнение баланса на {amount} ₽',
                'receipt': {
                    'customer': {
                        'email': user_email
                    },
                    'items': [{
                        'description': 'Пополнение баланса виртуальной примерочной',
                        'quantity': '1.00',
                        'amount': {
                            'value': f'{amount:.2f}',
                            'currency': 'RUB'
                        },
                        'vat_code': 1,
                        'payment_subject': 'service',
                        'payment_mode': 'full_prepayment'
                    }]
                },
                'metadata': {
                    'transaction_id': transaction_id,
                    'user_id': user_id
                }
            }
            
            auth_string = f'{shop_id}:{secret_key}'
            auth_encoded = base64.b64encode(auth_string.encode()).decode()
            
            try:
                print(f"[DEBUG] Calling YooKassa API with amount={amount}")
                response = requests.post(
                    f'{YOOKASSA_API}/payments',
                    json=payment_data,
                    headers={
                        'Authorization': f'Basic {auth_encoded}',
                        'Idempotence-Key': idempotence_key,
                        'Content-Type': 'application/json'
                    },
                    timeout=10
                )
                
                print(f"[DEBUG] YooKassa response status: {response.status_code}")
                result = response.json()
                print(f"[DEBUG] YooKassa response: {result}")
                
                if response.status_code in [200, 201]:
                    yookassa_payment_id = result.get('id')
                    confirmation_url = result.get('confirmation', {}).get('confirmation_url')
                    
                    cur.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.payment_transactions 
                        SET yookassa_payment_id = %s, yookassa_status = %s, updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    ''', (yookassa_payment_id, result.get('status'), transaction_id))
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                        'body': json.dumps({
                            'payment_url': confirmation_url,
                            'payment_id': yookassa_payment_id,
                            'transaction_id': transaction_id
                        }),
                        'isBase64Encoded': False
                    }
                else:
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                        'body': json.dumps({
                            'error': 'Ошибка создания платежа',
                            'details': result
                        }),
                        'isBase64Encoded': False
                    }
            
            except Exception as e:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': f'Ошибка API ЮКассы: {str(e)}'}),
                    'isBase64Encoded': False
                }
        
        elif method == 'POST' and is_webhook:
            print(f"[WEBHOOK] Received: {json.dumps(body_data)}")
            
            # ЮКасса отправляет данные в формате: {"event": "payment.succeeded", "object": {...}}
            event_type = body_data.get('event')
            payment_object = body_data.get('object', {})
            payment_status = payment_object.get('status')
            
            if event_type == 'payment.succeeded' and payment_status == 'succeeded':
                yookassa_payment_id = payment_object.get('id')
                amount_value = float(payment_object.get('amount', {}).get('value', 0))
                metadata = payment_object.get('metadata', {})
                transaction_id = metadata.get('transaction_id')
                user_id = metadata.get('user_id')
                print(f"[WEBHOOK] Payment succeeded: payment_id={yookassa_payment_id}, transaction_id={transaction_id}, user_id={user_id}, amount={amount_value}")
                
                if transaction_id and user_id:
                    cur.execute('''
                        SELECT status, amount FROM t_p29007832_virtual_fitting_room.payment_transactions 
                        WHERE id = %s
                    ''', (transaction_id,))
                    
                    transaction = cur.fetchone()
                    if transaction and transaction[0] == 'pending':
                        amount = transaction[1]
                        print(f"[WEBHOOK] Found pending transaction: amount={amount}")
                        
                        cur.execute('''
                            SELECT balance FROM t_p29007832_virtual_fitting_room.users 
                            WHERE id = %s
                        ''', (user_id,))
                        user_data = cur.fetchone()
                        balance_before = float(user_data[0]) if user_data else 0
                        balance_after = balance_before + float(amount)
                        print(f"[WEBHOOK] Balance update: {balance_before} → {balance_after}")
                        
                        cur.execute('''
                            UPDATE t_p29007832_virtual_fitting_room.payment_transactions 
                            SET status = 'completed', yookassa_status = 'succeeded', updated_at = CURRENT_TIMESTAMP 
                            WHERE id = %s
                        ''', (transaction_id,))
                        
                        cur.execute('''
                            UPDATE t_p29007832_virtual_fitting_room.users 
                            SET balance = balance + %s, updated_at = CURRENT_TIMESTAMP 
                            WHERE id = %s
                        ''', (amount, user_id))
                        
                        cur.execute('''
                            INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
                            (user_id, type, amount, balance_before, balance_after, description, payment_transaction_id, yookassa_payment_id)
                            VALUES (%s, 'deposit', %s, %s, %s, 'Пополнение через ЮКасса', %s, %s)
                        ''', (user_id, amount, balance_before, balance_after, transaction_id, yookassa_payment_id))
                        
                        conn.commit()
                        print(f"[WEBHOOK] Successfully updated balance for user {user_id}")
                    else:
                        print(f"[WEBHOOK] Transaction not found or not pending: {transaction}")
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'status': 'ok'}),
                'isBase64Encoded': False
            }
        
        elif method == 'GET':
            params = event.get('queryStringParameters', {})
            payment_id = params.get('payment_id')
            
            if not payment_id:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': 'Требуется payment_id'}),
                    'isBase64Encoded': False
                }
            
            shop_id = os.environ.get('YUKASSA_SHOP_ID')
            secret_key = os.environ.get('YUKASSA_SECRET_KEY')
            
            if not shop_id or not secret_key:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': 'ЮКасса не настроена'}),
                    'isBase64Encoded': False
                }
            
            auth_string = f'{shop_id}:{secret_key}'
            auth_encoded = base64.b64encode(auth_string.encode()).decode()
            
            try:
                response = requests.get(
                    f'{YOOKASSA_API}/payments/{payment_id}',
                    headers={'Authorization': f'Basic {auth_encoded}'},
                    timeout=10
                )
                
                result = response.json()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({
                        'status': result.get('status'),
                        'amount': result.get('amount', {}).get('value')
                    }),
                    'isBase64Encoded': False
                }
            
            except Exception as e:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                    'body': json.dumps({'error': f'Ошибка проверки статуса: {str(e)}'}),
                    'isBase64Encoded': False
                }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'body': json.dumps({'error': 'Метод не поддерживается'}),
            'isBase64Encoded': False
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'body': json.dumps({'error': f'Unexpected error: {str(e)}'}),
            'isBase64Encoded': False
        }
    finally:
        try:
            if 'cur' in locals():
                cur.close()
            if 'conn' in locals():
                conn.close()
        except:
            pass