"""Security validators для schedule"""
import os

def check_ownership(conn, table: str, record_id: int, user_id: int) -> bool:
    allowed_tables = ['materials', 'schedule', 'tasks', 'payments']
    if table not in allowed_tables:
        return False
    
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    cursor = conn.cursor()
    cursor.execute(f"""
        SELECT 1 FROM {schema}.{table}
        WHERE id = %s AND user_id = %s
        LIMIT 1
    """, (record_id, user_id))
    
    result = cursor.fetchone()
    cursor.close()
    return result is not None

def validate_string_field(value: str, field_name: str, max_length: int = 255, allow_empty: bool = False) -> tuple:
    if value is None:
        return (True, None) if allow_empty else (False, f'{field_name} не может быть пустым')
    if not isinstance(value, str):
        return (False, f'{field_name} должно быть строкой')
    if len(value) > max_length:
        return (False, f'{field_name} слишком длинное')
    return (True, None)

def validate_integer_field(value, field_name: str, min_val: int = None, max_val: int = None) -> tuple:
    try:
        int_value = int(value)
        if min_val and int_value < min_val:
            return (False, f'{field_name} должно быть >= {min_val}')
        if max_val and int_value > max_val:
            return (False, f'{field_name} должно быть <= {max_val}')
        return (True, None)
    except:
        return (False, f'{field_name} должно быть числом')
