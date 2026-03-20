"""
Планировщик задач Studyfay.
GET /?action=run        — запустить все ежедневные задачи
GET /?action=run_push   — запустить только push-уведомления (streak, реактивация, рефералка)
GET /?action=run_hourly — запустить почасовые задачи (триал, онбординг)
GET /?action=status     — статус
"""
import json
import os
from datetime import datetime
import requests

NOTIFICATIONS_URL = 'https://functions.poehali.dev/710399d8-fbc7-4df6-8c6c-200b2828678f'
AUTO_CHARGE_URL   = 'https://functions.poehali.dev/3648aa29-eff1-418c-ae47-50de549cb47d'
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
    """Планировщик: ежедневные + почасовые задачи и push-уведомления"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    qs = event.get('queryStringParameters') or {}
    action = qs.get('action', 'status')
    started_at = datetime.now().isoformat()
    results = []

    # ── Ежедневные задачи (запускать раз в день, например в 09:00) ────────────
    if action == 'run':
        results.append(run_task('auto-charge', AUTO_CHARGE_URL, 'run'))
        results.append(run_task('trial-reminder', TRIAL_REMINDER_URL, 'run'))
        # Push: streak (только вечером, ~20:00), реактивация, рефералка
        hour = datetime.now().hour
        if hour >= 18:
            results.append(run_cron('push:streak', NOTIFICATIONS_URL, 'streak'))
        results.append(run_cron('push:reactivation', NOTIFICATIONS_URL, 'reactivation'))
        results.append(run_cron('push:referral_promo', NOTIFICATIONS_URL, 'referral_promo'))

    # ── Почасовые задачи (запускать каждый час) ───────────────────────────────
    elif action == 'run_hourly':
        results.append(run_cron('push:onboarding', NOTIFICATIONS_URL, 'onboarding'))
        results.append(run_cron('push:trial_ending', NOTIFICATIONS_URL, 'trial_ending'))
        results.append(run_cron('push:trial_expired', NOTIFICATIONS_URL, 'trial_expired'))
        results.append(run_cron('push:discount', NOTIFICATIONS_URL, 'discount'))

    # ── Только push (для отладки) ─────────────────────────────────────────────
    elif action == 'run_push':
        results.append(run_cron('push:onboarding', NOTIFICATIONS_URL, 'onboarding'))
        results.append(run_cron('push:streak', NOTIFICATIONS_URL, 'streak'))
        results.append(run_cron('push:trial_ending', NOTIFICATIONS_URL, 'trial_ending'))
        results.append(run_cron('push:trial_expired', NOTIFICATIONS_URL, 'trial_expired'))
        results.append(run_cron('push:reactivation', NOTIFICATIONS_URL, 'reactivation'))
        results.append(run_cron('push:referral_promo', NOTIFICATIONS_URL, 'referral_promo'))
        results.append(run_cron('push:discount', NOTIFICATIONS_URL, 'discount'))

    else:
        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({
                'status': 'ready',
                'tasks': ['auto-charge', 'trial-reminder', 'push:*'],
                'usage': {
                    'daily (09:00)': '?action=run',
                    'hourly': '?action=run_hourly',
                    'push only': '?action=run_push',
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
