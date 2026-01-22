import json
import os
import jwt
import psycopg2
from datetime import datetime, timedelta
from pywebpush import webpush, WebPushException

DATABASE_URL = os.environ.get('DATABASE_URL')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY', '')
VAPID_PUBLIC_KEY = os.environ.get('VAPID_PUBLIC_KEY', '')
VAPID_EMAIL = os.environ.get('VAPID_EMAIL', 'mailto:admin@studyfay.app')

def get_user_id_from_token(token: str) -> int:
    """Извлечение user_id из JWT токена"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload['user_id']
    except:
        return None

def handler(event: dict, context) -> dict:
    """API для управления push-уведомлениями и их отправки"""
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            'body': ''
        }
    
    token = event.get('headers', {}).get('X-Authorization', '').replace('Bearer ', '')
    user_id = get_user_id_from_token(token)
    
    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Unauthorized'})
        }
    
    conn = psycopg2.connect(DATABASE_URL)
    
    try:
        if method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action')
            
            if action == 'subscribe':
                return handle_subscribe(conn, user_id, body.get('subscription'))
            elif action == 'unsubscribe':
                return handle_unsubscribe(conn, user_id)
            elif action == 'send_test':
                return handle_send_test(conn, user_id)
            elif action == 'send_lesson_reminders':
                return handle_send_lesson_reminders(conn)
            elif action == 'send_deadline_reminders':
                return handle_send_deadline_reminders(conn)
        
        elif method == 'GET':
            action = event.get('queryStringParameters', {}).get('action')
            
            if action == 'status':
                return get_subscription_status(conn, user_id)
        
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid action'})
        }
    
    finally:
        conn.close()

def handle_subscribe(conn, user_id: int, subscription: dict) -> dict:
    """Подписка пользователя на push-уведомления"""
    if not subscription:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Subscription data required'})
        }
    
    endpoint = subscription.get('endpoint')
    keys = subscription.get('keys', {})
    p256dh = keys.get('p256dh')
    auth = keys.get('auth')
    
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (user_id, endpoint) DO UPDATE
        SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
    ''', (user_id, endpoint, p256dh, auth))
    
    cursor.execute('''
        INSERT INTO notification_settings (user_id)
        VALUES (%s)
        ON CONFLICT (user_id) DO NOTHING
    ''', (user_id,))
    
    conn.commit()
    cursor.close()
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'success': True, 'message': 'Subscribed to notifications'})
    }

def handle_unsubscribe(conn, user_id: int) -> dict:
    """Отписка от push-уведомлений"""
    cursor = conn.cursor()
    cursor.execute('UPDATE push_subscriptions SET endpoint = NULL WHERE user_id = %s', (user_id,))
    conn.commit()
    cursor.close()
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'success': True, 'message': 'Unsubscribed from notifications'})
    }

def get_subscription_status(conn, user_id: int) -> dict:
    """Проверка статуса подписки"""
    cursor = conn.cursor()
    cursor.execute('''
        SELECT COUNT(*) FROM push_subscriptions 
        WHERE user_id = %s AND endpoint IS NOT NULL
    ''', (user_id,))
    count = cursor.fetchone()[0]
    cursor.close()
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'subscribed': count > 0})
    }

def handle_send_test(conn, user_id: int) -> dict:
    """Отправка тестового уведомления"""
    cursor = conn.cursor()
    cursor.execute('''
        SELECT endpoint, p256dh, auth FROM push_subscriptions
        WHERE user_id = %s AND endpoint IS NOT NULL
    ''', (user_id,))
    
    subscriptions = cursor.fetchall()
    cursor.close()
    
    if not subscriptions:
        return {
            'statusCode': 404,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'No subscriptions found'})
        }
    
    notification_data = {
        'title': '🎓 Studyfay',
        'body': 'Уведомления работают отлично!',
        'tag': 'test',
        'url': '/'
    }
    
    sent_count = 0
    for endpoint, p256dh, auth in subscriptions:
        try:
            send_push_notification(endpoint, p256dh, auth, notification_data)
            sent_count += 1
        except Exception as e:
            print(f'Failed to send to {endpoint}: {e}')
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'success': True, 'sent': sent_count})
    }

def handle_send_lesson_reminders(conn) -> dict:
    """Отправка напоминаний о занятиях (запускается по расписанию)"""
    cursor = conn.cursor()
    
    today = datetime.now()
    day_of_week = today.isoweekday()
    
    cursor.execute('''
        SELECT DISTINCT u.id, u.full_name, ps.endpoint, ps.p256dh, ps.auth
        FROM users u
        JOIN push_subscriptions ps ON u.id = ps.user_id
        JOIN notification_settings ns ON u.id = ns.user_id
        JOIN schedule s ON u.id = s.user_id
        WHERE ps.endpoint IS NOT NULL
        AND ns.lessons_reminder = TRUE
        AND s.day_of_week = %s
        AND s.start_time > CURRENT_TIME
        AND s.start_time <= CURRENT_TIME + INTERVAL '2 hours'
    ''', (day_of_week,))
    
    users = cursor.fetchall()
    
    for user_id, full_name, endpoint, p256dh, auth in users:
        cursor.execute('''
            SELECT subject, start_time, room FROM schedule
            WHERE user_id = %s AND day_of_week = %s
            AND start_time > CURRENT_TIME
            ORDER BY start_time LIMIT 1
        ''', (user_id, day_of_week))
        
        lesson = cursor.fetchone()
        if lesson:
            subject, start_time, room = lesson
            notification_data = {
                'title': f'📚 Скоро пара: {subject}',
                'body': f'Начало в {start_time.strftime("%H:%M")}' + (f', {room}' if room else ''),
                'tag': f'lesson-{user_id}',
                'url': '/'
            }
            
            try:
                send_push_notification(endpoint, p256dh, auth, notification_data)
            except Exception as e:
                print(f'Failed to send lesson reminder: {e}')
    
    cursor.close()
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'success': True, 'sent': len(users)})
    }

def handle_send_deadline_reminders(conn) -> dict:
    """Отправка напоминаний о дедлайнах (запускается по расписанию)"""
    cursor = conn.cursor()
    
    tomorrow = datetime.now() + timedelta(days=1)
    
    cursor.execute('''
        SELECT DISTINCT u.id, u.full_name, ps.endpoint, ps.p256dh, ps.auth
        FROM users u
        JOIN push_subscriptions ps ON u.id = ps.user_id
        JOIN notification_settings ns ON u.id = ns.user_id
        JOIN tasks t ON u.id = t.user_id
        WHERE ps.endpoint IS NOT NULL
        AND ns.deadline_reminder = TRUE
        AND t.completed = FALSE
        AND t.deadline >= CURRENT_TIMESTAMP
        AND t.deadline <= %s
    ''', (tomorrow,))
    
    users = cursor.fetchall()
    
    for user_id, full_name, endpoint, p256dh, auth in users:
        cursor.execute('''
            SELECT title, deadline FROM tasks
            WHERE user_id = %s AND completed = FALSE
            AND deadline >= CURRENT_TIMESTAMP AND deadline <= %s
            ORDER BY deadline LIMIT 3
        ''', (user_id, tomorrow))
        
        tasks = cursor.fetchall()
        if tasks:
            task_count = len(tasks)
            first_task = tasks[0]
            notification_data = {
                'title': f'⏰ Дедлайн через 24 часа!',
                'body': f'{first_task[0]}' + (f' и ещё {task_count - 1}' if task_count > 1 else ''),
                'tag': f'deadline-{user_id}',
                'url': '/'
            }
            
            try:
                send_push_notification(endpoint, p256dh, auth, notification_data)
            except Exception as e:
                print(f'Failed to send deadline reminder: {e}')
    
    cursor.close()
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'success': True, 'sent': len(users)})
    }

def send_push_notification(endpoint: str, p256dh: str, auth: str, data: dict):
    """Отправка push-уведомления через Web Push API"""
    subscription_info = {
        'endpoint': endpoint,
        'keys': {
            'p256dh': p256dh,
            'auth': auth
        }
    }
    
    webpush(
        subscription_info=subscription_info,
        data=json.dumps(data),
        vapid_private_key=VAPID_PRIVATE_KEY,
        vapid_claims={
            'sub': VAPID_EMAIL
        }
    )
