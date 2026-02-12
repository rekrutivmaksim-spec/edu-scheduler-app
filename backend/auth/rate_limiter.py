"""Rate limiting middleware для защиты от DDoS и брутфорса"""

import time
from datetime import datetime, timedelta
import hashlib

# In-memory хранилище (для продакшена использовать Redis)
_rate_limit_storage = {}
_failed_login_storage = {}
_cleanup_last_run = datetime.now()

def cleanup_old_records():
    """Очищает старые записи (вызывается автоматически)"""
    global _cleanup_last_run
    now = datetime.now()
    
    # Запускаем cleanup раз в 5 минут
    if (now - _cleanup_last_run).seconds < 300:
        return
    
    _cleanup_last_run = now
    cutoff = now - timedelta(hours=1)
    
    # Удаляем записи старше 1 часа
    for storage in [_rate_limit_storage, _failed_login_storage]:
        expired_keys = [k for k, v in storage.items() if v.get('expires', now) < cutoff]
        for key in expired_keys:
            del storage[key]

def check_rate_limit(identifier: str, max_requests: int = 100, window_seconds: int = 60) -> tuple:
    """
    Проверяет rate limit для идентификатора (IP + endpoint)
    Возвращает (is_allowed: bool, remaining: int, retry_after: int)
    """
    cleanup_old_records()
    
    now = time.time()
    key = hashlib.md5(identifier.encode()).hexdigest()
    
    if key not in _rate_limit_storage:
        _rate_limit_storage[key] = {
            'requests': [],
            'expires': datetime.now() + timedelta(seconds=window_seconds)
        }
    
    # Удаляем старые запросы за пределами окна
    record = _rate_limit_storage[key]
    record['requests'] = [r for r in record['requests'] if now - r < window_seconds]
    
    # Проверяем лимит
    if len(record['requests']) >= max_requests:
        oldest = record['requests'][0]
        retry_after = int(window_seconds - (now - oldest)) + 1
        return (False, 0, retry_after)
    
    # Добавляем текущий запрос
    record['requests'].append(now)
    remaining = max_requests - len(record['requests'])
    
    return (True, remaining, 0)

def check_failed_login(identifier: str, max_attempts: int = 5, lockout_minutes: int = 15) -> tuple:
    """
    Проверяет количество неудачных попыток входа
    Возвращает (is_allowed: bool, attempts_left: int, locked_until: datetime | None)
    """
    cleanup_old_records()
    
    now = datetime.now()
    key = hashlib.md5(f"login_{identifier}".encode()).hexdigest()
    
    if key not in _failed_login_storage:
        _failed_login_storage[key] = {
            'attempts': [],
            'locked_until': None,
            'expires': now + timedelta(minutes=lockout_minutes)
        }
    
    record = _failed_login_storage[key]
    
    # Проверяем блокировку
    if record['locked_until'] and now < record['locked_until']:
        return (False, 0, record['locked_until'])
    
    # Сбрасываем блокировку если истекла
    if record['locked_until'] and now >= record['locked_until']:
        record['attempts'] = []
        record['locked_until'] = None
    
    # Удаляем старые попытки (старше lockout_minutes)
    cutoff = now - timedelta(minutes=lockout_minutes)
    record['attempts'] = [a for a in record['attempts'] if a > cutoff]
    
    # Проверяем лимит
    if len(record['attempts']) >= max_attempts:
        record['locked_until'] = now + timedelta(minutes=lockout_minutes)
        return (False, 0, record['locked_until'])
    
    attempts_left = max_attempts - len(record['attempts'])
    return (True, attempts_left, None)

def record_failed_login(identifier: str):
    """Записывает неудачную попытку входа"""
    now = datetime.now()
    key = hashlib.md5(f"login_{identifier}".encode()).hexdigest()
    
    if key not in _failed_login_storage:
        _failed_login_storage[key] = {
            'attempts': [],
            'locked_until': None,
            'expires': now + timedelta(minutes=15)
        }
    
    _failed_login_storage[key]['attempts'].append(now)

def reset_failed_login(identifier: str):
    """Сбрасывает счетчик неудачных попыток (при успешном входе)"""
    key = hashlib.md5(f"login_{identifier}".encode()).hexdigest()
    if key in _failed_login_storage:
        del _failed_login_storage[key]

def get_client_ip(event: dict) -> str:
    """Извлекает IP клиента из event"""
    # Сначала проверяем X-Forwarded-For (если за прокси)
    headers = event.get('headers', {})
    forwarded = headers.get('X-Forwarded-For', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    
    # Затем X-Real-IP
    real_ip = headers.get('X-Real-IP', '')
    if real_ip:
        return real_ip
    
    # Из requestContext
    request_context = event.get('requestContext', {})
    identity = request_context.get('identity', {})
    source_ip = identity.get('sourceIp', '')
    if source_ip:
        return source_ip
    
    return 'unknown'
