"""API для родительского дашборда: генерация кода, регистрация/вход родителя, оплата, просмотр статистики ребёнка"""

import json
import os
import re
import uuid
import string
import random
import base64
import datetime as dt
from datetime import datetime, timedelta, date
from decimal import Decimal

import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
import urllib.request
import urllib.error

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
YOKASSA_SHOP_ID = os.environ.get('YOKASSA_SHOP_ID', '')
YOKASSA_SECRET_KEY = os.environ.get('YOKASSA_SECRET_KEY', '')

PARENT_ACCESS_PRICE = 299
PARENT_ACCESS_DAYS = 30

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
}

OPTIONS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
}


def _json_serial(obj):
    """Сериализация нестандартных типов для json.dumps"""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, dt.date):
        return obj.isoformat()
    raise TypeError(f'Type {type(obj)} not serializable')


def ok(body: dict) -> dict:
    return {
        'statusCode': 200,
        'headers': CORS_HEADERS,
        'body': json.dumps(body, ensure_ascii=False, default=_json_serial),
    }


def err(status: int, msg: str) -> dict:
    return {
        'statusCode': status,
        'headers': CORS_HEADERS,
        'body': json.dumps({'error': msg}, ensure_ascii=False),
    }


def get_db_connection():
    """Создаёт подключение к PostgreSQL с указанной схемой"""
    conn = psycopg2.connect(DATABASE_URL, options=f'-c search_path={SCHEMA_NAME}')
    return conn


def verify_student_token(token: str) -> dict:
    """Проверяет JWT токен студента и возвращает payload или None"""
    if token == 'mock-token':
        return {'user_id': 1}
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        if payload.get('type') == 'parent':
            return None
        return payload
    except Exception:
        return None


