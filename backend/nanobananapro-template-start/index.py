import json
import os
import psycopg2
from typing import Dict, Any
import uuid
from datetime import datetime
from session_utils import validate_session

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''Запуск генерации шаблонных изображений (капсула/лукбук-сетка) через NanoBanana'''
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'

    method: str = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }

    import time
    request_timestamp = time.time()
    request_id = f"{context.request_id[:8]}-{int(request_timestamp * 1000)}"
    print(f'[TEMPLATE-START-{request_id}] ========== NEW REQUEST ==========')

    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }

    is_valid, user_id, error_msg = validate_session(event)
    if not is_valid:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': error_msg or 'Unauthorized'})
        }

    if not user_id:
        return {
            'statusCode': 401,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'User ID required'})
        }

    print(f'[TEMPLATE-START-{request_id}] User: {user_id}')

    body_data = json.loads(event.get('body', '{}'))
    mode = body_data.get('mode', '')
    person_image = body_data.get('person_image', '')
    template_image = body_data.get('template_image', '')
    garments = body_data.get('garments', [])
    prompt = body_data.get('prompt', '')

    if mode not in ('capsule', 'lookbook_grid'):
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'mode must be capsule or lookbook_grid'})
        }

    if not person_image:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'person_image is required'})
        }

    if not template_image:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'template_image is required'})
        }

    if len(garments) > 12:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Максимум 12 предметов одежды'})
        }

    if len(garments) == 0:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'At least one garment is required'})
        }

    if mode == 'capsule':
        model_outfit = body_data.get('model_outfit', [])
        template_data = {
            'model_outfit': model_outfit,
            'garments': garments,
            'prompt': prompt,
            'template_image': template_image
        }
    else:
        grid_size = body_data.get('grid_size', 4)
        if grid_size not in (4, 8):
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'grid_size must be 4 or 8'})
            }
        slots = body_data.get('slots', [])
        if len(slots) != grid_size:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': f'Expected {grid_size} slots, got {len(slots)}'})
            }
        template_data = {
            'grid_size': grid_size,
            'slots': slots,
            'garments': garments,
            'prompt': prompt,
            'template_image': template_image
        }

    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        person_prefix = person_image[:100] if len(person_image) > 100 else person_image
        cursor.execute('''
            SELECT id, created_at FROM nanobananapro_tasks
            WHERE user_id = %s
              AND status IN ('pending', 'processing')
              AND mode = %s
              AND LEFT(person_image, 100) = %s
              AND created_at > NOW() - INTERVAL '0.01 seconds'
            ORDER BY created_at DESC
            LIMIT 1
        ''', (user_id, mode, person_prefix))

        existing = cursor.fetchone()
        if existing:
            existing_task_id = existing[0]
            print(f'[TEMPLATE-START-{request_id}] DEDUPLICATED: {existing_task_id}')
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({
                    'task_id': existing_task_id,
                    'status': 'pending',
                    'estimated_time_seconds': 60,
                    'deduplicated': True
                })
            }

        task_id = str(uuid.uuid4())
        garments_json = json.dumps([g for g in garments if g.get('image')], ensure_ascii=False)
        template_data_json = json.dumps(template_data, ensure_ascii=False)

        cursor.execute('''
            INSERT INTO nanobananapro_tasks (id, user_id, status, person_image, garments, prompt_hints, mode, template_data, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (
            task_id,
            user_id,
            'pending',
            person_image,
            garments_json,
            prompt,
            mode,
            template_data_json,
            datetime.utcnow()
        ))

        conn.commit()
        print(f'[TEMPLATE-START-{request_id}] Task {task_id} saved, mode={mode}')
        cursor.close()
        conn.close()

        try:
            import urllib.request
            worker_url = f'https://functions.poehali.dev/7f57bfff-f742-4a66-b506-c2acb4e2cdd3?task_id={task_id}'
            req = urllib.request.Request(worker_url, method='GET')
            urllib.request.urlopen(req, timeout=2)
            print(f'[TEMPLATE-START-{request_id}] Template worker triggered for {task_id}')
        except Exception as e:
            print(f'[TEMPLATE-START-{request_id}] Worker trigger failed (non-critical): {e}')

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({
                'task_id': task_id,
                'status': 'pending',
                'estimated_time_seconds': 60
            })
        }

    except Exception as e:
        print(f'[TEMPLATE-START-{request_id}] Error: {e}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }