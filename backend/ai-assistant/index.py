import json
import os
import jwt
import psycopg2
import hashlib
import httpx
from datetime import datetime, timedelta
from openai import OpenAI

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
ARTEMOX_API_KEY = os.environ.get('ARTEMOX_API_KEY', '')
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')

# IP rate limiting: max запросов за окно времени (защита от пика нагрузки)
_ip_requests: dict = {}
IP_WINDOW_SECONDS = 60
IP_MAX_REQUESTS = 15  # не более 15 запросов с одного IP в минуту

def check_ip_rate_limit(ip: str) -> bool:
    """Возвращает True если запрос разрешён, False если превышен лимит"""
    now = datetime.now().timestamp()
    if ip not in _ip_requests:
        _ip_requests[ip] = []
    # Убираем старые записи за пределами окна
    _ip_requests[ip] = [t for t in _ip_requests[ip] if now - t < IP_WINDOW_SECONDS]
    if len(_ip_requests[ip]) >= IP_MAX_REQUESTS:
        return False
    _ip_requests[ip].append(now)
    return True

_http = httpx.Client(timeout=httpx.Timeout(22.0, connect=3.0))
_http_vision = httpx.Client(timeout=httpx.Timeout(40.0, connect=5.0))
client = OpenAI(api_key=ARTEMOX_API_KEY, base_url='https://api.artemox.com/v1', timeout=22.0, http_client=_http)

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
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload['user_id']
    except Exception:
        return None

PREMIUM_DAILY_LIMIT = 20
FREE_DAILY_LIMIT = 3