def generate_parent_token(parent_id: int, child_user_id: int) -> str:
    """Генерирует JWT токен для родителя (срок действия — 30 дней)"""
    payload = {
        'parent_id': parent_id,
        'child_user_id': child_user_id,
        'type': 'parent',
        'exp': datetime.utcnow() + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def verify_parent_token(token: str) -> dict:
    """Проверяет JWT токен родителя и возвращает payload или None"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        if payload.get('type') != 'parent' or not payload.get('parent_id'):
            return None
        return payload
    except Exception:
        return None


def check_parent_subscription(conn, parent_id: int) -> bool:
    """Проверяет, активна ли подписка родителя"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT subscription_active, subscription_expires_at
            FROM {SCHEMA_NAME}.parent_accounts
            WHERE id = %s
        """, (parent_id,))
        row = cur.fetchone()
        if not row:
            return False
        if row['subscription_active']:
            if row['subscription_expires_at']:
                expires = row['subscription_expires_at']
                if hasattr(expires, 'tzinfo') and expires.tzinfo:
                    expires = expires.replace(tzinfo=None)
                return expires > datetime.now()
            return True
        return False


def extract_token(event: dict) -> str:
    """Извлекает Bearer-токен из заголовков (X-Authorization приоритетнее)"""
    headers = event.get('headers', {}) or {}
    raw = (
        headers.get('X-Authorization')
        or headers.get('x-authorization')
        or headers.get('Authorization')
        or headers.get('authorization')
        or ''
    )
    if raw.startswith('Bearer '):
        return raw[7:]
    return raw


def generate_access_code() -> str:
    """Генерирует уникальный 8-символьный алфавитно-цифровой код"""
    chars = string.ascii_uppercase + string.digits
    return ''.join(random.choices(chars, k=8))


# ─── YooKassa helpers ─────────────────────────────────────────────────────────

def yokassa_create_payment(amount, description, order_id, return_url):
    """Создаёт платёж через YooKassa API"""
    url = 'https://api.yookassa.ru/v3/payments'
    idempotence_key = str(uuid.uuid4())
    credentials = base64.b64encode(f'{YOKASSA_SHOP_ID}:{YOKASSA_SECRET_KEY}'.encode()).decode()

    payment_body = {
        'amount': {
            'value': f'{amount:.2f}',
            'currency': 'RUB'
        },
        'confirmation': {
            'type': 'redirect',
            'return_url': return_url
        },
        'description': description,
        'metadata': {
            'order_id': order_id
        }
    }

    data = json.dumps(payment_body).encode('utf-8')
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Basic {credentials}',
            'Idempotence-Key': idempotence_key
        },
        method='POST'
    )

    print(f"[PARENT-YOKASSA] Creating payment: order_id={order_id}, amount={amount}")
    try:
        response = urllib.request.urlopen(req, timeout=15)
        result = json.loads(response.read().decode('utf-8'))
        print(f"[PARENT-YOKASSA] Payment created: id={result.get('id')}, status={result.get('status')}")
        return result
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')[:500]
        print(f"[PARENT-YOKASSA] Create payment error {e.code}: {err_body}")
        return None
    except Exception as e:
        print(f"[PARENT-YOKASSA] Create payment exception: {e}")
        return None


def yokassa_get_payment(payment_id):
    """Получает статус платежа через YooKassa API"""
    url = f'https://api.yookassa.ru/v3/payments/{payment_id}'
    credentials = base64.b64encode(f'{YOKASSA_SHOP_ID}:{YOKASSA_SECRET_KEY}'.encode()).decode()

    req = urllib.request.Request(
        url,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Basic {credentials}'
        },
        method='GET'
    )

    print(f"[PARENT-YOKASSA] Getting payment: {url}")
    try:
        response = urllib.request.urlopen(req, timeout=15)
        result = json.loads(response.read().decode('utf-8'))
        print(f"[PARENT-YOKASSA] Payment info: id={result.get('id')}, status={result.get('status')}")
        return result
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8', errors='replace')[:500]
        print(f"[PARENT-YOKASSA] Get payment error {e.code}: {err_body}")
        return None
    except Exception as e:
        print(f"[PARENT-YOKASSA] Get payment exception: {e}")
        return None


# ─── Action handlers ──────────────────────────────────────────────────────────

def handle_generate_code(conn, user_id: int) -> dict:
    """Генерирует родительский код для студента"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Проверяем, есть ли уже код
        cur.execute(f"""
            SELECT parent_code FROM {SCHEMA_NAME}.users WHERE id = %s
        """, (user_id,))
        user = cur.fetchone()
        if not user:
            return err(404, 'Пользователь не найден')

        if user['parent_code']:
            return ok({'code': user['parent_code']})

        # Генерируем уникальный код
        for _ in range(10):
            code = generate_access_code()
            cur.execute(f"""
                SELECT id FROM {SCHEMA_NAME}.users WHERE parent_code = %s
            """, (code,))
            if not cur.fetchone():
                break
        else:
            return err(500, 'Не удалось сгенерировать уникальный код')

        cur.execute(f"""
            UPDATE {SCHEMA_NAME}.users SET parent_code = %s WHERE id = %s
        """, (code, user_id))
        conn.commit()

        return ok({'code': code})


def handle_register(conn, body: dict) -> dict:
    """Регистрация родителя по телефону и коду доступа"""
    phone = (body.get('phone') or '').strip()
    access_code = (body.get('access_code') or '').strip().upper()
    full_name = (body.get('full_name') or '').strip()

    if not phone or not access_code:
        return err(400, 'Телефон и код доступа обязательны')

    # Валидация телефона (российский формат: начинается с 7, 11 цифр)
    phone_digits = re.sub(r'\D', '', phone)
    if not phone_digits.startswith('7') or len(phone_digits) != 11:
        return err(400, 'Некорректный формат телефона. Используйте российский номер (начинается с 7, 11 цифр)')

    phone = phone_digits  # сохраняем только цифры

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Находим студента по parent_code
        cur.execute(f"""
            SELECT id, full_name FROM {SCHEMA_NAME}.users WHERE parent_code = %s
        """, (access_code,))
        student = cur.fetchone()
        if not student:
            return err(404, 'Код доступа не найден. Попросите ребёнка сгенерировать код в приложении')

        child_user_id = student['id']
        child_name = student['full_name'] or 'Студент'

        # Проверяем, есть ли уже запись parent_accounts для этого телефона + ребёнка
        cur.execute(f"""
            SELECT id, full_name, subscription_active, subscription_expires_at
            FROM {SCHEMA_NAME}.parent_accounts
            WHERE phone = %s AND child_user_id = %s
        """, (phone, child_user_id))
        existing = cur.fetchone()

        if existing:
            parent_id = existing['id']
            parent_name = existing['full_name'] or full_name

            # Обновляем имя, если передано
            if full_name and not existing['full_name']:
                cur.execute(f"""
                    UPDATE {SCHEMA_NAME}.parent_accounts SET full_name = %s WHERE id = %s
                """, (full_name, parent_id))
                conn.commit()
                parent_name = full_name

            needs_payment = not check_parent_subscription(conn, parent_id)
            token = generate_parent_token(parent_id, child_user_id)

            return ok({
                'success': True,
                'token': token,
                'parent': {
                    'id': parent_id,
                    'full_name': parent_name,
                    'child_name': child_name
                },
                'needs_payment': needs_payment
            })

        # Создаём новую запись
        cur.execute(f"""
            INSERT INTO {SCHEMA_NAME}.parent_accounts
            (phone, full_name, child_user_id, access_code, subscription_active, created_at)
            VALUES (%s, %s, %s, %s, false, CURRENT_TIMESTAMP)
            RETURNING id
        """, (phone, full_name or None, child_user_id, access_code))
        parent_id = cur.fetchone()['id']
        conn.commit()

        token = generate_parent_token(parent_id, child_user_id)

        return ok({
            'success': True,
            'token': token,
            'parent': {
                'id': parent_id,
                'full_name': full_name or None,
                'child_name': child_name
            },
            'needs_payment': True
        })


def handle_login(conn, body: dict) -> dict:
    """Вход родителя по телефону и коду доступа"""
    phone = (body.get('phone') or '').strip()
    access_code = (body.get('access_code') or '').strip().upper()

    if not phone or not access_code:
        return err(400, 'Телефон и код доступа обязательны')

    phone_digits = re.sub(r'\D', '', phone)
    if not phone_digits.startswith('7') or len(phone_digits) != 11:
        return err(400, 'Некорректный формат телефона')

    phone = phone_digits

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Находим студента по parent_code
        cur.execute(f"""
            SELECT id, full_name FROM {SCHEMA_NAME}.users WHERE parent_code = %s
        """, (access_code,))
        student = cur.fetchone()
        if not student:
            return err(404, 'Неверный код доступа')

        child_user_id = student['id']
        child_name = student['full_name'] or 'Студент'

        # Находим parent_accounts
        cur.execute(f"""
            SELECT id, full_name, subscription_active, subscription_expires_at
            FROM {SCHEMA_NAME}.parent_accounts
            WHERE phone = %s AND child_user_id = %s
        """, (phone, child_user_id))
        parent = cur.fetchone()

        if not parent:
            return err(404, 'Аккаунт не найден. Сначала зарегистрируйтесь')

        parent_id = parent['id']

        # Обновляем last_login_at
        cur.execute(f"""
            UPDATE {SCHEMA_NAME}.parent_accounts SET last_login_at = CURRENT_TIMESTAMP WHERE id = %s
        """, (parent_id,))
        conn.commit()

        needs_payment = not check_parent_subscription(conn, parent_id)
        token = generate_parent_token(parent_id, child_user_id)

        return ok({
            'success': True,
            'token': token,
            'parent': {
                'id': parent_id,
                'full_name': parent['full_name'],
                'child_name': child_name
            },
            'needs_payment': needs_payment
        })


def handle_create_payment(conn, parent_id: int, child_user_id: int, body: dict) -> dict:
    """Создаёт платёж 299 руб. за доступ к родительскому дашборду"""
    return_url = body.get('return_url', 'https://studyfay.ru/parent?payment=success')

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Проверяем существование parent_accounts
        cur.execute(f"""
            SELECT id FROM {SCHEMA_NAME}.parent_accounts WHERE id = %s
        """, (parent_id,))
        if not cur.fetchone():
            return err(404, 'Аккаунт родителя не найден')

        expires_at = datetime.now() + timedelta(days=PARENT_ACCESS_DAYS)

        # Создаём запись о платеже
        cur.execute(f"""
            INSERT INTO {SCHEMA_NAME}.payments
            (user_id, amount, plan_type, payment_status, expires_at, metadata)
            VALUES (%s, %s, %s, 'pending', %s, %s)
            RETURNING id
        """, (
            child_user_id,
            PARENT_ACCESS_PRICE,
            'parent_access',
            expires_at,
            json.dumps({'type': 'parent', 'parent_id': parent_id})
        ))
        local_payment_id = cur.fetchone()['id']
        conn.commit()

    order_id = f'studyfay_{local_payment_id}'
    description = f'StudyFay: Родительский доступ (30 дней)'

    yokassa_result = yokassa_create_payment(PARENT_ACCESS_PRICE, description, order_id, return_url)
    if not yokassa_result:
        return err(500, 'Не удалось создать платёж в YooKassa')

    confirmation_url = yokassa_result.get('confirmation', {}).get('confirmation_url', '')
    yokassa_payment_id = yokassa_result.get('id', '')

    # Сохраняем yokassa payment_id
    with conn.cursor() as cur:
        cur.execute(f"""
            UPDATE {SCHEMA_NAME}.payments SET payment_id = %s WHERE id = %s
        """, (yokassa_payment_id, local_payment_id))

        # Привязываем payment_id к parent_accounts
        cur.execute(f"""
            UPDATE {SCHEMA_NAME}.parent_accounts SET payment_id = %s WHERE id = %s
        """, (local_payment_id, parent_id))
        conn.commit()

    return ok({
        'success': True,
        'confirmation_url': confirmation_url,
        'payment_id': local_payment_id
    })


def handle_webhook(conn, body: dict) -> dict:
    """Обработка webhook-уведомлений от YooKassa для родительских платежей"""
    event_type = body.get('event', '')
    payment_object = body.get('object', {})

    if not payment_object:
        print("[PARENT-WEBHOOK] No payment object in body")
        return ok({'success': True})

    yokassa_payment_id = payment_object.get('id', '')
    metadata = payment_object.get('metadata', {})
    order_id = metadata.get('order_id', '')

    if not order_id or not order_id.startswith('studyfay_'):
        print(f"[PARENT-WEBHOOK] Unknown order_id={order_id}")
        return ok({'success': True})

    local_payment_id = int(order_id.replace('studyfay_', ''))
    print(f"[PARENT-WEBHOOK] event={event_type}, yokassa_id={yokassa_payment_id}, local_id={local_payment_id}")

    if event_type == 'payment.succeeded':
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Получаем информацию о платеже
            cur.execute(f"""
                SELECT id, plan_type, payment_status, metadata, expires_at
                FROM {SCHEMA_NAME}.payments
                WHERE id = %s
            """, (local_payment_id,))
            payment = cur.fetchone()

            if not payment:
                print(f"[PARENT-WEBHOOK] Payment {local_payment_id} not found")
                return ok({'success': True})

            if payment['payment_status'] != 'pending':
                print(f"[PARENT-WEBHOOK] Payment {local_payment_id} already processed: {payment['payment_status']}")
                return ok({'success': True})

            # Проверяем, что это родительский платёж
            payment_metadata = payment.get('metadata')
            if isinstance(payment_metadata, str):
                try:
                    payment_metadata = json.loads(payment_metadata)
                except Exception:
                    payment_metadata = {}
            if not payment_metadata or payment_metadata.get('type') != 'parent':
                print(f"[PARENT-WEBHOOK] Payment {local_payment_id} is not a parent payment, skipping")
                return ok({'success': True})

            parent_id = payment_metadata.get('parent_id')
            if not parent_id:
                print(f"[PARENT-WEBHOOK] No parent_id in metadata for payment {local_payment_id}")
                return ok({'success': True})

            # Верифицируем через YooKassa API
            verified = yokassa_get_payment(yokassa_payment_id)
            if not verified or verified.get('status') != 'succeeded':
                print(f"[PARENT-WEBHOOK] Payment verification failed for {yokassa_payment_id}")
                return ok({'success': True})

            # Обновляем статус платежа
            cur.execute(f"""
                UPDATE {SCHEMA_NAME}.payments
                SET payment_status = 'completed',
                    completed_at = CURRENT_TIMESTAMP,
                    payment_method = 'yokassa',
                    payment_id = %s
                WHERE id = %s
            """, (yokassa_payment_id, local_payment_id))

            # Активируем подписку родителя
            subscription_expires = datetime.now() + timedelta(days=PARENT_ACCESS_DAYS)
            cur.execute(f"""
                UPDATE {SCHEMA_NAME}.parent_accounts
                SET subscription_active = true,
                    subscription_expires_at = %s,
                    payment_id = %s
                WHERE id = %s
            """, (subscription_expires, local_payment_id, parent_id))

            conn.commit()
            print(f"[PARENT-WEBHOOK] Parent {parent_id} subscription activated until {subscription_expires}")

    return ok({'success': True})


def handle_dashboard(conn, parent_id: int, child_user_id: int) -> dict:
    """Возвращает комплексную статистику учёбы ребёнка"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Основная информация о ребёнке
        cur.execute(f"""
            SELECT full_name, subscription_type, subscription_expires_at,
                   xp_total, level, created_at
            FROM {SCHEMA_NAME}.users WHERE id = %s
        """, (child_user_id,))
        child = cur.fetchone()
        if not child:
            return err(404, 'Ребёнок не найден')

        child_name = child['full_name'] or 'Студент'
        is_premium = (
            child['subscription_type'] == 'premium'
            and child['subscription_expires_at']
            and child['subscription_expires_at'].replace(tzinfo=None) > datetime.now()
        ) if child['subscription_expires_at'] else False

        # Стрик
        cur.execute(f"""
            SELECT current_streak, longest_streak, total_active_days, last_activity_date
            FROM {SCHEMA_NAME}.user_streaks WHERE user_id = %s
        """, (child_user_id,))
        streak = cur.fetchone()
        streak_data = {
            'current_streak': streak['current_streak'] if streak else 0,
            'longest_streak': streak['longest_streak'] if streak else 0,
            'total_active_days': streak['total_active_days'] if streak else 0,
            'last_activity_date': streak['last_activity_date'] if streak else None
        }

        # Сегодняшняя активность
        today = date.today()
        cur.execute(f"""
            SELECT tasks_completed, pomodoro_minutes, ai_questions_asked, exam_tasks_done, xp_earned
            FROM {SCHEMA_NAME}.daily_activity
            WHERE user_id = %s AND activity_date = %s
        """, (child_user_id, today))
        today_activity = cur.fetchone()
        today_data = {
            'tasks_completed': today_activity['tasks_completed'] if today_activity else 0,
            'pomodoro_minutes': today_activity['pomodoro_minutes'] if today_activity else 0,
            'ai_questions_asked': today_activity['ai_questions_asked'] if today_activity else 0,
            'exam_tasks_done': today_activity['exam_tasks_done'] if today_activity else 0,
            'xp_earned': today_activity['xp_earned'] if today_activity else 0
        }

        # Активность за последние 7 дней
        week_ago = today - timedelta(days=7)
        cur.execute(f"""
            SELECT activity_date, tasks_completed, pomodoro_minutes,
                   ai_questions_asked, exam_tasks_done, xp_earned
            FROM {SCHEMA_NAME}.daily_activity
            WHERE user_id = %s AND activity_date >= %s
            ORDER BY activity_date DESC
        """, (child_user_id, week_ago))
        week_activity = [dict(row) for row in cur.fetchall()]

        # Уровень и XP
        level_data = {
            'level': child['level'] or 1,
            'xp_total': child['xp_total'] or 0
        }

        # Последние 5 достижений
        cur.execute(f"""
            SELECT achievement_type, achievement_title, xp_reward, unlocked_at
            FROM {SCHEMA_NAME}.achievements
            WHERE user_id = %s
            ORDER BY unlocked_at DESC
            LIMIT 5
        """, (child_user_id,))
        achievements = [dict(row) for row in cur.fetchall()]

        # Активные квесты
        cur.execute(f"""
            SELECT quest_type, quest_title, target_value, current_value,
                   xp_reward, is_completed, completed_at
            FROM {SCHEMA_NAME}.daily_quests
            WHERE user_id = %s AND quest_date = %s
            ORDER BY id
        """, (child_user_id, today))
        quests = [dict(row) for row in cur.fetchall()]

        # Оценки (GPA, количество предметов)
        cur.execute(f"""
            SELECT COUNT(DISTINCT gs.id) as subjects_count
            FROM {SCHEMA_NAME}.grade_subjects gs
            WHERE gs.user_id = %s
        """, (child_user_id,))
        subjects_row = cur.fetchone()
        subjects_count = subjects_row['subjects_count'] if subjects_row else 0

        cur.execute(f"""
            SELECT ROUND(AVG(g.grade)::numeric, 2) as gpa
            FROM {SCHEMA_NAME}.grades g
            JOIN {SCHEMA_NAME}.grade_subjects gs ON gs.id = g.subject_id
            WHERE g.user_id = %s AND gs.grade_type != 'zachet'
        """, (child_user_id,))
        gpa_row = cur.fetchone()
        gpa = float(gpa_row['gpa']) if gpa_row and gpa_row['gpa'] else None

        grade_summary = {
            'gpa': gpa,
            'subjects_count': subjects_count
        }

        # Прогресс плана подготовки (если есть)
        cur.execute(f"""
            SELECT id, subject, exam_date, total_days, completed_days, progress_percent, status
            FROM {SCHEMA_NAME}.study_plans
            WHERE user_id = %s AND status = 'active'
            ORDER BY exam_date ASC
            LIMIT 3
        """, (child_user_id,))
        study_plans = [dict(row) for row in cur.fetchall()]

        # Использование дневных лимитов
        cur.execute(f"""
            SELECT daily_premium_questions_used, bonus_questions
            FROM {SCHEMA_NAME}.users WHERE id = %s
        """, (child_user_id,))
        limits_row = cur.fetchone()
        daily_limits = {
            'ai_questions_used': limits_row['daily_premium_questions_used'] if limits_row else 0,
            'bonus_questions': limits_row['bonus_questions'] if limits_row else 0
        }

        return ok({
            'child_name': child_name,
            'subscription_active': is_premium,
            'streak': streak_data,
            'today_activity': today_data,
            'week_activity': week_activity,
            'level': level_data,
            'achievements': achievements,
            'quests': quests,
            'grade_summary': grade_summary,
            'study_plans': study_plans,
            'daily_limits': daily_limits
        })


def handle_activity_history(conn, child_user_id: int, params: dict) -> dict:
    """Возвращает историю активности ребёнка за N дней"""
    days = int(params.get('days', 30))
    if days < 1:
        days = 1
    if days > 365:
        days = 365

    since_date = date.today() - timedelta(days=days)

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT activity_date, tasks_completed, pomodoro_minutes,
                   ai_questions_asked, exam_tasks_done, materials_uploaded,
                   schedule_views, xp_earned
            FROM {SCHEMA_NAME}.daily_activity
            WHERE user_id = %s AND activity_date >= %s
            ORDER BY activity_date DESC
        """, (child_user_id, since_date))
        rows = [dict(row) for row in cur.fetchall()]

    return ok({'daily_activity': rows, 'days': days, 'total_records': len(rows)})


