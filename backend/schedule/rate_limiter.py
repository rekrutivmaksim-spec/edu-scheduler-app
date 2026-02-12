"""Rate limiting для schedule"""
import time
from datetime import datetime, timedelta
import hashlib

_rate_limit_storage = {}

def check_rate_limit(identifier: str, max_requests: int = 100, window_seconds: int = 60) -> tuple:
    now = time.time()
    key = hashlib.md5(identifier.encode()).hexdigest()
    
    if key not in _rate_limit_storage:
        _rate_limit_storage[key] = {'requests': []}
    
    record = _rate_limit_storage[key]
    record['requests'] = [r for r in record['requests'] if now - r < window_seconds]
    
    if len(record['requests']) >= max_requests:
        oldest = record['requests'][0]
        retry_after = int(window_seconds - (now - oldest)) + 1
        return (False, 0, retry_after)
    
    record['requests'].append(now)
    return (True, max_requests - len(record['requests']), 0)

def get_client_ip(event: dict) -> str:
    headers = event.get('headers', {})
    forwarded = headers.get('X-Forwarded-For', '')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return event.get('requestContext', {}).get('identity', {}).get('sourceIp', 'unknown')
