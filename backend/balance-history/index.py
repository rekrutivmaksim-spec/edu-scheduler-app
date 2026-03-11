import json
import os
import psycopg2
from typing import Dict, Any

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
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'body': json.dumps({'error': 'Метод не поддерживается'})
        }
    
    params = event.get('queryStringParameters', {})
    user_id = params.get('user_id')
    limit = params.get('limit', '50')
    offset = params.get('offset', '0')
    
    if not user_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'body': json.dumps({'error': 'Требуется user_id'})
        }
    
    try:
        limit = int(limit)
        offset = int(offset)
    except ValueError:
        limit = 50
        offset = 0
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    try:
        cur.execute('''
            SELECT COUNT(*) as total
            FROM t_p29007832_virtual_fitting_room.balance_transactions bt
            WHERE bt.user_id = %s
        ''', (user_id,))
        
        total_row = cur.fetchone()
        total = total_row[0] if total_row else 0
        
        # Get user's current balance from users table (single source of truth)
        cur.execute('''
            SELECT balance FROM t_p29007832_virtual_fitting_room.users WHERE id = %s
        ''', (user_id,))
        user_balance_row = cur.fetchone()
        user_balance = float(user_balance_row[0]) if user_balance_row else 0.0
        
        cur.execute('''
            SELECT 
                bt.id,
                bt.type,
                bt.amount,
                bt.balance_before,
                bt.balance_after,
                bt.description,
                bt.created_at,
                bt.try_on_id,
                bt.color_type_id,
                th.removed_at AS try_on_removed,
                th.saved_to_lookbook,
                ct.removed_at AS color_removed
            FROM t_p29007832_virtual_fitting_room.balance_transactions bt
            LEFT JOIN t_p29007832_virtual_fitting_room.try_on_history th ON bt.try_on_id = th.id
            LEFT JOIN t_p29007832_virtual_fitting_room.color_type_history ct ON bt.color_type_id = ct.id
            WHERE bt.user_id = %s
            ORDER BY bt.created_at DESC
            LIMIT %s OFFSET %s
        ''', (user_id, limit, offset))
        
        transactions = cur.fetchall()
        
        result = []
        for tx in transactions:
            tx_id, tx_type, amount, balance_before, balance_after_old, description, created_at, try_on_id, color_type_id, try_on_removed, saved_to_lookbook, color_removed = tx
            
            display_description = description
            
            if try_on_id and try_on_removed:
                if saved_to_lookbook:
                    display_description = 'Виртуальная примерочная [УДАЛЕНО ИЗ ЛУКБУКА]'
                else:
                    display_description = 'Виртуальная примерочная [УДАЛЕНО ИЗ ИСТОРИИ]'
            elif color_type_id and color_removed:
                display_description = 'Определение цветотипа [УДАЛЕНО ИЗ ИСТОРИИ]'
            
            result.append({
                'id': str(tx_id),
                'type': tx_type,
                'amount': float(amount),
                'balance_before': float(balance_before),
                'balance_after': user_balance,  # Real balance from users table (single source of truth)
                'description': display_description,
                'created_at': created_at.isoformat() if created_at else None,
                'is_deleted': bool(try_on_removed or color_removed)
            })
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'body': json.dumps({
                'transactions': result,
                'total': total
            })
        }
    
    finally:
        cur.close()
        conn.close()