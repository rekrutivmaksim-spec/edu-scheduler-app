"""API для данных сессии: тема дня, стрик пользователя, дней до экзамена"""

import json
import os
import hashlib
from datetime import date, datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt


DAILY_TOPICS = [
    {"subject": "Математика", "topic": "Квадратные уравнения"},
    {"subject": "Математика", "topic": "Производная функции"},
    {"subject": "Математика", "topic": "Интегралы"},
    {"subject": "Математика", "topic": "Логарифмы"},
    {"subject": "Математика", "topic": "Тригонометрия"},
    {"subject": "Математика", "topic": "Пределы"},
    {"subject": "Математика", "topic": "Матрицы и определители"},
    {"subject": "Физика", "topic": "Законы Ньютона"},
    {"subject": "Физика", "topic": "Электрическое поле"},
    {"subject": "Физика", "topic": "Магнетизм"},
    {"subject": "Физика", "topic": "Оптика"},
    {"subject": "Физика", "topic": "Термодинамика"},
    {"subject": "Химия", "topic": "Реакции окисления-восстановления"},
    {"subject": "Химия", "topic": "Органические соединения"},
    {"subject": "Биология", "topic": "Клеточное строение"},
    {"subject": "Биология", "topic": "Генетика и наследственность"},
    {"subject": "Информатика", "topic": "Алгоритмы сортировки"},
    {"subject": "Информатика", "topic": "Рекурсия"},
    {"subject": "История", "topic": "Петровские реформы"},
    {"subject": "История", "topic": "Вторая мировая война"},
    {"subject": "Русский язык", "topic": "Причастие и деепричастие"},
    {"subject": "Русский язык", "topic": "Сложноподчинённые предложения"},
    {"subject": "Обществознание", "topic": "Конституция РФ"},
    {"subject": "Обществознание", "topic": "Рыночная экономика"},
]


def get_db_connection():
    dsn = os.environ['DATABASE_URL']
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(dsn, options=f'-c search_path={schema}')
    return conn


def verify_token(token: str):
    secret = os.environ.get('JWT_SECRET', '')
    try:
        return jwt.decode(token, secret, algorithms=['HS256'])
    except:
        return None


def get_today_topic():
    today_str = date.today().isoformat()
    idx = int(hashlib.md5(today_str.encode()).hexdigest(), 16) % len(DAILY_TOPICS)
    topic = DAILY_TOPICS[idx]
    total = len(DAILY_TOPICS)
    completed_today = idx + 1
    return {**topic, "topic_number": completed_today, "total_topics": total}


def handler(event: dict, context) -> dict:
    """Возвращает данные для сессии: тема дня, стрик, дней до экзамена"""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    topic = get_today_topic()

    auth_header = event.get('headers', {}).get('X-Authorization') or event.get('headers', {}).get('Authorization', '')
    user_id = None
    streak = 0
    days_to_exam = 87
    topics_completed = 1
    is_premium = False

    token = auth_header.replace('Bearer ', '').strip() if auth_header else ''
    if token and token != 'guest_token':
        payload = verify_token(token)
        if payload:
            user_id = payload.get('user_id')

    if user_id:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            "SELECT current_streak, total_active_days FROM user_streaks WHERE user_id = %s",
            (user_id,)
        )
        streak_row = cur.fetchone()
        if streak_row:
            streak = streak_row['current_streak']
            topics_completed = streak_row['total_active_days']

        cur.execute(
            "SELECT subscription_type, subscription_expires_at FROM users WHERE id = %s",
            (user_id,)
        )
        user_row = cur.fetchone()
        if user_row and user_row['subscription_type'] == 'premium':
            exp = user_row['subscription_expires_at']
            if exp and exp >= datetime.now():
                is_premium = True

        cur.close()
        conn.close()

    result = {
        "topic": topic,
        "streak": streak,
        "days_to_exam": days_to_exam,
        "topics_completed": topics_completed,
        "total_topics": topic["total_topics"],
        "is_premium": is_premium,
        "show_paywall": streak >= 3 and not is_premium,
    }

    return {
        'statusCode': 200,
        'headers': {**cors, 'Content-Type': 'application/json'},
        'body': json.dumps(result),
    }
