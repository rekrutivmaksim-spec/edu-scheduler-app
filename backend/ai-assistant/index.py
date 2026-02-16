import json
import os
import jwt
import psycopg2
import hashlib
from datetime import datetime, timedelta
from openai import OpenAI

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
ARTEMOX_API_KEY = os.environ.get('ARTEMOX_API_KEY', 'sk-Z7PQzAcoYmPrv3O7x4ZkyQ')

client = OpenAI(
    api_key=ARTEMOX_API_KEY,
    base_url='https://api.artemox.com/v1',
    timeout=20.0
)

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

def ok(body: dict) -> dict:
    return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': json.dumps(body, ensure_ascii=False)}

def err(status: int, body: dict) -> dict:
    return {'statusCode': status, 'headers': CORS_HEADERS, 'body': json.dumps(body, ensure_ascii=False)}

def get_user_id(token: str):
    if token in ('mock-token', 'guest_token'):
        return 1
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload['user_id']
    except Exception:
        return None

def check_access(conn, user_id: int) -> dict:
    """Проверка доступа с учетом подписки/триала/free"""
    cur = conn.cursor()
    cur.execute(f'''
        SELECT subscription_type, subscription_expires_at, subscription_plan,
               ai_questions_used, ai_questions_limit,
               trial_ends_at, is_trial_used,
               daily_questions_used, daily_questions_reset_at, bonus_questions
        FROM {SCHEMA_NAME}.users WHERE id = %s
    ''', (user_id,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return {'has_access': False, 'reason': 'user_not_found'}

    (sub_type, expires_at, sub_plan, q_used, q_limit,
     trial_ends, trial_used, daily_used, daily_reset, bonus) = row
    now = datetime.now()
    q_used = q_used or 0
    daily_used = daily_used or 0
    bonus = bonus or 0

    limits = {'1month': 40, '3months': 120, '6months': 260}
    expected = limits.get(sub_plan, 40)
    if q_limit != expected:
        cur2 = conn.cursor()
        cur2.execute(f'UPDATE {SCHEMA_NAME}.users SET ai_questions_limit=%s WHERE id=%s', (expected, user_id))
        conn.commit()
        cur2.close()
        q_limit = expected

    if sub_type == 'premium' and expires_at and expires_at > now:
        if q_used >= q_limit:
            return {'has_access': False, 'reason': 'limit', 'used': q_used, 'limit': q_limit}
        return {'has_access': True, 'is_premium': True, 'used': q_used, 'limit': q_limit, 'remaining': q_limit - q_used}

    if trial_ends and not trial_used and trial_ends > now:
        return {'has_access': True, 'is_trial': True, 'used': q_used, 'limit': 999, 'remaining': 999}

    if daily_reset and daily_reset < now:
        cur2 = conn.cursor()
        cur2.execute(f'UPDATE {SCHEMA_NAME}.users SET daily_questions_used=0, daily_questions_reset_at=%s WHERE id=%s',
                     (now + timedelta(days=1), user_id))
        conn.commit()
        cur2.close()
        daily_used = 0

    total = 3 + bonus
    if daily_used >= total:
        return {'has_access': False, 'reason': 'limit', 'used': daily_used, 'limit': total, 'is_free': True}
    return {'has_access': True, 'is_free': True, 'used': daily_used, 'limit': total, 'remaining': total - daily_used}

def increment_questions(conn, user_id: int):
    cur = conn.cursor()
    cur.execute(f'''
        SELECT subscription_type, subscription_expires_at, trial_ends_at, is_trial_used,
               daily_questions_used, bonus_questions
        FROM {SCHEMA_NAME}.users WHERE id=%s
    ''', (user_id,))
    u = cur.fetchone()
    now = datetime.now()
    if u:
        sub_type, expires, trial_ends, trial_used, daily_used, bonus = u
        daily_used = daily_used or 0
        bonus = bonus or 0
        is_premium = sub_type == 'premium' and expires and expires > now
        is_trial = trial_ends and not trial_used and trial_ends > now
        if is_premium or is_trial:
            cur.execute(f'UPDATE {SCHEMA_NAME}.users SET ai_questions_used=COALESCE(ai_questions_used,0)+1 WHERE id=%s', (user_id,))
        elif daily_used < 3:
            cur.execute(f'UPDATE {SCHEMA_NAME}.users SET daily_questions_used=COALESCE(daily_questions_used,0)+1, daily_questions_reset_at=COALESCE(daily_questions_reset_at,%s) WHERE id=%s',
                        (now + timedelta(days=1), user_id))
        elif bonus > 0:
            cur.execute(f'UPDATE {SCHEMA_NAME}.users SET daily_questions_used=COALESCE(daily_questions_used,0)+1, bonus_questions=bonus_questions-1, daily_questions_reset_at=COALESCE(daily_questions_reset_at,%s) WHERE id=%s AND bonus_questions>0',
                        (now + timedelta(days=1), user_id))
    conn.commit()
    cur.close()

def get_cache(conn, question, material_ids):
    h = hashlib.md5(f"{question.lower().strip()}:{sorted(material_ids)}".encode()).hexdigest()
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT answer FROM {SCHEMA_NAME}.ai_question_cache WHERE question_hash=%s AND last_used_at > CURRENT_TIMESTAMP - INTERVAL '30 days'", (h,))
        row = cur.fetchone()
        if row:
            cur.execute(f"UPDATE {SCHEMA_NAME}.ai_question_cache SET hit_count=hit_count+1, last_used_at=CURRENT_TIMESTAMP WHERE question_hash=%s", (h,))
            conn.commit()
            cur.close()
            return row[0]
    except Exception:
        pass
    cur.close()
    return None

def set_cache(conn, question, material_ids, answer, tokens):
    h = hashlib.md5(f"{question.lower().strip()}:{sorted(material_ids)}".encode()).hexdigest()
    cur = conn.cursor()
    try:
        cur.execute(f'''
            INSERT INTO {SCHEMA_NAME}.ai_question_cache (question_hash, question_text, answer, material_ids, tokens_used)
            VALUES (%s,%s,%s,%s,%s)
            ON CONFLICT (question_hash) DO UPDATE SET answer=EXCLUDED.answer, tokens_used=EXCLUDED.tokens_used,
            hit_count={SCHEMA_NAME}.ai_question_cache.hit_count+1, last_used_at=CURRENT_TIMESTAMP
        ''', (h, question[:500], answer, material_ids or [], tokens))
        conn.commit()
    except Exception:
        pass
    cur.close()

def get_session(conn, user_id):
    cur = conn.cursor()
    try:
        cur.execute(f"SELECT id FROM {SCHEMA_NAME}.chat_sessions WHERE user_id=%s AND updated_at > CURRENT_TIMESTAMP - INTERVAL '24 hours' ORDER BY updated_at DESC LIMIT 1", (user_id,))
        row = cur.fetchone()
        if row:
            cur.close()
            return row[0]
        cur.execute(f"INSERT INTO {SCHEMA_NAME}.chat_sessions (user_id, title) VALUES (%s, %s) RETURNING id", (user_id, 'Новый чат'))
        sid = cur.fetchone()[0]
        conn.commit()
        cur.close()
        return sid
    except Exception:
        cur.close()
        return None

def save_msg(conn, sid, uid, role, content, mids=None, tokens=0, cached=False):
    if not sid:
        return
    cur = conn.cursor()
    try:
        cur.execute(f"INSERT INTO {SCHEMA_NAME}.chat_messages (session_id,user_id,role,content,material_ids,tokens_used,was_cached) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                    (sid, uid, role, content, mids or [], tokens, cached))
        cur.execute(f"UPDATE {SCHEMA_NAME}.chat_sessions SET message_count=message_count+1, updated_at=CURRENT_TIMESTAMP WHERE id=%s", (sid,))
        if role == 'user':
            cur.execute(f"UPDATE {SCHEMA_NAME}.chat_sessions SET title=%s WHERE id=%s AND title='Новый чат'", (content[:100], sid))
        conn.commit()
    except Exception:
        pass
    cur.close()

def get_context(conn, user_id, material_ids):
    cur = conn.cursor()
    try:
        if material_ids:
            ph = ','.join(['%s'] * len(material_ids))
            cur.execute(f"SELECT id,title,subject,recognized_text,summary,total_chunks FROM {SCHEMA_NAME}.materials WHERE user_id=%s AND id IN ({ph}) ORDER BY created_at DESC LIMIT 5", [user_id]+material_ids)
        else:
            cur.execute(f"SELECT id,title,subject,recognized_text,summary,total_chunks FROM {SCHEMA_NAME}.materials WHERE user_id=%s ORDER BY created_at DESC LIMIT 5", (user_id,))
        materials = cur.fetchall()
        if not materials:
            cur.close()
            return ""
        parts = []
        for mid, title, subject, text, summary, chunks in materials:
            parts.append(f"## {title or 'Документ'}" + (f" ({subject})" if subject else ""))
            if summary:
                parts.append(summary[:500])
            if chunks and chunks > 1:
                try:
                    cur.execute(f"SELECT chunk_text FROM {SCHEMA_NAME}.document_chunks WHERE material_id=%s ORDER BY chunk_index LIMIT 2", (mid,))
                    for c in cur.fetchall():
                        if c[0]:
                            parts.append(c[0][:1500])
                except Exception:
                    if text:
                        parts.append(text[:1500])
            elif text:
                parts.append(text[:1500])
        cur.close()
        result = "\n\n".join(parts)
        return result[:3000]
    except Exception as e:
        print(f"[AI] context error: {e}", flush=True)
        cur.close()
        return ""

def detect_action(question):
    q = question.lower()
    task_triggers = ['создай задачу', 'добавь задачу', 'задача:']
    schedule_triggers = ['добавь занятие', 'добавь пару', 'в расписание']
    if any(t in q for t in task_triggers):
        return 'task'
    if any(t in q for t in schedule_triggers):
        return 'schedule'
    return None

def parse_schedule(question):
    import re
    q = question.lower()
    days = {'понедельник':0,'пн':0,'вторник':1,'вт':1,'среда':2,'ср':2,'четверг':3,'чт':3,'пятница':4,'пт':4,'суббота':5,'сб':5,'воскресенье':6,'вс':6}
    types = {'лекция':'лекция','семинар':'семинар','практика':'практика','лаб':'лаб. работа'}
    r = {'day_of_week':None,'start_time':None,'end_time':None,'type':'лекция','room':None,'teacher':None}
    for dn, dv in days.items():
        if dn in q:
            r['day_of_week'] = dv
            break
    for tn, tv in types.items():
        if tn in q:
            r['type'] = tv
            break
    times = re.findall(r'(\d{1,2}):(\d{2})', question)
    if times:
        r['start_time'] = f"{times[0][0].zfill(2)}:{times[0][1]}"
    if len(times) >= 2:
        r['end_time'] = f"{times[1][0].zfill(2)}:{times[1][1]}"
    elif r['start_time']:
        h, m = int(times[0][0]), int(times[0][1])
        eh = h + 1
        if eh < 24:
            r['end_time'] = f"{str(eh).zfill(2)}:{str(m).zfill(2)}"
    return r

def extract_title(question, action):
    import re
    m = re.search(r'["«]([^"»]+)["»]', question)
    if m:
        return m.group(1).strip()[:200]
    m = re.search(r':\s*(.+?)(?:\s+до|\s+к|$)', question)
    if m:
        return m.group(1).strip()[:200]
    triggers = ['создай задачу','добавь задачу','задача:','добавь занятие','добавь пару','в расписание']
    q = question.lower()
    for t in triggers:
        if t in q:
            idx = q.find(t) + len(t)
            return question[idx:].strip()[:200]
    return question[:100]

def ask_ai(question, context):
    """Один запрос к ИИ с коротким промптом — укладываемся в 20 секунд"""
    has_context = bool(context and len(context) > 50)

    if has_context:
        system = f"""Ты — Studyfay, ИИ-репетитор. Отвечай на русском, по делу, дружелюбно.

МАТЕРИАЛЫ СТУДЕНТА:
{context}

ПРАВИЛА:
- Отвечай на основе материалов студента, если вопрос связан с ними
- Если в материалах нет ответа — используй свои знания
- Объясняй просто, с примерами
- Используй **жирный** для терминов, списки для структуры
- 2-4 абзаца, не лей воду"""
    else:
        system = """Ты — Studyfay, ИИ-репетитор для студентов. Отвечай на русском, по делу, дружелюбно.

ПРАВИЛА:
- Отвечай на любые учебные вопросы, используя свои знания
- Объясняй просто, с примерами и аналогиями
- Используй **жирный** для терминов, списки для структуры
- Если вопрос не учебный — всё равно помоги, но кратко
- 2-4 абзаца, не лей воду"""

    try:
        print(f"[AI] Запрос к Artemox (timeout: 20s)", flush=True)
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": question}
            ],
            temperature=0.6,
            max_tokens=900,
            timeout=20.0
        )
        answer = resp.choices[0].message.content
        tokens = resp.usage.total_tokens if resp.usage else 0
        print(f"[AI] OK, tokens: {tokens}", flush=True)
        return answer, tokens
    except Exception as e:
        print(f"[AI] ERROR: {type(e).__name__}: {e}", flush=True)
        return None, 0

def fallback_answer(question, context):
    if context and len(context) > 100:
        snippet = context[:600].strip()
        return f"Сервер ИИ временно загружен, но вот что нашлось в твоих материалах:\n\n{snippet}\n\n---\nПопробуй задать вопрос ещё раз через минуту."
    return "Сервер ИИ временно загружен. Попробуй через минуту! А пока загрузи конспекты в раздел **Материалы** — тогда я смогу отвечать точнее."

def handler(event: dict, context) -> dict:
    """ИИ-ассистент Studyfay: отвечает на вопросы студентов"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    token = event.get('headers', {}).get('X-Authorization', '').replace('Bearer ', '')
    user_id = get_user_id(token)
    if not user_id:
        return err(401, {'error': 'Unauthorized'})

    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True

        if method == 'GET':
            action = (event.get('queryStringParameters') or {}).get('action', 'sessions')

            if action == 'sessions':
                cur = conn.cursor()
                cur.execute(f"SELECT id,title,created_at,updated_at,message_count FROM {SCHEMA_NAME}.chat_sessions WHERE user_id=%s ORDER BY updated_at DESC LIMIT 50", (user_id,))
                sessions = [{'id':r[0],'title':r[1],'created_at':r[2].isoformat() if r[2] else None,'updated_at':r[3].isoformat() if r[3] else None,'message_count':r[4]} for r in cur.fetchall()]
                cur.close()
                return ok({'sessions': sessions})

            elif action == 'messages':
                sid = (event.get('queryStringParameters') or {}).get('session_id')
                if not sid:
                    return err(400, {'error': 'session_id required'})
                cur = conn.cursor()
                cur.execute(f"SELECT role,content,created_at FROM {SCHEMA_NAME}.chat_messages WHERE session_id=%s AND user_id=%s ORDER BY created_at ASC LIMIT 200", (sid, user_id))
                msgs = [{'role':r[0],'content':r[1],'timestamp':r[2].isoformat() if r[2] else None} for r in cur.fetchall()]
                cur.close()
                return ok({'messages': msgs})

            return ok({'status': 'ok'})

        if method == 'POST':
            body = json.loads(event.get('body', '{}'))
            question = body.get('question', '').strip()
            material_ids = body.get('material_ids', [])

            if not question:
                return err(400, {'error': 'Введи вопрос'})

            print(f"[AI] User:{user_id} Q:{question[:60]} M:{material_ids}", flush=True)

            access = check_access(conn, user_id)
            if not access.get('has_access'):
                msg = 'Лимит вопросов исчерпан. Оформи подписку или подожди до завтра!' if access.get('reason') == 'limit' else 'Для доступа к ИИ нужна подписка.'
                return err(403, {'error': 'limit', 'message': msg, 'used': access.get('used', 0), 'limit': access.get('limit', 0)})

            sid = get_session(conn, user_id)
            save_msg(conn, sid, user_id, 'user', question, material_ids)

            action_type = detect_action(question)

            if action_type == 'task':
                try:
                    title = extract_title(question, 'task')
                    import re
                    subj_m = re.search(r'по ([а-яё\s]+)', question.lower())
                    subj = subj_m.group(1).strip()[:50] if subj_m else None
                    cur = conn.cursor()
                    cur.execute(f"INSERT INTO {SCHEMA_NAME}.tasks (user_id,title,subject,priority) VALUES (%s,%s,%s,'high') RETURNING id,title", (user_id, title, subj))
                    task = cur.fetchone()
                    conn.commit()
                    cur.close()
                    increment_questions(conn, user_id)
                    acc = check_access(conn, user_id)
                    ans = f"✅ **Задача создана!**\n\n📋 **{task[1]}**" + (f"\n📚 Предмет: {subj}" if subj else "") + "\n\nНайдёшь её в разделе **Планировщик**."
                    save_msg(conn, sid, user_id, 'assistant', ans)
                    return ok({'answer': ans, 'remaining': acc.get('remaining', 0), 'action': 'task_created'})
                except Exception as e:
                    print(f"[AI] task error: {e}", flush=True)

            if action_type == 'schedule':
                try:
                    title = extract_title(question, 'schedule')
                    parsed = parse_schedule(question)
                    import re
                    subj_m = re.search(r'по ([а-яё\s]+)', question.lower())
                    subj = subj_m.group(1).strip()[:50] if subj_m else title
                    cur = conn.cursor()
                    cur.execute(f"INSERT INTO {SCHEMA_NAME}.schedule (user_id,subject,type,start_time,end_time,day_of_week,room,teacher,color) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'bg-purple-500') RETURNING id,subject,day_of_week",
                                (user_id, subj, parsed['type'], parsed['start_time'], parsed['end_time'], parsed['day_of_week'], parsed['room'], parsed['teacher']))
                    lesson = cur.fetchone()
                    conn.commit()
                    cur.close()
                    increment_questions(conn, user_id)
                    acc = check_access(conn, user_id)
                    days_names = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']
                    dn = days_names[lesson[2]] if lesson[2] is not None else 'не указан'
                    ans = f"✅ **Занятие добавлено!**\n\n📚 **{lesson[1]}** — {parsed['type']}\n📅 {dn}"
                    if parsed['start_time']:
                        ans += f" в {parsed['start_time']}"
                    ans += "\n\nСмотри в **Расписании**."
                    save_msg(conn, sid, user_id, 'assistant', ans)
                    return ok({'answer': ans, 'remaining': acc.get('remaining', 0), 'action': 'schedule_created'})
                except Exception as e:
                    print(f"[AI] schedule error: {e}", flush=True)

            cached = get_cache(conn, question, material_ids)
            if cached:
                print(f"[AI] cache hit", flush=True)
                increment_questions(conn, user_id)
                acc = check_access(conn, user_id)
                save_msg(conn, sid, user_id, 'assistant', cached, material_ids, 0, True)
                return ok({'answer': cached, 'remaining': acc.get('remaining', 0), 'cached': True})

            ctx = get_context(conn, user_id, material_ids)
            answer, tokens = ask_ai(question, ctx)

            if not answer:
                answer = fallback_answer(question, ctx)
                save_msg(conn, sid, user_id, 'assistant', answer, material_ids, 0, False)
                increment_questions(conn, user_id)
                acc = check_access(conn, user_id)
                return ok({'answer': answer, 'remaining': acc.get('remaining', 0), 'fallback': True})

            if tokens > 0:
                set_cache(conn, question, material_ids, answer, tokens)

            save_msg(conn, sid, user_id, 'assistant', answer, material_ids, tokens, False)
            increment_questions(conn, user_id)
            acc = check_access(conn, user_id)
            return ok({'answer': answer, 'remaining': acc.get('remaining', 0)})

        return err(405, {'error': 'Method not allowed'})

    except Exception as e:
        print(f"[AI] FATAL: {type(e).__name__}: {e}", flush=True)
        return ok({'answer': 'Произошла временная ошибка. Попробуй задать вопрос ещё раз!', 'remaining': 0, 'error': True})
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass
