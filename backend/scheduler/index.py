"""Планировщик задач Studyfay — модель Duolingo.

Расписание:
  run_morning (09:00)  — auto-charge, email:drip, email:trial, email:reactivation, push:daily_bonus
  run_evening (20:00)  — push:streak (главный!), email:streak_save, push:reactivation
  run_hourly           — push:trial_ending, push:trial_expired
  status               — информация

GET /?action=run_morning
GET /?action=run_evening
GET /?action=run_hourly
GET /?action=status
"""
import json
import os
from datetime import datetime
import requests

NOTIFICATIONS_URL = 'https://functions.poehali.dev/710399d8-fbc7-4df6-8c6c-200b2828678f'
EMAIL_URL = 'https://functions.poehali.dev/c94cbc92-0ba0-4f34-968f-fb874f465499'
AUTO_CHARGE_URL = 'https://functions.poehali.dev/3648aa29-eff1-418c-ae47-50de549cb47d'
TRIAL_REMINDER_URL = 'https://functions.poehali.dev/2c1becc4-590e-48a4-a712-3efc4e707169'

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
}


def run_cron(name: str, url: str, cron: str) -> dict:
    try:
        resp = requests.get(f'{url}?cron={cron}', timeout=25)
        return {'task': name, 'status': 'ok', 'code': resp.status_code,
                'response': resp.json() if resp.status_code == 200 else resp.text[:200]}
    except Exception as e:
        return {'task': name, 'status': 'error', 'error': str(e)}


def run_task(name: str, url: str, action: str = 'run') -> dict:
    try:
        resp = requests.get(f'{url}?action={action}', timeout=25)
        return {'task': name, 'status': 'ok', 'code': resp.status_code,
                'response': resp.json() if resp.status_code == 200 else resp.text[:200]}
    except Exception as e:
        return {'task': name, 'status': 'error', 'error': str(e)}


def handler(event: dict, context) -> dict:
    """Планировщик Studyfay: утро, вечер, почасовые задачи."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', 'status')
    started_at = datetime.now().isoformat()
    results = []

    if action == 'run_morning':
        results.append(run_task('auto-charge', AUTO_CHARGE_URL, 'run'))
        results.append(run_task('trial-reminder', TRIAL_REMINDER_URL, 'run'))
        results.append(run_cron('email:drip', EMAIL_URL, 'drip'))
        results.append(run_cron('email:trial_ending', EMAIL_URL, 'trial_ending'))
        results.append(run_cron('email:reactivation', EMAIL_URL, 'reactivation'))
        results.append(run_cron('push:daily_bonus', NOTIFICATIONS_URL, 'daily_bonus'))

    elif action == 'run_evening':
        results.append(run_cron('push:streak', NOTIFICATIONS_URL, 'streak'))
        results.append(run_cron('email:streak_save', EMAIL_URL, 'streak_save'))
        results.append(run_cron('push:reactivation', NOTIFICATIONS_URL, 'reactivation'))
        results.append(run_cron('push:expire_bonus', NOTIFICATIONS_URL, 'expire_bonus'))

    elif action == 'run_hourly':
        results.append(run_cron('push:trial_ending', NOTIFICATIONS_URL, 'trial_ending'))
        results.append(run_cron('push:trial_expired', NOTIFICATIONS_URL, 'trial_expired'))

    elif action == 'run':
        hour = datetime.now().hour
        if hour < 14:
            results.append(run_task('auto-charge', AUTO_CHARGE_URL, 'run'))
            results.append(run_task('trial-reminder', TRIAL_REMINDER_URL, 'run'))
            results.append(run_cron('email:drip', EMAIL_URL, 'drip'))
            results.append(run_cron('email:trial_ending', EMAIL_URL, 'trial_ending'))
            results.append(run_cron('email:reactivation', EMAIL_URL, 'reactivation'))
            results.append(run_cron('push:daily_bonus', NOTIFICATIONS_URL, 'daily_bonus'))
        if hour >= 18:
            results.append(run_cron('push:streak', NOTIFICATIONS_URL, 'streak'))
            results.append(run_cron('email:streak_save', EMAIL_URL, 'streak_save'))
            results.append(run_cron('push:reactivation', NOTIFICATIONS_URL, 'reactivation'))
            results.append(run_cron('push:expire_bonus', NOTIFICATIONS_URL, 'expire_bonus'))

    else:
        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({
                'status': 'ready',
                'schedule': {
                    'morning_09': '?action=run_morning — drip, trial email, reactivation email, daily bonus push',
                    'evening_20': '?action=run_evening — streak push+email, reactivation push, expire bonus',
                    'hourly': '?action=run_hourly — trial ending/expired push',
                    'auto': '?action=run — утро/вечер по часу автоматически',
                }
            })
        }

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({
            'message': 'Задачи выполнены',
            'started_at': started_at,
            'completed_at': datetime.now().isoformat(),
            'tasks': results
        }, default=str, ensure_ascii=False)
    }
