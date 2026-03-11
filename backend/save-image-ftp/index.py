'''
Business: Save images to Yandex Object Storage (S3) with unique filenames
Args: event with httpMethod, body containing image_url, folder (catalog/lookbooks), user_id
Returns: HTTP response with public image URL
'''

import json
import os
import base64
import requests
import uuid
from datetime import datetime
from typing import Dict, Any
from io import BytesIO
import boto3
from botocore.config import Config


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
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
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token, X-Admin-Password',
                'Access-Control-Allow-Credentials': 'true',
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
    
    body_str = event.get('body', '{}')
    body_data = json.loads(body_str)
    
    image_url = body_data.get('image_url')
    folder = body_data.get('folder', 'catalog')
    user_id = body_data.get('user_id', 'guest')
    prefix = body_data.get('prefix', '')
    
    if not image_url:
        return {
            'statusCode': 400,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Missing image_url'})
        }
    
    if folder not in ['catalog', 'lookbooks']:
        folder = 'catalog'
    
    # Get S3 credentials from environment
    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    s3_bucket_name = os.environ.get('S3_BUCKET_NAME')
    
    if not s3_access_key or not s3_secret_key or not s3_bucket_name:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'S3 not configured'})
        }
    
    # Generate unique filename with microseconds and UUID to avoid collisions
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S_%f')
    unique_id = str(uuid.uuid4())[:8]
    
    # Determine file extension
    file_ext = '.jpg'
    if image_url.startswith('data:image/'):
        if 'png' in image_url:
            file_ext = '.png'
        elif 'webp' in image_url:
            file_ext = '.webp'
        elif 'gif' in image_url:
            file_ext = '.gif'
    elif '.' in image_url.split('/')[-1]:
        url_ext = image_url.split('/')[-1].split('.')[-1].split('?')[0].lower()
        if url_ext in ['jpg', 'jpeg', 'png', 'webp', 'gif']:
            file_ext = f'.{url_ext}'
    
    # For lookbooks folder, use user_id subfolder structure
    if folder == 'lookbooks':
        if prefix:
            filename = f'{user_id}/{prefix}_{timestamp}_{user_id}_{unique_id}{file_ext}'
        else:
            filename = f'{user_id}/{timestamp}_{user_id}_{unique_id}{file_ext}'
    else:
        if prefix:
            filename = f'{prefix}_{timestamp}_{user_id}_{unique_id}{file_ext}'
        else:
            filename = f'{timestamp}_{user_id}_{unique_id}{file_ext}'
    
    # Download image
    if image_url.startswith('data:'):
        header, encoded = image_url.split(',', 1)
        image_data = base64.b64decode(encoded)
    else:
        response = requests.get(image_url, timeout=30)
        if response.status_code != 200:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Failed to download image'})
            }
        image_data = response.content
    
    # Upload to S3
    try:
        # Configure S3 client for Yandex Cloud
        s3_client = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            aws_access_key_id=s3_access_key,
            aws_secret_access_key=s3_secret_key,
            region_name='ru-central1',
            config=Config(signature_version='s3v4')
        )
        
        # Build S3 key (path in bucket)
        s3_key = f'images/{folder}/{filename}'
        
        print(f'Uploading to S3: {s3_bucket_name}/{s3_key}')
        
        # Determine content type
        content_type = 'image/jpeg'
        if file_ext == '.png':
            content_type = 'image/png'
        elif file_ext == '.webp':
            content_type = 'image/webp'
        elif file_ext == '.gif':
            content_type = 'image/gif'
        
        # Upload file
        s3_client.put_object(
            Bucket=s3_bucket_name,
            Key=s3_key,
            Body=image_data,
            ContentType=content_type,
            ACL='public-read'
        )
        
        print(f'File uploaded successfully')
        
        # Construct public URL
        public_url = f'https://{s3_bucket_name}.storage.yandexcloud.net/{s3_key}'
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'url': public_url, 'filename': filename})
        }
    
    except Exception as e:
        print(f'S3 upload error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'S3 upload failed: {str(e)}'})
        }