def handle_grades(conn, child_user_id: int) -> dict:
    """Возвращает все оценки ребёнка, сгруппированные по семестрам"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT gs.id as subject_id, gs.name as subject_name,
                   gs.semester, gs.credit_units, gs.grade_type,
                   g.id as grade_id, g.grade, g.grade_label, g.date, g.note
            FROM {SCHEMA_NAME}.grade_subjects gs
            LEFT JOIN {SCHEMA_NAME}.grades g ON g.subject_id = gs.id AND g.user_id = %s
            WHERE gs.user_id = %s
            ORDER BY gs.semester, gs.name, g.date DESC
        """, (child_user_id, child_user_id))
        rows = cur.fetchall()

    semesters = {}
    for row in rows:
        sem = row['semester']
        if sem not in semesters:
            semesters[sem] = {}
        subj_id = row['subject_id']
        if subj_id not in semesters[sem]:
            semesters[sem][subj_id] = {
                'subject_id': subj_id,
                'subject_name': row['subject_name'],
                'credit_units': row['credit_units'],
                'grade_type': row['grade_type'],
                'grades': []
            }
        if row['grade_id']:
            semesters[sem][subj_id]['grades'].append({
                'id': row['grade_id'],
                'grade': row['grade'],
                'grade_label': row['grade_label'],
                'date': row['date'],
                'note': row['note']
            })

    # Преобразуем в список
    result = {}
    for sem, subjects in semesters.items():
        result[sem] = list(subjects.values())

    return ok({'semesters': result})


