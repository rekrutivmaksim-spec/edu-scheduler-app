import json
import os
from typing import Dict, Any, List
import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import jwt

def verify_admin_jwt(provided_token: str) -> tuple[bool, str]:
    '''
    Verify JWT token for admin authentication
    Returns: (is_valid, error_message)
    '''
    if not provided_token:
        return (False, 'Token required')
    
    try:
        secret_key = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        payload = jwt.decode(provided_token, secret_key, algorithms=['HS256'])
        
        if not payload.get('admin'):
            return (False, 'Invalid token')
        
        return (True, '')
    except jwt.ExpiredSignatureError:
        return (False, 'Token expired')
    except jwt.InvalidTokenError:
        return (False, 'Invalid token')
    except Exception as e:
        return (False, f'Token verification failed: {str(e)}')

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Manage clothing catalog with categories, colors, archetypes
    Args: event - dict with httpMethod, body, queryStringParameters
          context - object with attributes: request_id, function_name
    Returns: HTTP response with catalog items or operation result
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
                'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Password, X-Admin-Token',
                'Access-Control-Allow-Credentials': 'true',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    dsn = os.environ.get('DATABASE_URL')
    if not dsn:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        query_params = event.get('queryStringParameters') or {}
        action = query_params.get('action', 'list')
        
        # GET /catalog-api?action=list&categories=1,2&colors=3&archetypes=4
        if method == 'GET':
            if action == 'remove_bg':
                # Special POST action disguised as GET for background removal
                return {
                    'statusCode': 405,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Use POST method for background removal'})
                }
            
            if action == 'list':
                # First, get all clothing items
                base_query = """
                    SELECT id, image_url, name, description, replicate_category, gender, created_at
                    FROM clothing_catalog
                    WHERE 1=1
                """
                
                conditions = []
                params = []
                
                # Filter by categories
                category_ids = query_params.get('categories', '').split(',') if query_params.get('categories') else []
                if category_ids and category_ids[0]:
                    category_ids_int = [int(cid) for cid in category_ids if cid.strip()]
                    if category_ids_int:
                        placeholders = ','.join(['%s'] * len(category_ids_int))
                        conditions.append(f"""
                            EXISTS (
                                SELECT 1 FROM clothing_category_links ccl
                                WHERE ccl.clothing_id = clothing_catalog.id AND ccl.category_id IN ({placeholders})
                            )
                        """)
                        params.extend(category_ids_int)
                
                # Filter by colors
                color_ids = query_params.get('colors', '').split(',') if query_params.get('colors') else []
                if color_ids and color_ids[0]:
                    color_ids_int = [int(cid) for cid in color_ids if cid.strip()]
                    if color_ids_int:
                        placeholders = ','.join(['%s'] * len(color_ids_int))
                        conditions.append(f"""
                            EXISTS (
                                SELECT 1 FROM clothing_color_links cl
                                WHERE cl.clothing_id = clothing_catalog.id AND cl.color_group_id IN ({placeholders})
                            )
                        """)
                        params.extend(color_ids_int)
                
                # Filter by archetypes
                archetype_ids = query_params.get('archetypes', '').split(',') if query_params.get('archetypes') else []
                if archetype_ids and archetype_ids[0]:
                    archetype_ids_int = [int(aid) for aid in archetype_ids if aid.strip()]
                    if archetype_ids_int:
                        placeholders = ','.join(['%s'] * len(archetype_ids_int))
                        conditions.append(f"""
                            EXISTS (
                                SELECT 1 FROM clothing_archetype_links cal
                                WHERE cal.clothing_id = clothing_catalog.id AND cal.archetype_id IN ({placeholders})
                            )
                        """)
                        params.extend(archetype_ids_int)
                
                # Filter by gender
                gender = query_params.get('gender', '').strip()
                if gender and gender in ['male', 'female', 'unisex']:
                    conditions.append("clothing_catalog.gender = %s")
                    params.append(gender)
                
                if conditions:
                    base_query += ' AND ' + ' AND '.join(conditions)
                
                base_query += ' ORDER BY created_at DESC'
                
                cursor.execute(base_query, params)
                items = cursor.fetchall()
                
                # Enrich each item with categories, colors, and archetypes
                result = []
                for item in items:
                    item_dict = dict(item)
                    item_id = item_dict['id']
                    
                    # Get categories
                    cursor.execute("""
                        SELECT cat.name
                        FROM clothing_category_links ccl
                        JOIN clothing_categories cat ON cat.id = ccl.category_id
                        WHERE ccl.clothing_id = %s
                    """, (item_id,))
                    item_dict['categories'] = [row['name'] for row in cursor.fetchall()]
                    
                    # Get colors
                    cursor.execute("""
                        SELECT cg.name
                        FROM clothing_color_links cl
                        JOIN color_groups cg ON cg.id = cl.color_group_id
                        WHERE cl.clothing_id = %s
                    """, (item_id,))
                    item_dict['colors'] = [row['name'] for row in cursor.fetchall()]
                    
                    # Get archetypes
                    cursor.execute("""
                        SELECT ka.name
                        FROM clothing_archetype_links cal
                        JOIN kibbe_archetypes ka ON ka.id = cal.archetype_id
                        WHERE cal.clothing_id = %s
                    """, (item_id,))
                    item_dict['archetypes'] = [row['name'] for row in cursor.fetchall()]
                    
                    result.append(item_dict)
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps(result, default=str)
                }
            
            elif action == 'filters':
                # Get all available filters
                cursor.execute('SELECT id, name FROM clothing_categories ORDER BY name')
                categories = cursor.fetchall()
                
                cursor.execute('SELECT id, name FROM color_groups ORDER BY name')
                colors = cursor.fetchall()
                
                cursor.execute('SELECT id, name FROM kibbe_archetypes ORDER BY name')
                archetypes = cursor.fetchall()
                
                genders = [
                    {'id': 'male', 'name': 'Мужской'},
                    {'id': 'female', 'name': 'Женский'},
                    {'id': 'unisex', 'name': 'Унисекс'}
                ]
                
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({
                        'categories': [dict(c) for c in categories],
                        'colors': [dict(c) for c in colors],
                        'archetypes': [dict(a) for a in archetypes],
                        'genders': genders
                    })
                }
        
        # POST /catalog-api - Add new clothing item OR remove background (admin only)
        elif method == 'POST':
            # Read admin token from cookie
            headers = event.get('headers', {})
            cookie_header = headers.get('x-cookie') or headers.get('X-Cookie') or headers.get('cookie') or headers.get('Cookie', '')
            
            admin_token = None
            if cookie_header:
                cookies = cookie_header.split('; ')
                for cookie in cookies:
                    if cookie.startswith('admin_token='):
                        admin_token = cookie.split('=', 1)[1]
                        break
            
            # Verify JWT token
            is_valid, error_message = verify_admin_jwt(admin_token)
            if not is_valid:
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': error_message})
                }
            
            body_data = json.loads(event.get('body', '{}'))
            
            # Handle background removal for existing item
            if action == 'remove_bg':
                clothing_id = body_data.get('id')
                image_url = body_data.get('image_url')
                
                if not clothing_id or not image_url:
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': get_cors_origin(event)
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': 'Missing id or image_url'})
                    }
                
                processed_image_url = image_url
                try:
                    fal_api_key = os.environ.get('FAL_API_KEY')
                    if fal_api_key:
                        bg_removal_response = requests.post(
                            'https://fal.run/fal-ai/birefnet',
                            headers={
                                'Authorization': f'Key {fal_api_key}',
                                'Content-Type': 'application/json'
                            },
                            json={'image_url': image_url},
                            timeout=60
                        )
                        
                        if bg_removal_response.status_code == 200:
                            bg_result = bg_removal_response.json()
                            processed_url = bg_result.get('image', {}).get('url') if isinstance(bg_result.get('image'), dict) else bg_result.get('image')
                            if processed_url:
                                # Save processed image to S3
                                s3_enabled = os.environ.get('S3_ACCESS_KEY')
                                if s3_enabled:
                                    try:
                                        save_response = requests.post(
                                            'https://functions.poehali.dev/56814ab9-6cba-4035-a63d-423ac0d301c8',
                                            json={
                                                'image_url': processed_url,
                                                'folder': 'catalog',
                                                'user_id': 'admin'
                                            },
                                            timeout=30
                                        )
                                        if save_response.status_code == 200:
                                            save_data = save_response.json()
                                            processed_image_url = save_data.get('url', processed_url)
                                            
                                            # Delete old image from S3 if it's different
                                            if image_url != processed_image_url and image_url.startswith('https://cdn.poehali.dev/'):
                                                try:
                                                    delete_response = requests.post(
                                                        'https://functions.poehali.dev/bfa8cc4d-a0e7-44dd-b97a-0bd15e9f9b27',
                                                        json={'image_url': image_url},
                                                        timeout=10
                                                    )
                                                except:
                                                    pass
                                        else:
                                            processed_image_url = processed_url
                                    except:
                                        processed_image_url = processed_url
                                else:
                                    processed_image_url = processed_url
                                
                                # Update in database
                                cursor.execute("""
                                    UPDATE clothing_catalog
                                    SET image_url = %s
                                    WHERE id = %s
                                """, (processed_image_url, clothing_id))
                                
                                return {
                                    'statusCode': 200,
                                    'headers': {
                                        'Content-Type': 'application/json',
                                        'Access-Control-Allow-Origin': get_cors_origin(event)
                                    },
                                    'isBase64Encoded': False,
                                    'body': json.dumps({'processed_image_url': processed_image_url})
                                }
                except Exception as e:
                    return {
                        'statusCode': 500,
                        'headers': {
                            'Content-Type': 'application/json',
                            'Access-Control-Allow-Origin': get_cors_origin(event)
                        },
                        'isBase64Encoded': False,
                        'body': json.dumps({'error': f'Background removal failed: {str(e)}'})
                    }
                
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Background removal failed'})
                }
            
            # Handle adding new clothing item
            image_url = body_data.get('image_url')
            name = body_data.get('name', '')
            description = body_data.get('description', '')
            category_ids = body_data.get('category_ids', [])
            color_ids = body_data.get('color_ids', [])
            archetype_ids = body_data.get('archetype_ids', [])
            replicate_category = body_data.get('replicate_category', '')
            gender = body_data.get('gender', 'unisex')
            
            if not image_url:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing image_url'})
                }
            
            # Save image to S3 if it's an external URL
            saved_image_url = image_url
            if image_url.startswith(('http://', 'https://', 'data:')):
                s3_enabled = os.environ.get('S3_ACCESS_KEY')
                if s3_enabled:
                    try:
                        save_response = requests.post(
                            'https://functions.poehali.dev/56814ab9-6cba-4035-a63d-423ac0d301c8',
                            json={
                                'image_url': image_url,
                                'folder': 'catalog',
                                'user_id': 'admin'
                            },
                            timeout=30
                        )
                        if save_response.status_code == 200:
                            save_data = save_response.json()
                            saved_image_url = save_data.get('url', image_url)
                    except:
                        pass
            
            # Insert clothing item with saved image URL
            cursor.execute("""
                INSERT INTO clothing_catalog (image_url, name, description, replicate_category, gender)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (saved_image_url, name, description, replicate_category, gender))
            
            clothing_id = cursor.fetchone()['id']
            
            # Add category links
            for cat_id in category_ids:
                cursor.execute("""
                    INSERT INTO clothing_category_links (clothing_id, category_id)
                    VALUES (%s, %s)
                """, (clothing_id, cat_id))
            
            # Add color links
            for color_id in color_ids:
                cursor.execute("""
                    INSERT INTO clothing_color_links (clothing_id, color_group_id)
                    VALUES (%s, %s)
                """, (clothing_id, color_id))
            
            # Add archetype links
            for arch_id in archetype_ids:
                cursor.execute("""
                    INSERT INTO clothing_archetype_links (clothing_id, archetype_id)
                    VALUES (%s, %s)
                """, (clothing_id, arch_id))
            
            return {
                'statusCode': 201,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Access-Control-Allow-Credentials': 'true'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'id': str(clothing_id), 'message': 'Clothing item added'})
            }
        
        # PUT /catalog-api - Update clothing item (admin only)
        elif method == 'PUT':
            # Read admin token from cookie
            headers = event.get('headers', {})
            cookie_header = headers.get('x-cookie') or headers.get('X-Cookie') or headers.get('cookie') or headers.get('Cookie', '')
            
            admin_token = None
            if cookie_header:
                cookies = cookie_header.split('; ')
                for cookie in cookies:
                    if cookie.startswith('admin_token='):
                        admin_token = cookie.split('=', 1)[1]
                        break
            
            # Verify JWT token
            is_valid, error_message = verify_admin_jwt(admin_token)
            if not is_valid:
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': error_message})
                }
            
            body_data = json.loads(event.get('body', '{}'))
            clothing_id = body_data.get('id')
            image_url = body_data.get('image_url')
            name = body_data.get('name', '')
            description = body_data.get('description', '')
            category_ids = body_data.get('category_ids', [])
            color_ids = body_data.get('color_ids', [])
            archetype_ids = body_data.get('archetype_ids', [])
            replicate_category = body_data.get('replicate_category', '')
            gender = body_data.get('gender', 'unisex')
            
            if not clothing_id or not image_url:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing id or image_url'})
                }
            
            # Get current image URL
            cursor.execute('SELECT image_url FROM clothing_catalog WHERE id = %s', (clothing_id,))
            current_item = cursor.fetchone()
            old_image_url = current_item['image_url'] if current_item else None
            
            # Only save to S3 if image URL has changed
            saved_image_url = image_url
            if old_image_url != image_url and image_url.startswith(('http://', 'https://', 'data:')):
                s3_enabled = os.environ.get('S3_ACCESS_KEY')
                if s3_enabled:
                    try:
                        save_response = requests.post(
                            'https://functions.poehali.dev/56814ab9-6cba-4035-a63d-423ac0d301c8',
                            json={
                                'image_url': image_url,
                                'folder': 'catalog',
                                'user_id': 'admin'
                            },
                            timeout=30
                        )
                        if save_response.status_code == 200:
                            save_data = save_response.json()
                            saved_image_url = save_data.get('url', image_url)
                            
                            # Delete old image from S3 if it exists
                            if old_image_url and old_image_url.startswith('https://cdn.poehali.dev/'):
                                try:
                                    delete_response = requests.post(
                                        'https://functions.poehali.dev/bfa8cc4d-a0e7-44dd-b97a-0bd15e9f9b27',
                                        json={'image_url': old_image_url},
                                        timeout=10
                                    )
                                except:
                                    pass
                    except:
                        pass
            
            # Update clothing item with saved image URL
            cursor.execute("""
                UPDATE clothing_catalog
                SET image_url = %s, name = %s, description = %s, replicate_category = %s, gender = %s
                WHERE id = %s
            """, (saved_image_url, name, description, replicate_category, gender, clothing_id))
            
            # Delete old links
            cursor.execute('DELETE FROM clothing_category_links WHERE clothing_id = %s', (clothing_id,))
            cursor.execute('DELETE FROM clothing_color_links WHERE clothing_id = %s', (clothing_id,))
            cursor.execute('DELETE FROM clothing_archetype_links WHERE clothing_id = %s', (clothing_id,))
            
            # Add new links
            for cat_id in category_ids:
                cursor.execute("""
                    INSERT INTO clothing_category_links (clothing_id, category_id)
                    VALUES (%s, %s)
                """, (clothing_id, cat_id))
            
            for color_id in color_ids:
                cursor.execute("""
                    INSERT INTO clothing_color_links (clothing_id, color_group_id)
                    VALUES (%s, %s)
                """, (clothing_id, color_id))
            
            for arch_id in archetype_ids:
                cursor.execute("""
                    INSERT INTO clothing_archetype_links (clothing_id, archetype_id)
                    VALUES (%s, %s)
                """, (clothing_id, arch_id))
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Access-Control-Allow-Credentials': 'true'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'Clothing item updated'})
            }
        
        # DELETE /catalog-api?id=uuid (admin only)
        elif method == 'DELETE':
            # Read admin token from cookie
            headers = event.get('headers', {})
            cookie_header = headers.get('x-cookie') or headers.get('X-Cookie') or headers.get('cookie') or headers.get('Cookie', '')
            
            admin_token = None
            if cookie_header:
                cookies = cookie_header.split('; ')
                for cookie in cookies:
                    if cookie.startswith('admin_token='):
                        admin_token = cookie.split('=', 1)[1]
                        break
            
            # Verify JWT token
            is_valid, error_message = verify_admin_jwt(admin_token)
            if not is_valid:
                return {
                    'statusCode': 403,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': error_message})
                }
            
            clothing_id = query_params.get('id')
            if not clothing_id:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': get_cors_origin(event),
                        'Access-Control-Allow-Credentials': 'true'
                    },
                    'isBase64Encoded': False,
                    'body': json.dumps({'error': 'Missing id parameter'})
                }
            
            # Get image URL before deletion to delete from S3
            cursor.execute('SELECT image_url FROM clothing_catalog WHERE id = %s', (clothing_id,))
            clothing_item = cursor.fetchone()
            image_url = clothing_item['image_url'] if clothing_item else None
            
            # Delete links first
            cursor.execute('DELETE FROM clothing_category_links WHERE clothing_id = %s', (clothing_id,))
            cursor.execute('DELETE FROM clothing_color_links WHERE clothing_id = %s', (clothing_id,))
            cursor.execute('DELETE FROM clothing_archetype_links WHERE clothing_id = %s', (clothing_id,))
            
            # Delete clothing item
            cursor.execute('DELETE FROM clothing_catalog WHERE id = %s', (clothing_id,))
            
            # Delete image from S3 if it's from our storage
            if image_url:
                s3_enabled = os.environ.get('S3_ACCESS_KEY')
                s3_bucket_name = os.environ.get('S3_BUCKET_NAME')
                s3_url_prefix = f'https://{s3_bucket_name}.storage.yandexcloud.net/'
                
                if s3_enabled and image_url.startswith(s3_url_prefix):
                    try:
                        requests.post(
                            'https://functions.poehali.dev/caf33ea6-1aaa-46b4-bc76-9b03bee18925',
                            json={'image_url': image_url},
                            timeout=10
                        )
                        print(f'Deleted from S3: {image_url}')
                    except Exception as e:
                        print(f'S3 delete failed: {str(e)}')
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event),
                    'Access-Control-Allow-Credentials': 'true'
                },
                'isBase64Encoded': False,
                'body': json.dumps({'message': 'Clothing item deleted'})
            }
        
        else:
            return {
                'statusCode': 405,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': get_cors_origin(event)
                },
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Method not allowed'})
            }
    
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': get_cors_origin(event),
                'Access-Control-Allow-Credentials': 'true'
            },
            'isBase64Encoded': False,
            'body': json.dumps({'error': str(e)})
        }
    finally:
        cursor.close()
        conn.close()