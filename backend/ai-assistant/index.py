import json
import os
import jwt
import psycopg2
import hashlib
import httpx
import threading
from datetime import datetime, timedelta
from openai import OpenAI

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA_NAME = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
_raw_gemini_key = os.environ.get('AITUNNEL_GEMINI_KEY', '')
AITUNNEL_GEMINI_KEY = ''.join(c for c in _raw_gemini_key.strip() if ord(c) < 128).strip()
if _raw_gemini_key and _raw_gemini_key != AITUNNEL_GEMINI_KEY:
    print(f"[INIT] WARN: AITUNNEL_GEMINI_KEY cleaned from non-ASCII chars. raw_len={len(_raw_gemini_key)} clean_len={len(AITUNNEL_GEMINI_KEY)}", flush=True)

LLAMA_MODEL = 'llama-4-maverick'
OPENROUTER_BASE_URL = 'https://api.aitunnel.ru/v1/'

_http = httpx.Client(timeout=httpx.Timeout(15.0, connect=4.0))
_http_vision = httpx.Client(timeout=httpx.Timeout(20.0, connect=4.0))
client = OpenAI(api_key=OPENROUTER_API_KEY, base_url=OPENROUTER_BASE_URL, timeout=15.0, http_client=_http)

_http_whisper = httpx.Client(timeout=httpx.Timeout(30.0, connect=5.0))

CORS_HEADERS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
    'Access-Control-Max-Age': '86400'
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

PREMIUM_DAILY_LIMIT = 20

FREE_LIMITS_SCHEDULE = {
    0: 10, 1: 10, 2: 10, 3: 10,
    4: 7,
    5: 5,
    6: 3,
}
FREE_DAILY_LIMIT_DEFAULT = 3

SOFT_LANDING_LIMIT = 10  # вопросов/день в переходный период после триала
SOFT_LANDING_DAYS = 3