def check_access(conn, user_id: int) -> dict:
    """Проверка доступа с учетом подписки/триала/free"""
    cur = conn.cursor()
    cur.execute(f'''
        SELECT subscription_type, subscription_expires_at, subscription_plan,
               trial_ends_at, is_trial_used,
               daily_questions_used, daily_questions_reset_at, bonus_questions,
               daily_premium_questions_used, daily_premium_questions_reset_at
        FROM {SCHEMA_NAME}.users WHERE id = %s
    ''', (user_id,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return {'has_access': False, 'reason': 'user_not_found'}

    (sub_type, expires_at, sub_plan,
     trial_ends, trial_used,
     daily_used, daily_reset, bonus,
     prem_daily_used, prem_daily_reset) = row

    now = datetime.now()
    daily_used = daily_used or 0
    bonus = bonus or 0
    prem_daily_used = prem_daily_used or 0

    # --- ТРИАЛ: безлимит ---
    if trial_ends and not trial_used and trial_ends > now:
        return {'has_access': True, 'is_trial': True, 'used': 0, 'limit': 999, 'remaining': 999}

    # --- ПРЕМИУМ ---
    if sub_type == 'premium' and expires_at and expires_at > now:
        # Сброс дневного счётчика
        if prem_daily_reset and prem_daily_reset < now:
            cur2 = conn.cursor()
            cur2.execute(f'''UPDATE {SCHEMA_NAME}.users
                SET daily_premium_questions_used=0,
                    daily_premium_questions_reset_at=%s
                WHERE id=%s''', (now + timedelta(days=1), user_id))
            conn.commit()
            cur2.close()
            prem_daily_used = 0

        remaining_daily = max(0, PREMIUM_DAILY_LIMIT - prem_daily_used)
        remaining_bonus = bonus

        if remaining_daily > 0:
            return {
                'has_access': True, 'is_premium': True,
                'used': prem_daily_used, 'limit': PREMIUM_DAILY_LIMIT,
                'remaining': remaining_daily, 'bonus_remaining': remaining_bonus,
                'source': 'daily'
            }
        elif remaining_bonus > 0:
            return {
                'has_access': True, 'is_premium': True,
                'used': prem_daily_used, 'limit': PREMIUM_DAILY_LIMIT,
                'remaining': remaining_bonus, 'bonus_remaining': remaining_bonus,
                'source': 'bonus', 'daily_exhausted': True
            }
        else:
            return {
                'has_access': False, 'reason': 'daily_limit',
                'used': prem_daily_used, 'limit': PREMIUM_DAILY_LIMIT,
                'is_premium': True, 'bonus_remaining': 0
            }

    # --- БЕСПЛАТНЫЙ ---
    if daily_reset and daily_reset < now:
        cur2 = conn.cursor()
        cur2.execute(f'UPDATE {SCHEMA_NAME}.users SET daily_questions_used=0, daily_questions_reset_at=%s WHERE id=%s',
                     (now + timedelta(days=1), user_id))
        conn.commit()
        cur2.close()
        daily_used = 0

    total = FREE_DAILY_LIMIT + bonus
    if daily_used >= total:
        return {'has_access': False, 'reason': 'limit', 'used': daily_used, 'limit': FREE_DAILY_LIMIT, 'is_free': True}
    return {'has_access': True, 'is_free': True, 'used': daily_used, 'limit': FREE_DAILY_LIMIT, 'remaining': total - daily_used}

def increment_questions(conn, user_id: int, access_info: dict = None):
    """Списываем вопрос после успешного ответа ИИ.
    access_info передаётся из check_access чтобы не делать лишний SELECT."""
    now = datetime.now()
    cur = conn.cursor()

    if not access_info:
        cur.execute(f'''
            SELECT subscription_type, subscription_expires_at, trial_ends_at, is_trial_used,
                   daily_questions_used, bonus_questions,
                   daily_premium_questions_used
            FROM {SCHEMA_NAME}.users WHERE id=%s
        ''', (user_id,))
        u = cur.fetchone()
        if not u:
            cur.close()
            return
        sub_type, expires, trial_ends, trial_used, daily_used, bonus, prem_daily = u
        is_premium = sub_type == 'premium' and expires and expires > now
        is_trial = trial_ends and not trial_used and trial_ends > now
        source = 'daily' if is_premium else 'free'
        prem_daily = prem_daily or 0
        bonus = bonus or 0
        if is_premium and prem_daily >= PREMIUM_DAILY_LIMIT and bonus > 0:
            source = 'bonus'
    else:
        is_premium = access_info.get('is_premium', False)
        is_trial = access_info.get('is_trial', False)
        source = access_info.get('source', 'daily')

    if is_trial:
        # триал не тратит реальные счётчики
        cur.close()
        return

    if is_premium:
        if source == 'bonus':
            # Списываем из пакета
            cur.execute(f'''UPDATE {SCHEMA_NAME}.users
                SET bonus_questions = GREATEST(0, bonus_questions - 1),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id=%s AND bonus_questions > 0''', (user_id,))
        else:
            # Списываем дневной лимит
            cur.execute(f'''UPDATE {SCHEMA_NAME}.users
                SET daily_premium_questions_used = COALESCE(daily_premium_questions_used,0) + 1,
                    daily_premium_questions_reset_at = COALESCE(
                        NULLIF(daily_premium_questions_reset_at, NULL),
                        %s
                    ),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id=%s''', (now + timedelta(days=1), user_id))
    else:
        # Бесплатный: сначала базовые 3, потом бонусные
        cur.execute(f'''SELECT daily_questions_used, bonus_questions FROM {SCHEMA_NAME}.users WHERE id=%s''', (user_id,))
        row = cur.fetchone()
        if row:
            daily_used, bonus = row[0] or 0, row[1] or 0
            if daily_used < FREE_DAILY_LIMIT:
                cur.execute(f'''UPDATE {SCHEMA_NAME}.users
                    SET daily_questions_used = COALESCE(daily_questions_used,0) + 1,
                        daily_questions_reset_at = COALESCE(daily_questions_reset_at, %s),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id=%s''', (now + timedelta(days=1), user_id))
            elif bonus > 0:
                cur.execute(f'''UPDATE {SCHEMA_NAME}.users
                    SET bonus_questions = GREATEST(0, bonus_questions - 1),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id=%s AND bonus_questions > 0''', (user_id,))

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
        return result[:6000]
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

def sanitize_answer(text):
    """Убирает LaTeX-разметку и иероглифы из ответа ИИ"""
    import re
    if not text:
        return text
    # Убираем блочный LaTeX: \[...\] и $$...$$
    text = re.sub(r'\\\[.*?\\\]', lambda m: m.group(0).replace('\\[', '').replace('\\]', '').strip(), text, flags=re.DOTALL)
    text = re.sub(r'\$\$.*?\$\$', lambda m: m.group(0).replace('$$', '').strip(), text, flags=re.DOTALL)
    # Убираем инлайн LaTeX: $...$ и \(...\)
    text = re.sub(r'\\\(.*?\\\)', lambda m: m.group(0).replace('\\(', '').replace('\\)', '').strip(), text, flags=re.DOTALL)
    text = re.sub(r'(?<!\$)\$(?!\$)([^$]+?)(?<!\$)\$(?!\$)', r'\1', text)
    # Убираем LaTeX-команды типа \frac, \sqrt, \cdot и т.д.
    text = re.sub(r'\\(frac|sqrt|cdot|times|div|pm|leq|geq|neq|approx|infty|alpha|beta|gamma|delta|theta|lambda|mu|pi|sigma|omega)\b', '', text)
    text = re.sub(r'\\[a-zA-Z]+\{([^}]*)\}', r'\1', text)
    text = re.sub(r'\\[a-zA-Z]+', '', text)
    # Убираем фигурные скобки LaTeX
    text = re.sub(r'\{([^}]*)\}', r'\1', text)
    # Чистим лишние пробелы
    text = re.sub(r' {2,}', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


BASE_RULES = (
    "Ты Studyfay — личный ИИ-репетитор. Ты умный, дружелюбный и всегда готов помочь разобраться.\n"
    "СТРОГО отвечай ТОЛЬКО на русском языке. Никаких иероглифов и LaTeX-разметки ($...$ или \\[...\\]).\n"
    "Формулы пиши обычным текстом: a² + b² = c², E = mc².\n\n"
    "КАК ОТВЕЧАТЬ:\n"
    "- Ты репетитор с огромной базой знаний — отвечаешь на любые учебные вопросы БЕЗ материалов\n"
    "- Объясняй просто, как хороший учитель другу: без занудства, с примерами из жизни\n"
    "- Если вопрос по школьной/вузовской программе — сразу давай полный ответ\n"
    "- Никогда не говори «я не знаю» или «загрузи конспект» — объясняй из своих знаний\n"
    "- После объяснения — предложи закрепить: задай встречный вопрос или мини-задание\n"
    "- Если человек говорит «привет» — ответь тепло, спроси чем помочь\n\n"
    "ФОРМАТИРОВАНИЕ (Markdown):\n"
    "- ## заголовки для длинных ответов\n"
    "- **жирный** для терминов и главных мыслей\n"
    "- Списки и нумерация для шагов и правил\n"
    "- > для определений которые надо запомнить\n"
    "Завершай мысль полностью. Будь живым и вовлечённым."
)


def _call_deepseek_direct(messages_list: list, max_tokens: int = 1500) -> tuple:
    """Прямой вызов DeepSeek API — используется для exam-режима (длинные промпты)"""
    api_key = DEEPSEEK_API_KEY
    if not api_key:
        return None, 0
    payload = {
        "model": "deepseek-chat",
        "messages": messages_list,
        "temperature": 0.7,
        "max_tokens": max_tokens,
    }
    try:
        print(f"[AI] -> DeepSeek direct [exam] prompt_len:{len(str(messages_list))}", flush=True)
        r = _http.post(
            "https://api.deepseek.com/v1/chat/completions",
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
        print(f"[AI] DeepSeek direct status:{r.status_code}", flush=True)
        if r.status_code == 200:
            data = r.json()
            answer = data["choices"][0]["message"]["content"]
            tokens = data.get("usage", {}).get("total_tokens", 1)
            return answer, tokens
        print(f"[AI] DeepSeek direct error body:{r.text[:300]}", flush=True)
        return None, 0
    except Exception as e:
        print(f"[AI] DeepSeek direct FAIL: {type(e).__name__}: {str(e)[:200]}", flush=True)
        return None, 0


def ask_ai(question, context, image_base64=None, exam_system_prompt=None, history=None):
    """Запрос к ИИ через Artemox. exam_system_prompt строится на бэкенде — всегда компактный."""
    has_context = bool(context and len(context) > 50)
    ctx_trimmed = context[:2500] if has_context else ""

    if exam_system_prompt:
        system = exam_system_prompt  # уже компактный — построен build_exam_prompt
    elif has_context:
        system = (
            f"{BASE_RULES}\n\n"
            f"МАТЕРИАЛЫ СТУДЕНТА:\n{ctx_trimmed}\n\n"
            "Опирайся на материалы, дополняй своими знаниями."
        )
    else:
        system = (
            f"{BASE_RULES}\n\n"
            "Материалов нет — отвечай из своих знаний как опытный репетитор."
        )

    if image_base64:
        answer, tokens = ask_ai_vision(question, system, image_base64)
        return answer, tokens

    messages_list = [{"role": "system", "content": system}]
    if history:
        for h in history[-6:]:
            role = h.get('role', 'user')
            content = h.get('content', '')
            if role in ('user', 'assistant') and content:
                messages_list.append({"role": role, "content": content[:600]})
    messages_list.append({"role": "user", "content": question[:600]})

    print(f"[AI] -> Artemox {'[exam]' if exam_system_prompt else ''} prompt_len:{len(system)}", flush=True)

    try:
        resp = client.chat.completions.create(
            model="deepseek-chat",
            messages=messages_list,
            temperature=0.7,
            max_tokens=1500 if exam_system_prompt else 1024,
        )
        answer = resp.choices[0].message.content
        tokens = resp.usage.total_tokens if resp.usage else 0
        print(f"[AI] Artemox OK tokens:{tokens}", flush=True)
        answer = sanitize_answer(answer)
        if answer and not answer.rstrip().endswith(('.', '!', '?', ')', '»', '`', '*')):
            answer = answer.rstrip() + '.'
        return answer, tokens
    except Exception as e:
        print(f"[AI] Artemox FAIL: {type(e).__name__}: {str(e)[:200]}", flush=True)
        return build_smart_fallback(question, context), 0


def ocr_image(image_base64):
    """OCR через DeepSeek Vision API — извлекает текст/условие с фото"""
    api_key = DEEPSEEK_API_KEY
    if not api_key:
        print(f"[AI] no DEEPSEEK_API_KEY", flush=True)
        return None
    payload = {
        "model": "deepseek-vl2",
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                    },
                    {
                        "type": "text",
                        "text": (
                            "Это фото с задачей или конспектом студента. "
                            "Точно распознай и перепиши ВЕСЬ текст с изображения дословно. "
                            "Если это математическая или физическая задача — перепиши условие полностью. "
                            "Отвечай только текстом с фото, без пояснений."
                        )
                    }
                ]
            }
        ],
        "temperature": 0.1,
        "max_tokens": 1000
    }
    try:
        print(f"[AI] -> DeepSeek Vision OCR", flush=True)
        r = _http_vision.post(
            "https://api.deepseek.com/v1/chat/completions",
            json=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
        )
        print(f"[AI] OCR status:{r.status_code} body:{r.text[:200]}", flush=True)
        if r.status_code == 200:
            data = r.json()
            text = data["choices"][0]["message"]["content"]
            print(f"[AI] OCR extracted: {text[:100]}", flush=True)
            return text.strip()
        return None
    except Exception as e:
        print(f"[AI] OCR FAIL: {type(e).__name__}: {str(e)[:200]}", flush=True)
        return None


