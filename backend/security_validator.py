"""Валидаторы для защиты от SQL injection и других атак"""

import re
from typing import Any

def validate_user_id(user_id: Any) -> bool:
    """Проверяет что user_id - валидное целое число"""
    if user_id is None:
        return False
    
    try:
        int_value = int(user_id)
        return 1 <= int_value <= 2147483647  # PostgreSQL INTEGER max
    except (ValueError, TypeError):
        return False

def validate_email(email: str) -> bool:
    """Проверяет формат email с защитой от инъекций"""
    if not email or not isinstance(email, str):
        return False
    
    # Длина
    if len(email) < 3 or len(email) > 255:
        return False
    
    # Опасные символы
    dangerous_chars = ["'", '"', '\\', ';', '--', '/*', '*/', '<', '>', '\x00']
    if any(char in email for char in dangerous_chars):
        return False
    
    # RFC 5322 упрощенная версия
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(email_pattern, email))

def validate_string_field(value: str, field_name: str, max_length: int = 255, allow_empty: bool = False) -> tuple:
    """
    Проверяет строковое поле
    Возвращает (is_valid: bool, error_message: str | None)
    """
    if value is None:
        if allow_empty:
            return (True, None)
        return (False, f'{field_name} не может быть пустым')
    
    if not isinstance(value, str):
        return (False, f'{field_name} должно быть строкой')
    
    # Удаляем пробелы
    value = value.strip()
    
    if not value and not allow_empty:
        return (False, f'{field_name} не может быть пустым')
    
    # Проверка длины
    if len(value) > max_length:
        return (False, f'{field_name} слишком длинное (макс. {max_length} символов)')
    
    # Защита от NULL байтов
    if '\x00' in value:
        return (False, f'{field_name} содержит недопустимые символы')
    
    # Защита от SQL injection паттернов
    sql_patterns = [
        r';\s*DROP\s+TABLE',
        r';\s*DELETE\s+FROM',
        r';\s*UPDATE\s+',
        r'UNION\s+SELECT',
        r'--',
        r'/\*.*\*/',
        r'xp_cmdshell',
        r'exec\s*\(',
        r'execute\s*\('
    ]
    
    for pattern in sql_patterns:
        if re.search(pattern, value, re.IGNORECASE):
            print(f"[SECURITY] SQL injection attempt detected in {field_name}: {value[:50]}")
            return (False, f'{field_name} содержит недопустимые символы')
    
    return (True, None)

def validate_integer_field(value: Any, field_name: str, min_val: int = None, max_val: int = None) -> tuple:
    """
    Проверяет целочисленное поле
    Возвращает (is_valid: bool, error_message: str | None)
    """
    if value is None:
        return (False, f'{field_name} не может быть пустым')
    
    try:
        int_value = int(value)
    except (ValueError, TypeError):
        return (False, f'{field_name} должно быть числом')
    
    if min_val is not None and int_value < min_val:
        return (False, f'{field_name} должно быть >= {min_val}')
    
    if max_val is not None and int_value > max_val:
        return (False, f'{field_name} должно быть <= {max_val}')
    
    return (True, None)

def validate_datetime_string(value: str, field_name: str) -> tuple:
    """
    Проверяет строку даты/времени (ISO 8601)
    Возвращает (is_valid: bool, error_message: str | None)
    """
    if not value:
        return (True, None)  # nullable
    
    if not isinstance(value, str):
        return (False, f'{field_name} должно быть строкой')
    
    # Проверка формата ISO 8601
    iso_pattern = r'^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$'
    if not re.match(iso_pattern, value):
        return (False, f'{field_name} должно быть в формате YYYY-MM-DD или ISO 8601')
    
    return (True, None)

def sanitize_filename(filename: str) -> str:
    """Очищает имя файла от опасных символов"""
    if not filename:
        return 'unnamed'
    
    # Удаляем путь (защита от path traversal)
    filename = filename.split('/')[-1].split('\\')[-1]
    
    # Удаляем опасные символы
    filename = re.sub(r'[^\w\s\-\.]', '', filename)
    
    # Ограничиваем длину
    if len(filename) > 255:
        name, ext = filename.rsplit('.', 1) if '.' in filename else (filename, '')
        filename = name[:250] + ('.' + ext if ext else '')
    
    return filename or 'unnamed'

def validate_json_field(value: Any, field_name: str, required_keys: list = None) -> tuple:
    """
    Проверяет JSON поле
    Возвращает (is_valid: bool, error_message: str | None)
    """
    if value is None:
        return (False, f'{field_name} не может быть пустым')
    
    if not isinstance(value, dict):
        return (False, f'{field_name} должно быть объектом')
    
    if required_keys:
        missing = [k for k in required_keys if k not in value]
        if missing:
            return (False, f'{field_name} не содержит обязательных полей: {", ".join(missing)}')
    
    return (True, None)

def check_ownership(conn, table: str, record_id: int, user_id: int) -> bool:
    """
    Проверяет что запись принадлежит пользователю
    КРИТИЧЕСКАЯ защита от IDOR (Insecure Direct Object Reference)
    """
    # Whitelist допустимых таблиц
    allowed_tables = ['materials', 'schedule', 'tasks', 'payments']
    if table not in allowed_tables:
        print(f"[SECURITY] Попытка доступа к недопустимой таблице: {table}")
        return False
    
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    
    # Используем параметризованный запрос (защита от SQL injection)
    # table name берется из whitelist, поэтому безопасно
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT 1 FROM {schema}.{table}
        WHERE id = %s AND user_id = %s
        LIMIT 1
    """, (record_id, user_id))
    
    result = cursor.fetchone()
    cursor.close()
    
    if not result:
        print(f"[SECURITY] IDOR attempt: user {user_id} tried to access {table}.{record_id}")
        return False
    
    return True

import os
