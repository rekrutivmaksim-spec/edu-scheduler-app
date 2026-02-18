"""API для учебных групп одногруппников"""

import json
import os
import random
import string
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt


def get_db():
    dsn = os.environ['DATABASE_URL']
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    return psycopg2.connect(dsn, options=f'-c search_path={schema}')


def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, os.environ['JWT_SECRET'], algorithms=['HS256'])
    except:
        return None


def gen_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))


def handler(event: dict, context) -> dict:
    """API для создания и управления учебными группами"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
            },
            'body': ''
        }

    headers = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}

    auth_header = event.get('headers', {}).get('X-Authorization', '')
    token = auth_header.replace('Bearer ', '')
    if not token:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Требуется авторизация'})}

    payload = verify_token(token)
    if not payload:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Недействительный токен'})}

    user_id = payload['user_id']
    action = event.get('queryStringParameters', {}).get('action', '')

    conn = get_db()
    try:
        if method == 'GET':
            if action == 'my_groups':
                return get_my_groups(conn, user_id, headers)
            elif action == 'group_detail':
                group_id = int(event.get('queryStringParameters', {}).get('group_id', 0))
                return get_group_detail(conn, user_id, group_id, headers)
            elif action == 'group_schedule':
                group_id = int(event.get('queryStringParameters', {}).get('group_id', 0))
                return get_group_schedule(conn, user_id, group_id, headers)
            elif action == 'group_tasks':
                group_id = int(event.get('queryStringParameters', {}).get('group_id', 0))
                return get_group_tasks(conn, user_id, group_id, headers)

        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            act = body.get('action', '')

            if act == 'create_group':
                return create_group(conn, user_id, body, headers)
            elif act == 'join_group':
                return join_group(conn, user_id, body.get('invite_code', ''), headers)
            elif act == 'leave_group':
                return leave_group(conn, user_id, body.get('group_id'), headers)
            elif act == 'add_schedule':
                return add_group_schedule(conn, user_id, body, headers)
            elif act == 'add_task':
                return add_group_task(conn, user_id, body, headers)
            elif act == 'import_schedule':
                return import_group_schedule(conn, user_id, body.get('group_id'), headers)

        elif method == 'DELETE':
            if action == 'schedule':
                item_id = int(event.get('queryStringParameters', {}).get('id', 0))
                group_id = int(event.get('queryStringParameters', {}).get('group_id', 0))
                return delete_group_schedule(conn, user_id, group_id, item_id, headers)
            elif action == 'task':
                item_id = int(event.get('queryStringParameters', {}).get('id', 0))
                group_id = int(event.get('queryStringParameters', {}).get('group_id', 0))
                return delete_group_task(conn, user_id, group_id, item_id, headers)
            elif action == 'group':
                group_id = int(event.get('queryStringParameters', {}).get('group_id', 0))
                return delete_group(conn, user_id, group_id, headers)

        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Неизвестное действие'})}
    finally:
        conn.close()


def is_member(conn, user_id, group_id):
    with conn.cursor() as cur:
        cur.execute("SELECT role FROM study_group_members WHERE group_id = %s AND user_id = %s", (group_id, user_id))
        row = cur.fetchone()
        return row[0] if row else None


def get_my_groups(conn, user_id, headers):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT g.id, g.name, g.description, g.invite_code, g.university, g.faculty, g.course,
                   m.role, g.created_at,
                   (SELECT COUNT(*) FROM study_group_members WHERE group_id = g.id) as member_count
            FROM study_groups g
            JOIN study_group_members m ON g.id = m.group_id AND m.user_id = %s
            ORDER BY m.joined_at DESC
        """, (user_id,))
        groups = cur.fetchall()
        return {
            'statusCode': 200, 'headers': headers,
            'body': json.dumps({'groups': [dict(g) for g in groups]}, default=str)
        }