def ask_ai_vision(question, system, image_base64):
    """OCR фото → передаём распознанный текст в deepseek-chat (та же модель)"""
    ocr_text = ocr_image(image_base64)

    if ocr_text:
        user_q = question.strip() if question and question != "Разбери задачу на фото" else ""
        if user_q:
            combined = f"{user_q}\n\nТекст с фото:\n{ocr_text}"
        else:
            combined = f"Разбери задачу пошагово и объясни решение:\n\n{ocr_text}"
        print(f"[AI] Vision->text, sending to deepseek-chat: {combined[:80]}", flush=True)
        try:
            resp = client.chat.completions.create(
                model="deepseek-chat",
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": combined[:1200]}
                ],
                temperature=0.7,
                max_tokens=1500,
            )
            answer = resp.choices[0].message.content
            tokens = resp.usage.total_tokens if resp.usage else 0
            answer = sanitize_answer(answer)
            if answer and not answer.rstrip().endswith(('.', '!', '?', ')', '»', '`', '*')):
                answer = answer.rstrip() + '.'
            return answer, tokens
        except Exception as e:
            print(f"[AI] chat after OCR FAIL: {e}", flush=True)
            return f"Я распознал текст с фото:\n\n{ocr_text}\n\nНо не смог сформировать ответ. Попробуй ещё раз!", 0
    else:
        return "Не удалось распознать текст с фото. Попробуй сфотографировать чётче или перепиши условие задачи текстом — разберём вместе!", 0

