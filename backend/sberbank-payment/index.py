'''
Business: Create Sberbank payment links and handle payment callbacks
Args: event with httpMethod, body (amount, user_id), queryStringParameters (orderId, status)
Returns: Payment URL or confirmation of payment processing
'''

import json
import os
import psycopg2
import requests
import hashlib
from typing import Dict, Any

SBERBANK_API = 'https://securepayments.sberbank.ru/payment/rest'

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    # Force redeploy
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'
    
    method: str = event.get('httpMethod', 'GET')
    
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
            'body': ''
        }
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    try:
        if method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            user_id = body_data.get('user_id')
            amount = body_data.get('amount')
            
            if not user_id or not amount:
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                    'body': json.dumps({'error': 'Требуется user_id и amount'})
                }
            
            cur.execute('''
                INSERT INTO t_p29007832_virtual_fitting_room.payment_transactions 
                (user_id, amount, status) 
                VALUES (%s, %s, 'pending') 
                RETURNING id, order_id
            ''', (user_id, amount))
            
            transaction = cur.fetchone()
            transaction_id = str(transaction[0])
            order_id = transaction[1] or transaction_id
            
            conn.commit()
            
            site_url = os.environ.get('SITE_URL', 'https://p29007832.poehali.dev')
            
            payment_data = {
                'userName': os.environ.get('SBERBANK_MERCHANT_ID', 'demo'),
                'password': os.environ.get('SBERBANK_SECRET_KEY', 'demo'),
                'orderNumber': order_id,
                'amount': int(amount * 100),
                'currency': '643',
                'returnUrl': f'{site_url}/profile?tab=wallet&payment=success',
                'failUrl': f'{site_url}/profile?tab=wallet&payment=failed',
                'description': f'Пополнение баланса на {amount} руб'
            }
            
            try:
                response = requests.post(
                    f'{SBERBANK_API}/register.do',
                    data=payment_data,
                    timeout=10
                )
                
                result = response.json()
                
                if 'formUrl' in result:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({
                            'payment_url': result['formUrl'],
                            'order_id': order_id,
                            'transaction_id': transaction_id
                        })
                    }
                else:
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({
                            'error': 'Ошибка создания платежа',
                            'details': result
                        })
                    }
            
            except Exception as e:
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                    'body': json.dumps({'error': f'Ошибка API Сбербанка: {str(e)}'})
                }
        
        elif method == 'GET':
            params = event.get('queryStringParameters', {})
            order_id = params.get('orderId')
            
            if order_id:
                status_data = {
                    'userName': os.environ.get('SBERBANK_MERCHANT_ID', 'demo'),
                    'password': os.environ.get('SBERBANK_SECRET_KEY', 'demo'),
                    'orderId': order_id
                }
                
                try:
                    response = requests.post(
                        f'{SBERBANK_API}/getOrderStatusExtended.do',
                        data=status_data,
                        timeout=10
                    )
                    
                    result = response.json()
                    
                    if result.get('orderStatus') == 2:
                        cur.execute('''
                            SELECT user_id, amount, status 
                            FROM t_p29007832_virtual_fitting_room.payment_transactions 
                            WHERE order_id = %s
                        ''', (order_id,))
                        
                        transaction = cur.fetchone()
                        if transaction and transaction[2] == 'pending':
                            user_id, amount, status = transaction
                            
                            cur.execute('''
                                UPDATE t_p29007832_virtual_fitting_room.payment_transactions 
                                SET status = 'completed', updated_at = CURRENT_TIMESTAMP 
                                WHERE order_id = %s
                            ''', (order_id,))
                            
                            cur.execute('''
                                UPDATE t_p29007832_virtual_fitting_room.users 
                                SET balance = balance + %s, updated_at = CURRENT_TIMESTAMP 
                                WHERE id = %s
                            ''', (amount, user_id))
                            
                            conn.commit()
                            
                            return {
                                'statusCode': 200,
                                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                                'body': json.dumps({
                                    'status': 'completed',
                                    'amount': float(amount)
                                })
                            }
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({
                            'status': 'pending',
                            'order_status': result.get('orderStatus')
                        })
                    }
                
                except Exception as e:
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({'error': f'Ошибка проверки статуса: {str(e)}'})
                    }
            
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({'error': 'Требуется orderId'})
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps({'error': 'Метод не поддерживается'})
        }
    
    finally:
        cur.close()
        conn.close()