def check_access(conn, user_id: int) -> dict:
    """Проверка доступа с учетом подписки/триала/free"""
    cur = conn.cursor()
    cur.execute(f'''
        SELECT subscription_type, subscription_expires_at, subscription_plan,
               trial_ends_at, is_trial_used,
               daily_questions_used, daily_questions_reset_at, bonus_questions,
               daily_premium_questions_used, daily_premium_questions_reset_at,
               created_at
        FROM {SCHEMA_NAME}.users WHERE id = %s
    ''', (user_id,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return {'has_access': False, 'reason': 'user_not_found'}

    (sub_type, expires_at, sub_plan,
     trial_ends, trial_used,
     daily_used, daily_reset, bonus,
     prem_daily_used, prem_daily_reset,
     created_at) = row

    now = datetime.now()
    daily_used = daily_used or 0
    bonus = bonus or 0
    prem_daily_used = prem_daily_used or 0

    # --- ТРИАЛ: безлимит ---
    if trial_ends and not trial_used and trial_ends > now:
        return {'has_access': True, 'is_trial': True, 'used': 0, 'limit': 999, 'remaining': 999}

    # --- ПЕРЕХОДНЫЙ ПЕРИОД (дни 8-10 после окончания триала): 10 вопросов/день ---
    if trial_ends and trial_ends <= now:
        days_since_trial_end = (now - trial_ends).days
        if 0 <= days_since_trial_end < SOFT_LANDING_DAYS and sub_type != 'premium':
            if daily_reset and daily_reset < now:
                cur2 = conn.cursor()
                cur2.execute(f'UPDATE {SCHEMA_NAME}.users SET daily_questions_used=0, daily_questions_reset_at=%s WHERE id=%s',
                             (now + timedelta(days=1), user_id))
                conn.commit()
                cur2.close()
                daily_used = 0
            total_sl = SOFT_LANDING_LIMIT + bonus
            days_left_sl = SOFT_LANDING_DAYS - days_since_trial_end
            if daily_used >= total_sl:
                return {
                    'has_access': False, 'reason': 'limit', 'is_soft_landing': True,
                    'used': daily_used, 'limit': SOFT_LANDING_LIMIT,
                    'soft_landing_days_left': days_left_sl
                }
            return {
                'has_access': True, 'is_soft_landing': True,
                'used': daily_used, 'limit': SOFT_LANDING_LIMIT,
                'remaining': total_sl - daily_used,
                'soft_landing_days_left': days_left_sl
            }

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

    days_since_reg = (now - created_at).days if created_at else 999
    current_free_limit = FREE_LIMITS_SCHEDULE.get(days_since_reg, FREE_DAILY_LIMIT_DEFAULT)
    is_newcomer = days_since_reg <= 3

    total = current_free_limit + bonus
    if daily_used >= total:
        return {'has_access': False, 'reason': 'limit', 'used': daily_used, 'limit': current_free_limit, 'is_free': True, 'is_newcomer': is_newcomer}
    return {'has_access': True, 'is_free': True, 'used': daily_used, 'limit': current_free_limit, 'remaining': total - daily_used, 'is_newcomer': is_newcomer}

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
    except Exception:
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

def _convert_ascii_table(text):
    """Конвертирует ASCII-таблицы с черточками в читаемый текст"""
    import re
    lines = text.split('\n')
    result = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Определяем строку-разделитель типа |---|---|
        if re.match(r'^\s*\|[\s\-\|:]+\|\s*$', line):
            i += 1
            continue
        # Определяем строку таблицы с | ... | ... |
        if re.match(r'^\s*\|.+\|', line):
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            if len(cells) > 1:
                result.append('  '.join(cells))
                i += 1
                continue
        result.append(line)
        i += 1
    return '\n'.join(result)


def sanitize_answer(text):
    """Убирает LaTeX, псевдографику, иероглифы, таблицы и форматирует ответ ИИ"""
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
    # Конвертируем ASCII-таблицы в читаемый вид
    text = _convert_ascii_table(text)
    # Убираем псевдографику: ^ как степень оставляем, убираем декоративные символы
    text = re.sub(r'[│├┤┬┴┼╔╗╚╝║═╠╣╦╩╬┌┐└┘─]', '', text)
    # Убираем иероглифы (CJK символы)
    text = re.sub(r'[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\u3040-\u309f\u30a0-\u30ff\uff00-\uffef\u2e80-\u2eff\u31c0-\u31ef]+', '', text)
    # Убираем подчёркивания-разделители типа _____ или ------- стоящие отдельной строкой
    text = re.sub(r'^\s*[-_=]{3,}\s*$', '', text, flags=re.MULTILINE)
    # Убираем markdown-таблицы (строки начинающиеся и заканчивающиеся на |)
    text = re.sub(r'^\s*\|[\s\-\|:]+\|\s*$', '', text, flags=re.MULTILINE)
    # Чистим лишние пробелы
    text = re.sub(r' {2,}', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


_http_demo = httpx.Client(timeout=httpx.Timeout(5.0, connect=3.0))
_http_fallback = httpx.Client(timeout=httpx.Timeout(5.0, connect=2.5))

# ── PHOTO SOLVE ──────────────────────────────────────────────────────────────
FREE_DAILY_PHOTOS = 1
PREMIUM_DAILY_PHOTOS = 5

def _check_photo_limit(conn, user_id: int) -> dict:
    from datetime import timedelta as _td
    now = datetime.now()
    cur = conn.cursor()
    cur.execute(f'''
        SELECT subscription_type, subscription_expires_at,
               photos_uploaded_today, photos_daily_reset_at, bonus_photos
        FROM {SCHEMA_NAME}.users WHERE id = %s
    ''', (user_id,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return {'has_access': False, 'reason': 'not_found'}
    sub_type, expires, photos_today, reset_at, bonus = row
    photos_today = photos_today or 0
    bonus = bonus or 0
    is_premium = sub_type == 'premium' and expires and expires.replace(tzinfo=None) > now if hasattr(expires, 'tzinfo') else (sub_type == 'premium' and expires and expires > now)
    daily_limit = PREMIUM_DAILY_PHOTOS if is_premium else FREE_DAILY_PHOTOS
    if reset_at:
        reset_naive = reset_at.replace(tzinfo=None) if hasattr(reset_at, 'tzinfo') and reset_at.tzinfo else reset_at
        if reset_naive < now:
            cur2 = conn.cursor()
            cur2.execute(f'UPDATE {SCHEMA_NAME}.users SET photos_uploaded_today=0, photos_daily_reset_at=%s WHERE id=%s',
                         (now + _td(days=1), user_id))
            conn.commit()
            cur2.close()
            photos_today = 0
    if photos_today >= daily_limit:
        if bonus > 0:
            return {'has_access': True, 'is_premium': is_premium, 'used': photos_today, 'limit': daily_limit, 'from_bonus': True, 'bonus_remaining': bonus}
        return {'has_access': False, 'reason': 'limit', 'is_premium': is_premium, 'used': photos_today, 'limit': daily_limit, 'bonus_remaining': 0}
    return {'has_access': True, 'is_premium': is_premium, 'used': photos_today, 'limit': daily_limit, 'from_bonus': False, 'bonus_remaining': bonus}

def _increment_photo_count(conn, user_id: int, from_bonus: bool):
    from datetime import timedelta as _td
    now = datetime.now()
    cur = conn.cursor()
    if from_bonus:
        cur.execute(f'UPDATE {SCHEMA_NAME}.users SET bonus_photos=GREATEST(0,bonus_photos-1),updated_at=CURRENT_TIMESTAMP WHERE id=%s AND bonus_photos>0', (user_id,))
    else:
        cur.execute(f'UPDATE {SCHEMA_NAME}.users SET photos_uploaded_today=COALESCE(photos_uploaded_today,0)+1, photos_daily_reset_at=COALESCE(photos_daily_reset_at,%s),updated_at=CURRENT_TIMESTAMP WHERE id=%s',
                    (now + _td(days=1), user_id))
    conn.commit()
    cur.close()

def _ocr_and_solve(image_base64: str, hint: str = '') -> dict:
    """OCR через DeepSeek Vision → решение через Llama-4-Maverick."""
    recognized_text = None

    # Шаг 1: OCR через DeepSeek Vision (если есть ключ)
    if DEEPSEEK_API_KEY:
        try:
            ocr_payload = {
                "model": "deepseek-vl2",
                "messages": [{"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
                    {"type": "text", "text": (
                        "Это фото с учебным заданием. Точно распознай и перепиши ВЕСЬ текст дословно, "
                        "включая цифры, формулы, условия, варианты ответов. Отвечай только текстом, без комментариев."
                    )}
                ]}],
                "temperature": 0.1, "max_tokens": 1500
            }
            with httpx.Client(timeout=httpx.Timeout(20.0, connect=5.0)) as h:
                r = h.post("https://api.deepseek.com/v1/chat/completions", json=ocr_payload,
                           headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"})
                if r.status_code == 200:
                    recognized_text = r.json()["choices"][0]["message"]["content"].strip()
                    print(f"[PHOTO] OCR deepseek ok: {recognized_text[:80]}", flush=True)
        except Exception as e:
            print(f"[PHOTO] OCR deepseek error: {e}", flush=True)

    # Фолбек: Llama Vision через aitunnel
    if not recognized_text and OPENROUTER_API_KEY:
        try:
            with httpx.Client(timeout=httpx.Timeout(20.0, connect=5.0)) as h:
                r2 = h.post("https://api.aitunnel.ru/v1/chat/completions", json={
                    "model": "meta-llama/llama-4-maverick",
                    "messages": [{"role": "user", "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
                        {"type": "text", "text": "Распознай и перепиши весь текст задачи с этого фото точно дословно."}
                    ]}],
                    "temperature": 0.1, "max_tokens": 1000
                }, headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"})
                if r2.status_code == 200:
                    recognized_text = r2.json()["choices"][0]["message"]["content"].strip()
                    print(f"[PHOTO] OCR llama ok: {recognized_text[:80]}", flush=True)
        except Exception as e2:
            print(f"[PHOTO] OCR llama error: {e2}", flush=True)

    if not recognized_text:
        return {'recognized_text': '', 'solution': 'Не удалось распознать текст. Сфотографируй чётче при хорошем освещении.', 'subject': 'Неизвестно'}

    # Шаг 2: Решение через Llama-4-Maverick
    hint_text = f"\nДополнительно от ученика: {hint}" if hint else ""
    solve_prompt = (
        f"Задание с фото:{hint_text}\n\n{recognized_text}\n\n"
        "Реши это задание пошагово. Формат:\n"
        "1. Определи предмет и тип задачи\n"
        "2. Реши полностью, показывая ВСЕ шаги\n"
        "3. Чётко напиши: 'Ответ: ...'\n"
        "4. Если тест — объясни почему правильный вариант именно тот\n"
        "Формулы текстом (x^2, sqrt(x), a/b). Отвечай по-русски."
    )
    solution = None
    try:
        resp_s = client.chat.completions.create(
            model=LLAMA_MODEL,
            messages=[
                {"role": "system", "content": (
                    "Ты лучший репетитор для российских школьников и студентов. "
                    "Решай задания ЕГЭ/ОГЭ/вузовские ПОЛНОСТЬЮ пошагово — каждый шаг на отдельной строке с пояснением. "
                    "Проверяй свои вычисления. Определяй предмет. Формулы текстом. Русский. "
                    "В конце дай совет: как решать подобные задачи быстрее."
                )},
                {"role": "user", "content": solve_prompt}
            ],
            temperature=0.3,
            max_tokens=800,
        )
        solution = sanitize_answer(resp_s.choices[0].message.content)
        print(f"[PHOTO] Solve llama ok: {solution[:80]}", flush=True)
    except Exception as es:
        print(f"[PHOTO] Solve error: {es}", flush=True)

    if not solution:
        solution = f"Задание распознано:\n\n{recognized_text}\n\nПопробуй задать вопрос в разделе «Ассистент»."

    sol_lower = (solution + recognized_text).lower()
    subject = 'Общее'
    if any(w in sol_lower for w in ['математика', 'уравнение', 'функция', 'интеграл', 'производная', 'геометрия', 'треугольник']):
        subject = 'Математика'
    elif any(w in sol_lower for w in ['физика', 'сила', 'скорость', 'ускорение', 'масса', 'энергия', 'ток', 'напряжение']):
        subject = 'Физика'
    elif any(w in sol_lower for w in ['химия', 'реакция', 'элемент', 'молекула', 'кислота', 'валентность']):
        subject = 'Химия'
    elif any(w in sol_lower for w in ['биология', 'клетка', 'днк', 'фотосинтез', 'организм']):
        subject = 'Биология'
    elif any(w in sol_lower for w in ['история', 'война', 'революция', 'царь', 'дата', 'событие']):
        subject = 'История'
    elif any(w in sol_lower for w in ['обществознание', 'право', 'конституция', 'государство']):
        subject = 'Обществознание'
    elif any(w in sol_lower for w in ['русский', 'орфография', 'пунктуация', 'предложение', 'грамматика']):
        subject = 'Русский язык'
    elif any(w in sol_lower for w in ['english', 'verb', 'grammar', 'sentence', 'английский']):
        subject = 'Английский'

    return {'recognized_text': recognized_text, 'solution': solution, 'subject': subject}
# ── END PHOTO SOLVE ──────────────────────────────────────────────────────────

def _call_openai_compat(http_client, url: str, api_key: str, question: str, history: list = None, max_tokens: int = 600) -> str | None:
    """Универсальный вызов OpenAI-совместимого API. Возвращает текст ответа или None."""
    try:
        messages = [{"role": "system", "content": DEMO_SYSTEM}]
        if history:
            for h in history[-4:]:
                role = h.get('role', 'user')
                content = str(h.get('content', ''))[:300]
                if role in ('user', 'assistant') and content:
                    messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": question[:800]})
        payload = {
            "model": LLAMA_MODEL,
            "messages": messages,
            "temperature": 0.5,
            "max_tokens": max_tokens,
        }
        r = http_client.post(
            url,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )
        if r.status_code == 200:
            data = r.json()
            return sanitize_answer(data["choices"][0]["message"]["content"])
        return None
    except Exception:
        return None

def ask_ai_demo(question: str, history: list = None) -> tuple:
    """Демо: Artemox → повтор Artemox × 2 → локальный ответ. Всегда возвращает ответ."""
    for attempt in range(2):
        answer = _call_openai_compat(
            _http_demo if attempt == 0 else _http_fallback,
            f"{OPENROUTER_BASE_URL}/chat/completions",
            OPENROUTER_API_KEY, question, history, max_tokens=300
        )
        if answer:
            return answer, 1

    # Локальный ответ — всегда работает
    return _smart_demo_fallback(question), 0

def _smart_demo_fallback(question: str) -> str:
    """Локальный ответ на основе ключевых слов — когда все попытки API не удались."""
    q = question.lower()
    # Сначала проверяем кэш тем
    cached = get_demo_cache(question)
    if cached:
        return cached
    # Ответ по типу запроса — без упоминания нагрузки/ошибок
    if any(w in q for w in ['объясни', 'что такое', 'расскажи', 'как работает', 'что это']):
        return (
            "Это важная тема для экзамена! 📚\n"
            "Задай вопрос чуть конкретнее — например, укажи конкретное понятие или формулу, и я разберу подробно."
        )
    if any(w in q for w in ['задание', 'задача', 'пример', 'реши', 'дай задание']):
        return (
            "Давай порешаем! ✏️\n"
            "Напиши конкретную тему — например, «задание по теореме Пифагора» или «задача по закону Ома» — и я дам тебе задание уровня ЕГЭ."
        )
    if any(w in q for w in ['привет', 'здравствуй', 'хай', 'начнём', 'начнем']):
        return "Привет! Я Studyfay — твой репетитор 👋\nЗадавай любой вопрос по школьным предметам — разберём вместе!"
    return (
        "Хороший вопрос! 🤔\n"
        "Уточни тему или предмет — и я дам точный ответ с примером."
    )


def ask_ai(question, context, image_base64=None, exam_meta=None, history=None):
    """Запрос к ИИ через Artemox. exam_meta — строка 'тип|предмет_id|предмет|режим'"""
    has_context = bool(context and len(context) > 50)
    ctx_trimmed = context[:1200] if has_context else ""

    if exam_meta:
        parts = exam_meta.split('|')
        et = parts[0] if len(parts) > 0 else ''
        sl = parts[2] if len(parts) > 2 else ''
        mode = parts[3] if len(parts) > 3 else 'explain'
        el = 'ЕГЭ' if et == 'ege' else 'ОГЭ'
        if mode == 'practice':
            system = (
                f"Ты Studyfay — опытный репетитор-экзаменатор по «{sl}» ({el}). Русский. 1-2 эмодзи. Формулы текстом.\n\n"
                f"РЕЖИМ ПРАКТИКИ {el.upper()}:\n"
                f"• Давай РЕАЛЬНЫЕ задания строго в формате {el} (как в КИМ ФИПИ). Указывай номер задания.\n"
                "• Когда ученик отвечает — НЕМЕДЛЕННО проверяй:\n"
                "  ✅ Правильно → похвали + объясни ПОЧЕМУ правильно (1-2 предложения) + дай следующее задание.\n"
                "  ❌ Неверно → покажи правильный ответ + разбор ошибки + подсказку «Запомни:...» + следующее задание.\n"
                "• Любое сообщение ученика = его ответ. Никогда не пропускай проверку.\n"
                "• Чередуй темы и типы (тест/расчёт/анализ). Сложность нарастает.\n"
                "• После 3-4 заданий подряд — короткий итог: «Ты уже разобрал X тем, отлично! 💪»\n"
                "• В конце задания: «Жду твой ответ 👇»"
            )
        elif mode == 'explain':
            system = (
                f"Ты Studyfay — лучший репетитор по «{sl}» для {el}. Русский. 1-2 эмодзи. Формулы текстом.\n\n"
                "КАК ОБЪЯСНЯТЬ:\n"
                "1) СУТЬ — объясни простым языком, используй аналогию из жизни.\n"
                "2) ПРИМЕР — покажи на конкретной задаче или ситуации (как в экзамене).\n"
                "3) ЛОВУШКА — предупреди о типичной ошибке: «Внимание: часто путают X с Y».\n"
                "4) ВОПРОС — задай один вопрос по теме, чтобы ученик закрепил.\n\n"
                "• Задачу — реши ПОЛНОСТЬЮ пошагово с пояснением каждого шага.\n"
                "• Если тема сложная — разбей на части, предложи «Давай разберём по шагам».\n"
                "• 4-8 предложений. Если просят подробнее — расширяй."
            )
        elif mode == 'weak':
            system = (
                f"Ты Studyfay — репетитор по «{sl}» ({el}). Специалист по СЛАБЫМ МЕСТАМ. Русский. 1-2 эмодзи. Формулы текстом.\n\n"
                "МЕТОД РАБОТЫ:\n"
                "• Определи конкретную проблему ученика и работай ТОЧЕЧНО — не уходи в сторону.\n"
                "• Дай ПРАВИЛО-ШПАРГАЛКУ: «🔑 Запомни: если X — то всегда Y».\n"
                "• Покажи ПРИЁМ решения: «Лайфхак: чтобы не ошибиться, делай так...».\n"
                "• Предупреди об ОШИБКЕ: «⚠️ Типичная ловушка: многие думают X, но на самом деле Y».\n"
                "• ОБЯЗАТЕЛЬНО дай тренировочное задание того же типа + «Жду ответ 👇».\n"
                "• При проверке: ✅/❌ + разбор + если неверно — объясни ту же тему ДРУГИМИ словами."
            )
        elif mode == 'mock':
            system = (
                f"Ты строгий экзаменатор {el} по «{sl}». Имитируешь реальный экзамен. Русский. Формулы текстом.\n\n"
                "СТРОГИЙ РЕЖИМ:\n"
                f"• Задания ТОЧНО как в КИМ {el} — официальные формулировки и сложность.\n"
                "• Нумеруй: «📝 Задание 1», «📝 Задание 2» и т.д.\n"
                "• Оценка ответа: «✅ Верно» или «❌ Неверно» + объяснение (1-2 предложения) + сразу следующее.\n"
                "• Засчитывай только ТОЧНЫЕ ответы. Неполный = неверно (объясни что не хватает).\n"
                "• Без подсказок. После каждых 5 заданий — краткий счёт: «Результат: X/5 ✅».\n"
                "• В конце задания: «Ваш ответ?»"
            )
        else:
            system = (
                f"Ты Studyfay — репетитор по «{sl}» для {el}. Русский. 1-2 эмодзи. Формулы текстом.\n"
                "Структура: суть простыми словами → конкретный пример → совет для экзамена → вопрос ученику."
            )
        user_content = question[:1000]
    else:
        system = (
            "Ты Studyfay — умный и дружелюбный репетитор для школьников и студентов России.\n\n"
            "КАК ТЫ УЧИШЬ:\n"
            "• Объясняй суть ПРОСТЫМИ СЛОВАМИ — как будто рассказываешь другу. Используй аналогии из жизни.\n"
            "• Покажи на КОНКРЕТНОМ примере — из учебника, экзамена или реальной ситуации.\n"
            "• Если задача — реши ПОЛНОСТЬЮ пошагово. Каждый шаг на отдельной строке с пояснением «почему».\n"
            "• Если проверяешь ответ — сначала реши сам, потом: «Правильно ✅» или «Неверно ❌» + разбор.\n"
            "• В КОНЦЕ ответа задай ОДИН короткий вопрос по теме — чтобы ученик подумал сам и закрепил понимание.\n\n"
            "СТИЛЬ:\n"
            "• Русский. Формулы текстом: x^2, sqrt(x), a/b. Без LaTeX.\n"
            "• 4-8 предложений. Если просят подробнее — расширяй.\n"
            "• 1-2 эмодзи. Тон тёплый и поддерживающий, но фактически точный.\n"
            "• Не переспрашивай — отвечай сразу. Если вопрос неясен — дай лучший ответ + уточни.\n"
            "• Для вузовских тем: академическая точность + понятная аналогия.\n\n"
            "СТРОГИЕ ЗАПРЕТЫ:\n"
            "• НИКОГДА не используй иероглифы, китайские/японские/корейские символы.\n"
            "• НИКОГДА не рисуй таблицы (ни ASCII, ни markdown-таблицы с | и ---). Вместо таблиц используй нумерованный список.\n"
            "• НИКОГДА не ссылайся на картинки, схемы, графики, диаграммы — ты не можешь их показать.\n"
            "• НИКОГДА не используй LaTeX, формулы в $...$ или \\frac{}{}. Пиши формулы простым текстом.\n"
            "• Каждый ответ должен быть УНИКАЛЬНЫМ — не повторяй шаблонные фразы. Адаптируй стиль под контекст вопроса.\n"
            "• Не начинай каждый ответ одинаково — варьируй вступление."
        )
        user_content = question[:1000]

    system += "\n\nСТРОГИЕ ЗАПРЕТЫ (нарушение = ошибка):\n• НЕ показывай картинки/схемы/графики/диаграммы. Не пиши «смотри на рисунок».\n• НЕ используй иероглифы или нелатинские/нерусские символы.\n• НЕ рисуй таблицы (ни ASCII с |---, ни markdown). Используй нумерованный список.\n• НЕ используй LaTeX ($, \\frac, \\sqrt). Формулы ТОЛЬКО текстом: x^2, sqrt(x), a/b.\n• Каждый ответ УНИКАЛЕН — варьируй стиль, вступления и примеры. Не повторяй шаблоны."

    if has_context:
        system += f"\n\nМатериалы пользователя (используй для ответа):\n{ctx_trimmed}"

    if image_base64:
        answer, tokens = ask_ai_vision(question, system, image_base64)
        return answer, tokens

    messages_list = [{"role": "system", "content": system}]
    if history:
        for h in history[-6:]:
            role = h.get('role', 'user')
            content = h.get('content', '')
            if role in ('user', 'assistant') and content:
                messages_list.append({"role": role, "content": content[:400]})
    messages_list.append({"role": "user", "content": user_content})

    for attempt in range(3):
        try:
            print(f"[AI] -> OpenRouter/Llama {'[exam]' if exam_meta else ''} attempt:{attempt} q_len:{len(user_content)}", flush=True)
            resp = client.chat.completions.create(
                model=LLAMA_MODEL,
                messages=messages_list,
                temperature=0.5,
                max_tokens=800,
            )
            answer = resp.choices[0].message.content
            tokens = resp.usage.total_tokens if resp.usage else 0
            print(f"[AI] OpenRouter/Llama OK attempt:{attempt} tokens:{tokens}", flush=True)
            answer = sanitize_answer(answer)
            if answer and not answer.rstrip().endswith(('.', '!', '?', ')', '»', '`', '*')):
                answer = answer.rstrip() + '.'
            return answer, tokens
        except Exception as e:
            print(f"[AI] OpenRouter/Llama FAIL attempt:{attempt}: {type(e).__name__}: {str(e)[:200]}", flush=True)
            if attempt < 2:
                import time as _t
                _t.sleep(0.5)
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
        print(f"[AI] Vision->text, sending to Llama: {combined[:80]}", flush=True)
        try:
            resp = client.chat.completions.create(
                model=LLAMA_MODEL,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": combined[:1000]}
                ],
                temperature=0.5,
                max_tokens=900,
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

def build_smart_fallback(question, context):
    """Fallback когда Artemox недоступен — умный ответ без упоминания ошибок"""
    q = question.lower().strip()
    if any(w in q for w in ['привет', 'здравствуй', 'хай']):
        return "Привет! Я Studyfay — твой репетитор. Задавай любой вопрос — разберём вместе!"
    # Пробуем найти в кэше тем
    cached = get_demo_cache(question)
    if cached:
        return cached
    if any(w in q for w in ['объясни', 'что такое', 'расскажи', 'как работает']):
        return "Давай разберём эту тему! 📚\nУточни, какой именно аспект тебя интересует — дам точный ответ с примером."
    if any(w in q for w in ['задание', 'задача', 'пример', 'реши']):
        return "Готов порешать! ✏️\nНапиши тему задания конкретнее — и я дам задачу уровня ЕГЭ с разбором."
    return "Хороший вопрос! 🤔\nУточни тему или предмет — отвечу подробно с примером."

DEMO_SYSTEM = (
    "Ты Studyfay — умный репетитор для школьников и студентов России. Русский. Формулы текстом (x^2, sqrt, a/b). 1-2 эмодзи.\n"
    "Объясняй ПРОСТЫМИ СЛОВАМИ с аналогией из жизни → покажи на примере → дай совет для экзамена.\n"
    "Задачу — реши пошагово. Проверка ответа: реши сам → ✅ или ❌ + объясни.\n"
    "В конце задай один вопрос по теме. Длина 4-6 предложений.\n"
    "СТРОГИЕ ЗАПРЕТЫ: НЕ показывай картинки/схемы/графики. НЕ рисуй таблицы (ни ASCII, ни markdown). "
    "НЕ используй иероглифы и нелатинские/нерусские символы. НЕ используй LaTeX ($, \\frac). "
    "Каждый ответ УНИКАЛЕН — варьируй стиль и вступления."
)

DEMO_RATE_LIMIT: dict = {}

# ---------------------------------------------------------------------------
# Кэш популярных тем — мгновенный ответ без вызова ИИ
# ---------------------------------------------------------------------------
DEMO_CACHE: dict[str, str] = {
    # Математика
    "производная": "Коротко: производная — это скорость изменения функции в точке. 📈\nПример: если f(x) = x², то f'(x) = 2x — при x=3 скорость роста равна 6.\nХочешь глубже — скажи.",
    "интеграл": "Коротко: интеграл — это площадь под графиком функции. 📐\nПример: интеграл от 0 до 2 функции x равен 2 — это площадь треугольника под прямой.\nХочешь глубже — скажи.",
    "логарифм": "Коротко: логарифм — это показатель степени, в которую нужно возвести основание чтобы получить число. 🔢\nПример: log₂(8) = 3, потому что 2³ = 8.\nХочешь глубже — скажи.",
    "теорема пифагора": "Коротко: в прямоугольном треугольнике квадрат гипотенузы равен сумме квадратов катетов. 📐\nПример: катеты 3 и 4 → гипотенуза √(9+16) = 5.\nХочешь глубже — скажи.",
    "пифагор": "Коротко: в прямоугольном треугольнике квадрат гипотенузы равен сумме квадратов катетов. 📐\nПример: катеты 3 и 4 → гипотенуза √(9+16) = 5.\nХочешь глубже — скажи.",
    "синус косинус": "Коротко: синус и косинус — отношения сторон прямоугольного треугольника к гипотенузе. 📐\nПример: в треугольнике с углом 30° синус = 0.5, значит противолежащий катет вдвое меньше гипотенузы.\nХочешь глубже — скажи.",
    "тригонометрия": "Коротко: тригонометрия изучает связи между углами и сторонами треугольника. 📐\nПример: sin(30°) = 0.5, cos(60°) = 0.5 — их можно запомнить по таблице.\nХочешь глубже — скажи.",
    "уравнение": "Коротко: уравнение — это равенство с неизвестным, которое нужно найти. ✏️\nПример: 2x + 4 = 10 → x = 3. Переносим числа, делим обе части.\nХочешь глубже — скажи.",
    "дробь": "Коротко: дробь показывает часть от целого — числитель делим на знаменатель. ➗\nПример: 3/4 = 0.75 — три части из четырёх.\nХочешь глубже — скажи.",
    "степень": "Коротко: степень — это произведение числа на себя несколько раз. 🔢\nПример: 2³ = 2×2×2 = 8. Основание 2, показатель 3.\nХочешь глубже — скажи.",
    "прогрессия": "Коротко: прогрессия — последовательность чисел по определённому правилу. 📊\nПример: 2, 4, 6, 8 — арифметическая (каждый раз +2); 2, 4, 8, 16 — геометрическая (×2).\nХочешь глубже — скажи.",

    # Физика
    "закон ома": "Коротко: закон Ома — сила тока равна напряжению делённому на сопротивление: I = U/R. ⚡\nПример: напряжение 12В, сопротивление 4Ом → ток 3А.\nХочешь глубже — скажи.",
    "закон ньютона": "Коротко: второй закон Ньютона — сила равна массе умножить на ускорение: F = ma. 🚀\nПример: масса 2кг, ускорение 5 м/с² → сила 10Н.\nХочешь глубже — скажи.",
    "ньютон": "Коротко: второй закон Ньютона — сила равна массе умножить на ускорение: F = ma. 🚀\nПример: масса 2кг, ускорение 5 м/с² → сила 10Н.\nХочешь глубже — скажи.",
    "кинетическая энергия": "Коротко: кинетическая энергия — энергия движущегося тела: Ek = mv²/2. ⚡\nПример: машина 1000кг едет 10 м/с → Ek = 50000Дж = 50кДж.\nХочешь глубже — скажи.",
    "потенциальная энергия": "Коротко: потенциальная энергия — запасённая энергия из-за положения тела: Ep = mgh. 🏔\nПример: камень 1кг на высоте 10м → Ep = 1×10×10 = 100Дж.\nХочешь глубже — скажи.",
    "скорость": "Коротко: скорость — расстояние пройденное за единицу времени: v = s/t. 🚗\nПример: проехал 120км за 2 часа → v = 60 км/ч.\nХочешь глубже — скажи.",
    "ускорение": "Коротко: ускорение — изменение скорости за единицу времени: a = Δv/t. 🚀\nПример: скорость выросла с 0 до 20 м/с за 4с → a = 5 м/с².\nХочешь глубже — скажи.",
    "электрический ток": "Коротко: электрический ток — направленное движение заряженных частиц. ⚡\nПример: в проводе электроны текут от минуса к плюсу, создавая ток.\nХочешь глубже — скажи.",

    # Химия
    "молярная масса": "Коротко: молярная масса — масса одного моля вещества в граммах, равна атомной/молярной массе из таблицы. ⚗️\nПример: молярная масса воды H₂O = 2×1 + 16 = 18 г/моль.\nХочешь глубже — скажи.",
    "валентность": "Коротко: валентность — способность атома образовывать химические связи. ⚗️\nПример: кислород всегда двухвалентен: в H₂O он образует 2 связи с водородом.\nХочешь глубже — скажи.",
    "оксид": "Коротко: оксид — бинарное соединение элемента с кислородом. ⚗️\nПример: CO₂ — оксид углерода (углекислый газ), Fe₂O₃ — оксид железа (ржавчина).\nХочешь глубже — скажи.",
    "кислота": "Коротко: кислота — вещество, которое в воде отдаёт ионы водорода H⁺. ⚗️\nПример: HCl — соляная кислота, H₂SO₄ — серная. Лакмус краснеет.\nХочешь глубже — скажи.",
    "электролиз": "Коротко: электролиз — разложение вещества электрическим током. ⚡\nПример: при электролизе воды на катоде выделяется водород, на аноде — кислород.\nХочешь глубже — скажи.",

    # Биология
    "фотосинтез": "Коротко: фотосинтез — процесс превращения CO₂ и воды в глюкозу под действием света. 🌿\nПример: 6CO₂ + 6H₂O + свет → C₆H₁₂O₆ + 6O₂. Именно так лист вырабатывает кислород.\nХочешь глубже — скажи.",
    "митоз": "Коротко: митоз — деление клетки на две одинаковые дочерние с тем же набором хромосом. 🔬\nПример: из одной клетки с 46 хромосомами получаются две клетки с 46 хромосомами каждая.\nХочешь глубже — скажи.",
    "мейоз": "Коротко: мейоз — деление клетки, при котором количество хромосом уменьшается вдвое. 🔬\nПример: из клетки с 46 хромосомами образуются 4 клетки с 23 хромосомами (половые клетки).\nХочешь глубже — скажи.",
    "днк": "Коротко: ДНК — молекула, хранящая генетическую информацию в виде последовательности нуклеотидов. 🧬\nПример: ДНК — как инструкция по сборке организма, записанная буквами А, Т, Г, Ц.\nХочешь глубже — скажи.",
    "рнк": "Коротко: РНК — молекула, которая переносит информацию от ДНК к рибосомам для синтеза белка. 🧬\nПример: мРНК считывает код ДНК и несёт его к рибосоме, где строится белок.\nХочешь глубже — скажи.",
    "клетка": "Коротко: клетка — структурная и функциональная единица всех живых организмов. 🔬\nПример: у человека ~37 триллионов клеток, у каждой есть оболочка, цитоплазма и ядро.\nХочешь глубже — скажи.",
    "белок": "Коротко: белок — сложная молекула из аминокислот, выполняющая множество функций в клетке. 🧬\nПример: гемоглобин — белок крови, переносящий кислород; инсулин — белок-гормон.\nХочешь глубже — скажи.",

    # История / Обществознание
    "конституция": "Коротко: конституция — основной закон государства, которому подчинены все остальные законы. 📜\nПример: Конституция РФ 1993 года закрепляет права граждан и устройство власти.\nХочешь глубже — скажи.",
    "реформа": "Коротко: реформа — постепенное преобразование общества или государства без смены власти. 📜\nПример: отмена крепостного права в 1861 году — великая реформа Александра II.\nХочешь глубже — скажи.",
}

def _normalize(text: str) -> str:
    """Нормализует вопрос для поиска в кэше"""
    import re
    t = text.lower().strip()
    t = re.sub(r'[^\w\s]', '', t)
    t = re.sub(r'\s+', ' ', t)
    return t

SESSION_TOPIC_CACHE: dict[str, str] = {
    "квадратные уравнения": "Квадратное уравнение — это уравнение вида ax² + bx + c = 0, где a ≠ 0.\nПример: x² - 5x + 6 = 0. Решаем через дискриминант D = b² - 4ac = 25 - 24 = 1. Корни: x₁ = (5+1)/2 = 3, x₂ = (5-1)/2 = 2.",
    "производная функции": "Производная показывает скорость изменения функции в каждой точке.\nПример: f(x) = x³, тогда f'(x) = 3x². При x=2 скорость роста равна 12.",
    "интегралы": "Интеграл — площадь под графиком функции.\nПример: интеграл от x² равен x³/3 + C. Определённый интеграл от 0 до 2 равен 8/3 ≈ 2.67.",
    "логарифмы": "Логарифм log_a(b) — это показатель, в который нужно возвести a, чтобы получить b.\nПример: log₂(8) = 3, потому что 2³ = 8. log₁₀(1000) = 3.",
    "тригонометрия": "Тригонометрия — раздел о связях углов и сторон треугольника.\nПример: sin(30°) = 0.5, cos(60°) = 0.5. В прямоугольном треугольнике с гипотенузой 10 и углом 30° противолежащий катет = 5.",
    "пределы": "Предел — значение, к которому стремится функция при приближении аргумента к точке.\nПример: lim(x→2) (x²-4)/(x-2) = lim(x→2)(x+2) = 4. Делим на общий множитель.",
    "матрицы и определители": "Матрица — таблица чисел. Определитель 2×2: |a b; c d| = ad - bc.\nПример: матрица [[3,1],[2,4]] — определитель = 3×4 - 1×2 = 10.",
    "законы ньютона": "Три закона Ньютона описывают движение тел.\nПример: второй закон F = ma. Тело массой 2 кг с ускорением 5 м/с² требует силы 10 Н.",
    "электрическое поле": "Электрическое поле — пространство вокруг заряда, в котором действует сила.\nПример: заряд +1 Кл создаёт поле. На расстоянии 1 м сила на заряд +1 Кл равна 9×10⁹ Н.",
    "магнетизм": "Магнитное поле создаётся движущимися зарядами и постоянными магнитами.\nПример: проводник с током 1 А в поле B=1 Тл и длиной 1 м испытывает силу 1 Н.",
    "оптика": "Оптика изучает природу и распространение света.\nПример: угол падения равен углу отражения. Линза с фокусом 10 см удваивает изображение объекта на 20 см.",
    "термодинамика": "Термодинамика — наука о теплоте и её переходе в другие формы энергии.\nПример: КПД тепловой машины η = (T₁-T₂)/T₁. При 600К и 300К КПД = 50%.",
    "реакции окисления-восстановления": "ОВР — реакции с переносом электронов. Окисление — отдача e⁻, восстановление — принятие e⁻.\nПример: Fe + CuSO₄ → FeSO₄ + Cu. Железо окисляется, медь восстанавливается.",
    "органические соединения": "Органические вещества содержат атомы углерода.\nПример: алканы (CH₄ — метан), алкены (C₂H₄ — этилен), спирты (C₂H₅OH — этанол).",
    "клеточное строение": "Все живые организмы состоят из клеток. Клетка: мембрана, цитоплазма, ядро.\nПример: у человека ~37 триллионов клеток. Растительная клетка имеет клеточную стенку из целлюлозы.",
    "генетика и наследственность": "Генетика изучает наследование признаков. Ген — участок ДНК, кодирующий белок.\nПример: закон Менделя: при скрещивании Aa × Aa потомство: 25% AA, 50% Aa, 25% aa.",
    "алгоритмы сортировки": "Алгоритм сортировки — упорядочивание элементов по правилу.\nПример: пузырьковая сортировка [3,1,2] → сравниваем пары → [1,2,3] за 3 прохода.",
    "рекурсия": "Рекурсия — функция, которая вызывает саму себя.\nПример: factorial(n) = n × factorial(n-1). factorial(5) = 5×4×3×2×1 = 120.",
    "петровские реформы": "Пётр I провёл реформы, превратив Россию в империю.\nПример: создал регулярную армию и флот, ввёл гражданский шрифт, основал Санкт-Петербург в 1703 году.",
    "вторая мировая война": "Вторая мировая война 1939–1945. СССР вступил в 1941 году.\nПример: Сталинградская битва 1942–1943 — переломный момент. Потери СССР — более 27 млн человек.",
    "причастие и деепричастие": "Причастие — особая форма глагола, отвечает на вопросы «какой? что делающий?». Деепричастие — добавочное действие.\nПример: «читающий студент» (причастие), «читая книгу» (деепричастие).",
    "сложноподчинённые предложения": "СПП — предложение с главной и придаточной частью, связанными союзом.\nПример: «Я знаю, [что ты придёшь]». Придаточная часть — «что ты придёшь».",
    "конституция рф": "Конституция РФ принята в 1993 году — основной закон страны.\nПример: статья 2 — человек, его права и свободы — высшая ценность. Президент избирается на 6 лет.",
    "рыночная экономика": "Рыночная экономика — система, где цены устанавливает рынок через спрос и предложение.\nПример: если яблок мало — цена растёт. Если много — падает. Государство не устанавливает цены.",
}

def get_demo_cache(question: str) -> str | None:
    """Ищет точное или частичное совпадение в кэше популярных тем.
    Не срабатывает на follow-up запросы (они длинные и содержат кавычки/спецфразы)."""
    q_lower = question.lower()

    # Session-промпты (длинные, содержат тему в кавычках) — ищем в SESSION_TOPIC_CACHE
    import re
    session_match = re.search(r'тему "([^"]+)"', q_lower)
    if session_match:
        topic_key = session_match.group(1).strip()
        for key, val in SESSION_TOPIC_CACHE.items():
            if key in topic_key or topic_key in key:
                return val

    # Follow-up запросы — не кэшируем
    followup_markers = ['"', 'объясни ещё проще', 'объясни еще проще', 'дай одно задание',
                        'разбери тему', 'глубже', 'типичные ошибки', 'уровня егэ', 'как для 5-классника']
    if any(m in q_lower for m in followup_markers):
        return None
    # Слишком длинный вопрос — скорее всего не про одну тему
    if len(question) > 60:
        return None
    norm = _normalize(question)
    # 1. Точное совпадение ключа
    if norm in DEMO_CACHE:
        return DEMO_CACHE[norm]
    # 2. Ключ входит в вопрос
    for key, answer in DEMO_CACHE.items():
        if key in norm:
            return answer
    return None

def handler(event: dict, context) -> dict:
    """ИИ-ассистент Studyfay: отвечает на вопросы студентов"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': ''}

    # --- DEMO без авторизации ---
    if method == 'POST':
        body_raw = event.get('body', '{}')
        try:
            body_demo = json.loads(body_raw)
        except Exception:
            body_demo = {}

        # --- PHOTO SOLVE (требует авторизации, но обрабатывается до demo check) ---
        if body_demo.get('action') == 'photo_solve':
            token_ps = event.get('headers', {}).get('X-Authorization', '').replace('Bearer ', '')
            uid_ps = get_user_id(token_ps)
            if not uid_ps:
                return err(401, {'error': 'Требуется авторизация'})
            image_b64 = body_demo.get('image_base64', '').strip()
            hint_ps = body_demo.get('hint', '').strip()[:300]
            if not image_b64:
                return err(400, {'error': 'Нет фото. Передай image_base64'})
            if len(image_b64) > 14_000_000:
                return err(400, {'error': 'Фото слишком большое. Максимум 10 МБ'})
            conn_ps = psycopg2.connect(DATABASE_URL)
            try:
                limit_info_ps = _check_photo_limit(conn_ps, uid_ps)
                if not limit_info_ps['has_access']:
                    used_ps = limit_info_ps.get('used', 0)
                    lim_ps = limit_info_ps.get('limit', FREE_DAILY_PHOTOS)
                    is_prem_ps = limit_info_ps.get('is_premium', False)
                    return err(403, {
                        'error': 'limit',
                        'message': (
                            f'Лимит фото на сегодня исчерпан ({used_ps}/{lim_ps}). '
                            f'{"Купи пакет или подожди завтра." if is_prem_ps else "Подключи Premium (5 фото/день) или купи пакет."}'
                        ),
                        'used': used_ps, 'limit': lim_ps,
                        'is_premium': is_prem_ps,
                        'bonus_remaining': limit_info_ps.get('bonus_remaining', 0)
                    })
                from_bonus_ps = limit_info_ps.get('from_bonus', False)
                _increment_photo_count(conn_ps, uid_ps, from_bonus_ps)
                new_used_ps = limit_info_ps['used'] + (0 if from_bonus_ps else 1)
                new_bonus_ps = max(0, limit_info_ps['bonus_remaining'] - (1 if from_bonus_ps else 0))
                daily_left_ps = max(0, limit_info_ps['limit'] - new_used_ps)
            finally:
                conn_ps.close()
            print(f"[PHOTO] User:{uid_ps} solving photo hint={hint_ps[:30]}", flush=True)
            result_ps = _ocr_and_solve(image_b64, hint_ps)
            return ok({
                'recognized_text': result_ps['recognized_text'],
                'solution': result_ps['solution'],
                'subject': result_ps['subject'],
                'remaining': daily_left_ps + new_bonus_ps,
                'used': new_used_ps,
                'limit': limit_info_ps['limit'],
                'bonus_remaining': new_bonus_ps,
            })

        # --- SMART CHAT (multimodal: text + audio + image via Llama + Whisper) ---
        if body_demo.get('action') == 'gemini_chat':
            token_gc = event.get('headers', {}).get('X-Authorization', '').replace('Bearer ', '')
            uid_gc = get_user_id(token_gc)
            if not uid_gc:
                return err(401, {'error': 'Требуется авторизация'})

            message_gc = (body_demo.get('message') or '').strip()
            image_b64_gc = (body_demo.get('image_base64') or '').strip()
            audio_b64_gc = (body_demo.get('audio_base64') or '').strip()
            audio_format_gc = (body_demo.get('audio_format') or 'webm').strip().lower()
            history_gc = body_demo.get('history') or []

            if not message_gc and not image_b64_gc and not audio_b64_gc:
                return err(400, {'error': 'Нужно отправить текст, фото или аудио'})

            if image_b64_gc and len(image_b64_gc) > 14_000_000:
                return err(400, {'error': 'Фото слишком большое. Максимум 10 МБ'})
            if audio_b64_gc and len(audio_b64_gc) > 20_000_000:
                return err(400, {'error': 'Аудио слишком большое. Максимум 15 МБ'})

            conn_gc = psycopg2.connect(DATABASE_URL)
            conn_gc.autocommit = True
            try:
                access_gc = check_access(conn_gc, uid_gc)
                if not access_gc.get('has_access'):
                    reason_gc = access_gc.get('reason', 'limit')
                    if reason_gc == 'daily_limit':
                        msg_gc = 'Дневной лимит исчерпан. Купи пакет вопросов или подожди до завтра!'
                    elif access_gc.get('is_free'):
                        msg_gc = 'Бесплатный лимит исчерпан. Оформи подписку или купи пакет!'
                    else:
                        msg_gc = 'Лимит исчерпан. Оформи подписку для продолжения.'
                    return err(403, {
                        'error': 'limit',
                        'message': msg_gc,
                        'used': access_gc.get('used', 0),
                        'limit': access_gc.get('limit', 0),
                        'is_premium': access_gc.get('is_premium', False),
                    })

                sid_gc = get_session(conn_gc, uid_gc)

                transcript_gc = None
                actual_question = message_gc
                has_image = bool(image_b64_gc)

                # --- Step 1: Whisper STT for audio ---
                if audio_b64_gc:
                    import base64 as _b64
                    try:
                        ext = 'webm' if audio_format_gc == 'webm' else 'wav'
                        audio_bytes = _b64.b64decode(audio_b64_gc)
                        print(f"[WHISPER] User:{uid_gc} format:{ext} size:{len(audio_bytes)}", flush=True)

                        import io as _io
                        boundary = '----StudyfayAudio'
                        body_parts = []
                        body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1')
                        body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="language"\r\n\r\nru')
                        body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.{ext}"\r\nContent-Type: audio/{ext}\r\n\r\n')
                        pre = '\r\n'.join(body_parts).encode('utf-8')
                        post = f'\r\n--{boundary}--\r\n'.encode('utf-8')
                        multipart_body = pre + audio_bytes + post

                        whisper_resp = _http_whisper.post(
                            'https://api.aitunnel.ru/v1/audio/transcriptions',
                            content=multipart_body,
                            headers={
                                'Authorization': f'Bearer {OPENROUTER_API_KEY}',
                                'Content-Type': f'multipart/form-data; boundary={boundary}',
                            },
                        )
                        if whisper_resp.status_code == 200:
                            whisper_data = whisper_resp.json()
                            transcript_gc = whisper_data.get('text', '').strip()
                            print(f"[WHISPER] OK: {transcript_gc[:100]}", flush=True)
                            if transcript_gc:
                                actual_question = transcript_gc
                        else:
                            print(f"[WHISPER] FAIL status:{whisper_resp.status_code} body:{whisper_resp.text[:300]}", flush=True)
                    except Exception as e_w:
                        print(f"[WHISPER] ERROR: {type(e_w).__name__}: {str(e_w)[:200]}", flush=True)

                if not actual_question and not has_image:
                    return ok({
                        'answer': 'Не удалось распознать речь. Попробуй записать ещё раз, говори чётче.',
                        'transcript': '',
                        'remaining': access_gc.get('remaining', 0),
                        'used': access_gc.get('used', 0),
                        'limit': access_gc.get('limit', 0),
                        'is_premium': access_gc.get('is_premium', False),
                    })

                # --- Step 2: Build system prompt ---
                system_gc = (
                    "Ты Studyfay — лучший репетитор для школьников и студентов России. Твоя задача — давать КАЧЕСТВЕННЫЕ, ПОДРОБНЫЕ ответы.\n\n"
                    "КАК ТЫ УЧИШЬ:\n"
                    "• Объясняй суть ПРОСТЫМИ СЛОВАМИ с аналогией из жизни.\n"
                    "• Если задача — реши ПОЛНОСТЬЮ пошагово. Каждый шаг на отдельной строке с пояснением «почему».\n"
                    "• ПРОВЕРЯЙ свои вычисления: после решения подставь ответ обратно в условие.\n"
                    "• Покажи на КОНКРЕТНОМ примере из учебника или экзамена.\n"
                    "• В конце — ОДИН короткий вопрос по теме для закрепления.\n\n"
                    "РАБОТА С ФОТО:\n"
                    "• Сначала ОПРЕДЕЛИ, что на фото: учебное задание, бытовой вопрос, предмет, текст, или просто фотография.\n"
                    "• Если это учебное задание (задача, тест, уравнение) — реши его ПОЛНОСТЬЮ пошагово.\n"
                    "• Если это НЕ учебное задание — просто опиши что ты видишь и ответь на вопрос пользователя.\n"
                    "• Если пользователь приложил фото без текстового вопроса и на фото нет задания — спроси, чем ты можешь помочь.\n"
                    "• НЕ выдумывай задания, если их нет на фото. Не навязывай решение если фото бытовое.\n\n"
                    "СТИЛЬ:\n"
                    "• Русский. Формулы текстом: x^2, sqrt(x), a/b. Без LaTeX.\n"
                    "• 6-15 предложений. Отвечай ПОДРОБНО, не экономь на объяснениях.\n"
                    "• 1-2 эмодзи. Тон тёплый, но фактически точный.\n"
                    "• Не переспрашивай — отвечай сразу.\n\n"
                    "СТРОГИЕ ЗАПРЕТЫ:\n"
                    "• НЕ используй иероглифы/китайские/японские символы.\n"
                    "• НЕ рисуй таблицы (ни ASCII, ни markdown). Используй нумерованный список.\n"
                    "• НЕ ссылайся на картинки/схемы — ты не можешь их показать.\n"
                    "• НЕ используй LaTeX ($, \\frac). Формулы ТОЛЬКО текстом.\n"
                    "• Каждый ответ УНИКАЛЕН — варьируй стиль и вступления."
                )

                # --- Step 3: Build messages for Llama ---
                messages_gc = [{"role": "system", "content": system_gc}]

                if history_gc:
                    for h in history_gc[-10:]:
                        h_role = h.get('role', 'user')
                        h_content = str(h.get('content', ''))[:500]
                        if h_role in ('user', 'assistant') and h_content:
                            messages_gc.append({"role": h_role, "content": h_content})

                if has_image:
                    user_content = []
                    user_content.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{image_b64_gc}"}
                    })
                    text_instruction = actual_question or ''
                    if not text_instruction:
                        text_instruction = "Внимательно рассмотри фото. Определи что на нём: если учебное задание — реши пошагово, если нет — опиши что видишь и спроси чем помочь."
                    else:
                        text_instruction = f"{text_instruction}\n\n(Смотри приложенное фото)"
                    user_content.append({"type": "text", "text": text_instruction[:3000]})
                    messages_gc.append({"role": "user", "content": user_content})
                else:
                    if transcript_gc:
                        q_text = f'Ты спросил: "{transcript_gc}"\n\nОтветь подробно на этот вопрос.'
                    else:
                        q_text = actual_question
                    messages_gc.append({"role": "user", "content": q_text[:3000]})

                user_text_for_save = actual_question or ('[фото задания]' if has_image else '[аудио]')
                save_msg(conn_gc, sid_gc, uid_gc, 'user', user_text_for_save[:500])

                # --- Step 4: Call Llama ---
                answer_gc = None
                tokens_gc = 0
                llama_vision_model = 'meta-llama/llama-4-maverick' if has_image else LLAMA_MODEL

                for _attempt_gc in range(2):
                    try:
                        print(f"[CHAT] User:{uid_gc} attempt:{_attempt_gc} msg:{actual_question[:60] if actual_question else ''} img:{has_image} model:{llama_vision_model}", flush=True)
                        if has_image:
                            with httpx.Client(timeout=httpx.Timeout(30.0, connect=5.0)) as _hc:
                                _r = _hc.post(
                                    f"{OPENROUTER_BASE_URL}chat/completions",
                                    json={
                                        "model": llama_vision_model,
                                        "messages": messages_gc,
                                        "temperature": 0.4,
                                        "max_tokens": 2000,
                                    },
                                    headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"},
                                )
                            if _r.status_code != 200:
                                raise Exception(f"Llama Vision {_r.status_code}: {_r.text[:300]}")
                            _rd = _r.json()
                            raw_answer_gc = _rd['choices'][0]['message']['content']
                            tokens_gc = _rd.get('usage', {}).get('total_tokens', 0)
                        else:
                            resp_gc = client.chat.completions.create(
                                model=llama_vision_model,
                                messages=messages_gc,
                                temperature=0.4,
                                max_tokens=2000,
                            )
                            raw_answer_gc = resp_gc.choices[0].message.content
                            tokens_gc = resp_gc.usage.total_tokens if resp_gc.usage else 0
                        answer_gc = sanitize_answer(raw_answer_gc)
                        if answer_gc and not answer_gc.rstrip().endswith(('.', '!', '?', ')', '»', '`', '*')):
                            answer_gc = answer_gc.rstrip() + '.'
                        print(f"[CHAT] OK tokens:{tokens_gc} ans:{answer_gc[:80]}", flush=True)
                        break
                    except Exception as e_gc:
                        print(f"[CHAT] FAIL attempt:{_attempt_gc}: {type(e_gc).__name__}: {str(e_gc)[:200]}", flush=True)
                        if _attempt_gc == 0:
                            import time as _tg
                            _tg.sleep(1)
                        answer_gc = None

                if not answer_gc:
                    return ok({
                        'answer': 'Не удалось получить ответ. Попробуй ещё раз через пару секунд!',
                        'remaining': access_gc.get('remaining', 0),
                        'used': access_gc.get('used', 0),
                        'limit': access_gc.get('limit', 0),
                        'is_premium': access_gc.get('is_premium', False),
                        'error': True
                    })

                increment_questions(conn_gc, uid_gc, access_gc)
                remaining_gc = max(0, access_gc.get('remaining', 1) - 1)

                def _bg_chat_save(uid, ans, tok, session_id):
                    try:
                        c2 = psycopg2.connect(DATABASE_URL)
                        c2.autocommit = True
                        save_msg(c2, session_id, uid, 'assistant', ans, None, tok, False)
                        c2.close()
                    except Exception as ex:
                        print(f"[CHAT] bg_save err: {ex}", flush=True)
                threading.Thread(target=_bg_chat_save, args=(uid_gc, answer_gc, tokens_gc, sid_gc), daemon=True).start()

                result_gc = {
                    'answer': answer_gc,
                    'remaining': remaining_gc,
                    'used': access_gc.get('used', 0) + 1,
                    'limit': access_gc.get('limit', 0),
                    'is_premium': access_gc.get('is_premium', False),
                }
                if transcript_gc:
                    result_gc['transcript'] = transcript_gc

                return ok(result_gc)
            finally:
                conn_gc.close()

        if body_demo.get('action') == 'demo_ask':
            question = body_demo.get('question', '').strip()
            if not question:
                return err(400, {'error': 'Введи вопрос'})
            ip = (event.get('requestContext', {}) or {}).get('identity', {}).get('sourceIp', 'unknown')
            now_ts = datetime.now()
            hits = DEMO_RATE_LIMIT.get(ip, [])
            hits = [t for t in hits if (now_ts - t).total_seconds() < 3600]
            if len(hits) >= 10:
                return err(429, {'error': 'Слишком много запросов. Попробуй позже.'})
            hits.append(now_ts)
            DEMO_RATE_LIMIT[ip] = hits
            import time as _time
            t0 = _time.time()
            history = body_demo.get('history', [])
            print(f"[DEMO] ip:{ip} q:{question[:60]} history:{len(history)}", flush=True)
            # Кэш только если нет истории (первый вопрос про тему)
            if not history:
                cached_answer = get_demo_cache(question)
                if cached_answer:
                    print(f"[DEMO] cache hit time:{_time.time()-t0:.3f}s", flush=True)
                    return ok({'answer': cached_answer, 'cached': True})
            answer, tokens = ask_ai_demo(question[:300], history)
            print(f"[DEMO] tokens:{tokens} time:{_time.time()-t0:.1f}s", flush=True)
            return ok({'answer': answer})

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
            exam_meta = body.get('exam_meta', None)
            history = body.get('history', [])
            # system_only=true — системный промпт (шаги сессии, первый промпт экзамена)
            # НЕ тратит лимит пользователя
            system_only = body.get('system_only', False)

            if not question and not image_base64:
                return err(400, {'error': 'Введи вопрос'})

            print(f"[AI] User:{user_id} Q:{question[:60]} M:{material_ids} sys_only:{system_only}", flush=True)

            # Системные промпты (шаги сессии, стартовый промпт экзамена) не тратят лимит
            if system_only:
                ctx = get_context(conn, user_id, material_ids)
                answer, tokens = ask_ai(question, ctx, image_base64, exam_meta=exam_meta, history=history)
                sid = get_session(conn, user_id)
                save_msg(conn, sid, user_id, 'assistant', answer, material_ids, tokens, False)
                return ok({'answer': answer, 'remaining': None, 'system_only': True})

            access = check_access(conn, user_id)
            if not access.get('has_access'):
                reason = access.get('reason', 'limit')
                if reason == 'daily_limit':
                    msg = 'Дневной лимит 20 вопросов исчерпан. Купи пакет вопросов или подожди до завтра!'
                elif access.get('is_soft_landing'):
                    days_left = access.get('soft_landing_days_left', 1)
                    msg = f'Сегодняшний лимит {SOFT_LANDING_LIMIT} вопросов исчерпан. Ещё {days_left} д. расширенного доступа — потом 3 вопроса/день. Оформи подписку!'
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
                    'is_soft_landing': access.get('is_soft_landing', False),
                    'daily_exhausted': access.get('is_premium', False)
                })

            action_type = detect_action(question)

            # --- КЭША ПРОВЕРЯЕМ ПЕРВОЙ (до get_context и get_session) ---
            if not image_base64 and action_type not in ('task', 'schedule'):
                cached = get_cache(conn, question, material_ids)
                if cached:
                    print(f"[AI] cache hit — fast return", flush=True)
                    increment_questions(conn, user_id, access)
                    remaining_now = max(0, access.get('remaining', 1) - 1)
                    def _bg_cache(uid, q, mids, ans):
                        try:
                            c2 = psycopg2.connect(DATABASE_URL)
                            c2.autocommit = True
                            sid2 = get_session(c2, uid)
                            save_msg(c2, sid2, uid, 'user', q, mids)
                            save_msg(c2, sid2, uid, 'assistant', ans, mids, 0, True)
                            c2.close()
                        except Exception as ex:
                            print(f"[AI] bg_cache err: {ex}", flush=True)
                    threading.Thread(target=_bg_cache, args=(user_id, question, material_ids, cached), daemon=True).start()
                    return ok({'answer': cached, 'remaining': remaining_now, 'cached': True})

            # --- СЕССИЯ И СООБЩЕНИЕ ПОЛЬЗОВАТЕЛЯ ---
            sid = get_session(conn, user_id)
            save_msg(conn, sid, user_id, 'user', question, material_ids)

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
                    remaining_now = max(0, access.get('remaining', 1) - 1)
                    ans = f"✅ **Задача создана!**\n\n📋 **{task[1]}**" + (f"\n📚 Предмет: {subj}" if subj else "") + "\n\nНайдёшь её в разделе **Планировщик**."
                    save_msg(conn, sid, user_id, 'assistant', ans)
                    return ok({'answer': ans, 'remaining': remaining_now, 'action': 'task_created'})
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
                    remaining_now = max(0, access.get('remaining', 1) - 1)
                    days_names = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье']
                    dn = days_names[lesson[2]] if lesson[2] is not None else 'не указан'
                    ans = f"✅ **Занятие добавлено!**\n\n📚 **{lesson[1]}** — {parsed['type']}\n📅 {dn}"
                    if parsed['start_time']:
                        ans += f" в {parsed['start_time']}"
                    ans += "\n\nСмотри в **Расписании**."
                    save_msg(conn, sid, user_id, 'assistant', ans)
                    return ok({'answer': ans, 'remaining': remaining_now, 'action': 'schedule_created'})
                except Exception as e:
                    print(f"[AI] schedule error: {e}", flush=True)

            # --- КОНТЕКСТ + ИИ ---
            ctx = get_context(conn, user_id, material_ids)
            answer, tokens = ask_ai(question, ctx, image_base64, exam_meta=exam_meta, history=history)

            ai_error = (answer == build_smart_fallback(question, ctx))

            if not ai_error:
                increment_questions(conn, user_id, access)
            remaining_now = max(0, access.get('remaining', 1) - 1) if not ai_error else access.get('remaining', 0)

            def _bg_post(uid, q, mids, ans, tok, session_id, is_err):
                try:
                    c2 = psycopg2.connect(DATABASE_URL)
                    c2.autocommit = True
                    if not is_err and tok > 0:
                        set_cache(c2, q, mids, ans, tok)
                    save_msg(c2, session_id, uid, 'assistant', ans, mids, tok, False)
                    c2.close()
                except Exception as ex:
                    print(f"[AI] bg_post err: {ex}", flush=True)
            threading.Thread(target=_bg_post, args=(user_id, question, material_ids, answer, tokens, sid, ai_error), daemon=True).start()

            return ok({'answer': answer, 'remaining': remaining_now, 'ai_error': ai_error})

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