EXAM_TASK_LISTS = {
    'ege': {
        'math_base': 'Числа и действия,Уравнения,Функции и графики,Геометрия,Текстовые задачи,Статистика и вероятность',
        'math_profile': 'Числа,Выражения,Уравнения и неравенства,Функции,Геометрия (планиметрия),Геометрия (стереометрия),Вероятность и статистика,Задачи с параметрами',
        'russian': 'Информация текста,Лексическое значение,Связь предложений,Орфоэпия,Паронимы,Лексические нормы,Морфологические нормы,Синтаксические нормы,Правописание приставок,Правописание суффиксов,Правописание окончаний,НЕ с разными ч/р,Слитно/раздельно/дефис,Н и НН,Знаки в простом предложении,Знаки в СПП,Знаки в ССП и БСП,Знаки при вводных,Текстовые задания (22-26),Сочинение',
        'chemistry': 'Строение атома,Химическая связь и кристаллические решётки,Классификация веществ,Химические свойства неорганических веществ,Химические реакции,Электролиз,Скорость реакций,Равновесие,Углеводороды,Кислородсодержащие ОС,Азотсодержащие ОС,Качественные реакции,Расчёты',
        'biology': 'Биология как наука,Клетка,Организм,Генетика,Эволюция,Экосистемы,Человек,Растения,Животные,Задачи по генетике',
        'physics': 'Механика,Термодинамика,Электростатика,Электрический ток,Магнитное поле,Оптика,Квантовая физика,Астрофизика,Задачи',
        'history': 'Хронология и периодизация,Восточные славяне,Русь IX-XIII,Монгольское нашествие,XIV-XV вв,XVI в,XVII в,XVIII в,XIX в,Первая половина XX в,Вторая половина XX в,СССР 1985-1991,Россия 1990-е,Россия 2000-е,Источники,Культура,Карты и схемы,Работа с текстом',
        'social': 'Человек и общество,Духовная сфера,Экономика,Социальные отношения,Политика,Право,Задания с текстом',
        'english': 'Грамматика и лексика,Чтение,Аудирование,Письмо,Говорение',
        'geography': 'Источники информации,Природа Земли,Природа России,Население,Мировое хозяйство,Регионы России,Регионы мира',
        'literature': 'Лирика,Эпос,Драма,Литературные термины,Сравнительный анализ,Сочинение',
        'informatics': 'Информация,Системы счисления,Логика,Алгоритмы,Программирование,Сети,Базы данных,Файловая система',
    },
    'oge': {
        'math': 'Числа и вычисления,Алгебра,Функции,Уравнения,Неравенства,Геометрия,Статистика,Текстовые задачи',
        'russian': 'Изложение,Тест (задания 2-8),Синтаксис (9-14),Орфография (15-22),Пунктуация (23-26),Сочинение',
        'chemistry': 'Строение атома,Периодический закон,Химическая связь,Вещества и их свойства,Реакции,Электролиз,Качественные реакции,Расчётные задачи',
        'biology': 'Биология как наука,Клетка,Организм,Человек,Растения,Животные,Экология,Генетика',
        'physics': 'Механика,Тепловые явления,Электричество,Оптика,Задачи',
        'history': 'Хронология,IX-XIII вв,XIV-XVI вв,XVII-XVIII вв,XIX в,XX в,Культура,Источники,Карты',
        'social': 'Человек и общество,Экономика,Социальная сфера,Политика,Право',
        'english': 'Аудирование,Чтение,Грамматика,Письмо',
        'geography': 'Земля,Природа России,Население,Хозяйство,Регионы',
        'informatics': 'Информация,Алгоритмы,Программирование,Сети,Задачи',
    }
}

