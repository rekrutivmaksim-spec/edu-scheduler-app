"""API для управления подписками и проверки лимитов пользователей"""

import json
import os
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import jwt


def get_db_connection():
    """Создаёт подключение к PostgreSQL базе данных"""
    dsn = os.environ['DATABASE_URL']
    schema = os.environ.get('MAIN_DB_SCHEMA', 'public')
    conn = psycopg2.connect(dsn, options=f'-c search_path={schema}')
    return conn


def verify_token(token: str) -> dict:
    """Проверяет JWT токен и возвращает payload"""
    secret = os.environ['JWT_SECRET']
    try:
        return jwt.decode(token, secret, algorithms=['HS256'])
    except:
        return None


def check_subscription_status(user_id: int, conn) -> dict:
    """Проверяет статус подписки пользователя (включая триал период)"""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT subscription_type, subscription_expires_at,
                   materials_quota_used, materials_quota_reset_at,
                   trial_ends_at, is_trial_used,
                   ai_questions_used, ai_questions_reset_at,
                   daily_questions_used, daily_questions_reset_at,
                   bonus_questions
            FROM users
            WHERE id = %s
        """, (user_id,))
        
        user = cur.fetchone()
        
        if not user:
            return {'is_premium': False, 'subscription_type': 'free', 'is_trial': False}
        
        now = datetime.now()
        is_premium = False
        is_trial = False
        trial_ends_at = None
        
        # Проверяем премиум подписку
        if user['subscription_type'] == 'premium':
            if user['subscription_expires_at']:
                if user['subscription_expires_at'] > now:
                    is_premium = True
                else:
                    cur.execute("""
                        UPDATE users 
                        SET subscription_type = 'free', subscription_expires_at = NULL
                        WHERE id = %s
                    """, (user_id,))
                    conn.commit()
            else:
                is_premium = True
        
        # Проверяем триал период (если нет активной премиум подписки)
        # КРИТИЧЕСКИ ВАЖНО: проверяем is_trial_used чтобы нельзя было использовать триал повторно
        if not is_premium and user.get('trial_ends_at') and not user.get('is_trial_used'):
            trial_ends_naive = user['trial_ends_at'].replace(tzinfo=None) if user['trial_ends_at'].tzinfo else user['trial_ends_at']
            if trial_ends_naive > now:
                is_trial = True
                trial_ends_at = user['trial_ends_at']
            else:
                # Триал закончился - помечаем как использованный (защита от накрутки)
                cur.execute("""
                    UPDATE users 
                    SET is_trial_used = TRUE
                    WHERE id = %s AND is_trial_used = FALSE
                """, (user_id,))
                conn.commit()
        # Если is_trial_used = TRUE, то триал уже был использован - не даем доступ повторно
        elif not is_premium and user.get('is_trial_used'):
            # Триал уже использован - предотвращаем повторное использование
            is_trial = False
            trial_ends_at = None
        
        if user['materials_quota_reset_at'] and user['materials_quota_reset_at'] < datetime.now():
            cur.execute("""
                UPDATE users 
                SET materials_quota_used = 0,
                    materials_quota_reset_at = CURRENT_TIMESTAMP + INTERVAL '1 month'
                WHERE id = %s
            """, (user_id,))
            conn.commit()
            user['materials_quota_used'] = 0
        
        # Сброс дневных вопросов каждый день
        if user.get('daily_questions_reset_at'):
            reset_naive = user['daily_questions_reset_at'].replace(tzinfo=None) if user['daily_questions_reset_at'].tzinfo else user['daily_questions_reset_at']
            if reset_naive < now:
                cur.execute("""
                    UPDATE users 
                    SET daily_questions_used = 0,
                        daily_questions_reset_at = CURRENT_TIMESTAMP + INTERVAL '1 day'
                    WHERE id = %s
                """, (user_id,))
                conn.commit()
                user['daily_questions_used'] = 0
        
        return {
            'is_premium': is_premium,
            'is_trial': is_trial,
            'subscription_type': user['subscription_type'],
            'subscription_expires_at': user['subscription_expires_at'].isoformat() if user['subscription_expires_at'] else None,
            'trial_ends_at': trial_ends_at.isoformat() if trial_ends_at else None,
            'materials_quota_used': user['materials_quota_used'] or 0,
            'materials_quota_reset_at': user['materials_quota_reset_at'].isoformat() if user['materials_quota_reset_at'] else None,
            'ai_questions_used': user.get('ai_questions_used', 0) or 0,
            'ai_questions_reset_at': user.get('ai_questions_reset_at').isoformat() if user.get('ai_questions_reset_at') else None,
            'daily_questions_used': user.get('daily_questions_used', 0) or 0,
            'daily_questions_reset_at': user.get('daily_questions_reset_at').isoformat() if user.get('daily_questions_reset_at') else None,
            'bonus_questions': user.get('bonus_questions', 0) or 0
        }


def get_limits(conn, user_id: int) -> dict:
    """Получает текущие лимиты пользователя"""
    status = check_subscription_status(user_id, conn)
    
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT COUNT(*) as count FROM schedule WHERE user_id = %s", (user_id,))
        schedule_count = cur.fetchone()['count']
        
        cur.execute("SELECT COUNT(*) as count FROM tasks WHERE user_id = %s AND completed = false", (user_id,))
        tasks_count = cur.fetchone()['count']
    
    if status['is_premium']:
        return {
            **status,
            'limits': {
                'schedule': {'used': schedule_count, 'max': None, 'unlimited': True},
                'tasks': {'used': tasks_count, 'max': None, 'unlimited': True},
                'materials': {'used': status['materials_quota_used'], 'max': None, 'unlimited': True},
                'exam_predictions': {'unlimited': True}
            }
        }
    elif status['is_trial']:
        # Триал (24 часа): безлимитный доступ ко всему
        return {
            **status,
            'limits': {
                'schedule': {'used': schedule_count, 'max': None, 'unlimited': True},
                'tasks': {'used': tasks_count, 'max': None, 'unlimited': True},
                'materials': {'used': status['materials_quota_used'], 'max': None, 'unlimited': True},
                'ai_questions': {'used': 0, 'max': None, 'unlimited': True, 'daily_used': 0},
                'exam_predictions': {'unlimited': True, 'available': True}
            }
        }
    else:
        # Free: 3 бесплатных вопроса в день + бонусные вопросы
        daily_used = status.get('daily_questions_used', 0)
        bonus = status.get('bonus_questions', 0)
        total_available = 3 + bonus
        total_used = daily_used
        
        return {
            **status,
            'limits': {
                'schedule': {'used': schedule_count, 'max': 7, 'unlimited': False},
                'tasks': {'used': tasks_count, 'max': 10, 'unlimited': False},
                'materials': {'used': status['materials_quota_used'], 'max': 2, 'unlimited': False},
                'ai_questions': {
                    'used': total_used, 
                    'max': total_available, 
                    'unlimited': False,
                    'daily_used': daily_used,
                    'daily_limit': 3,
                    'bonus_available': bonus
                },
                'exam_predictions': {'unlimited': False, 'available': False}
            }
        }


def handler(event: dict, context) -> dict:
    """Обработчик запросов для подписок"""
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Authorization'
            },
            'body': ''
        }
    
    headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    }
    
    hdrs = event.get('headers', {})
    auth_header = hdrs.get('X-Authorization') or hdrs.get('x-authorization') or hdrs.get('Authorization') or hdrs.get('authorization') or ''
    token = auth_header.replace('Bearer ', '')
    
    if not token:
        return {
            'statusCode': 401,
            'headers': headers,
            'body': json.dumps({'error': 'Требуется авторизация'})
        }
    
    payload = verify_token(token)
    if not payload:
        return {
            'statusCode': 401,
            'headers': headers,
            'body': json.dumps({'error': 'Недействительный токен'})
        }
    
    user_id = payload['user_id']
    conn = get_db_connection()
    
    try:
        if method == 'GET':
            action = event.get('queryStringParameters', {}).get('action', 'status')
            
            if action == 'status':
                status = check_subscription_status(user_id, conn)
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps(status, default=str)
                }
            
            elif action == 'limits':
                limits = get_limits(conn, user_id)
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps(limits, default=str)
                }
            
            elif action == 'referral':
                # Получение реферальных данных
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute("""
                        SELECT referral_code, referral_count, referral_rewards_earned
                        FROM users
                        WHERE id = %s
                    """, (user_id,))
                    user = cur.fetchone()
                    
                    if not user or not user['referral_code']:
                        # Генерируем реферальный код если его нет
                        import hashlib
                        referral_code = hashlib.md5((str(user_id) + str(datetime.now().timestamp())).encode()).hexdigest()[:8].upper()
                        cur.execute("""
                            UPDATE users 
                            SET referral_code = %s
                            WHERE id = %s
                            RETURNING referral_code, referral_count, referral_rewards_earned
                        """, (referral_code, user_id))
                        user = cur.fetchone()
                        conn.commit()
                    
                    count = user['referral_count'] or 0
                    total_days = count * 7
                    
                    cur.execute("""
                        SELECT ri.created_at, u.full_name
                        FROM referral_invites ri
                        JOIN users u ON u.id = ri.invited_id
                        WHERE ri.referrer_id = %s
                        ORDER BY ri.created_at DESC
                        LIMIT 20
                    """, (user_id,))
                    invites = cur.fetchall()
                    
                    invite_list = []
                    for inv in invites:
                        name = inv['full_name'] or 'Студент'
                        if len(name) > 2:
                            name = name[0] + '***' + name[-1]
                        invite_list.append({
                            'name': name,
                            'date': inv['created_at'].strftime('%d.%m.%Y') if inv['created_at'] else ''
                        })
                    
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({
                            'referral_code': user['referral_code'],
                            'referral_count': count,
                            'rewards_earned': user['referral_rewards_earned'] or 0,
                            'total_premium_days': total_days,
                            'next_reward': '+7 дней Premium за каждого друга',
                            'progress_to_1month': min(count, 10),
                            'progress_to_1year': min(count, 20),
                            'has_1month_reward': count >= 10,
                            'has_1year_reward': count >= 20,
                            'invites': invite_list
                        })
                    }
        
        elif method == 'POST':
            body = json.loads(event.get('body', '{}'))
            action = body.get('action')
            
            if action == 'use_referral':
                # Использование реферального кода
                referral_code = body.get('referral_code', '').strip().upper()
                
                # Валидация: только буквы и цифры, 8 символов
                if not referral_code or len(referral_code) != 8 or not referral_code.isalnum():
                    return {
                        'statusCode': 400,
                        'headers': headers,
                        'body': json.dumps({'error': 'Некорректный формат реферального кода'})
                    }
                
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Проверяем что пользователь еще не использовал реферальный код
                    cur.execute("SELECT referred_by, created_at FROM users WHERE id = %s", (user_id,))
                    user = cur.fetchone()
                    
                    if user and user['referred_by']:
                        return {
                            'statusCode': 400,
                            'headers': headers,
                            'body': json.dumps({'error': 'Вы уже использовали реферальный код'})
                        }
                    
                    # ЗАЩИТА: можно использовать код только в течение 7 дней после регистрации
                    if user and user['created_at']:
                        days_since_registration = (datetime.now() - user['created_at'].replace(tzinfo=None)).days
                        if days_since_registration > 7:
                            return {
                                'statusCode': 400,
                                'headers': headers,
                                'body': json.dumps({'error': 'Реферальный код можно использовать только в течение 7 дней после регистрации'})
                            }
                    
                    # Ищем реферера
                    cur.execute("SELECT id FROM users WHERE referral_code = %s", (referral_code,))
                    referrer = cur.fetchone()
                    
                    if not referrer:
                        return {
                            'statusCode': 404,
                            'headers': headers,
                            'body': json.dumps({'error': 'Реферальный код не найден'})
                        }
                    
                    if referrer['id'] == user_id:
                        return {
                            'statusCode': 400,
                            'headers': headers,
                            'body': json.dumps({'error': 'Нельзя использовать свой собственный код'})
                        }
                    
                    cur.execute("""
                        UPDATE users 
                        SET referred_by = %s
                        WHERE id = %s
                    """, (referrer['id'], user_id))
                    
                    cur.execute("""
                        UPDATE users 
                        SET referral_count = COALESCE(referral_count, 0) + 1
                        WHERE id = %s
                        RETURNING referral_count, subscription_expires_at
                    """, (referrer['id'],))
                    
                    updated = cur.fetchone()
                    new_count = updated['referral_count']
                    current_expires = updated['subscription_expires_at']
                    
                    if current_expires and current_expires > datetime.now():
                        cur.execute("""
                            UPDATE users 
                            SET subscription_expires_at = subscription_expires_at + INTERVAL '7 days',
                                referral_rewards_earned = COALESCE(referral_rewards_earned, 0) + 1
                            WHERE id = %s
                        """, (referrer['id'],))
                    else:
                        cur.execute("""
                            UPDATE users 
                            SET subscription_type = 'premium',
                                subscription_expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days',
                                referral_rewards_earned = COALESCE(referral_rewards_earned, 0) + 1
                            WHERE id = %s
                        """, (referrer['id'],))
                    
                    cur.execute("""
                        INSERT INTO referral_invites (referrer_id, invited_id, reward_type, reward_granted)
                        VALUES (%s, %s, '7_days_premium', TRUE)
                        ON CONFLICT (invited_id) DO NOTHING
                    """, (referrer['id'], user_id))
                    
                    cur.execute("""
                        UPDATE users 
                        SET bonus_questions = COALESCE(bonus_questions, 0) + 5
                        WHERE id = %s
                    """, (user_id,))
                    
                    conn.commit()
                    
                    return {
                        'statusCode': 200,
                        'headers': headers,
                        'body': json.dumps({
                            'message': 'Код применён! Ты получил +5 бонусных вопросов к ИИ-ассистенту',
                            'bonus_added': 5,
                            'referrer_reward': '7 дней Premium'
                        })
                    }
            
            elif action == 'upgrade_demo':
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE users 
                        SET subscription_type = 'premium',
                            subscription_expires_at = CURRENT_TIMESTAMP + INTERVAL '7 days'
                        WHERE id = %s
                    """, (user_id,))
                    conn.commit()
                
                return {
                    'statusCode': 200,
                    'headers': headers,
                    'body': json.dumps({
                        'message': 'Премиум активирован на 7 дней (демо)',
                        'subscription_type': 'premium',
                        'expires_at': (datetime.now().timestamp() + 7*24*60*60)
                    })
                }
        
        return {
            'statusCode': 404,
            'headers': headers,
            'body': json.dumps({'error': 'Маршрут не найден'})
        }
        
    finally:
        conn.close()