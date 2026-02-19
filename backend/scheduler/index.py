"""Планировщик ежедневных задач — вызывать по крону раз в день"""

import json
import os
from datetime import datetime
import requests

AUTO_CHARGE_URL = 'https://functions.poehali.dev/3648aa29-eff1-418c-ae47-50de549cb47d'
TRIAL_REMINDER_URL = 'https://functions.poehali.dev/2c1becc4-590e-48a4-a712-3efc4e707169'

def run_task(name, url, action='run'):
    try:
        resp = requests.get(f'{url}?action={action}', timeout=30)
        return {'task': name, 'status': 'ok', 'code': resp.status_code, 'response': resp.json() if resp.status_code == 200 else resp.text[:200]}
    except Exception as e:
        return {'task': name, 'status': 'error', 'error': str(e)}

def handler(event: dict, context) -> dict:
    """Ежедневный планировщик: автопродление подписок + напоминания"""
    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            },
            'body': ''
        }

    headers = {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
    qs = event.get('queryStringParameters', {}) or {}
    action = qs.get('action', 'status')

    if action == 'run':
        results = []
        started_at = datetime.now().isoformat()

        results.append(run_task('auto-charge', AUTO_CHARGE_URL, 'run'))
        results.append(run_task('trial-reminder', TRIAL_REMINDER_URL, 'run'))

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'message': 'Ежедневные задачи выполнены',
                'started_at': started_at,
                'completed_at': datetime.now().isoformat(),
                'tasks': results
            }, default=str, ensure_ascii=False)
        }

    return {
        'statusCode': 200,
        'headers': headers,
        'body': json.dumps({
            'status': 'ready',
            'tasks': ['auto-charge', 'trial-reminder'],
            'usage': 'GET /?action=run'
        })
    }