def build_exam_prompt(exam_type: str, subject_id: str, subject_label: str, mode: str) -> str:
    """Строит компактный system prompt для ЕГЭ/ОГЭ — умещается в лимит Artemox"""
    exam_label = 'ЕГЭ' if exam_type == 'ege' else 'ОГЭ'
    tasks_str = EXAM_TASK_LISTS.get(exam_type, {}).get(subject_id, '')
    tasks_hint = f'\nТемы {exam_label} по {subject_label}: {tasks_str}.' if tasks_str else ''

    base = (
        f"Ты Studyfay — репетитор по {exam_label}, предмет «{subject_label}». "
        f"Знаешь программу {exam_label} досконально и отвечаешь из своих знаний без конспектов.{tasks_hint}\n"
        "Отвечай только на русском. Формулы текстом: a²+b²=c². Без LaTeX.\n"
        "Стиль: живо, по-дружески, как старший товарищ. Хвали за верные ответы, мягко разбирай ошибки.\n"
        "Формат: **жирный** для терминов, ## заголовки, списки, > для правил."
    )

    if mode == 'explain':
        return (
            base + "\nРЕЖИМ — Объяснение. Когда ученик называет тему или номер задания:\n"
            "1. Назови тему: **Задание N — [тема]**\n"
            "2. Объясни что проверяет это задание\n"
            "3. Теория с примерами из жизни\n"
            "4. Полный пример задания с разбором (все варианты если нужно)\n"
            "5. Частые ошибки жирным\n"
            "6. Предложи: «Хочешь потренироваться?»\n"
            "Если не знает с чего начать — спроси что даётся труднее."
        )
    else:
        return (
            base + "\nРЕЖИМ — Тренировка. Алгоритм:\n"
            "1. **Задание N — [тема]** одной строкой\n"
            "2. **Задание:** — ПОЛНОЕ реалистичное задание (все варианты/столбцы/пропуски)\n"
            "3. После ответа: правильный ответ + разбор + частые ошибки\n"
            "4. «Следующее задание или другая тема?»\n"
            "Начни сразу с задания. Если тема не указана — выбери самую сложную по статистике."
        )


