'''
Business: Manage user balance, check limits, and deduct credits for try-on generations
Args: event with httpMethod, headers (session token via cookie/X-Session-Token), body
Returns: User balance info or updated balance after deduction
'''

import json
import os
import psycopg2
from typing import Dict, Any
from session_utils import validate_session

GENERATION_COST = 50
COLORTYPE_COST = 50
MIN_TOPUP = 50

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
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
                'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    # Validate session token
    is_valid, user_id, error_msg = validate_session(event)
    
    if not is_valid:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps({'error': error_msg or 'Требуется авторизация'})
        }
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    try:
        if method == 'GET':
            cur.execute('''
                SELECT balance, free_tries_used, unlimited_access 
                FROM t_p29007832_virtual_fitting_room.users 
                WHERE id = %s
            ''', (user_id,))
            
            result = cur.fetchone()
            if not result:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                    'body': json.dumps({'error': 'Пользователь не найден'})
                }
            
            balance, free_tries_used, unlimited_access = result
            free_tries_remaining = 0
            paid_tries_available = int(balance / GENERATION_COST) if balance >= GENERATION_COST else 0
            
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({
                    'balance': float(balance),
                    'free_tries_remaining': free_tries_remaining,
                    'paid_tries_available': paid_tries_available,
                    'unlimited_access': unlimited_access,
                    'can_generate': unlimited_access or free_tries_remaining > 0 or paid_tries_available > 0
                })
            }
        
        elif method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            action = body_data.get('action')
            
            if action == 'deduct':
                cost_per_step = GENERATION_COST
                total_cost = cost_per_step
                generation_type = body_data.get('generation_type', 'try_on')
                generation_id = body_data.get('generation_id')
                
                cur.execute('''
                    SELECT balance, unlimited_access 
                    FROM t_p29007832_virtual_fitting_room.users 
                    WHERE id = %s
                ''', (user_id,))
                
                result = cur.fetchone()
                if not result:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({'error': 'Пользователь не найден'})
                    }
                
                balance, unlimited_access = result
                balance_before = float(balance)
                
                if unlimited_access:
                    description = f'{"Виртуальная примерочная" if generation_type == "try_on" else "Определение цветотипа"} (безлимитный доступ)'
                    
                    cur.execute('''
                        INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
                        (user_id, type, amount, balance_before, balance_after, description, try_on_id, color_type_id)
                        VALUES (%s, 'charge', 0, %s, %s, %s, %s, %s)
                    ''', (
                        user_id, 
                        balance_before, 
                        balance_before, 
                        description,
                        generation_id if generation_type == 'try_on' else None,
                        generation_id if generation_type == 'color_type' else None
                    ))
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({
                            'success': True,
                            'unlimited': True,
                            'message': 'Безлимитный доступ'
                        })
                    }
                
                if balance >= total_cost:
                    balance_after = balance_before - total_cost
                    description = 'Виртуальная примерочная' if generation_type == 'try_on' else 'Определение цветотипа'
                    
                    cur.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.users 
                        SET balance = balance - %s, updated_at = CURRENT_TIMESTAMP
                        WHERE id = %s
                    ''', (total_cost, user_id))
                    
                    cur.execute('''
                        INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
                        (user_id, type, amount, balance_before, balance_after, description, try_on_id, color_type_id)
                        VALUES (%s, 'charge', %s, %s, %s, %s, %s, %s)
                    ''', (
                        user_id, 
                        -total_cost,
                        balance_before, 
                        balance_after, 
                        description,
                        generation_id if generation_type == 'try_on' else None,
                        generation_id if generation_type == 'color_type' else None
                    ))
                    
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({
                            'success': True,
                            'paid_try': True,
                            'new_balance': balance_after,
                            'cost': total_cost
                        })
                    }
                
                return {
                    'statusCode': 402,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                    'body': json.dumps({
                        'error': 'Недостаточно средств',
                        'balance': balance_before,
                        'required': total_cost
                    })
                }
            
            elif action == 'refund':
                cost_per_step = GENERATION_COST
                total_refund = cost_per_step
                generation_type = body_data.get('generation_type', 'try_on')
                generation_id = body_data.get('generation_id')
                reason = body_data.get('reason', 'Технический сбой')
                
                cur.execute('''
                    SELECT balance, unlimited_access 
                    FROM t_p29007832_virtual_fitting_room.users 
                    WHERE id = %s
                ''', (user_id,))
                
                result = cur.fetchone()
                if not result:
                    return {
                        'statusCode': 404,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({'error': 'Пользователь не найден'})
                    }
                
                balance, unlimited_access = result
                balance_before = float(balance)
                
                if unlimited_access:
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'body': json.dumps({
                            'success': True,
                            'unlimited': True,
                            'message': 'Безлимитный пользователь - возврат не требуется'
                        })
                    }
                
                balance_after = balance_before + total_refund
                service_name = 'примерочной' if generation_type == 'try_on' else 'цветотипа'
                description = f'Возврат: {reason} {service_name}'
                
                cur.execute('''
                    UPDATE t_p29007832_virtual_fitting_room.users 
                    SET balance = balance + %s, updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                ''', (total_refund, user_id))
                
                cur.execute('''
                    INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
                    (user_id, type, amount, balance_before, balance_after, description, try_on_id, color_type_id)
                    VALUES (%s, 'refund', %s, %s, %s, %s, %s, %s)
                ''', (
                    user_id, 
                    total_refund,
                    balance_before, 
                    balance_after, 
                    description,
                    generation_id if generation_type == 'try_on' else None,
                    generation_id if generation_type == 'color_type' else None
                ))
                
                conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                    'body': json.dumps({
                        'success': True,
                        'refunded': True,
                        'refund_type': 'paid',
                        'refund_amount': total_refund,
                        'new_balance': balance_after
                    })
                }
            
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'body': json.dumps({'error': 'Неизвестное действие'})
            }
        
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps({'error': 'Метод не поддерживается'})
        }
    
    finally:
        cur.close()
        conn.close()