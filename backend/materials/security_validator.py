"""Security validators для materials"""
import os
import re

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