def build_smart_fallback(question, context):
    """Умный fallback — ВСЕГДА даёт полезный ответ по вопросу и материалам"""
    q = question.lower().strip()
    has_ctx = bool(context and len(context) > 100)

    if has_ctx:
        snippet = context[:1200].strip()
        if any(w in q for w in ['конспект', 'тезис', 'главн', 'основн', 'о чём', 'о чем', 'суть', 'содержани']):
            return f"Вот краткое содержание из твоих материалов:\n\n{snippet}\n\n---\n💡 Это ключевые моменты из загруженных документов."
        if any(w in q for w in ['формул', 'определени', 'термин', 'понят']):
            return f"Вот что нашлось по твоему запросу в материалах:\n\n{snippet}\n\n---\n💡 Обрати внимание на выделенные термины и формулы."
        if any(w in q for w in ['экзамен', 'подготов', 'билет', 'зачёт', 'зачет']):
            return f"Для подготовки обрати внимание на эти ключевые моменты:\n\n{snippet}\n\n---\n💡 Рекомендую составить план повторения по этим пунктам."
        return f"По твоему вопросу нашлось в материалах:\n\n{snippet}\n\n---\n💡 Задай более конкретный вопрос — смогу ответить точнее!"
    else:
        if any(w in q for w in ['привет', 'здравствуй', 'хай', 'йо']):
            return "Привет! 👋 Я Studyfay — твой личный репетитор. Спрашивай по любому предмету — объясню, разберу задачу, помогу подготовиться к экзамену. С чего начнём?"
        if any(w in q for w in ['математик', 'алгебр', 'геометр', 'физик', 'химия', 'биолог']):
            return "Задай конкретный вопрос или напиши условие задачи — разберём по шагам!"
        return "Задай вопрос по любому предмету — я отвечу из своих знаний как репетитор. Если хочешь, чтобы я работал с твоими конспектами — загрузи их в разделе **Материалы**."

