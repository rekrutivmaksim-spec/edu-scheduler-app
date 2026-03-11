import json
import os
import psycopg2
from typing import Dict, Any, Optional
import requests
from datetime import datetime
from googletrans import Translator
import boto3
import time
import uuid

GENERATION_COST = 50

def normalize_image_format(image: str) -> str:
    if image.startswith('http://') or image.startswith('https://'):
        return image
    if image.startswith('data:'):
        return image
    return f'data:image/jpeg;base64,{image}'

def translate_to_english(text: str) -> str:
    if not text or not text.strip():
        return text
    try:
        translator = Translator()
        detected = translator.detect(text)
        if detected.lang == 'ru':
            print(f'[Translate] Detected Russian, translating: {text}')
            translated = translator.translate(text, src='ru', dest='en')
            result = translated.text
            print(f'[Translate] Translated to: {result}')
            return result
        else:
            print(f'[Translate] Detected {detected.lang}, keeping original')
            return text
    except Exception as e:
        print(f'[Translate] Error: {e}, keeping original text')
        return text

def ordinal_image_ref(n: int) -> str:
    ordinals = {1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth', 6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth', 11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth'}
    return f'{ordinals.get(n, str(n)+"th")} uploaded image'

def build_capsule_prompt(template_data: dict) -> str:
    garments = template_data.get('garments', [])
    model_outfit = template_data.get('model_outfit', [])
    prompt = template_data.get('prompt', '')

    person_ref = ordinal_image_ref(1)
    template_ref = ordinal_image_ref(2)

    base = "Create a fashion capsule wardrobe image exactly like the template/reference image layout. "
    base += "The image has TWO parts side by side: LEFT part is a full-body photo of the model, RIGHT part is a grid of clothing items WITHOUT any text labels or numbers. "

    base += f"CRITICAL RULE — PERSON: The {person_ref} is the person photo. Keep the EXACT face, body shape, physique, skin tone, hair, body proportions, and build from the {person_ref}. The model on the LEFT side MUST look identical to the person in the {person_ref}. Do NOT generate, invent, or substitute a different face or body. Do NOT use faces or body features from the {template_ref} (template), clothing images, or any other source. The {person_ref} is the ONLY source for the person's appearance. Change ONLY the clothes. "

    base += f"CRITICAL RULE — TEMPLATE: The {template_ref} is ONLY a layout/structure reference. Use it ONLY to understand the composition and arrangement of elements (model on the left, grid on the right). Do NOT take any clothing, accessories, person, face, or body from the {template_ref}. Ignore all garments and people shown in the template. "

    base += f"CRITICAL RULE — NO EXTRA ITEMS: Do NOT copy, transfer, or add ANY clothing, accessories, glasses, sunglasses, bags, hats, scarves, jewelry, or other items from the {template_ref} (template) or the {person_ref} (person photo) onto the model in the result. The {template_ref} is ONLY for layout structure, the {person_ref} is ONLY for face and body shape. ONLY dress the model in the specific items listed below. "

    keep_keywords = ['оставить', 'оставь', 'сохрани', 'не меняй', 'keep original', 'keep the original', 'keep her', 'keep his', 'don\'t change', 'do not change']
    all_text = (prompt or '').lower()
    for g in garments:
        all_text += ' ' + (g.get('hint', '') or '').lower()
    has_keep_instruction = any(kw in all_text for kw in keep_keywords)

    if not has_keep_instruction:
        base += f"CRITICAL RULE — REMOVE ORIGINAL CLOTHING: COMPLETELY REMOVE and DISCARD all original clothing that the person is wearing in the {person_ref}. The person's original outfit MUST NOT appear on the model. Dress the model ONLY in the garments specified below. If an item is not listed, it MUST NOT be on the model. "

    outfit_image_refs = []
    outfit_photo_descs = []
    outfit_text_descs = []
    for idx in model_outfit:
        if idx < len(garments):
            g = garments[idx]
            desc = g.get('hint', '') or f'item {idx+1}'
            if g.get('image'):
                image_num = idx + 3
                ref = ordinal_image_ref(image_num)
                outfit_image_refs.append(ref)
                outfit_photo_descs.append(f'{desc} (from {ref})')
            else:
                outfit_text_descs.append(desc)

    if outfit_photo_descs or outfit_text_descs:
        all_descs = outfit_photo_descs + outfit_text_descs
        translated_outfit = translate_to_english(', '.join(all_descs))
        base += f"LEFT: The model from the {person_ref} wearing ONLY these specific items together: {translated_outfit}. "
        if outfit_image_refs:
            refs_str = ', '.join([f'the {r}' for r in outfit_image_refs])
            base += f"For photo-based items, take clothing appearance ONLY from: {refs_str}. Reproduce each item as a PIXEL-PERFECT copy on the model — preserve the EXACT fabric type, precise color with no hue shifts, cut, construction, and all details. No reinterpretation, no style changes, no fabric substitution. "
        if outfit_text_descs:
            translated_text_items = translate_to_english(', '.join(outfit_text_descs))
            base += f"For text-described items (no photo reference), GENERATE and draw these clothing items on the model based on their description: {translated_text_items}. "
        base += "Do NOT put any other clothing items, accessories, glasses, or bags on the model that are not listed above. "
    else:
        base += f"LEFT: The model from the {person_ref} in a stylish outfit. "

    if prompt:
        translated_prompt = translate_to_english(prompt)
        base += f"Background and style: {translated_prompt}. "

    photo_garments = [g for g in garments if g.get('image')]
    text_garments = [g for g in garments if not g.get('image')]

    total_count = len(garments)
    all_item_descs = []
    for i, g in enumerate(garments):
        desc = g.get('hint', '') or f'item {i+1}'
        all_item_descs.append(desc)
    translated_items_list = translate_to_english(', '.join(all_item_descs))

    base += f"RIGHT: A clean grid layout showing EXACTLY {total_count} clothing items — no more, no less. Each of these {total_count} items MUST appear separately in the grid: {translated_items_list}. Do NOT skip, merge, or omit any item. Do NOT add any text, labels, numbers, or titles to the grid — show only the clothing images. "
    if photo_garments:
        base += "For items with a photo reference — reproduce them as a PIXEL-PERFECT copy from their corresponding uploaded image. Preserve the EXACT original design: fabric, color, cut, construction, and all details. No reinterpretation. "
    if text_garments:
        text_descs = [g.get('hint', '') for g in text_garments]
        translated_text_grid = translate_to_english(', '.join(text_descs))
        base += f"For items WITHOUT a photo (text-only) — GENERATE a realistic clothing image based on the text description and place it in the grid: {translated_text_grid}. "

    base += f"Keep the EXACT face, body shape, physique, skin tone, and hair from the {person_ref} (person photo). Professional fashion lookbook style. Clean white or light background for the clothing grid. "

    return base

def build_grid_prompt(template_data: dict) -> str:
    grid_size = template_data.get('grid_size', 4)
    slots = template_data.get('slots', [])
    garments = template_data.get('garments', [])
    prompt = template_data.get('prompt', '')

    person_ref = ordinal_image_ref(1)
    template_ref = ordinal_image_ref(2)

    if grid_size == 4:
        base = "Create a fashion lookbook collage with exactly 4 photos in a 2x2 grid layout. "
    else:
        base = "Create a fashion lookbook collage with exactly 8 photos in a 2x4 grid layout (2 rows, 4 columns). "

    base += f"IMAGE ROLES: The {person_ref} is the PERSON photo — this is the model whose face, body, hair, skin tone, and physique must appear in every outfit cell. The {template_ref} is ONLY a GRID LAYOUT EXAMPLE — use it ONLY to understand how cells are arranged (rows, columns, spacing). Do NOT take ANY content from the {template_ref}: no clothing, no people, no faces, no accessories, no text, no colors, no backgrounds. The content of each cell is defined SOLELY by the cell descriptions below. "

    base += f"CRITICAL RULE — PERSON IDENTITY: The model in ALL outfit cells MUST be the EXACT same person from the {person_ref}. Preserve the IDENTICAL face, body shape, physique, skin tone, hair color, hair style, and body proportions. Do NOT generate, invent, or substitute a different face or body. Do NOT use faces or body features from the {template_ref} or any clothing images. The {person_ref} is the ONLY source for the person's appearance. "

    base += f"CRITICAL RULE — CLOTHING FIDELITY: For each outfit cell, dress the model ONLY in the specific items listed in that cell's description. Do NOT copy, transfer, or add ANY clothing, accessories, glasses, sunglasses, bags, hats, scarves, jewelry, shoes, or other items from the {template_ref} (template) or the {person_ref} (person photo). If shoes are specified — use ONLY those shoes. If shoes are NOT specified — generate appropriate shoes that match the outfit. "

    keep_keywords = ['оставить', 'оставь', 'сохрани', 'не меняй', 'keep original', 'keep the original', 'keep her', 'keep his', 'don\'t change', 'do not change']
    all_text = (prompt or '').lower()
    for g in garments:
        all_text += ' ' + (g.get('hint', '') or '').lower()
    has_keep_instruction = any(kw in all_text for kw in keep_keywords)

    if not has_keep_instruction:
        base += f"CRITICAL RULE — REMOVE ORIGINAL CLOTHING: COMPLETELY REMOVE and DISCARD all original clothing that the person is wearing in the {person_ref}. The person's original outfit MUST NOT appear in ANY outfit cell. Every outfit cell must show the model dressed ONLY in the garments specified in that cell's description. If an item is not listed in the cell description, it MUST NOT be on the model. "

    for i, slot in enumerate(slots):
        slot_type = slot.get('type', 'outfit')
        cell_num = i + 1

        if slot_type == 'outfit':
            outfit_indices = slot.get('outfit', [])
            outfit_photo_descs = []
            outfit_text_descs = []
            outfit_image_refs = []
            for idx in outfit_indices:
                if idx < len(garments):
                    g = garments[idx]
                    desc = g.get('hint', '') or f'item {idx+1}'
                    if g.get('image'):
                        image_num = idx + 3
                        ref = ordinal_image_ref(image_num)
                        outfit_image_refs.append(ref)
                        outfit_photo_descs.append(f'{desc} (from {ref})')
                    else:
                        outfit_text_descs.append(desc)
            slot_prompt = slot.get('prompt', '')
            all_descs = outfit_photo_descs + outfit_text_descs
            if all_descs:
                translated_items = translate_to_english(', '.join(all_descs))
                base += f"Cell {cell_num} [OUTFIT]: Model from the {person_ref} wearing ONLY these items: {translated_items}. "
                if outfit_image_refs:
                    refs_str = ', '.join([f'the {r}' for r in outfit_image_refs])
                    base += f"For photo-based items, take clothing appearance ONLY from: {refs_str}. Reproduce each item as a PIXEL-PERFECT copy — preserve the EXACT fabric, color, cut, construction, and all details. No reinterpretation, no style changes, no fabric substitution. "
                if outfit_text_descs:
                    translated_text = translate_to_english(', '.join(outfit_text_descs))
                    base += f"For text-described items (no photo), GENERATE clothing based on description: {translated_text}. "
                base += "Do NOT put any other items on the model that are not listed above. "
            if slot_prompt:
                translated_slot = translate_to_english(slot_prompt)
                base += f"Style/background for cell {cell_num}: {translated_slot}. "
        elif slot_type == 'other':
            other_desc = slot.get('prompt', '')
            if other_desc:
                translated_other = translate_to_english(other_desc)
                base += f"Cell {cell_num} [CUSTOM CONTENT]: Instead of an outfit photo, this cell should contain: {translated_other}. Generate this content exactly as described. Do NOT place a person in this cell unless explicitly requested. "

    if prompt:
        translated_prompt = translate_to_english(prompt)
        base += f"Overall style: {translated_prompt}. "

    base += f"FINAL REMINDER: The person in ALL outfit cells must be IDENTICAL to the {person_ref}. The {template_ref} is ONLY for grid layout reference — ignore all its visual content. Professional fashion lookbook style. "

    return base

def submit_template_to_fal(person_image: str, template_image: str, garment_images: list, prompt: str, mode: str, grid_size: int = 4) -> tuple:
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')

    image_urls = [normalize_image_format(person_image), normalize_image_format(template_image)]
    for img in garment_images:
        image_urls.append(normalize_image_format(img))

    if mode == 'capsule':
        aspect_ratio = '4:3'
    elif grid_size == 8:
        aspect_ratio = '4:3'
    else:
        aspect_ratio = '3:4'

    print(f'[TemplateWorker] Mode: {mode}, aspect_ratio: {aspect_ratio}')
    print(f'[TemplateWorker] Images: 1=person, 2=template, 3-{len(image_urls)}=clothes')
    print(f'[TemplateWorker] Prompt length: {len(prompt)} chars')

    headers = {
        'Authorization': f'Key {fal_api_key}',
        'Content-Type': 'application/json'
    }

    payload = {
        'image_urls': image_urls,
        'prompt': prompt,
        'aspect_ratio': aspect_ratio,
        'num_images': 1
    }

    response = requests.post(
        'https://queue.fal.run/fal-ai/nano-banana-pro/edit',
        headers=headers,
        json=payload,
        timeout=30
    )

    if response.status_code == 200:
        result = response.json()
        if 'request_id' in result and 'response_url' in result:
            return (result['request_id'], result['response_url'])

    raise Exception(f'Failed to submit to queue: {response.status_code} - {response.text}')

def check_fal_status(response_url: str) -> Optional[dict]:
    fal_api_key = os.environ.get('FAL_API_KEY')
    if not fal_api_key:
        raise Exception('FAL_API_KEY not configured')
    headers = {
        'Authorization': f'Key {fal_api_key}',
        'Content-Type': 'application/json'
    }
    response = requests.get(response_url, headers=headers, timeout=10)
    if response.status_code == 200:
        return response.json()
    if response.status_code >= 500:
        error_text = response.text[:200] if response.text else 'Unknown server error'
        print(f'[check_fal_status] fal.ai returned {response.status_code}: {error_text}')
        return {'status': 'FAILED', 'error': f'fal.ai server error {response.status_code}: {error_text}'}
    raise Exception(f'Failed to check status: {response.status_code} - {response.text}')

def upload_to_s3(image_url: str, user_id: str, mode: str) -> str:
    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    s3_bucket = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')
    if not s3_access_key or not s3_secret_key:
        raise Exception('S3 credentials not configured')

    print(f'[S3] Downloading image: {image_url[:50]}...')
    img_response = requests.get(image_url, timeout=30)
    if img_response.status_code != 200:
        raise Exception(f'Failed to download image: {img_response.status_code}')
    image_data = img_response.content
    print(f'[S3] Downloaded {len(image_data)} bytes')

    timestamp = time.strftime('%Y%m%d_%H%M%S')
    random_suffix = uuid.uuid4().hex[:8]
    subfolder = 'capsule' if mode == 'capsule' else 'grid'
    filename = f'{subfolder}_{timestamp}_{user_id}_{random_suffix}.jpg'
    s3_key = f'images/lookbooks/{user_id}/{subfolder}/{filename}'

    print(f'[S3] Uploading to: {s3_key}')

    s3 = boto3.client('s3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key
    )
    s3.put_object(Bucket=s3_bucket, Key=s3_key, Body=image_data, ContentType='image/jpeg')
    cdn_url = f'https://storage.yandexcloud.net/{s3_bucket}/{s3_key}'
    print(f'[S3] Upload complete: {cdn_url}')
    return cdn_url

def refund_balance_if_needed(conn, user_id: str, task_id: str) -> None:
    try:
        cursor = conn.cursor()
        cursor.execute('SELECT refunded FROM t_p29007832_virtual_fitting_room.nanobananapro_tasks WHERE id = %s', (task_id,))
        refund_row = cursor.fetchone()
        if refund_row and refund_row[0]:
            print(f'[Refund] Task {task_id} already refunded')
            cursor.close()
            return
        cursor.execute('SELECT unlimited_access, balance FROM t_p29007832_virtual_fitting_room.users WHERE id = %s', (user_id,))
        user_row = cursor.fetchone()
        if not user_row:
            cursor.close()
            return
        unlimited_access = user_row[0]
        balance_before = float(user_row[1])
        if unlimited_access:
            cursor.execute('UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks SET refunded = true WHERE id = %s', (task_id,))
            conn.commit()
            cursor.close()
            return
        balance_after = balance_before + GENERATION_COST
        cursor.execute('UPDATE t_p29007832_virtual_fitting_room.users SET balance = balance + %s WHERE id = %s', (GENERATION_COST, user_id))
        cursor.execute('UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks SET refunded = true WHERE id = %s', (task_id,))
        cursor.execute('''
            INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
            (user_id, type, amount, balance_before, balance_after, description, try_on_id)
            VALUES (%s, 'refund', %s, %s, %s, 'Возврат: сбой шаблонной генерации', NULL)
        ''', (user_id, GENERATION_COST, balance_before, balance_after))
        conn.commit()
        print(f'[Refund] Refunded {GENERATION_COST} to user {user_id}')
        cursor.close()
    except Exception as e:
        print(f'[Refund] Error: {str(e)}')

def save_to_history(conn, user_id: str, cdn_url: str, person_image: str, garments: list, prompt: str, task_id: str, mode: str) -> Optional[str]:
    try:
        cursor = conn.cursor()
        garments_json = json.dumps(garments)
        cursor.execute('SELECT unlimited_access, balance FROM t_p29007832_virtual_fitting_room.users WHERE id = %s', (user_id,))
        user_row = cursor.fetchone()
        unlimited_access = user_row[0] if user_row else False
        cost = 0 if unlimited_access else GENERATION_COST
        garment_image = garments[0].get('image', '') if garments else ''
        model_used = 'capsule' if mode == 'capsule' else 'lookbook_grid'

        cursor.execute('''
            INSERT INTO t_p29007832_virtual_fitting_room.try_on_history
            (user_id, person_image, garment_image, result_image, garments, model_used, cost, created_at, saved_to_lookbook, task_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (user_id, person_image, garment_image, cdn_url, garments_json, model_used, cost, datetime.utcnow(), False, task_id))
        history_row = cursor.fetchone()
        history_id = str(history_row[0]) if history_row else None
        conn.commit()
        cursor.close()
        print(f'[History] Saved {mode} to history (id={history_id})')
        return history_id
    except psycopg2.errors.UniqueViolation:
        print(f'[History] Task {task_id} already saved, skipping')
        cursor.close()
        return None
    except Exception as e:
        print(f'[History] Failed to save: {str(e)}')
        cursor.close()
        return None


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''Обработка шаблонных задач генерации (капсула/лукбук-сетка) через NanoBanana'''
    def get_cors_origin(event: Dict[str, Any]) -> str:
        origin = event.get('headers', {}).get('origin') or event.get('headers', {}).get('Origin', '')
        allowed_origins = ['https://fitting-room.ru', 'https://preview--virtual-fitting-room.poehali.dev']
        return origin if origin in allowed_origins else 'https://fitting-room.ru'

    method: str = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }

    query_params = event.get('queryStringParameters') or {}
    task_id = query_params.get('task_id')

    if not task_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'task_id parameter is required'})
        }

    print(f'[TemplateWorker] Processing task: {task_id}')

    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }

    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, person_image, garments, prompt_hints, fal_request_id, fal_response_url, user_id, status, saved_to_history, mode, template_data
            FROM t_p29007832_virtual_fitting_room.nanobananapro_tasks
            WHERE id = %s
        ''', (task_id,))

        row = cursor.fetchone()
        if not row:
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Task not found'})
            }

        task_id, person_image, garments_json, prompt_hints, fal_request_id, fal_response_url, user_id, task_status, saved_to_history, mode, template_data_json = row
        garments = json.loads(garments_json) if garments_json else []
        template_data = json.loads(template_data_json) if template_data_json else {}

        if mode not in ('capsule', 'lookbook_grid'):
            cursor.close()
            conn.close()
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'error': f'Template worker cannot process mode: {mode}'})
            }

        if saved_to_history:
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                'isBase64Encoded': False,
                'body': json.dumps({'status': 'already_processed'})
            }

        if task_status == 'pending':
            if not fal_request_id:
                cursor.execute('''
                    SELECT COUNT(*) FROM t_p29007832_virtual_fitting_room.nanobananapro_tasks
                    WHERE status = 'processing'
                      AND fal_request_id IS NOT NULL
                      AND mode IN ('capsule', 'lookbook_grid')
                      AND created_at > NOW() - INTERVAL '3 minutes'
                ''')
                active_count = cursor.fetchone()[0]
                if active_count > 0:
                    print(f'[TemplateWorker] {active_count} active template task(s), staying pending')
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'isBase64Encoded': False,
                        'body': json.dumps({'status': 'queued', 'active_tasks': active_count})
                    }

                cursor.execute('''
                    UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                    SET status = 'processing', updated_at = %s
                    WHERE id = %s AND status = 'pending'
                    RETURNING id
                ''', (datetime.utcnow(), task_id))
                updated_row = cursor.fetchone()
                conn.commit()

                if not updated_row:
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
                        'isBase64Encoded': False,
                        'body': json.dumps({'status': 'task_already_processing'})
                    }

                try:
                    if mode == 'capsule':
                        built_prompt = build_capsule_prompt(template_data)
                    else:
                        built_prompt = build_grid_prompt(template_data)

                    print(f'[TemplateWorker] Built prompt: {built_prompt[:200]}...')

                    template_image = template_data.get('template_image', '') or person_image
                    garment_images = [g['image'] for g in garments if g.get('image')]
                    grid_size = template_data.get('grid_size', 4)

                    fal_req_id, response_url = submit_template_to_fal(
                        person_image, template_image, garment_images, built_prompt, mode, grid_size
                    )
                    print(f'[TemplateWorker] Submitted to fal.ai: {fal_req_id}')

                    cursor.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                        SET fal_request_id = %s, fal_response_url = %s, updated_at = %s
                        WHERE id = %s
                    ''', (fal_req_id, response_url, datetime.utcnow(), task_id))
                    conn.commit()

                except Exception as e:
                    error_msg = str(e)
                    print(f'[TemplateWorker] Submit failed: {error_msg}')
                    cursor.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                        SET status = 'failed', error_message = %s, updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
                    refund_balance_if_needed(conn, user_id, task_id)

        if task_status == 'processing' and fal_response_url:
            try:
                status_data = check_fal_status(fal_response_url)
                fal_status = status_data.get('status', status_data.get('state', 'UNKNOWN'))

                if fal_status.upper() == 'COMPLETED' or 'images' in status_data or 'image' in status_data:
                    if 'images' in status_data and len(status_data['images']) > 0:
                        fal_result_url = status_data['images'][0]['url']
                    elif 'image' in status_data:
                        if isinstance(status_data['image'], dict):
                            fal_result_url = status_data['image']['url']
                        else:
                            fal_result_url = status_data['image']
                    else:
                        raise Exception('No image in response')

                    print(f'[TemplateWorker] Task {task_id} completed! URL: {fal_result_url}')

                    try:
                        cdn_url = upload_to_s3(fal_result_url, user_id, mode)

                        cursor.execute('''
                            SELECT person_image, garments, prompt_hints, mode
                            FROM t_p29007832_virtual_fitting_room.nanobananapro_tasks
                            WHERE id = %s
                        ''', (task_id,))
                        task_details = cursor.fetchone()
                        if task_details:
                            person_img, g_json, prompt, task_mode = task_details
                            g_list = json.loads(g_json) if g_json else []

                            cursor.execute('''
                                UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                                SET saved_to_history = true
                                WHERE id = %s AND saved_to_history = false
                                RETURNING id
                            ''', (task_id,))
                            atomic_check = cursor.fetchone()
                            conn.commit()

                            if atomic_check:
                                save_to_history(conn, user_id, cdn_url, person_img, g_list, prompt or '', task_id, task_mode)

                        cursor.execute('''
                            UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                            SET status = 'completed', result_url = %s, updated_at = %s
                            WHERE id = %s
                        ''', (cdn_url, datetime.utcnow(), task_id))
                        conn.commit()
                        print(f'[TemplateWorker] Task {task_id} FULLY saved')

                    except Exception as save_error:
                        print(f'[TemplateWorker] S3 save failed: {str(save_error)}')
                        cursor.execute('''
                            UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                            SET status = 'completed', result_url = %s, updated_at = %s, error_message = %s
                            WHERE id = %s
                        ''', (fal_result_url, datetime.utcnow(), f'S3 failed: {str(save_error)}', task_id))
                        conn.commit()

                elif fal_status.upper() in ['FAILED', 'EXPIRED']:
                    error_msg = f'Ошибка генерации: {status_data.get("error", "Generation failed")}'
                    cursor.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                        SET status = 'failed', error_message = %s, updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
                    refund_balance_if_needed(conn, user_id, task_id)
                else:
                    print(f'[TemplateWorker] Task {task_id} still processing')

            except Exception as e:
                error_str = str(e)
                print(f'[TemplateWorker] Status check error: {error_str}')
                try:
                    cursor.execute('SELECT created_at FROM t_p29007832_virtual_fitting_room.nanobananapro_tasks WHERE id = %s', (task_id,))
                    created_row = cursor.fetchone()
                    if created_row:
                        age_seconds = (datetime.utcnow() - created_row[0]).total_seconds()
                        if age_seconds > 660:
                            print(f'[TemplateWorker] Task {task_id} stuck for {age_seconds}s, marking failed')
                            cursor.execute('''
                                UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                                SET status = 'failed', error_message = %s, updated_at = %s
                                WHERE id = %s AND status = 'processing'
                            ''', (f'Timeout after {int(age_seconds)}s: {error_str[:100]}', datetime.utcnow(), task_id))
                            conn.commit()
                            refund_balance_if_needed(conn, user_id, task_id)
                except Exception as inner_e:
                    print(f'[TemplateWorker] Error in fallback handler: {str(inner_e)}')

        print(f'[TemplateWorker] Checking for stuck tasks older than 4 minutes...')
        cursor.execute('''
            SELECT id, fal_response_url, user_id, created_at, mode, template_data
            FROM t_p29007832_virtual_fitting_room.nanobananapro_tasks
            WHERE status = 'processing'
              AND fal_response_url IS NOT NULL
              AND mode IN ('capsule', 'lookbook_grid')
              AND updated_at < NOW() - INTERVAL '4 minutes'
              AND id != %s
            ORDER BY created_at ASC
            LIMIT 5
        ''', (task_id,))

        stuck_tasks = cursor.fetchall()
        print(f'[TemplateWorker] Found {len(stuck_tasks)} stuck tasks')

        for stuck_task in stuck_tasks:
            stuck_id, stuck_response_url, stuck_user_id, stuck_created, stuck_mode, stuck_template_data_json = stuck_task
            print(f'[TemplateWorker] Processing stuck task {stuck_id} (created {stuck_created})')

            try:
                status_data = check_fal_status(stuck_response_url)
                fal_status = status_data.get('status', status_data.get('state', 'UNKNOWN'))

                if fal_status.upper() == 'COMPLETED' or 'images' in status_data or 'image' in status_data:
                    if 'images' in status_data and len(status_data['images']) > 0:
                        fal_result_url = status_data['images'][0]['url']
                    elif 'image' in status_data:
                        if isinstance(status_data['image'], dict):
                            fal_result_url = status_data['image']['url']
                        else:
                            fal_result_url = status_data['image']
                    else:
                        continue

                    print(f'[TemplateWorker] Stuck task {stuck_id} completed! Uploading to S3...')

                    try:
                        cdn_url = upload_to_s3(fal_result_url, stuck_user_id, stuck_mode or 'capsule')

                        cursor.execute('''
                            SELECT person_image, garments, prompt_hints
                            FROM t_p29007832_virtual_fitting_room.nanobananapro_tasks
                            WHERE id = %s
                        ''', (stuck_id,))
                        task_details = cursor.fetchone()
                        if task_details:
                            person_img, garments_json_s, prompt_s = task_details
                            garments_s = json.loads(garments_json_s) if garments_json_s else []

                            cursor.execute('''
                                UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                                SET saved_to_history = true
                                WHERE id = %s AND saved_to_history = false
                                RETURNING id
                            ''', (stuck_id,))
                            atomic_check = cursor.fetchone()
                            conn.commit()

                            if atomic_check:
                                save_to_history(conn, stuck_user_id, cdn_url, person_img, garments_s, prompt_s or '', stuck_id, stuck_mode or 'capsule')

                        cursor.execute('''
                            UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                            SET status = 'completed', result_url = %s, updated_at = %s
                            WHERE id = %s
                        ''', (cdn_url, datetime.utcnow(), stuck_id))
                        conn.commit()
                        print(f'[TemplateWorker] Stuck task {stuck_id} SAVED!')

                    except Exception as save_error:
                        print(f'[TemplateWorker] Failed to save stuck task {stuck_id}: {str(save_error)}')
                        cursor.execute('''
                            UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                            SET status = 'completed', result_url = %s, updated_at = %s
                            WHERE id = %s
                        ''', (fal_result_url, datetime.utcnow(), stuck_id))
                        conn.commit()

                elif fal_status.upper() in ['FAILED', 'EXPIRED']:
                    error_msg = f'Ошибка генерации: {str(status_data.get("error", "Generation failed"))[:100]}'
                    print(f'[TemplateWorker] Stuck task {stuck_id} failed')
                    cursor.execute('''
                        UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                        SET status = 'failed', error_message = %s, updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), stuck_id))
                    conn.commit()
                    refund_balance_if_needed(conn, stuck_user_id, stuck_id)

            except Exception as e:
                error_str = str(e)
                print(f'[TemplateWorker] Error processing stuck task {stuck_id}: {error_str}')
                try:
                    age_seconds = (datetime.utcnow() - stuck_created).total_seconds()
                    if age_seconds > 660:
                        print(f'[TemplateWorker] Stuck task {stuck_id} aged {age_seconds}s, marking failed')
                        cursor.execute('''
                            UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                            SET status = 'failed', error_message = %s, updated_at = %s
                            WHERE id = %s AND status = 'processing'
                        ''', (f'Timeout after {int(age_seconds)}s: {error_str[:100]}', datetime.utcnow(), stuck_id))
                        conn.commit()
                        refund_balance_if_needed(conn, stuck_user_id, stuck_id)
                except Exception as inner_e:
                    print(f'[TemplateWorker] Error in stuck fallback: {str(inner_e)}')

        try:
            cursor.execute('''
                UPDATE t_p29007832_virtual_fitting_room.nanobananapro_tasks
                SET status = 'pending', updated_at = %s
                WHERE status = 'processing'
                  AND fal_request_id IS NULL
                  AND mode IN ('capsule', 'lookbook_grid')
                  AND created_at < NOW() - INTERVAL '3 minutes'
                RETURNING id
            ''', (datetime.utcnow(),))
            zombie_rows = cursor.fetchall()
            conn.commit()
            if zombie_rows:
                zombie_ids = [r[0] for r in zombie_rows]
                print(f'[TemplateWorker] Reset {len(zombie_ids)} zombie tasks back to pending: {zombie_ids}')
        except Exception as e:
            print(f'[TemplateWorker] Error resetting zombie tasks: {str(e)}')

        try:
            cursor.execute('''
                SELECT id FROM t_p29007832_virtual_fitting_room.nanobananapro_tasks
                WHERE status = 'pending'
                  AND fal_request_id IS NULL
                  AND mode IN ('capsule', 'lookbook_grid')
                  AND created_at < NOW() - INTERVAL '2 minutes'
                  AND id != %s
                ORDER BY created_at ASC
                LIMIT 1
            ''', (task_id,))
            orphan_row = cursor.fetchone()
            if orphan_row:
                orphan_id = orphan_row[0]
                print(f'[TemplateWorker] Found orphan pending task {orphan_id}, triggering worker')
                try:
                    import urllib.request
                    worker_url = f'https://functions.poehali.dev/7f57bfff-f742-4a66-b506-c2acb4e2cdd3?task_id={orphan_id}'
                    req = urllib.request.Request(worker_url, method='GET')
                    urllib.request.urlopen(req, timeout=2)
                except Exception as trigger_err:
                    print(f'[TemplateWorker] Orphan trigger failed (non-critical): {trigger_err}')
        except Exception as e:
            print(f'[TemplateWorker] Error checking orphan tasks: {str(e)}')

        cursor.close()
        conn.close()

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'status': 'processed', 'task_id': task_id, 'stuck_tasks_processed': len(stuck_tasks)})
        }

    except Exception as e:
        print(f'[TemplateWorker] Error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event), 'Access-Control-Allow-Credentials': 'true'},
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }