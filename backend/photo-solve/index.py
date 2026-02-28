"""
OCR + решение задач по фото. 
Пользователь загружает фото с задачей (ЕГЭ/ОГЭ/вуз), ИИ распознаёт и решает.
Лимиты: Free 1 фото/день, Premium 5 фото/день + bonus_photos из пакетов.
"""

import json
import os
import base64
import httpx
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'secret')
DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')

FREE_DAILY_PHOTOS = 1
PREMIUM_DAILY_PHOTOS = 5

CORS = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
}


def ok(body: dict) -> dict:
    return {'statusCode': 200, 'headers': CORS, 'body': json.dumps(body, ensure_ascii=False)}


def err(status: int, msg: str, extra: dict = None) -> dict:
    body = {'error': msg}
    if extra:
        body.update(extra)
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body, ensure_ascii=False)}


def get_db():
    return psycopg2.connect(DATABASE_URL, options=f'-c search_path={SCHEMA}')


def verify_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except Exception:
        return None


def check_photo_limit(conn, user_id: int) -> dict:
    """Проверяет лимит фото на сегодня. Возвращает dict с has_access, used, limit, bonus."""
    now = datetime.now()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT subscription_type, subscription_expires_at,
               photos_uploaded_today, photos_daily_reset_at,
               bonus_photos
        FROM users WHERE id = %s
    """, (user_id,))
    user = cur.fetchone()
    cur.close()
    if not user:
        return {'has_access': False, 'reason': 'not_found'}

    is_premium = (
        user['subscription_type'] == 'premium'
        and user['subscription_expires_at']
        and user['subscription_expires_at'].replace(tzinfo=None) > now
    )
    daily_limit = PREMIUM_DAILY_PHOTOS if is_premium else FREE_DAILY_PHOTOS

    # Сброс дневного счётчика
    photos_today = user['photos_uploaded_today'] or 0
    reset_at = user['photos_daily_reset_at']
    if reset_at:
        reset_naive = reset_at.replace(tzinfo=None) if hasattr(reset_at, 'tzinfo') and reset_at.tzinfo else reset_at
        if reset_naive < now:
            cur2 = conn.cursor()
            cur2.execute(
                "UPDATE users SET photos_uploaded_today=0, photos_daily_reset_at=%s WHERE id=%s",
                (now + timedelta(days=1), user_id)
            )
            conn.commit()
            cur2.close()
            photos_today = 0

    bonus = user['bonus_photos'] or 0

    if photos_today >= daily_limit:
        if bonus > 0:
            return {
                'has_access': True, 'is_premium': is_premium,
                'used': photos_today, 'limit': daily_limit,
                'from_bonus': True, 'bonus_remaining': bonus
            }
        return {
            'has_access': False, 'reason': 'limit',
            'is_premium': is_premium,
            'used': photos_today, 'limit': daily_limit, 'bonus_remaining': 0
        }

    return {
        'has_access': True, 'is_premium': is_premium,
        'used': photos_today, 'limit': daily_limit,
        'from_bonus': False, 'bonus_remaining': bonus
    }


def increment_photo_count(conn, user_id: int, from_bonus: bool):
    """Списываем одно фото: из дневного лимита или из бонуса."""
    now = datetime.now()
    cur = conn.cursor()
    if from_bonus:
        cur.execute("""
            UPDATE users
            SET bonus_photos = GREATEST(0, bonus_photos - 1),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND bonus_photos > 0
        """, (user_id,))
    else:
        cur.execute("""
            UPDATE users
            SET photos_uploaded_today = COALESCE(photos_uploaded_today, 0) + 1,
                photos_daily_reset_at = COALESCE(photos_daily_reset_at, %s),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (now + timedelta(days=1), user_id))
    conn.commit()
    cur.close()