def handler(event: dict, context) -> dict:
    """ИИ-ассистент Studyfay: отвечает на вопросы студентов"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    # IP rate limiting — защита от пиков нагрузки (май/июнь)
    ip = (event.get('requestContext', {}) or {}).get('identity', {}) or {}
    client_ip = ip.get('sourceIp', 'unknown') if isinstance(ip, dict) else 'unknown'
    if method == 'POST' and not check_ip_rate_limit(client_ip):
        return err(429, {'error': 'Слишком много запросов. Подожди минуту и попробуй снова.'})

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
            image_base64 = body.get('image_base64', None)
            history = body.get('history', [])

            # Новый способ: exam_context с параметрами (фронт не шлёт длинный промпт)
            exam_context = body.get('exam_context', None)
            exam_system_prompt = None
            if exam_context:
                exam_system_prompt = build_exam_prompt(
                    exam_context.get('exam_type', ''),
                    exam_context.get('subject_id', ''),
                    exam_context.get('subject_label', ''),
                    exam_context.get('mode', 'explain'),
                )
            # Обратная совместимость: если фронт всё ещё шлёт exam_system_prompt напрямую — обрезаем до безопасного размера
            elif body.get('exam_system_prompt'):
                exam_system_prompt = body['exam_system_prompt'][:800]

            if not question and not image_base64:
                return err(400, {'error': 'Введи вопрос'})

            print(f"[AI] User:{user_id} Q:{question[:60]} M:{material_ids}", flush=True)

            access = check_access(conn, user_id)
            if not access.get('has_access'):
                reason = access.get('reason', 'limit')
                if reason == 'daily_limit':
                    msg = 'Дневной лимит 20 вопросов исчерпан. Купи пакет вопросов или подожди до завтра!'
                elif access.get('is_free'):
                    msg = 'Бесплатный лимит (3 вопроса в день) исчерпан. Оформи подписку или купи пакет!'
                else:
                    msg = 'Для доступа к ИИ нужна подписка.'
                return err(403, {
                    'error': 'limit',
                    'message': msg,
                    'used': access.get('used', 0),
                    'limit': access.get('limit', 0),
                    'is_premium': access.get('is_premium', False),
                    'daily_exhausted': access.get('is_premium', False)
                })

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
                    increment_questions(conn, user_id, access)
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
                    increment_questions(conn, user_id, access)
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

            if not image_base64:
                cached = get_cache(conn, question, material_ids)
                if cached:
                    print(f"[AI] cache hit", flush=True)
                    increment_questions(conn, user_id, access)
                    acc = check_access(conn, user_id)
                    save_msg(conn, sid, user_id, 'assistant', cached, material_ids, 0, True)
                    return ok({'answer': cached, 'remaining': acc.get('remaining', 0), 'cached': True})

            ctx = get_context(conn, user_id, material_ids)
            answer, tokens = ask_ai(question, ctx, image_base64, exam_system_prompt=exam_system_prompt, history=history)

            # Если ИИ вернул ошибку (tokens==0 = fallback), вопрос НЕ сгорает
            ai_error = (tokens == 0)
            if not ai_error:
                if tokens > 0:
                    set_cache(conn, question, material_ids, answer, tokens)
                increment_questions(conn, user_id, access)

            acc = check_access(conn, user_id)
            save_msg(conn, sid, user_id, 'assistant', answer, material_ids, tokens, False)
            return ok({'answer': answer, 'remaining': acc.get('remaining', 0), 'ai_error': ai_error})

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