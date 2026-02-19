"""Telegram-бот Studyfay: расписание, задачи, напоминания"""

import json
import os
import hashlib
from datetime import datetime, timedelta, date
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import jwt

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')
BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
TG_API = f'https://api.telegram.org/bot{BOT_TOKEN}'
APP_URL = 'https://eduhelper.poehali.dev'

DAY_NAMES = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
DAY_NAMES_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
PRIORITY_EMOJI = {'high': '🔴', 'medium': '🟡', 'low': '🟢'}


def tg_send(chat_id, text, reply_markup=None, parse_mode='HTML'):
    payload = {'chat_id': chat_id, 'text': text, 'parse_mode': parse_mode}
    if reply_markup:
        payload['reply_markup'] = json.dumps(reply_markup)
    requests.post(f'{TG_API}/sendMessage', json=payload, timeout=10)


def tg_answer_callback(callback_query_id, text=''):
    requests.post(f'{TG_API}/answerCallbackQuery', json={
        'callback_query_id': callback_query_id, 'text': text
    }, timeout=5)


def tg_edit(chat_id, message_id, text, reply_markup=None, parse_mode='HTML'):
    payload = {'chat_id': chat_id, 'message_id': message_id, 'text': text, 'parse_mode': parse_mode}
    if reply_markup:
        payload['reply_markup'] = json.dumps(reply_markup)
    requests.post(f'{TG_API}/editMessageText', json=payload, timeout=10)


def get_main_keyboard():
    return {
        'keyboard': [
            [{'text': '📅 Расписание'}, {'text': '📝 Задачи'}],
            [{'text': '🔥 Стрик'}, {'text': '🏆 Достижения'}],
            [{'text': '👤 Профиль'}, {'text': '📱 Открыть приложение'}]
        ],
        'resize_keyboard': True
    }


def get_user_by_telegram(conn, telegram_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"SELECT * FROM {SCHEMA}.users WHERE telegram_id = %s", (telegram_id,))
        return cur.fetchone()


def link_telegram(conn, user_id, telegram_id, tg_username=None):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            UPDATE {SCHEMA}.users SET telegram_id = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (telegram_id, user_id))
        conn.commit()


def get_today_schedule(conn, user_id):
    today_dow = datetime.now().weekday()
    week_num = datetime.now().isocalendar()[1]
    week_type_filter = 'even' if week_num % 2 == 0 else 'odd'

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT subject, type, start_time, end_time, room, teacher
            FROM {SCHEMA}.schedule
            WHERE user_id = %s AND day_of_week = %s
              AND (week_type = 'every' OR week_type = %s)
            ORDER BY start_time
        """, (user_id, today_dow, week_type_filter))
        return cur.fetchall()


def get_week_schedule(conn, user_id):
    week_num = datetime.now().isocalendar()[1]
    week_type_filter = 'even' if week_num % 2 == 0 else 'odd'

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT subject, type, start_time, end_time, room, teacher, day_of_week
            FROM {SCHEMA}.schedule
            WHERE user_id = %s
              AND (week_type = 'every' OR week_type = %s)
            ORDER BY day_of_week, start_time
        """, (user_id, week_type_filter))
        return cur.fetchall()


def get_pending_tasks(conn, user_id, limit=10):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT id, title, subject, deadline, priority
            FROM {SCHEMA}.tasks
            WHERE user_id = %s AND completed = FALSE
            ORDER BY deadline ASC NULLS LAST, priority DESC
            LIMIT %s
        """, (user_id, limit))
        return cur.fetchall()


def get_streak_info(conn, user_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT current_streak, longest_streak, last_activity_date, total_active_days
            FROM {SCHEMA}.user_streaks
            WHERE user_id = %s
        """, (user_id,))
        return cur.fetchone()