def ocr_and_solve(image_base64: str, hint: str = '') -> dict:
    """
    Шаг 1: OCR через DeepSeek Vision — извлекаем текст задачи с фото.
    Шаг 2: Решение через DeepSeek chat (или Llama как фолбек).
    Возвращает {'recognized_text': ..., 'solution': ..., 'subject': ...}
    """
    print(f"[PHOTO] OCR start, image_len={len(image_base64)}", flush=True)

    # --- ШАГ 1: OCR через DeepSeek Vision ---
    recognized_text = None
    if DEEPSEEK_API_KEY:
        try:
            ocr_payload = {
                "model": "deepseek-vl2",
                "messages": [{
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                        },
                        {
                            "type": "text",
                            "text": (
                                "Это фото с учебным заданием или задачей. "
                                "Точно распознай и перепиши ВЕСЬ текст с изображения дословно, включая цифры, формулы, условия. "
                                "Если это математическая задача — перепиши все числа и условие точно. "
                                "Если это тест с вариантами — перепиши вопрос и все варианты. "
                                "Отвечай только распознанным текстом, без комментариев."
                            )
                        }
                    ]
                }],
                "temperature": 0.1,
                "max_tokens": 1500
            }
            with httpx.Client(timeout=httpx.Timeout(20.0, connect=5.0)) as http:
                r = http.post(
                    "https://api.deepseek.com/v1/chat/completions",
                    json=ocr_payload,
                    headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"}
                )
                print(f"[PHOTO] OCR status={r.status_code}", flush=True)
                if r.status_code == 200:
                    recognized_text = r.json()["choices"][0]["message"]["content"].strip()
                    print(f"[PHOTO] OCR ok: {recognized_text[:100]}", flush=True)
        except Exception as e:
            print(f"[PHOTO] OCR error: {e}", flush=True)

    if not recognized_text:
        # Фолбек: пробуем Llama с vision через OpenRouter
        if OPENROUTER_API_KEY:
            try:
                ocr_payload2 = {
                    "model": "meta-llama/llama-4-maverick",
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}},
                            {"type": "text", "text": "Распознай и перепиши весь текст задачи с этого фото точно дословно."}
                        ]
                    }],
                    "temperature": 0.1,
                    "max_tokens": 1000
                }
                with httpx.Client(timeout=httpx.Timeout(20.0, connect=5.0)) as http:
                    r2 = http.post(
                        "https://api.aitunnel.ru/v1/chat/completions",
                        json=ocr_payload2,
                        headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}
                    )
                    if r2.status_code == 200:
                        recognized_text = r2.json()["choices"][0]["message"]["content"].strip()
                        print(f"[PHOTO] OCR fallback ok: {recognized_text[:100]}", flush=True)
            except Exception as e2:
                print(f"[PHOTO] OCR fallback error: {e2}", flush=True)

    if not recognized_text:
        return {
            'recognized_text': '',
            'solution': 'Не удалось распознать текст с фото. Попробуй сфотографировать чётче, при хорошем освещении, без наклона.',
            'subject': 'Неизвестно',
            'error': True
        }

    # --- ШАГ 2: Решение через DeepSeek chat ---
    user_hint = f"\nДополнительный контекст от пользователя: {hint}" if hint and len(hint) > 2 else ""
    solve_prompt = (
        f"Задание с фото:{user_hint}\n\n{recognized_text}\n\n"
        "Реши это задание пошагово. Формат ответа:\n"
        "1. Определи тип задачи и предмет\n"
        "2. Реши задание полностью, показывая все шаги\n"
        "3. Дай ответ в конце чётко: 'Ответ: ...'\n"
        "4. Если есть несколько вариантов — объясни почему правильный именно тот\n"
        "Пиши формулы текстом (x^2, sqrt(x), a/b). Отвечай по-русски."
    )

    solution = None
    subject = 'Общее'

    # Сначала пробуем DeepSeek chat (точнее для математики)
    if DEEPSEEK_API_KEY:
        try:
            solve_payload = {
                "model": "deepseek-chat",
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "Ты лучший репетитор и решатель задач. "
                            "Решай задания точно, пошагово, с проверкой. "
                            "Определяй предмет: математика, физика, химия, русский язык, история и т.д. "
                            "Формулы пиши текстом. Отвечай по-русски."
                        )
                    },
                    {"role": "user", "content": solve_prompt}
                ],
                "temperature": 0.3,
                "max_tokens": 1500
            }
            with httpx.Client(timeout=httpx.Timeout(25.0, connect=5.0)) as http:
                rs = http.post(
                    "https://api.deepseek.com/v1/chat/completions",
                    json=solve_payload,
                    headers={"Authorization": f"Bearer {DEEPSEEK_API_KEY}", "Content-Type": "application/json"}
                )
                print(f"[PHOTO] Solve DeepSeek status={rs.status_code}", flush=True)
                if rs.status_code == 200:
                    solution = rs.json()["choices"][0]["message"]["content"].strip()
                    print(f"[PHOTO] Solve ok: {solution[:100]}", flush=True)
        except Exception as e:
            print(f"[PHOTO] Solve DeepSeek error: {e}", flush=True)

    # Фолбек: Llama через OpenRouter
    if not solution and OPENROUTER_API_KEY:
        try:
            solve_payload2 = {
                "model": "llama-4-maverick",
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "Ты репетитор. Решай задания точно и пошагово. "
                            "Определяй предмет. Формулы текстом. Отвечай по-русски."
                        )
                    },
                    {"role": "user", "content": solve_prompt}
                ],
                "temperature": 0.4,
                "max_tokens": 1200
            }
            with httpx.Client(timeout=httpx.Timeout(20.0, connect=4.0)) as http:
                rs2 = http.post(
                    "https://api.aitunnel.ru/v1/chat/completions",
                    json=solve_payload2,
                    headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json"}
                )
                if rs2.status_code == 200:
                    solution = rs2.json()["choices"][0]["message"]["content"].strip()
                    print(f"[PHOTO] Solve fallback ok: {solution[:100]}", flush=True)
        except Exception as e2:
            print(f"[PHOTO] Solve fallback error: {e2}", flush=True)

    if not solution:
        solution = (
            f"Задание распознано:\n\n{recognized_text}\n\n"
            "К сожалению, решение временно недоступно. Попробуй задать этот вопрос в разделе «Ассистент»."
        )

    # Определяем предмет из текста решения
    sol_lower = (solution + recognized_text).lower()
    if any(w in sol_lower for w in ['математика', 'уравнение', 'функция', 'интеграл', 'производная', 'геометрия', 'треугольник', 'площадь']):
        subject = 'Математика'
    elif any(w in sol_lower for w in ['физика', 'сила', 'скорость', 'ускорение', 'масса', 'энергия', 'ток', 'напряжение']):
        subject = 'Физика'
    elif any(w in sol_lower for w in ['химия', 'реакция', 'элемент', 'молекула', 'кислота', 'щелочь', 'валентность']):
        subject = 'Химия'
    elif any(w in sol_lower for w in ['биология', 'клетка', 'днк', 'фотосинтез', 'организм']):
        subject = 'Биология'
    elif any(w in sol_lower for w in ['история', 'война', 'революция', 'царь', 'дата', 'событие']):
        subject = 'История'
    elif any(w in sol_lower for w in ['обществознание', 'право', 'конституция', 'государство', 'общество']):
        subject = 'Обществознание'
    elif any(w in sol_lower for w in ['русский', 'орфография', 'пунктуация', 'предложение', 'слово', 'грамматика']):
        subject = 'Русский язык'
    elif any(w in sol_lower for w in ['english', 'verb', 'grammar', 'sentence', 'английский']):
        subject = 'Английский'

    return {
        'recognized_text': recognized_text,
        'solution': solution,
        'subject': subject
    }