def get_group_detail(conn, user_id, group_id, headers):
    role = is_member(conn, user_id, group_id)
    if not role:
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Вы не в этой группе'})}

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT g.*, (SELECT COUNT(*) FROM study_group_members WHERE group_id = g.id) as member_count
            FROM study_groups g WHERE g.id = %s
        """, (group_id,))
        group = cur.fetchone()

        cur.execute("""
            SELECT m.user_id, m.role, m.joined_at, u.full_name, u.university
            FROM study_group_members m
            JOIN users u ON m.user_id = u.id
            WHERE m.group_id = %s
            ORDER BY m.role DESC, m.joined_at
        """, (group_id,))
        members = cur.fetchall()

        return {
            'statusCode': 200, 'headers': headers,
            'body': json.dumps({
                'group': dict(group),
                'members': [dict(m) for m in members],
                'my_role': role
            }, default=str)
        }


def get_group_schedule(conn, user_id, group_id, headers):
    role = is_member(conn, user_id, group_id)
    if not role:
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Вы не в этой группе'})}

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT gs.*, u.full_name as created_by_name
            FROM group_schedule gs
            JOIN users u ON gs.created_by = u.id
            WHERE gs.group_id = %s
            ORDER BY gs.day_of_week, gs.start_time
        """, (group_id,))
        schedule = cur.fetchall()
        return {
            'statusCode': 200, 'headers': headers,
            'body': json.dumps({'schedule': [dict(s) for s in schedule]}, default=str)
        }


def get_group_tasks(conn, user_id, group_id, headers):
    role = is_member(conn, user_id, group_id)
    if not role:
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Вы не в этой группе'})}

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT gt.*, u.full_name as created_by_name
            FROM group_tasks gt
            JOIN users u ON gt.created_by = u.id
            WHERE gt.group_id = %s
            ORDER BY gt.deadline ASC NULLS LAST, gt.created_at DESC
        """, (group_id,))
        tasks = cur.fetchall()
        return {
            'statusCode': 200, 'headers': headers,
            'body': json.dumps({'tasks': [dict(t) for t in tasks]}, default=str)
        }


def create_group(conn, user_id, body, headers):
    name = body.get('name', '').strip()
    if not name:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Название группы обязательно'})}

    invite_code = gen_code()

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO study_groups (name, description, invite_code, owner_id, university, faculty, course)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id, name, invite_code
        """, (
            name,
            body.get('description', ''),
            invite_code,
            user_id,
            body.get('university'),
            body.get('faculty'),
            body.get('course')
        ))
        group = cur.fetchone()

        cur.execute("""
            INSERT INTO study_group_members (group_id, user_id, role)
            VALUES (%s, %s, 'owner')
        """, (group['id'], user_id))

        conn.commit()
        return {
            'statusCode': 201, 'headers': headers,
            'body': json.dumps({'group': dict(group), 'message': f'Группа создана! Код: {invite_code}'}, default=str)
        }


def join_group(conn, user_id, invite_code, headers):
    if not invite_code:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Укажите код приглашения'})}

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id, name, max_members FROM study_groups WHERE invite_code = %s", (invite_code.upper(),))
        group = cur.fetchone()
        if not group:
            return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Группа не найдена'})}

        existing = is_member(conn, user_id, group['id'])
        if existing:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Вы уже в этой группе'})}

        cur.execute("SELECT COUNT(*) as cnt FROM study_group_members WHERE group_id = %s", (group['id'],))
        cnt = cur.fetchone()['cnt']
        if cnt >= group['max_members']:
            return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Группа заполнена'})}

        cur.execute("""
            INSERT INTO study_group_members (group_id, user_id, role)
            VALUES (%s, %s, 'member')
        """, (group['id'], user_id))

        conn.commit()
        return {
            'statusCode': 200, 'headers': headers,
            'body': json.dumps({'message': f'Вы вступили в группу «{group["name"]}»'})
        }


def leave_group(conn, user_id, group_id, headers):
    with conn.cursor() as cur:
        cur.execute("SELECT role FROM study_group_members WHERE group_id = %s AND user_id = %s", (group_id, user_id))
        row = cur.fetchone()
        if not row:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Вы не в этой группе'})}
        if row[0] == 'owner':
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Владелец не может покинуть группу. Удалите её.'})}

        cur.execute("DELETE FROM study_group_members WHERE group_id = %s AND user_id = %s", (group_id, user_id))
        conn.commit()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'Вы покинули группу'})}


