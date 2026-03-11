import json
import os
from typing import Dict, Any
import urllib.request
import base64

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Proxy для загрузки изображений с внешних источников для PDF
    Args: event - dict с httpMethod, queryStringParameters
          context - object с attributes: request_id, function_name
    Returns: HTTP response с base64 изображением
    '''
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
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method not in ['GET', 'POST']:
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
        # Support both GET with query params and POST with JSON body
        if method == 'POST':
            body_data = json.loads(event.get('body', '{}'))
            image_url = body_data.get('image_url')
            download = body_data.get('download', False)
        else:
            query_params = event.get('queryStringParameters') or {}
            image_url = query_params.get('url')
            download = query_params.get('download', 'false').lower() == 'true'
        
        if not image_url:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Missing url parameter'})
            }
        
        print(f'[ImageProxy] Fetching image: {image_url}, download={download}')
        
        req = urllib.request.Request(image_url)
        req.add_header('User-Agent', 'Mozilla/5.0')
        
        with urllib.request.urlopen(req, timeout=30) as response:
            image_data = response.read()
            content_type = response.headers.get('Content-Type', 'image/jpeg')
            
            print(f'[ImageProxy] Loaded {len(image_data)} bytes, type: {content_type}')
            
            if download:
                base64_image = base64.b64encode(image_data).decode('utf-8')
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': content_type,
                        'Content-Disposition': f'attachment; filename="fitting-room-{context.request_id}.jpg"',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': True,
                    'body': base64_image
                }
            else:
                base64_data = base64.b64encode(image_data).decode('utf-8')
                data_url = f'data:{content_type};base64,{base64_data}'
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event)
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'data_url': data_url})
                }
    
    except urllib.error.HTTPError as e:
        print(f'[ImageProxy] HTTP Error: {e.code}')
        return {
            'statusCode': 502,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Failed to fetch image: HTTP {e.code}'})
        }
    
    except Exception as e:
        print(f'[ImageProxy] Error: {type(e).__name__}: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }