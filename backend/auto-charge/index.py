"""Проверка истекших подписок и понижение до бесплатного тарифа"""

import json
import os
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')

PLANS = {
    '1month': {'price': 499, 'duration_days': 30, 'name': '1 месяц'},
    '6months': {'price': 1499, 'duration_days': 180, 'name': '6 месяцев'},
    '1year': {'price': 2399, 'duration_days': 365, 'name': '1 год'}
}

def process_renewals(conn):
    """Находит пользователей с истёкшей подпиской и понижает до free"""
    results = {'processed': 0, 'downgraded': 0, 'details': []}

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT id, subscription_plan, subscription_expires_at
            FROM {SCHEMA_NAME}.users
            WHERE subscription_type = 'premium'
              AND subscription_expires_at IS NOT NULL
              AND subscription_expires_at < NOW()
            ORDER BY subscription_expires_at ASC
            LIMIT 200
        """)
        expired_users = cur.fetchall()

    results['processed'] = len(expired_users)

    for user in expired_users:
        user_id = user['id']
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    UPDATE {SCHEMA_NAME}.users
                    SET subscription_type = 'free',
                        subscription_plan = NULL,
                        auto_renew = false,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                      AND subscription_type = 'premium'
                      AND subscription_expires_at < NOW()
                """, (user_id,))
                conn.commit()

                if cur.rowcount > 0:
                    results['downgraded'] += 1
                    results['details'].append({
                        'user_id': user_id,
                        'status': 'downgraded',
                        'expired_at': str(user['subscription_expires_at']),
                        'plan': user['subscription_plan']
                    })
        except Exception as e:
            results['details'].append({
                'user_id': user_id,
                'status': 'error',
                'error': str(e)
            })

    print(f"[AUTO-CHARGE] Processed {results['processed']} users, downgraded {results['downgraded']}")
    return results

def handler(event: dict, context) -> dict:
    """Проверка истёкших подписок. Вызывать ежедневно по крону или вручную GET/?action=run"""
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
                    'message': 'Проверка подписок выполнена',
                    'results': results
                }, default=str)
            }

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f"""
                SELECT 
                    COUNT(*) FILTER (WHERE subscription_type = 'premium') as active_premium,
                    COUNT(*) FILTER (
                        WHERE subscription_type = 'premium'
                          AND subscription_expires_at IS NOT NULL
                          AND subscription_expires_at < NOW()
                    ) as expired_not_downgraded,
                    COUNT(*) FILTER (
                        WHERE subscription_type = 'free'
                          AND subscription_expires_at IS NOT NULL
                          AND subscription_expires_at > NOW() - INTERVAL '7 days'
                    ) as recently_downgraded
                FROM {SCHEMA_NAME}.users
            """)
            stats = cur.fetchone()

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'status': 'ready',
                'active_premium': stats['active_premium'],
                'expired_not_downgraded': stats['expired_not_downgraded'],
                'recently_downgraded': stats['recently_downgraded']
            })
        }
    finally:
        conn.close()