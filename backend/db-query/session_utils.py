"""
Session validation utilities for secure authentication
Used by protected endpoints to validate session tokens
"""
import os
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

def get_db_connection():
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)

def extract_token_from_event(event: dict) -> str:
    """
    Extract session token from headers or cookies
    Supports both new (X-Session-Token, Cookie) and old (localStorage) methods
    """
    headers = event.get('headers', {})
    
    print(f'[SessionDebug] All headers: {list(headers.keys())}')
    print(f'[SessionDebug] x-cookie: {headers.get("x-cookie", "NOT FOUND")}')
    print(f'[SessionDebug] X-Cookie: {headers.get("X-Cookie", "NOT FOUND")}')
    
    # Try X-Session-Token header (new way - from localStorage)
    token = headers.get('x-session-token') or headers.get('X-Session-Token')
    if token:
        print(f'[SessionDebug] Found token in X-Session-Token header')
        return token
    
    # Try X-Cookie header (httpOnly cookie)
    cookie_header = headers.get('x-cookie') or headers.get('X-Cookie', '')
    if cookie_header:
        print(f'[SessionDebug] Cookie header value: {cookie_header[:50]}...')
        # Parse session_token from cookies
        for cookie in cookie_header.split(';'):
            cookie = cookie.strip()
            if cookie.startswith('session_token='):
                token = cookie.split('=', 1)[1]
                print(f'[SessionDebug] Found session_token in cookie')
                return token
    
    print(f'[SessionDebug] No token found in any header!')
    return None

def validate_session(event: dict) -> tuple[bool, str, str]:
    """
    Validate session token and return user_id
    Returns: (is_valid, user_id, error_message)
    

    """
    # Try new way: validate token from DB
    token = extract_token_from_event(event)
    
    if token:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            cursor.execute(
                """
                SELECT user_id, expires_at FROM sessions 
                WHERE token = %s
                """,
                (token,)
            )
            session = cursor.fetchone()
            
            if not session:
                return (False, None, 'Invalid session token')
            
            if datetime.now() > session['expires_at']:
                return (False, None, 'Session expired')
            
            # Update last_used_at
            cursor.execute(
                "UPDATE sessions SET last_used_at = CURRENT_TIMESTAMP WHERE token = %s",
                (token,)
            )
            conn.commit()
            
            return (True, str(session['user_id']), '')
        except Exception as e:
            return (False, None, f'Session validation error: {str(e)}')
        finally:
            cursor.close()
            conn.close()
    
    return (False, None, 'No authentication provided - session token required')