def add_group_schedule(conn, user_id, body, headers):
    group_id = body.get('group_id')
    role = is_member(conn, user_id, group_id)
    if not role:
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Вы не в этой группе'})}

    week_type = body.get('week_type', 'every')
    if week_type not in ('every', 'even', 'odd'):
        week_type = 'every'

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO group_schedule (group_id, subject, type, start_time, end_time, day_of_week, week_type, room, teacher, color, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            group_id,
            body.get('subject'),
            body.get('type', 'lecture'),
            body.get('start_time'),
            body.get('end_time'),
            body.get('day_of_week'),
            week_type,
            body.get('room'),
            body.get('teacher'),
            body.get('color', 'bg-blue-500'),
            user_id
        ))
        item = cur.fetchone()
        conn.commit()
        return {'statusCode': 201, 'headers': headers, 'body': json.dumps({'lesson': dict(item)}, default=str)}


def add_group_task(conn, user_id, body, headers):
    group_id = body.get('group_id')
    role = is_member(conn, user_id, group_id)
    if not role:
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Вы не в этой группе'})}

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            INSERT INTO group_tasks (group_id, title, description, subject, deadline, priority, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (
            group_id,
            body.get('title'),
            body.get('description'),
            body.get('subject'),
            body.get('deadline'),
            body.get('priority', 'medium'),
            user_id
        ))
        task = cur.fetchone()
        conn.commit()
        return {'statusCode': 201, 'headers': headers, 'body': json.dumps({'task': dict(task)}, default=str)}


def import_group_schedule(conn, user_id, group_id, headers):
    role = is_member(conn, user_id, group_id)
    if not role:
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Вы не в этой группе'})}

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT subject, type, start_time, end_time, day_of_week, week_type, room, teacher, color FROM group_schedule WHERE group_id = %s", (group_id,))
        group_lessons = cur.fetchall()

        imported = 0
        for gl in group_lessons:
            cur.execute("""
                SELECT 1 FROM schedule
                WHERE user_id = %s AND subject = %s AND day_of_week = %s AND start_time = %s AND week_type = %s
                LIMIT 1
            """, (user_id, gl['subject'], gl['day_of_week'], gl['start_time'], gl['week_type']))
            if not cur.fetchone():
                cur.execute("""
                    INSERT INTO schedule (user_id, subject, type, start_time, end_time, day_of_week, week_type, room, teacher, color)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (user_id, gl['subject'], gl['type'], gl['start_time'], gl['end_time'], gl['day_of_week'], gl['week_type'], gl['room'], gl['teacher'], gl['color']))
                imported += 1

        conn.commit()
        return {
            'statusCode': 200, 'headers': headers,
            'body': json.dumps({'message': f'Импортировано {imported} занятий', 'imported': imported})
        }


def delete_group_schedule(conn, user_id, group_id, item_id, headers):
    role = is_member(conn, user_id, group_id)
    if role not in ('owner', 'admin'):
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Нет прав'})}

    with conn.cursor() as cur:
        cur.execute("DELETE FROM group_schedule WHERE id = %s AND group_id = %s", (item_id, group_id))
        conn.commit()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'Удалено'})}


def delete_group_task(conn, user_id, group_id, item_id, headers):
    role = is_member(conn, user_id, group_id)
    if role not in ('owner', 'admin'):
        return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Нет прав'})}

    with conn.cursor() as cur:
        cur.execute("DELETE FROM group_tasks WHERE id = %s AND group_id = %s", (item_id, group_id))
        conn.commit()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'Удалено'})}


def delete_group(conn, user_id, group_id, headers):
    with conn.cursor() as cur:
        cur.execute("SELECT owner_id FROM study_groups WHERE id = %s", (group_id,))
        row = cur.fetchone()
        if not row or row[0] != user_id:
            return {'statusCode': 403, 'headers': headers, 'body': json.dumps({'error': 'Только владелец может удалить группу'})}

        cur.execute("DELETE FROM group_tasks WHERE group_id = %s", (group_id,))
        cur.execute("DELETE FROM group_schedule WHERE group_id = %s", (group_id,))
        cur.execute("DELETE FROM study_group_members WHERE group_id = %s", (group_id,))
        cur.execute("DELETE FROM study_groups WHERE id = %s", (group_id,))
        conn.commit()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'message': 'Группа удалена'})}
