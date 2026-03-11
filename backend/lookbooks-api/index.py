import json
import os
from typing import Dict, Any, List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import boto3
from botocore.config import Config
from pydantic import BaseModel, Field, field_validator
from session_utils import validate_session

def get_db_connection():
    # Force redeploy
    dsn = os.environ.get('DATABASE_URL')
    if '?' in dsn:
        dsn += '&options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    else:
        dsn += '?options=-c%20search_path%3Dt_p29007832_virtual_fitting_room'
    return psycopg2.connect(dsn)

def get_fitting_prefix(model_used: str) -> str:
    '''Get fitting room prefix based on model name'''
    if model_used == 'replicate':
        return '1fitting'
    elif model_used == 'seedream':
        return '2fitting'
    elif model_used == 'nanobananapro':
        return '3fitting'
    else:
        return '1fitting'  # default to fitting1

def save_photo_to_s3(photo_url: str, user_id: str, cursor, s3_enabled: bool, s3_bucket_name: str, s3_url_prefix: str) -> str:
    '''Save photo to S3 with fitting room prefix based on model used'''
    # Skip if already in our S3
    if s3_enabled and photo_url.startswith(s3_url_prefix):
        print(f'Photo already in S3, skipping: {photo_url}')
        return photo_url
    
    # Get model_used from history to determine prefix
    model_used = 'replicate'  # default
    try:
        # Try exact URL match first
        cursor.execute(
            "SELECT model_used FROM try_on_history WHERE user_id = %s AND result_image = %s LIMIT 1",
            (user_id, photo_url)
        )
        history_row = cursor.fetchone()
        
        if history_row and history_row.get('model_used'):
            model_used = history_row['model_used']
            print(f'Found model in history by exact URL: {model_used}')
        else:
            print(f'Exact URL match failed for: {photo_url[:100]}...')
            
            # If exact match failed, try LIKE pattern for FAL URLs
            if 'fal.media' in photo_url:
                # Extract unique part of FAL URL (request ID)
                # FAL URLs look like: https://fal.media/files/lion/xxxxx-request-id-xxxxx.png
                url_parts = photo_url.split('/')
                if len(url_parts) >= 5:
                    request_part = url_parts[-1].split('.')[0]  # Get filename without extension
                    print(f'Searching by FAL request pattern: {request_part[:30]}...')
                    
                    cursor.execute(
                        "SELECT model_used FROM try_on_history WHERE user_id = %s AND result_image LIKE %s ORDER BY created_at DESC LIMIT 1",
                        (user_id, f"%{request_part[:30]}%")
                    )
                    pattern_row = cursor.fetchone()
                    
                    if pattern_row and pattern_row.get('model_used'):
                        model_used = pattern_row['model_used']
                        print(f'Found model by FAL pattern: {model_used}')
                    else:
                        # Last resort: use most recent FAL generation
                        cursor.execute(
                            "SELECT model_used FROM try_on_history WHERE user_id = %s AND model_used IN ('seedream', 'nanobananapro') ORDER BY created_at DESC LIMIT 1",
                            (user_id,)
                        )
                        recent_row = cursor.fetchone()
                        if recent_row and recent_row.get('model_used'):
                            model_used = recent_row['model_used']
                            print(f'Using recent FAL model: {model_used}')
                        else:
                            model_used = 'seedream'
                            print(f'Defaulting to seedream for FAL URL')
                else:
                    model_used = 'seedream'
                    print(f'Could not parse FAL URL, defaulting to seedream')
            elif 'replicate' in photo_url.lower() or 'pbxt.replicate.delivery' in photo_url:
                model_used = 'replicate'
                print(f'Detected replicate from URL pattern')
            else:
                print(f'Unknown URL pattern, using default: {model_used}')
        
        prefix = get_fitting_prefix(model_used)
        print(f'Using prefix: {prefix} for model: {model_used}')
    except Exception as e:
        print(f'Failed to get model from history: {e}, using default prefix')
        prefix = '1fitting'
    
    # Save to S3 with prefix
    if photo_url.startswith(('http://', 'https://', 'data:')) and s3_enabled:
        try:
            save_response = requests.post(
                'https://functions.poehali.dev/56814ab9-6cba-4035-a63d-423ac0d301c8',
                json={
                    'image_url': photo_url,
                    'folder': 'lookbooks',
                    'user_id': str(user_id),
                    'prefix': prefix
                },
                timeout=30
            )
            print(f'S3 save response: {save_response.status_code}')
            if save_response.status_code == 200:
                save_data = save_response.json()
                new_url = save_data.get('url', photo_url)
                print(f'Saved to S3 with prefix {prefix}: {new_url}')
                return new_url
            else:
                print(f'S3 save failed with status {save_response.status_code}')
                return photo_url
        except Exception as e:
            print(f'S3 save exception: {str(e)}')
            return photo_url
    else:
        return photo_url

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: CRUD operations for lookbooks
    Args: event - dict with httpMethod, body, queryStringParameters
          context - object with attributes: request_id, function_name
    Returns: HTTP response with lookbook data
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
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-Session-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Validate session for non-public GET requests
        query_params = event.get('queryStringParameters') or {}
        share_token = query_params.get('share_token')
        
        # Public access with share_token doesn't need auth
        if method == 'GET' and share_token:
            user_id = None
        else:
            is_valid, user_id, error_msg = validate_session(event)
            if not is_valid and method != 'GET':
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': error_msg or 'Unauthorized'})
                }
        
        if method == 'GET':
            query_params = event.get('queryStringParameters') or {}
            lookbook_id = query_params.get('id')
            share_token = query_params.get('share_token')
            
            if share_token:
                cursor.execute(
                    "SELECT * FROM lookbooks WHERE share_token = %s AND is_public = true",
                    (share_token,)
                )
                lookbook = cursor.fetchone()
                
                if not lookbook:
                    return {
                        'statusCode': 404,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': get_cors_origin(event)
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Lookbook not found or not public'})
                    }
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'id': str(lookbook['id']),
                        'name': lookbook['name'],
                        'person_name': lookbook['person_name'],
                        'photos': lookbook['photos'] or [],
                        'color_palette': lookbook['color_palette'] or [],
                        'created_at': lookbook['created_at'].isoformat(),
                        'updated_at': lookbook['updated_at'].isoformat()
                    })
                }
            
            if not user_id:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Unauthorized - User ID required'})
                }
            
            if lookbook_id:
                cursor.execute(
                    "SELECT * FROM lookbooks WHERE id = %s AND user_id = %s",
                    (lookbook_id, user_id)
                )
                lookbook = cursor.fetchone()
                
                if not lookbook:
                    return {
                        'statusCode': 404,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': get_cors_origin(event)
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Lookbook not found'})
                    }
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'id': str(lookbook['id']),
                        'name': lookbook['name'],
                        'person_name': lookbook['person_name'],
                        'photos': lookbook['photos'] or [],
                        'color_palette': lookbook['color_palette'] or [],
                        'is_public': lookbook.get('is_public', False),
                        'share_token': lookbook.get('share_token'),
                        'created_at': lookbook['created_at'].isoformat(),
                        'updated_at': lookbook['updated_at'].isoformat()
                    })
                }
            else:
                cursor.execute(
                    "SELECT * FROM lookbooks WHERE user_id = %s ORDER BY created_at DESC",
                    (user_id,)
                )
                lookbooks = cursor.fetchall()
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps([{
                        'id': str(lb['id']),
                        'name': lb['name'],
                        'person_name': lb['person_name'],
                        'photos': lb['photos'] or [],
                        'color_palette': lb['color_palette'] or [],
                        'is_public': lb.get('is_public', False),
                        'share_token': lb.get('share_token'),
                        'created_at': lb['created_at'].isoformat(),
                        'updated_at': lb['updated_at'].isoformat()
                    } for lb in lookbooks])
                }
        
        elif method == 'POST':
            if not user_id:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Unauthorized - User ID required'})
                }
            
            body_str = event.get('body', '{}')
            body_data = json.loads(body_str)
            
            class LookbookCreate(BaseModel):
                name: str = Field(..., min_length=1, max_length=100)
                person_name: str = Field(..., min_length=1, max_length=100)
                photos: List[str] = Field(default_factory=list)
                color_palette: List[str] = Field(default_factory=list, max_length=10)
            
            try:
                validated = LookbookCreate(**body_data)
            except Exception as e:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': f'Validation error: {str(e)}'})
                }
            
            name = validated.name
            person_name = validated.person_name
            photos = validated.photos
            color_palette = validated.color_palette
            
            if not name or not person_name:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing name or person_name'})
                }
            
            # Save photos to S3 with fitting room prefix
            saved_photos = []
            s3_enabled = os.environ.get('S3_ACCESS_KEY')
            s3_bucket_name = os.environ.get('S3_BUCKET_NAME')
            s3_url_prefix = f'https://{s3_bucket_name}.storage.yandexcloud.net/'
            
            for photo in photos:
                saved_url = save_photo_to_s3(photo, user_id, cursor, s3_enabled, s3_bucket_name, s3_url_prefix)
                saved_photos.append(saved_url)
            
            cursor.execute(
                """
                INSERT INTO lookbooks (name, person_name, photos, color_palette, user_id)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, name, person_name, photos, color_palette, created_at, updated_at
                """,
                (name, person_name, saved_photos, color_palette, user_id)
            )
            
            lookbook = cursor.fetchone()
            
            # Mark photos as saved to lookbook in history
            for photo_url in saved_photos:
                try:
                    cursor.execute(
                        "UPDATE try_on_history SET saved_to_lookbook = true WHERE user_id = %s AND result_image = %s",
                        (user_id, photo_url)
                    )
                except Exception as e:
                    print(f'Failed to update history for photo {photo_url}: {e}')
            
            conn.commit()
            
            return {
                'statusCode': 201,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://fitting-room.ru'
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'id': str(lookbook['id']),
                    'name': lookbook['name'],
                    'person_name': lookbook['person_name'],
                    'photos': lookbook['photos'] or [],
                    'color_palette': lookbook['color_palette'] or [],
                    'created_at': lookbook['created_at'].isoformat(),
                    'updated_at': lookbook['updated_at'].isoformat()
                })
            }
        
        elif method == 'PUT':
            if not user_id:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Unauthorized - User ID required'})
                }
            
            body_str = event.get('body', '{}')
            body_data = json.loads(body_str)
            
            lookbook_id = body_data.get('id')
            name = body_data.get('name')
            person_name = body_data.get('person_name')
            photos = body_data.get('photos')
            color_palette = body_data.get('color_palette')
            is_public = body_data.get('is_public')
            share_token = body_data.get('share_token')
            
            if not lookbook_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing id'})
                }
            
            # Get old photos to detect deletions
            old_photos = []
            if photos:
                cursor.execute(
                    "SELECT photos FROM lookbooks WHERE id = %s AND user_id = %s",
                    (lookbook_id, user_id)
                )
                old_lookbook = cursor.fetchone()
                if old_lookbook:
                    old_photos = old_lookbook['photos'] or []
            
            # Save new photos to S3 with fitting room prefix
            saved_photos = photos
            if photos:
                saved_photos = []
                s3_enabled = os.environ.get('S3_ACCESS_KEY')
                s3_bucket_name = os.environ.get('S3_BUCKET_NAME')
                s3_url_prefix = f'https://{s3_bucket_name}.storage.yandexcloud.net/'
                
                for photo in photos:
                    saved_url = save_photo_to_s3(photo, user_id, cursor, s3_enabled, s3_bucket_name, s3_url_prefix)
                    saved_photos.append(saved_url)
            
            # Get old photos to check which ones were removed
            cursor.execute(
                "SELECT photos FROM lookbooks WHERE id = %s AND user_id = %s",
                (lookbook_id, user_id)
            )
            old_lookbook = cursor.fetchone()
            old_photos = old_lookbook['photos'] if old_lookbook else []
            
            removed_photos = [p for p in old_photos if p not in saved_photos]
            
            cursor.execute(
                """
                UPDATE lookbooks 
                SET name = COALESCE(%s, name),
                    person_name = COALESCE(%s, person_name),
                    photos = COALESCE(%s, photos),
                    color_palette = COALESCE(%s, color_palette),
                    is_public = COALESCE(%s, is_public),
                    share_token = COALESCE(%s, share_token),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND user_id = %s
                RETURNING id, name, person_name, photos, color_palette, created_at, updated_at
                """,
                (name, person_name, saved_photos, color_palette, is_public, share_token, lookbook_id, user_id)
            )
            
            # CRITICAL: Save the result IMMEDIATELY before other queries
            lookbook = cursor.fetchone()
            
            if not lookbook:
                conn.rollback()
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Lookbook not found'})
                }
            
            # Mark new photos as saved to lookbook in history
            if saved_photos:
                for photo_url in saved_photos:
                    if photo_url not in old_photos:
                        try:
                            cursor.execute(
                                "UPDATE try_on_history SET saved_to_lookbook = true WHERE user_id = %s AND result_image = %s",
                                (user_id, photo_url)
                            )
                        except Exception as e:
                            print(f'Failed to update history for photo {photo_url}: {e}')
            
            # Check if removed photos should be deleted from S3
            # Delete from S3 if photo is NOT in history AND NOT in any other lookbook
            if removed_photos:
                s3_bucket_name = os.environ.get('S3_BUCKET_NAME')
                s3_url_prefix = f'https://{s3_bucket_name}.storage.yandexcloud.net/'
                
                for photo_url in removed_photos:
                    if not photo_url.startswith(s3_url_prefix):
                        continue
                    
                    # Check if in history (PUT method)
                    cursor.execute(
                        "SELECT COUNT(*) as count FROM try_on_history WHERE user_id = %s AND result_image = %s",
                        (user_id, photo_url)
                    )
                    history_count = cursor.fetchone()['count']
                    
                    # Check if in other lookbooks (PUT method)
                    cursor.execute(
                        "SELECT COUNT(*) as count FROM lookbooks WHERE user_id = %s AND id != %s AND %s = ANY(photos)",
                        (user_id, lookbook_id, photo_url)
                    )
                    other_lookbooks_count = cursor.fetchone()['count']
                    
                    # Delete from S3 only if NOT in history and NOT in other lookbooks
                    if history_count == 0 and other_lookbooks_count == 0:
                        try:
                            s3_key = photo_url.replace(s3_url_prefix, '')
                            
                            s3_client = boto3.client(
                                's3',
                                endpoint_url='https://storage.yandexcloud.net',
                                aws_access_key_id=os.environ.get('S3_ACCESS_KEY'),
                                aws_secret_access_key=os.environ.get('S3_SECRET_KEY'),
                                region_name='ru-central1',
                                config=Config(signature_version='s3v4')
                            )
                            
                            s3_client.delete_object(
                                Bucket=s3_bucket_name,
                                Key=s3_key
                            )
                            print(f'Deleted from S3 (removed from lookbook, not in history): {s3_key}')
                        except Exception as e:
                            print(f'Failed to delete from S3: {e}')
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://fitting-room.ru'
                },
                'isBase64Encoded': False,
                'body': json.dumps({
                    'id': str(lookbook['id']),
                    'name': lookbook['name'],
                    'person_name': lookbook['person_name'],
                    'photos': lookbook['photos'] or [],
                    'color_palette': lookbook['color_palette'] or [],
                    'created_at': lookbook['created_at'].isoformat(),
                    'updated_at': lookbook['updated_at'].isoformat()
                })
            }
        
        elif method == 'DELETE':
            if not user_id:
                return {
                    'statusCode': 401,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Unauthorized - User ID required'})
                }
            
            query_params = event.get('queryStringParameters') or {}
            lookbook_id = query_params.get('id')
            
            if not lookbook_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing id'})
                }
            
            # Get photos before deletion to check if they should be deleted from S3
            cursor.execute(
                "SELECT photos FROM lookbooks WHERE id = %s AND user_id = %s",
                (lookbook_id, user_id)
            )
            lookbook = cursor.fetchone()
            
            if not lookbook:
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Lookbook not found'})
                }
            
            photos_to_check = lookbook['photos'] or []
            
            # Delete lookbook from DB
            cursor.execute(
                "DELETE FROM lookbooks WHERE id = %s AND user_id = %s RETURNING id",
                (lookbook_id, user_id)
            )
            deleted = cursor.fetchone()
            
            if not deleted:
                conn.rollback()
                return {
                    'statusCode': 404,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Lookbook not found'})
                }
            
            # Check if photos should be deleted from S3
            # Delete from S3 if photo is NOT in history AND NOT in any other lookbook
            if photos_to_check:
                s3_bucket_name = os.environ.get('S3_BUCKET_NAME')
                s3_url_prefix = f'https://{s3_bucket_name}.storage.yandexcloud.net/'
                
                for photo_url in photos_to_check:
                    if not photo_url.startswith(s3_url_prefix):
                        continue
                    
                    # Check if in history (DELETE method)
                    cursor.execute(
                        "SELECT COUNT(*) as count FROM try_on_history WHERE user_id = %s AND result_image = %s",
                        (user_id, photo_url)
                    )
                    history_count = cursor.fetchone()['count']
                    
                    # Check if in other lookbooks (DELETE method)
                    cursor.execute(
                        "SELECT COUNT(*) as count FROM lookbooks WHERE user_id = %s AND id != %s AND %s = ANY(photos)",
                        (user_id, lookbook_id, photo_url)
                    )
                    other_lookbooks_count = cursor.fetchone()['count']
                    
                    # Delete from S3 only if NOT in history and NOT in other lookbooks
                    if history_count == 0 and other_lookbooks_count == 0:
                        try:
                            s3_key = photo_url.replace(s3_url_prefix, '')
                            
                            s3_client = boto3.client(
                                's3',
                                endpoint_url='https://storage.yandexcloud.net',
                                aws_access_key_id=os.environ.get('S3_ACCESS_KEY'),
                                aws_secret_access_key=os.environ.get('S3_SECRET_KEY'),
                                region_name='ru-central1',
                                config=Config(signature_version='s3v4')
                            )
                            
                            s3_client.delete_object(
                                Bucket=s3_bucket_name,
                                Key=s3_key
                            )
                            print(f'Deleted from S3 (lookbook deleted, not in history or other lookbooks): {s3_key}')
                        except Exception as e:
                            print(f'Failed to delete from S3: {e}')
            
            conn.commit()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://fitting-room.ru'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'Lookbook deleted successfully'})
            }
        
        else:
            return {
                'statusCode': 405,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': 'https://fitting-room.ru'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Method not allowed'})
            }
    
    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': 'https://fitting-room.ru'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cursor.close()
        conn.close()