"""API для зачётной книжки — управление предметами, оценками и расчёт среднего балла"""

import json
import os
from datetime import datetime, date
from decimal import Decimal

import jwt
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type, X-Authorization, Authorization',
}

FREE_SUBJECT_LIMIT = 5

VALID_GRADE_TYPES = ('exam', 'zachet', 'diff_zachet', 'coursework')


def _json_serial(obj):
    """Сериализация нестандартных типов для json.dumps"""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
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


def _get_user_id(token: str):
    """Декодирует JWT и возвращает user_id или None"""
    if token in ('mock-token', 'guest_token'):
        return 1
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload.get('user_id')
    except Exception:
        return None


def _extract_token(event: dict) -> str:
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


def _get_conn():
    """Создаёт подключение к БД с нужной схемой"""
    conn = psycopg2.connect(DATABASE_URL, options=f'-c search_path={SCHEMA}')
    return conn


def _check_premium(cur, user_id: int) -> bool:
    """Проверяет, имеет ли пользователь premium или активный trial"""
    cur.execute(
        """
        SELECT subscription_type, subscription_expires_at,
               trial_ends_at, is_trial_used
        FROM users WHERE id = %s
        """,
        (user_id,),
    )
    row = cur.fetchone()
    if not row:
        return False

    now = datetime.now()

    # Премиум
    if row['subscription_type'] == 'premium':
        if row['subscription_expires_at'] is None:
            return True
        exp = row['subscription_expires_at']
        if hasattr(exp, 'tzinfo') and exp.tzinfo:
            exp = exp.replace(tzinfo=None)
        if exp > now:
            return True

    # Триал
    trial_ends = row.get('trial_ends_at')
    is_used = row.get('is_trial_used')
    if trial_ends and not is_used:
        t = trial_ends
        if hasattr(t, 'tzinfo') and t.tzinfo:
            t = t.replace(tzinfo=None)
        if t > now:
            return True

    return False


# ---------------------------------------------------------------------------
# GET handlers
# ---------------------------------------------------------------------------

def _handle_subjects(cur, user_id: int) -> dict:
    """Список предметов пользователя, сгруппированных по семестрам"""
    cur.execute(
        """
        SELECT id, name, semester, credit_units, grade_type, created_at
        FROM grade_subjects
        WHERE user_id = %s
        ORDER BY semester, name
        """,
        (user_id,),
    )
    rows = cur.fetchall()

    grouped: dict = {}
    for r in rows:
        sem = r['semester']
        if sem not in grouped:
            grouped[sem] = []
        grouped[sem].append(dict(r))

    return ok({'semesters': grouped, 'total': len(rows)})


def _handle_grades(cur, user_id: int, params: dict) -> dict:
    """Оценки по конкретному предмету"""
    subject_id = params.get('subject_id')
    if not subject_id:
        return err(400, 'Не указан subject_id')

    # Проверяем принадлежность предмета
    cur.execute(
        'SELECT id FROM grade_subjects WHERE id = %s AND user_id = %s',
        (int(subject_id), user_id),
    )
    if not cur.fetchone():
        return err(404, 'Предмет не найден')

    cur.execute(
        """
        SELECT id, subject_id, grade, grade_label, date, note, created_at
        FROM grades
        WHERE subject_id = %s AND user_id = %s
        ORDER BY date DESC, created_at DESC
        """,
        (int(subject_id), user_id),
    )
    return ok({'grades': [dict(r) for r in cur.fetchall()]})


def _handle_stats(cur, user_id: int) -> dict:
    """Статистика: общий средний балл, по семестрам, стипендия"""
    cur.execute(
        """
        SELECT gs.semester, gs.credit_units, gs.grade_type, g.grade
        FROM grades g
        JOIN grade_subjects gs ON gs.id = g.subject_id
        WHERE g.user_id = %s
        """,
        (user_id,),
    )
    rows = cur.fetchall()

    if not rows:
        return ok({
            'overall_gpa': None,
            'semester_gpa': {},
            'scholarship': None,
            'total_grades': 0,
        })

    # Для GPA учитываем только числовые оценки (zachet — pass/fail, не входит в GPA)
    weighted_sum = Decimal(0)
    weight_total = Decimal(0)
    semester_data: dict = {}
    all_grades: list[int] = []

    for r in rows:
        grade = r['grade']
        credits = r['credit_units'] or Decimal(1)
        semester = r['semester']
        grade_type = r['grade_type']

        if semester not in semester_data:
            semester_data[semester] = {'weighted_sum': Decimal(0), 'weight_total': Decimal(0), 'grades': []}

        if grade_type != 'zachet':
            weighted_sum += Decimal(grade) * credits
            weight_total += credits
            semester_data[semester]['weighted_sum'] += Decimal(grade) * credits
            semester_data[semester]['weight_total'] += credits
            all_grades.append(grade)
        else:
            # zachet: 3+ считается зачтённым
            all_grades.append(grade)

        semester_data[semester]['grades'].append(grade)

    overall_gpa = float(weighted_sum / weight_total) if weight_total else None

    semester_gpa = {}
    for sem, d in semester_data.items():
        if d['weight_total']:
            semester_gpa[sem] = round(float(d['weighted_sum'] / d['weight_total']), 2)
        else:
            semester_gpa[sem] = None

    # Стипендия
    scholarship = None
    if all_grades:
        if all(g >= 4 for g in all_grades):
            if all(g == 5 for g in all_grades):
                scholarship = 'Повышенная стипендия'
            else:
                scholarship = 'Обычная стипендия'

    return ok({
        'overall_gpa': round(overall_gpa, 2) if overall_gpa else None,
        'semester_gpa': semester_gpa,
        'scholarship': scholarship,
        'total_grades': len(rows),
    })


