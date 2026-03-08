"""Генератор реалистичных экзаменационных вопросов через ИИ"""

import json
import os
import jwt
from openai import OpenAI
import httpx

OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
OPENROUTER_BASE_URL = 'https://api.aitunnel.ru/v1/'
MODEL = 'llama-4-maverick'

JWT_SECRET = os.environ.get('JWT_SECRET', '')

_http = httpx.Client(verify=False, timeout=22.0)
client = OpenAI(api_key=OPENROUTER_API_KEY, base_url=OPENROUTER_BASE_URL, timeout=22.0, http_client=_http)

SUBJECTS = {
    'ege': {
        'ru': {'name': 'Русский язык', 'topics': ['Ударения', 'Паронимы', 'Грамматика', 'Орфография', 'Пунктуация', 'Синтаксис', 'Средства выразительности']},
        'math_base': {'name': 'Математика (база)', 'topics': ['Вычисления', 'Проценты', 'Площади', 'Уравнения', 'Статистика', 'Вероятность', 'Графики']},
        'math_prof': {'name': 'Математика (профиль)', 'topics': ['Уравнения', 'Неравенства', 'Функции', 'Производная', 'Геометрия', 'Тригонометрия', 'Логарифмы']},
        'physics': {'name': 'Физика', 'topics': ['Механика', 'Термодинамика', 'Электричество', 'Оптика', 'Колебания']},
        'chemistry': {'name': 'Химия', 'topics': ['Строение атома', 'Химическая связь', 'Неорганическая химия', 'Органическая химия', 'Реакции', 'Растворы']},
        'biology': {'name': 'Биология', 'topics': ['Клетка', 'Генетика', 'Эволюция', 'Экология', 'Анатомия', 'Ботаника']},
        'history': {'name': 'История', 'topics': ['Древняя Русь', 'XVIII век', 'XIX век', 'XX век']},
        'social': {'name': 'Обществознание', 'topics': ['Право', 'Экономика', 'Политика', 'Социальная сфера']},
        'informatics': {'name': 'Информатика', 'topics': ['Системы счисления', 'Логика', 'Алгоритмы', 'Программирование']},
        'english': {'name': 'Английский язык', 'topics': ['Grammar', 'Vocabulary', 'Tenses', 'Conditionals', 'Word formation']},
        'geography': {'name': 'География', 'topics': ['Природа', 'Население', 'Климат', 'Экономика', 'Картография']},
        'literature': {'name': 'Литература', 'topics': ['Авторы и произведения', 'Средства выразительности', 'Стихосложение', 'Роды и жанры']},
    },
    'oge': {
        'ru': {'name': 'Русский язык', 'topics': ['Орфография', 'Пунктуация', 'Синтаксис', 'Грамматика']},
        'math': {'name': 'Математика', 'topics': ['Алгебра', 'Геометрия', 'Проценты', 'Уравнения', 'Функции']},
        'physics': {'name': 'Физика', 'topics': ['Механика', 'Электричество', 'Оптика', 'Тепловые явления']},
        'chemistry': {'name': 'Химия', 'topics': ['Строение вещества', 'Реакции', 'Классы веществ']},
        'biology': {'name': 'Биология', 'topics': ['Клетка', 'Ботаника', 'Зоология', 'Анатомия', 'Экология']},
        'history': {'name': 'История', 'topics': ['Древняя Русь', 'XVIII-XIX века', 'XX век']},
        'social': {'name': 'Обществознание', 'topics': ['Право', 'Экономика', 'Политика']},
        'informatics': {'name': 'Информатика', 'topics': ['Информация', 'Программирование', 'Логика', 'Алгоритмы']},
        'english': {'name': 'Английский язык', 'topics': ['Grammar', 'Vocabulary']},
        'geography': {'name': 'География', 'topics': ['Природа', 'Население', 'Климат']},
        'literature': {'name': 'Литература', 'topics': ['Авторы', 'Средства выразительности', 'Жанры']},
    }
}


def verify_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except:
        return None


def generate_questions(subject_name, exam_type_name, count, topics):
    topics_str = ', '.join(topics) if topics else ''
    prompt = f"""Сгенерируй {count} заданий для {exam_type_name} по "{subject_name}".
Темы: {topics_str}.
Типы: single (варианты ответа), input (ввод числа/слова).
Формат ФИПИ, разная сложность.

JSON массив, каждый элемент: {{"id":N,"topic":"тема","text":"условие","type":"single"/"input","options":["a","b","c","d"],"correctAnswer":"ответ","explanation":"пояснение","points":1}}
options только для single.
ТОЛЬКО JSON массив, без markdown."""

    resp = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": "Генерируй задания ЕГЭ/ОГЭ в формате ФИПИ. Отвечай ТОЛЬКО JSON массивом."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.8,
        max_tokens=6000,
    )
    text = resp.choices[0].message.content.strip()
    if text.startswith('```'):
        text = text.split('\n', 1)[1] if '\n' in text else text[3:]
        if text.endswith('```'):
            text = text[:-3]
        text = text.strip()
    if text.startswith('json'):
        text = text[4:].strip()
    return json.loads(text)


def handler(event, context):
    """Генерирует реалистичные экзаменационные вопросы через ИИ"""
    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    headers = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}

    auth_header = event.get('headers', {}).get('X-Authorization', '')
    token = auth_header.replace('Bearer ', '')
    if not token:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'auth'})}

    payload = verify_token(token)
    if not payload:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'auth'})}

    body = json.loads(event.get('body', '{}'))
    exam_type = body.get('exam_type', 'ege')
    subject = body.get('subject', 'ru')

    sub_info = SUBJECTS.get(exam_type, {}).get(subject)
    if not sub_info:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'unknown_subject'})}

    subject_name = sub_info['name']
    topics = sub_info.get('topics', [])
    exam_name = 'ЕГЭ' if exam_type == 'ege' else 'ОГЭ'
    count = min(15, body.get('count', 15))

    try:
        questions = generate_questions(subject_name, exam_name, count, topics)

        result = []
        for i, q in enumerate(questions):
            item = {
                'id': i + 1,
                'subject': subject,
                'examType': exam_type,
                'topic': q.get('topic', ''),
                'text': q.get('text', ''),
                'type': q.get('type', 'single'),
                'correctAnswer': q.get('correctAnswer', ''),
                'explanation': q.get('explanation', ''),
                'points': q.get('points', 1),
            }
            if item['type'] == 'single':
                opts = q.get('options')
                if opts and isinstance(opts, list) and len(opts) >= 2:
                    item['options'] = opts
                else:
                    item['type'] = 'input'
            result.append(item)

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({'questions': result, 'total': len(result)}, ensure_ascii=False)
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({'error': 'generation_failed', 'detail': str(e)[:200]})
        }