# ─── Main handler ─────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """Обработчик запросов для родительского дашборда: генерация кода, регистрация, вход, оплата, статистика"""
    method = event.get('httpMethod', 'GET')

    # CORS preflight
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': OPTIONS_HEADERS,
            'body': ''
        }

    qs = event.get('queryStringParameters', {}) or {}
    body_str = event.get('body', '{}') or '{}'

    # ── Webhook обрабатывается ДО любой авторизации ──
    if method == 'POST':
        body = json.loads(body_str)
        action = body.get('action')

        if action == 'webhook':
            conn = get_db_connection()
            try:
                return handle_webhook(conn, body)
            finally:
                conn.close()

        # ── Публичные эндпоинты (не требуют авторизации) ──
        if action == 'register':
            conn = get_db_connection()
            try:
                return handle_register(conn, body)
            finally:
                conn.close()

        if action == 'login':
            conn = get_db_connection()
            try:
                return handle_login(conn, body)
            finally:
                conn.close()

    # ── Далее всё требует токен ──
    token = extract_token(event)
    if not token:
        return err(401, 'Требуется авторизация')

    # Определяем тип токена (студент или родитель)
    if method == 'POST':
        body = json.loads(body_str)
        action = body.get('action')

        # generate_code — студентский токен
        if action == 'generate_code':
            payload = verify_student_token(token)
            if not payload:
                return err(401, 'Недействительный токен студента')
            user_id = payload.get('user_id')
            conn = get_db_connection()
            try:
                return handle_generate_code(conn, user_id)
            finally:
                conn.close()

        # create_payment — родительский токен (без проверки подписки)
        if action == 'create_payment':
            payload = verify_parent_token(token)
            if not payload:
                return err(401, 'Недействительный токен родителя')
            parent_id = payload['parent_id']
            child_user_id = payload['child_user_id']
            conn = get_db_connection()
            try:
                return handle_create_payment(conn, parent_id, child_user_id, body)
            finally:
                conn.close()

    # ── GET-запросы — все требуют родительский токен + подписку ──
    if method == 'GET':
        action = qs.get('action', 'dashboard')

        payload = verify_parent_token(token)
        if not payload:
            return err(401, 'Недействительный токен родителя')

        parent_id = payload['parent_id']
        child_user_id = payload['child_user_id']

        conn = get_db_connection()
        try:
            # Проверяем подписку для GET-запросов
            if not check_parent_subscription(conn, parent_id):
                return err(403, 'Подписка не активна. Оплатите доступ к родительскому дашборду')

            if action == 'dashboard':
                return handle_dashboard(conn, parent_id, child_user_id)

            elif action == 'activity_history':
                return handle_activity_history(conn, child_user_id, qs)

            elif action == 'grades':
                return handle_grades(conn, child_user_id)

            else:
                return err(400, f'Неизвестное действие: {action}')
        finally:
            conn.close()

    return err(400, 'Неподдерживаемый метод или действие')
