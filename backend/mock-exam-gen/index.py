"""Генератор реалистичных экзаменационных вопросов через ИИ"""

import json
import os
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt
from openai import OpenAI
import httpx

OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
OPENROUTER_BASE_URL = 'https://api.aitunnel.ru/v1/'
MODEL = 'llama-4-maverick'

DATABASE_URL = os.environ.get('DATABASE_URL')
SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 'public')
JWT_SECRET = os.environ.get('JWT_SECRET', '')

_http = httpx.Client(verify=False)
client = OpenAI(api_key=OPENROUTER_API_KEY, base_url=OPENROUTER_BASE_URL, timeout=60.0, http_client=_http)

EGE_STRUCTURE = {
    'ru': {'count': 27, 'name': 'Русский язык', 'topics': ['Ударения', 'Паронимы', 'Грамматика', 'Орфография', 'Пунктуация', 'Синтаксис', 'Лексика', 'Стилистика', 'Средства выразительности', 'Текст']},
    'math_base': {'count': 21, 'name': 'Математика (база)', 'topics': ['Вычисления', 'Проценты', 'Площади', 'Графики', 'Уравнения', 'Единицы измерения', 'Статистика', 'Задачи на движение', 'Логика', 'Вероятность']},
    'math_prof': {'count': 18, 'name': 'Математика (профиль)', 'topics': ['Уравнения', 'Неравенства', 'Функции', 'Производная', 'Геометрия', 'Тригонометрия', 'Логарифмы', 'Вероятность', 'Прогрессии', 'Стереометрия']},
    'physics': {'count': 30, 'name': 'Физика', 'topics': ['Механика', 'Термодинамика', 'Электричество', 'Оптика', 'Ядерная физика', 'Колебания и волны', 'Магнетизм']},
    'chemistry': {'count': 34, 'name': 'Химия', 'topics': ['Строение атома', 'Химическая связь', 'Неорганическая химия', 'Органическая химия', 'Реакции', 'Растворы', 'Электролиз']},
    'biology': {'count': 28, 'name': 'Биология', 'topics': ['Клетка', 'Генетика', 'Эволюция', 'Экология', 'Анатомия', 'Ботаника', 'Зоология']},
    'history': {'count': 21, 'name': 'История', 'topics': ['Древняя Русь', 'Средневековье', 'XVI-XVII века', 'XVIII век', 'XIX век', 'XX век', 'Современность']},
    'social': {'count': 25, 'name': 'Обществознание', 'topics': ['Право', 'Экономика', 'Политика', 'Социальная сфера', 'Философия', 'Духовная сфера']},
    'informatics': {'count': 27, 'name': 'Информатика', 'topics': ['Системы счисления', 'Логика', 'Алгоритмы', 'Программирование', 'Базы данных', 'Сети']},
    'english': {'count': 38, 'name': 'Английский язык', 'topics': ['Grammar', 'Vocabulary', 'Reading', 'Word formation', 'Tenses', 'Conditionals']},
    'geography': {'count': 31, 'name': 'География', 'topics': ['Природа России', 'Население', 'Хозяйство', 'Мировая география', 'Климат', 'Картография']},
    'literature': {'count': 17, 'name': 'Литература', 'topics': ['Авторы и произведения', 'Роды и жанры', 'Средства выразительности', 'Литературные направления', 'Анализ текста']},
}

OGE_STRUCTURE = {
    'ru': {'count': 25, 'name': 'Русский язык'},
    'math': {'count': 25, 'name': 'Математика'},
    'physics': {'count': 25, 'name': 'Физика'},
    'chemistry': {'count': 25, 'name': 'Химия'},
    'biology': {'count': 25, 'name': 'Биология'},
    'history': {'count': 25, 'name': 'История'},
    'social': {'count': 25, 'name': 'Обществознание'},
    'informatics': {'count': 25, 'name': 'Информатика'},
    'english': {'count': 25, 'name': 'Английский язык'},
    'geography': {'count': 25, 'name': 'География'},
    'literature': {'count': 25, 'name': 'Литература'},
}


def verify_token(token):
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    except:
        return None


def generate_batch(subject_name, exam_type_name, batch_size, start_id, topics=None):
    topics_hint = f"Темы для заданий: {', '.join(topics)}." if topics else ""

    prompt = f"""Сгенерируй {batch_size} заданий для {exam_type_name} по предмету "{subject_name}".
{topics_hint}

Требования:
- Задания должны соответствовать формату ФИПИ и реальных экзаменов
- Разные типы: single (один ответ из вариантов), input (ввод ответа числом или коротким словом)
- Задания разной сложности
- Формулировки как в реальном КИМ
- Правильные ответы и объяснения

Верни JSON массив. Каждый элемент:
{{"id":{start_id}+i, "topic":"тема", "text":"условие задания", "type":"single" или "input", "options":["вариант1","вариант2","вариант3","вариант4"] (только для single), "correctAnswer":"правильный ответ", "explanation":"краткое объяснение", "points":1}}

ВАЖНО: верни ТОЛЬКО JSON массив, без markdown, без ```."""

    try:
        resp = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": "Ты эксперт по составлению заданий ЕГЭ и ОГЭ. Генерируй задания строго в формате ФИПИ. Отвечай ТОЛЬКО JSON массивом."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4000,
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
    except Exception as e:
        return []


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
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Требуется авторизация'})}

    payload = verify_token(token)
    if not payload:
        return {'statusCode': 401, 'headers': headers, 'body': json.dumps({'error': 'Недействительный токен'})}

    body = json.loads(event.get('body', '{}'))
    exam_type = body.get('exam_type', 'ege')
    subject = body.get('subject', 'ru')

    structure = EGE_STRUCTURE if exam_type == 'ege' else OGE_STRUCTURE
    sub_info = structure.get(subject)
    if not sub_info:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'Неизвестный предмет'})}

    total = sub_info['count']
    subject_name = sub_info['name']
    topics = sub_info.get('topics')
    exam_type_name = 'ЕГЭ' if exam_type == 'ege' else 'ОГЭ'

    all_questions = []
    batch_size = min(10, total)
    generated = 0

    while generated < total:
        remaining = total - generated
        batch = min(batch_size, remaining)
        batch_questions = generate_batch(subject_name, exam_type_name, batch, generated + 1, topics)

        for i, q in enumerate(batch_questions):
            q['id'] = generated + i + 1
            q['subject'] = subject
            q['examType'] = exam_type
            if q.get('type') not in ('single', 'multiple', 'input'):
                q['type'] = 'single'
            if q['type'] == 'single' and not q.get('options'):
                q['type'] = 'input'
            if not q.get('points'):
                q['points'] = 1
            all_questions.append(q)

        generated += len(batch_questions)
        if len(batch_questions) == 0:
            break

    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({
            'questions': all_questions[:total],
            'total': len(all_questions[:total]),
            'exam_type': exam_type,
            'subject': subject_name,
            'time_minutes': (EGE_STRUCTURE if exam_type == 'ege' else OGE_STRUCTURE).get(subject, {}).get('count', 180)
        }, ensure_ascii=False)
    }
