import json
import os
from typing import Dict, Any, List
import requests
from io import BytesIO
from PIL import Image
import base64

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Compose multiple clothing items into single image for virtual try-on
    Args: event - dict with httpMethod, body (clothing_images array)
          context - object with attributes: request_id, function_name
    Returns: HTTP response with composed image URL
    '''
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
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        body_data = json.loads(event.get('body', '{}'))
        clothing_images = body_data.get('clothing_images', [])
        
        if not clothing_images or len(clothing_images) == 0:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'No clothing images provided'})
            }
        
        if len(clothing_images) == 1:
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'composed_image': clothing_images[0]})
            }
        
        images: List[Image.Image] = []
        for img_url in clothing_images:
            if img_url.startswith('data:image'):
                header, encoded = img_url.split(',', 1)
                img_data = base64.b64decode(encoded)
                img = Image.open(BytesIO(img_data))
            else:
                response = requests.get(img_url, timeout=10)
                img = Image.open(BytesIO(response.content))
            
            img = img.convert('RGBA')
            images.append(img)
        
        max_width = max(img.width for img in images)
        max_height = max(img.height for img in images)
        
        grid_cols = min(2, len(images))
        grid_rows = (len(images) + grid_cols - 1) // grid_cols
        
        canvas_width = max_width * grid_cols
        canvas_height = max_height * grid_rows
        
        canvas = Image.new('RGBA', (canvas_width, canvas_height), (255, 255, 255, 255))
        
        for idx, img in enumerate(images):
            col = idx % grid_cols
            row = idx // grid_cols
            
            img_resized = img.resize((max_width, max_height), Image.Resampling.LANCZOS)
            
            x = col * max_width
            y = row * max_height
            
            canvas.paste(img_resized, (x, y), img_resized if img_resized.mode == 'RGBA' else None)
        
        buffer = BytesIO()
        canvas.convert('RGB').save(buffer, format='JPEG', quality=95)
        buffer.seek(0)
        
        img_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        data_url = f'data:image/jpeg;base64,{img_base64}'
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'composed_image': data_url})
        }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }