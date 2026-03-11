'''
Business: Delete images from Yandex Object Storage (S3)
Args: event with httpMethod, body containing image_url
Returns: HTTP response confirming deletion
'''

import json
import os
from typing import Dict, Any
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
    if not body_str:
        body_str = '{}'
    body_data = json.loads(body_str)
    
    image_url = body_data.get('image_url')
    
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
    
    # Only delete if image is from our S3
    s3_url_base = f'https://{s3_bucket_name}.storage.yandexcloud.net/'
    if not image_url.startswith(s3_url_base):
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'message': 'Not our S3 bucket, skipping deletion'})
        }
    
    # Extract S3 key from URL: https://bucket.storage.yandexcloud.net/images/lookbooks/file.jpg -> images/lookbooks/file.jpg
    try:
        s3_key = image_url.replace(s3_url_base, '')
        
        if not s3_key.startswith('images/'):
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Invalid image path'})
            }
        
        print(f'Deleting from S3: {s3_bucket_name}/{s3_key}')
        
        # Configure S3 client for Yandex Cloud
        s3_client = boto3.client(
            's3',
            endpoint_url='https://storage.yandexcloud.net',
            aws_access_key_id=s3_access_key,
            aws_secret_access_key=s3_secret_key,
            region_name='ru-central1',
            config=Config(signature_version='s3v4')
        )
        
        # Delete file
        s3_client.delete_object(
            Bucket=s3_bucket_name,
            Key=s3_key
        )
        
        print('File deleted successfully')
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'message': 'File deleted successfully'})
        }
    
    except Exception as e:
        print(f'Deletion error: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event)
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'S3 deletion failed: {str(e)}'})
        }