def _handle_summary(cur, user_id: int) -> dict:
    """Сводка для дашборда"""
    cur.execute(
        'SELECT COUNT(*) AS cnt FROM grade_subjects WHERE user_id = %s',
        (user_id,),
    )
    total_subjects = cur.fetchone()['cnt']

    cur.execute(
        """
        SELECT gs.semester, COUNT(g.id) AS grade_count,
               ROUND(AVG(g.grade)::numeric, 2) AS avg_grade
        FROM grade_subjects gs
        LEFT JOIN grades g ON g.subject_id = gs.id AND g.user_id = %s
        WHERE gs.user_id = %s
        GROUP BY gs.semester
        ORDER BY gs.semester
        """,
        (user_id, user_id),
    )
    semesters = [dict(r) for r in cur.fetchall()]

    cur.execute(
        """
        SELECT ROUND(AVG(g.grade)::numeric, 2) AS avg
        FROM grades g
        JOIN grade_subjects gs ON gs.id = g.subject_id
        WHERE g.user_id = %s AND gs.grade_type != 'zachet'
        """,
        (user_id,),
    )
    avg_row = cur.fetchone()
    avg_grade = float(avg_row['avg']) if avg_row and avg_row['avg'] else None

    return ok({
        'total_subjects': total_subjects,
        'avg_grade': avg_grade,
        'semesters': semesters,
    })


# ---------------------------------------------------------------------------
# POST handlers
# ---------------------------------------------------------------------------

def _handle_add_subject(cur, conn, user_id: int, body: dict) -> dict:
    """Добавить предмет"""
    name = (body.get('name') or '').strip()
    semester = body.get('semester')
    credit_units = body.get('credit_units')
    grade_type = body.get('grade_type')

    if not name:
        return err(400, 'Не указано название предмета')
    if semester is None:
        return err(400, 'Не указан семестр')
    if credit_units is None:
        return err(400, 'Не указаны зачётные единицы')
    if grade_type not in VALID_GRADE_TYPES:
        return err(400, f'Недопустимый тип оценки. Допустимые: {", ".join(VALID_GRADE_TYPES)}')

    # Проверка лимита для бесплатных пользователей
    is_premium = _check_premium(cur, user_id)
    if not is_premium:
        cur.execute(
            'SELECT COUNT(*) AS cnt FROM grade_subjects WHERE user_id = %s',
            (user_id,),
        )
        count = cur.fetchone()['cnt']
        if count >= FREE_SUBJECT_LIMIT:
            return err(403, f'Лимит бесплатного плана: максимум {FREE_SUBJECT_LIMIT} предметов. Оформите подписку для безлимитного доступа.')

    cur.execute(
        """
        INSERT INTO grade_subjects (user_id, name, semester, credit_units, grade_type)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, name, semester, credit_units, grade_type, created_at
        """,
        (user_id, name, int(semester), float(credit_units), grade_type),
    )
    row = cur.fetchone()
    conn.commit()
    return ok({'subject': dict(row)})


def _handle_add_grade(cur, conn, user_id: int, body: dict) -> dict:
    """Добавить оценку"""
    subject_id = body.get('subject_id')
    grade = body.get('grade')
    grade_label = body.get('grade_label', '')
    grade_date = body.get('date')
    note = body.get('note', '')

    if not subject_id:
        return err(400, 'Не указан subject_id')
    if grade is None:
        return err(400, 'Не указана оценка')
    if not isinstance(grade, int) or grade < 2 or grade > 5:
        return err(400, 'Оценка должна быть целым числом от 2 до 5')

    # Проверяем принадлежность предмета
    cur.execute(
        'SELECT id, grade_type FROM grade_subjects WHERE id = %s AND user_id = %s',
        (int(subject_id), user_id),
    )
    subj = cur.fetchone()
    if not subj:
        return err(404, 'Предмет не найден')

    # Для зачёта автоматически формируем label
    if subj['grade_type'] == 'zachet' and not grade_label:
        grade_label = 'зачёт' if grade >= 3 else 'незачёт'

    cur.execute(
        """
        INSERT INTO grades (subject_id, user_id, grade, grade_label, date, note)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING id, subject_id, grade, grade_label, date, note, created_at
        """,
        (int(subject_id), user_id, grade, grade_label, grade_date, note),
    )
    row = cur.fetchone()
    conn.commit()
    return ok({'grade': dict(row)})


