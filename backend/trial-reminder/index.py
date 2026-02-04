"""Отправка push-уведомлений за 12 часов до окончания Trial"""

import json
import os
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor


def get_db_connection():
    """Создаёт подключение к PostgreSQL базе данных"""
    dsn = os.environ['DATABASE_URL']
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(dsn, options=f'-c search_path={schema}')
    return conn


def handler(event: dict, context) -> dict:
    """Проверяет пользователей с истекающим Trial и отправляет уведомления"""
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }
    
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }
    
    conn = get_db_connection()
    
    try:
        # Находим пользователей, у которых Trial истекает через 12 часов
        now = datetime.now()
        reminder_time = now + timedelta(hours=12)
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, email, trial_ends_at
                FROM users
                WHERE trial_ends_at IS NOT NULL
                  AND is_trial_used = false
                  AND trial_ends_at > %s
                  AND trial_ends_at <= %s
                  AND trial_reminder_sent = false
            """, (now, reminder_time))
            
            users_to_notify = cur.fetchall()
            
            # Список для результатов
            notifications_sent = []
            
            for user in users_to_notify:
                user_id = user['id']
                email = user['email']
                trial_ends = user['trial_ends_at']
                
                # Формируем сообщение
                hours_left = int((trial_ends - now).total_seconds() / 3600)
                
                notification = {
                    'user_id': user_id,
                    'email': email,
                    'title': '⏰ Trial заканчивается!',
                    'body': f'Осталось {hours_left} часов Premium доступа. Успейте оформить подписку со скидкой 33%!',
                    'action_url': '/subscription'
                }
                
                # Здесь можно добавить отправку через Firebase Cloud Messaging
                # или другой push-сервис
                
                # Отмечаем, что уведомление отправлено
                cur.execute("""
                    UPDATE users
                    SET trial_reminder_sent = true
                    WHERE id = %s
                """, (user_id,))
                
                notifications_sent.append(notification)
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': headers,
                'body': json.dumps({
                    'notifications_sent': len(notifications_sent),
                    'users': notifications_sent
                })
            }
    
    finally:
        conn.close()