def handler(event: dict, context) -> dict:
    """Решение задач по фото: OCR + ИИ-решение. Free: 1/день, Premium: 5/день + bonus_photos."""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    auth = event.get('headers', {}).get('X-Authorization', '')
    token = auth.replace('Bearer ', '')
    payload = verify_token(token)
    if not payload:
        return err(401, 'Требуется авторизация')

    user_id = payload['user_id']

    if method == 'GET':
        # Возвращаем текущий лимит
        conn = get_db()
        try:
            info = check_photo_limit(conn, user_id)
            return ok({
                'used': info.get('used', 0),
                'limit': info.get('limit', FREE_DAILY_PHOTOS),
                'bonus_remaining': info.get('bonus_remaining', 0),
                'is_premium': info.get('is_premium', False),
            })
        finally:
            conn.close()

    if method == 'POST':
        try:
            body = json.loads(event.get('body', '{}'))
        except Exception:
            return err(400, 'Неверный формат запроса')

        image_b64 = body.get('image_base64', '').strip()
        hint = body.get('hint', '').strip()[:300]

        if not image_b64:
            return err(400, 'Нет фото. Передай image_base64')

        # Проверяем размер (не больше 10 МБ в base64 = ~7.5 МБ файл)
        if len(image_b64) > 14_000_000:
            return err(400, 'Фото слишком большое. Максимум 10 МБ')

        conn = get_db()
        try:
            limit_info = check_photo_limit(conn, user_id)

            if not limit_info['has_access']:
                is_prem = limit_info.get('is_premium', False)
                used = limit_info.get('used', 0)
                lim = limit_info.get('limit', FREE_DAILY_PHOTOS)
                return err(403, 'limit', {
                    'message': (
                        f'Лимит фото на сегодня исчерпан ({used}/{lim}). '
                        f'{"Купи пакет +5 фото или подожди завтра." if is_prem else "Подключи Premium (5 фото/день) или купи пакет +5 фото."}'
                    ),
                    'used': used,
                    'limit': lim,
                    'is_premium': is_prem,
                    'bonus_remaining': limit_info.get('bonus_remaining', 0)
                })

            from_bonus = limit_info.get('from_bonus', False)

            # Списываем до вызова ИИ (чтобы не дублировать при ошибках)
            increment_photo_count(conn, user_id, from_bonus)

            # Считаем оставшееся
            new_used = limit_info['used'] + (0 if from_bonus else 1)
            new_bonus = max(0, limit_info['bonus_remaining'] - (1 if from_bonus else 0))
            daily_left = max(0, limit_info['limit'] - new_used)
            total_remaining = daily_left + new_bonus

        finally:
            conn.close()

        # OCR + решение
        print(f"[PHOTO] User:{user_id} solving photo, hint={hint[:30]}", flush=True)
        result = ocr_and_solve(image_b64, hint)

        return ok({
            'recognized_text': result['recognized_text'],
            'solution': result['solution'],
            'subject': result['subject'],
            'remaining': total_remaining,
            'used': new_used,
            'limit': limit_info['limit'],
            'bonus_remaining': new_bonus,
            'error': result.get('error', False)
        })

    return err(405, 'Метод не поддерживается')