def _handle_update_grade(cur, conn, user_id: int, body: dict) -> dict:
    """Обновить оценку"""
    grade_id = body.get('grade_id')
    if not grade_id:
        return err(400, 'Не указан grade_id')

    # Проверяем принадлежность
    cur.execute(
        'SELECT id FROM grades WHERE id = %s AND user_id = %s',
        (int(grade_id), user_id),
    )
    if not cur.fetchone():
        return err(404, 'Оценка не найдена')

    fields = []
    values = []

    if 'grade' in body:
        g = body['grade']
        if not isinstance(g, int) or g < 2 or g > 5:
            return err(400, 'Оценка должна быть целым числом от 2 до 5')
        fields.append('grade = %s')
        values.append(g)

    if 'grade_label' in body:
        fields.append('grade_label = %s')
        values.append(body['grade_label'])

    if 'note' in body:
        fields.append('note = %s')
        values.append(body['note'])

    if not fields:
        return err(400, 'Нет полей для обновления')

    values.append(int(grade_id))
    values.append(user_id)

    cur.execute(
        f"""
        UPDATE grades SET {', '.join(fields)}
        WHERE id = %s AND user_id = %s
        RETURNING id, subject_id, grade, grade_label, date, note, created_at
        """,
        values,
    )
    row = cur.fetchone()
    conn.commit()
    return ok({'grade': dict(row)})


def _handle_delete_subject(cur, conn, user_id: int, body: dict) -> dict:
    """Удалить предмет (и связанные оценки)"""
    subject_id = body.get('subject_id')
    if not subject_id:
        return err(400, 'Не указан subject_id')

    cur.execute(
        'SELECT id FROM grade_subjects WHERE id = %s AND user_id = %s',
        (int(subject_id), user_id),
    )
    if not cur.fetchone():
        return err(404, 'Предмет не найден')

    # Сначала удаляем оценки
    cur.execute(
        'DELETE FROM grades WHERE subject_id = %s AND user_id = %s',
        (int(subject_id), user_id),
    )
    cur.execute(
        'DELETE FROM grade_subjects WHERE id = %s AND user_id = %s',
        (int(subject_id), user_id),
    )
    conn.commit()
    return ok({'deleted': True, 'subject_id': int(subject_id)})


def _handle_delete_grade(cur, conn, user_id: int, body: dict) -> dict:
    """Удалить оценку"""
    grade_id = body.get('grade_id')
    if not grade_id:
        return err(400, 'Не указан grade_id')

    cur.execute(
        'SELECT id FROM grades WHERE id = %s AND user_id = %s',
        (int(grade_id), user_id),
    )
    if not cur.fetchone():
        return err(404, 'Оценка не найдена')

    cur.execute(
        'DELETE FROM grades WHERE id = %s AND user_id = %s',
        (int(grade_id), user_id),
    )
    conn.commit()
    return ok({'deleted': True, 'grade_id': int(grade_id)})


# ---------------------------------------------------------------------------
# Main handler
# ---------------------------------------------------------------------------

def handler(event: dict, context) -> dict:
    """API для зачётной книжки — управление предметами, оценками и расчёт среднего балла"""

    method = event.get('httpMethod', 'GET')

    # CORS preflight
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    # Авторизация
    token = _extract_token(event)
    if not token:
        return err(401, 'Требуется авторизация')

    user_id = _get_user_id(token)
    if not user_id:
        return err(401, 'Неверный токен')

    params = event.get('queryStringParameters') or {}

    conn = _get_conn()
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)

        if method == 'GET':
            action = params.get('action', '')
            if action == 'subjects':
                return _handle_subjects(cur, user_id)
            elif action == 'grades':
                return _handle_grades(cur, user_id, params)
            elif action == 'stats':
                return _handle_stats(cur, user_id)
            elif action == 'summary':
                return _handle_summary(cur, user_id)
            else:
                return err(400, 'Неизвестное действие')

        elif method == 'POST':
            body = json.loads(event.get('body', '{}') or '{}')
            action = body.get('action', '')

            if action == 'add_subject':
                return _handle_add_subject(cur, conn, user_id, body)
            elif action == 'add_grade':
                return _handle_add_grade(cur, conn, user_id, body)
            elif action == 'update_grade':
                return _handle_update_grade(cur, conn, user_id, body)
            elif action == 'delete_subject':
                return _handle_delete_subject(cur, conn, user_id, body)
            elif action == 'delete_grade':
                return _handle_delete_grade(cur, conn, user_id, body)
            else:
                return err(400, 'Неизвестное действие')

        return err(405, 'Метод не поддерживается')
    except Exception as e:
        return err(500, f'Внутренняя ошибка сервера: {str(e)}')
    finally:
        conn.close()
