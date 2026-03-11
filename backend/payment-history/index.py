'''
Business: Get payment history for a user
Args: event with queryStringParameters (user_id)
Returns: List of payment transactions with status and dates
'''

import json
import os
import psycopg2
from typing import Dict, Any

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
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps({'error': 'Метод не поддерживается'})
        }
    
    params = event.get('queryStringParameters', {})
    user_id = params.get('user_id')
    
    if not user_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps({'error': 'Требуется user_id'})
        }
    
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    try:
        cur.execute('''
            SELECT 
                id,
                amount,
                payment_method,
                status,
                order_id,
                created_at,
                updated_at
            FROM t_p29007832_virtual_fitting_room.payment_transactions
            WHERE user_id = %s
            ORDER BY created_at DESC
        ''', (user_id,))
        
        transactions = cur.fetchall()
        
        result = []
        for tx in transactions:
            result.append({
                'id': str(tx[0]),
                'amount': float(tx[1]),
                'payment_method': tx[2],
                'status': tx[3],
                'order_id': tx[4],
                'created_at': tx[5].isoformat() if tx[5] else None,
                'updated_at': tx[6].isoformat() if tx[6] else None
            })
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'body': json.dumps({'transactions': result})
        }
    
    finally:
        cur.close()
        conn.close()