def get_achievements(conn, user_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            SELECT a.title, a.icon, a.xp_reward, ua.unlocked_at
            FROM {SCHEMA}.user_achievements ua
            JOIN {SCHEMA}.achievements a ON a.id = ua.achievement_id
            WHERE ua.user_id = %s
            ORDER BY ua.unlocked_at DESC
            LIMIT 10
        """, (user_id,))
        return cur.fetchall()


def complete_task(conn, task_id, user_id):
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(f"""
            UPDATE {SCHEMA}.tasks SET completed = TRUE, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND user_id = %s AND completed = FALSE
            RETURNING title
        """, (task_id, user_id))
        result = cur.fetchone()
        conn.commit()
        return result


def format_time(t):
    if isinstance(t, str):
        return t[:5]
    if hasattr(t, 'strftime'):
        return t.strftime('%H:%M')
    return str(t)


def handle_start(conn, chat_id, telegram_id, first_name, args=None):
    user = get_user_by_telegram(conn, telegram_id)

    if args and args.startswith('link_'):
        token = args[5:]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            uid = payload.get('user_id')
            if uid:
                link_telegram(conn, uid, telegram_id)
                tg_send(chat_id,
                    f'✅ <b>Аккаунт привязан!</b>\n\n'
                    f'Теперь ты можешь управлять расписанием и задачами прямо из Telegram.\n\n'
                    f'Нажми на кнопку внизу 👇',
                    get_main_keyboard())
                return
        except Exception:
            pass

    if user:
        tg_send(chat_id,
            f'👋 Привет, <b>{first_name}</b>!\n\n'
            f'Рад видеть тебя снова. Выбери, что тебя интересует 👇',
            get_main_keyboard())
    else:
        inline = {'inline_keyboard': [
            [{'text': '📱 Зарегистрироваться в Studyfay', 'url': APP_URL}],
            [{'text': '🔗 У меня уже есть аккаунт', 'callback_data': 'how_to_link'}]
        ]}
        tg_send(chat_id,
            f'👋 Привет, <b>{first_name}</b>!\n\n'
            f'Я — бот <b>Studyfay</b>, твой помощник в учёбе.\n\n'
            f'📅 Расписание на сегодня\n'
            f'📝 Управление задачами\n'
            f'🔥 Стрики и достижения\n'
            f'⏰ Напоминания о парах\n\n'
            f'Для начала нужно привязать аккаунт Studyfay:',
            inline)


def handle_schedule(conn, chat_id, user):
    lessons = get_today_schedule(conn, user['id'])
    today_name = DAY_NAMES[datetime.now().weekday()]

    if not lessons:
        text = f'📅 <b>{today_name}</b> — выходной!\n\nСегодня пар нет. Отдыхай или занимайся самоподготовкой 📚'
    else:
        lines = [f'📅 <b>{today_name}</b> — {len(lessons)} пар(ы):\n']
        for i, l in enumerate(lessons, 1):
            time_str = f"{format_time(l['start_time'])}–{format_time(l['end_time'])}"
            lines.append(f'<b>{i}. {l["subject"]}</b>')
            lines.append(f'   🕐 {time_str}')
            if l.get('room'):
                lines.append(f'   📍 {l["room"]}')
            if l.get('teacher'):
                lines.append(f'   👨‍🏫 {l["teacher"]}')
            lines.append('')
        text = '\n'.join(lines)

    inline = {'inline_keyboard': [
        [{'text': '📆 Вся неделя', 'callback_data': 'week_schedule'}],
        [{'text': '➕ Добавить пару', 'url': f'{APP_URL}/schedule'}]
    ]}
    tg_send(chat_id, text, inline)


def handle_week_schedule(conn, chat_id, message_id, user):
    lessons = get_week_schedule(conn, user['id'])

    if not lessons:
        text = '📆 <b>Расписание на неделю</b>\n\nРасписание пустое. Добавь пары в приложении!'
    else:
        by_day = {}
        for l in lessons:
            d = l['day_of_week']
            if d not in by_day:
                by_day[d] = []
            by_day[d].append(l)

        lines = ['📆 <b>Расписание на неделю:</b>\n']
        for dow in range(7):
            if dow in by_day:
                lines.append(f'<b>{DAY_NAMES[dow]}</b>')
                for l in by_day[dow]:
                    time_str = f"{format_time(l['start_time'])}–{format_time(l['end_time'])}"
                    room = f' • {l["room"]}' if l.get('room') else ''
                    lines.append(f'  {time_str} — {l["subject"]}{room}')
                lines.append('')
        text = '\n'.join(lines)

    inline = {'inline_keyboard': [
        [{'text': '📅 Сегодня', 'callback_data': 'today_schedule'}]
    ]}

    if message_id:
        tg_edit(chat_id, message_id, text, inline)
    else:
        tg_send(chat_id, text, inline)


def handle_tasks(conn, chat_id, user):
    tasks = get_pending_tasks(conn, user['id'])

    if not tasks:
        text = '📝 <b>Задачи</b>\n\nВсе задачи выполнены! Ты молодец 🎉'
        inline = {'inline_keyboard': [
            [{'text': '➕ Добавить задачу', 'url': f'{APP_URL}/schedule'}]
        ]}
    else:
        lines = [f'📝 <b>Активные задачи</b> ({len(tasks)}):\n']
        buttons = []
        for t in tasks:
            emoji = PRIORITY_EMOJI.get(t.get('priority', 'low'), '⚪')
            dl = ''
            if t.get('deadline'):
                try:
                    deadline_dt = t['deadline'] if isinstance(t['deadline'], datetime) else datetime.fromisoformat(str(t['deadline']))
                    days_left = (deadline_dt.date() - date.today()).days
                    if days_left < 0:
                        dl = ' ⚠️ <i>просрочена</i>'
                    elif days_left == 0:
                        dl = ' 🔥 <i>сегодня</i>'
                    elif days_left == 1:
                        dl = ' ⏰ <i>завтра</i>'
                    else:
                        dl = f' 📆 <i>{days_left} дн.</i>'
                except Exception:
                    dl = ''

            subj = f' ({t["subject"]})' if t.get('subject') else ''
            lines.append(f'{emoji} {t["title"]}{subj}{dl}')
            buttons.append([{'text': f'✅ {t["title"][:30]}', 'callback_data': f'done_{t["id"]}'}])

        text = '\n'.join(lines)
        buttons.append([{'text': '➕ Добавить задачу', 'url': f'{APP_URL}/schedule'}])
        inline = {'inline_keyboard': buttons}

    tg_send(chat_id, text, inline)


def handle_streak(conn, chat_id, user):
    streak = get_streak_info(conn, user['id'])

    if not streak or streak['current_streak'] == 0:
        text = (
            '🔥 <b>Стрик</b>\n\n'
            'У тебя пока нет стрика.\n'
            'Заходи в Studyfay каждый день, чтобы начать серию! 💪'
        )
    else:
        fire = '🔥' * min(streak['current_streak'], 5)
        text = (
            f'🔥 <b>Твой стрик: {streak["current_streak"]} дней</b> {fire}\n\n'
            f'🏅 Лучший стрик: {streak["longest_streak"]} дней\n'
            f'📊 Всего активных дней: {streak["total_active_days"]}\n\n'
        )
        if streak['current_streak'] >= 7:
            text += '💎 Отличная серия! Держи темп!'
        elif streak['current_streak'] >= 3:
            text += '👍 Хороший старт! Не останавливайся!'
        else:
            text += '🚀 Продолжай заниматься каждый день!'

    inline = {'inline_keyboard': [
        [{'text': '📱 Подробная статистика', 'url': f'{APP_URL}/dashboard'}]
    ]}
    tg_send(chat_id, text, inline)


def handle_achievements(conn, chat_id, user):
    achievements = get_achievements(conn, user['id'])

    if not achievements:
        text = '🏆 <b>Достижения</b>\n\nПока нет достижений. Начни учиться, чтобы получить первое! 🎯'
    else:
        lines = [f'🏆 <b>Твои достижения</b> ({len(achievements)}):\n']
        for a in achievements:
            icon = a.get('icon', '🏅')
            lines.append(f'{icon} <b>{a["title"]}</b> (+{a["xp_reward"]} XP)')
        text = '\n'.join(lines)

    inline = {'inline_keyboard': [
        [{'text': '📱 Все достижения', 'url': f'{APP_URL}/dashboard'}]
    ]}
    tg_send(chat_id, text, inline)


def handle_profile(conn, chat_id, user):
    sub_type = user.get('subscription_type', 'free')
    sub_label = '👑 Premium' if sub_type == 'premium' else '🆓 Бесплатный'
    exp_text = ''
    if user.get('subscription_expires_at'):
        try:
            exp = user['subscription_expires_at']
            if isinstance(exp, str):
                exp = datetime.fromisoformat(exp)
            exp_text = f'\n📅 Подписка до: {exp.strftime("%d.%m.%Y")}'
        except Exception:
            pass

    uni = user.get('university', '')
    faculty = user.get('faculty', '')
    course = user.get('course', '')
    uni_info = ''
    if uni:
        uni_info = f'\n🏫 {uni}'
        if faculty:
            uni_info += f', {faculty}'
        if course:
            uni_info += f', {course} курс'

    text = (
        f'👤 <b>Профиль</b>\n\n'
        f'📧 {user.get("email") or user.get("phone") or "Не указано"}\n'
        f'⭐ Уровень: {user.get("level", 1)} ({user.get("xp_total", 0)} XP)\n'
        f'📦 Тариф: {sub_label}{exp_text}{uni_info}'
    )

    buttons = []
    if sub_type != 'premium':
        buttons.append([{'text': '👑 Получить Premium — 299₽/мес', 'url': f'{APP_URL}/subscription'}])
    buttons.append([{'text': '📱 Открыть приложение', 'url': APP_URL}])

    tg_send(chat_id, text, {'inline_keyboard': buttons})


def handle_callback(conn, chat_id, message_id, callback_data, callback_id, user):
    if callback_data == 'how_to_link':
        tg_answer_callback(callback_id)
        tg_send(chat_id,
            '🔗 <b>Как привязать аккаунт:</b>\n\n'
            '1. Открой Studyfay → Профиль\n'
            '2. Нажми «Привязать Telegram»\n'
            '3. Перейди по ссылке — и всё готово!\n\n'
            f'📱 <a href="{APP_URL}/profile">Открыть профиль</a>')
        return

    if not user:
        tg_answer_callback(callback_id, 'Сначала привяжи аккаунт!')
        return

    if callback_data == 'week_schedule':
        tg_answer_callback(callback_id)
        handle_week_schedule(conn, chat_id, message_id, user)
    elif callback_data == 'today_schedule':
        tg_answer_callback(callback_id)
        lessons = get_today_schedule(conn, user['id'])
        today_name = DAY_NAMES[datetime.now().weekday()]
        if not lessons:
            text = f'📅 <b>{today_name}</b> — выходной!\n\nСегодня пар нет.'
        else:
            lines = [f'📅 <b>{today_name}</b> — {len(lessons)} пар(ы):\n']
            for i, l in enumerate(lessons, 1):
                time_str = f"{format_time(l['start_time'])}–{format_time(l['end_time'])}"
                room = f' • {l["room"]}' if l.get('room') else ''
                lines.append(f'{i}. <b>{l["subject"]}</b> {time_str}{room}')
            text = '\n'.join(lines)
        inline = {'inline_keyboard': [[{'text': '📆 Вся неделя', 'callback_data': 'week_schedule'}]]}
        tg_edit(chat_id, message_id, text, inline)
    elif callback_data.startswith('done_'):
        task_id = int(callback_data[5:])
        result = complete_task(conn, task_id, user['id'])
        if result:
            tg_answer_callback(callback_id, f'✅ «{result["title"][:30]}» выполнена!')
            handle_tasks(conn, chat_id, user)
        else:
            tg_answer_callback(callback_id, 'Задача уже выполнена')


def handler(event: dict, context) -> dict:
    """Webhook Telegram-бота Studyfay"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            'body': ''
        }

    headers = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}

    qs = event.get('queryStringParameters', {}) or {}

    if method == 'GET' and qs.get('action') == 'set_webhook':
        func_url = qs.get('url', '')
        if not func_url:
            return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'url required'})}

        resp = requests.post(f'{TG_API}/setWebhook', json={
            'url': func_url,
            'allowed_updates': ['message', 'callback_query'],
            'drop_pending_updates': True
        }, timeout=10)
        result = resp.json()

        commands = [
            {'command': 'start', 'description': 'Начать работу с ботом'},
            {'command': 'schedule', 'description': 'Расписание на сегодня'},
            {'command': 'tasks', 'description': 'Мои задачи'},
            {'command': 'streak', 'description': 'Мой стрик'},
            {'command': 'profile', 'description': 'Мой профиль'},
        ]
        requests.post(f'{TG_API}/setMyCommands', json={'commands': commands}, timeout=10)

        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'webhook': result, 'commands': 'set'})}

    if method == 'GET' and qs.get('action') == 'info':
        resp = requests.get(f'{TG_API}/getWebhookInfo', timeout=10)
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps(resp.json())}

    if method == 'POST':
        try:
            body = json.loads(event.get('body', '{}'))
        except Exception:
            return {'statusCode': 200, 'headers': headers, 'body': 'ok'}

        conn = psycopg2.connect(DATABASE_URL)
        try:
            if 'callback_query' in body:
                cq = body['callback_query']
                chat_id = cq['message']['chat']['id']
                message_id = cq['message']['message_id']
                callback_data = cq.get('data', '')
                callback_id = cq['id']
                telegram_id = cq['from']['id']

                user = get_user_by_telegram(conn, telegram_id)
                handle_callback(conn, chat_id, message_id, callback_data, callback_id, user)

            elif 'message' in body:
                msg = body['message']
                chat_id = msg['chat']['id']
                telegram_id = msg['from']['id']
                first_name = msg['from'].get('first_name', 'Студент')
                text = msg.get('text', '')

                user = get_user_by_telegram(conn, telegram_id)

                if text.startswith('/start'):
                    args = text[7:].strip() if len(text) > 7 else None
                    handle_start(conn, chat_id, telegram_id, first_name, args)
                elif not user:
                    inline = {'inline_keyboard': [
                        [{'text': '📱 Зарегистрироваться', 'url': APP_URL}],
                        [{'text': '🔗 Привязать аккаунт', 'callback_data': 'how_to_link'}]
                    ]}
                    tg_send(chat_id,
                        'Сначала нужно привязать аккаунт Studyfay.\n'
                        'Нажми /start для инструкции.',
                        inline)
                elif text in ('/schedule', '📅 Расписание'):
                    handle_schedule(conn, chat_id, user)
                elif text in ('/tasks', '📝 Задачи'):
                    handle_tasks(conn, chat_id, user)
                elif text in ('/streak', '🔥 Стрик'):
                    handle_streak(conn, chat_id, user)
                elif text in ('/achievements', '🏆 Достижения'):
                    handle_achievements(conn, chat_id, user)
                elif text in ('/profile', '👤 Профиль'):
                    handle_profile(conn, chat_id, user)
                elif text == '📱 Открыть приложение':
                    tg_send(chat_id, f'📱 <a href="{APP_URL}">Открыть Studyfay</a>')
                else:
                    tg_send(chat_id,
                        'Используй кнопки меню или команды:\n'
                        '/schedule — расписание\n'
                        '/tasks — задачи\n'
                        '/streak — стрик\n'
                        '/profile — профиль',
                        get_main_keyboard())
        finally:
            conn.close()

    return {'statusCode': 200, 'headers': headers, 'body': 'ok'}
