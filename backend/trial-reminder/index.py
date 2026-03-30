"""Отправка push-уведомлений за день до снижения бесплатных лимитов"""

import json
import os
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import urllib.request


def get_db_connection():
    dsn = os.environ['DATABASE_URL']
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(dsn, options=f'-c search_path={schema}')
    return conn


PUSH_URL = os.environ.get('PUSH_NOTIFICATIONS_URL', '')


def create_in_app_notification(conn, user_id: int, title: str, message: str, action_url: str = None):
    with conn.cursor() as cur:
        cur.execute("""
            INSERT INTO notifications (user_id, title, message, action_url, is_read, created_at)
            VALUES (%s, %s, %s, %s, false, CURRENT_TIMESTAMP)
        """, (user_id, title, message, action_url))
        conn.commit()


def send_push(user_id: int, title: str, body: str, url: str, tag: str):
    if not PUSH_URL:
        return
    try:
        data = json.dumps({
            'action': 'send',
            'user_id': user_id,
            'title': title,
            'body': body,
            'url': url,
            'tag': tag
        }).encode()
        req = urllib.request.Request(PUSH_URL, data=data, headers={'Content-Type': 'application/json'}, method='POST')
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass


FREE_GENEROUS_DAYS = 3


def handler(event: dict, context) -> dict:
    """Находит пользователей, у которых завтра закончатся 3 дня Premium и снизятся лимиты"""
    method = event.get('httpMethod', 'POST')

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
        now = datetime.now()
        cutoff_start = now - timedelta(days=FREE_GENEROUS_DAYS)
        cutoff_end = cutoff_start + timedelta(hours=24)

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT u.id, u.email, u.created_at
                FROM users u
                WHERE u.subscription_type = 'free'
                  AND u.created_at >= %s
                  AND u.created_at < %s
                  AND u.trial_reminder_sent = false
                  AND EXISTS (
                      SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = u.id
                  )
            """, (cutoff_start, cutoff_end))

            users_to_notify = cur.fetchall()
            notifications_sent = []

            for user in users_to_notify:
                user_id = user['id']
                days_used = (now - user['created_at'].replace(tzinfo=None)).days

                title = 'Подписка заканчивается завтра'
                message = 'Завтра доступ будет ограничен. Продли подписку — безлимит ко всему!'

                create_in_app_notification(conn, user_id, title, message, '/pricing')
                send_push(user_id, title, message, '/pricing', f'limit-drop-{user_id}')

                cur.execute("""
                    UPDATE users
                    SET trial_reminder_sent = true
                    WHERE id = %s
                """, (user_id,))

                notifications_sent.append({
                    'user_id': user_id,
                    'days_used': days_used,
                    'title': title,
                    'body': message,
                    'action_url': '/pricing'
                })

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