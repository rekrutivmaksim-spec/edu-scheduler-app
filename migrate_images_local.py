#!/usr/bin/env python3
"""
Скрипт для миграции изображений цветотипов в S3 хранилище
Запускается локально, читает credentials из окружения
"""
import json
import os
import boto3
import requests
from pathlib import Path

def migrate_images():
    # Загружаем текущие ссылки
    refs_path = Path('backend/colortype-worker/colortype_references.json')
    with open(refs_path, 'r', encoding='utf-8') as f:
        refs = json.load(f)
    
    # S3 credentials (нужно установить в окружении)
    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    s3_bucket = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')
    
    if not all([s3_access_key, s3_secret_key]):
        print('❌ ERROR: S3_ACCESS_KEY and S3_SECRET_KEY must be set')
        return
    
    # Initialize S3
    s3 = boto3.client(
        's3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key,
        region_name='ru-central1'
    )
    
    migrated = 0
    failed = []
    new_refs = {}
    
    print(f'🚀 Starting migration of {len(refs)} color types...')
    
    for colortype, data in refs.items():
        folder_name = colortype.lower().replace(' ', '-')
        new_data = data.copy()
        
        print(f'\n📁 Processing {colortype}...')
        
        # Migrate scheme
        if 'scheme_url' in data:
            try:
                scheme_url = data['scheme_url']
                print(f'   Downloading scheme: {scheme_url}')
                response = requests.get(scheme_url, timeout=30)
                response.raise_for_status()
                
                file_ext = 'jpg' if scheme_url.endswith('.jpg') else 'jpeg'
                s3_key = f"colortype-schemes/{folder_name}/scheme.{file_ext}"
                content_type = 'image/jpeg'
                
                print(f'   Uploading to S3: {s3_key}')
                s3.put_object(
                    Bucket=s3_bucket,
                    Key=s3_key,
                    Body=response.content,
                    ContentType=content_type,
                    ACL='public-read'
                )
                
                new_url = f"https://storage.yandexcloud.net/{s3_bucket}/{s3_key}"
                new_data['scheme_url'] = new_url
                migrated += 1
                print(f'   ✅ Scheme migrated')
                
            except Exception as e:
                print(f'   ❌ Failed to migrate scheme: {str(e)}')
                failed.append(f"{colortype}/scheme: {str(e)}")
                new_data['scheme_url'] = data['scheme_url']
        
        # Migrate examples
        if 'examples' in data:
            new_examples = []
            example_count = len(data['examples'])
            print(f'   Migrating {example_count} examples...')
            
            for idx, example_url in enumerate(data['examples'], 1):
                try:
                    print(f'   [{idx}/{example_count}] Downloading example...')
                    response = requests.get(example_url, timeout=30)
                    response.raise_for_status()
                    
                    file_ext = 'webp' if example_url.endswith('.webp') else 'jpg'
                    s3_key = f"colortype-schemes/{folder_name}/example-{idx}.{file_ext}"
                    content_type = 'image/webp' if file_ext == 'webp' else 'image/jpeg'
                    
                    s3.put_object(
                        Bucket=s3_bucket,
                        Key=s3_key,
                        Body=response.content,
                        ContentType=content_type,
                        ACL='public-read'
                    )
                    
                    new_url = f"https://storage.yandexcloud.net/{s3_bucket}/{s3_key}"
                    new_examples.append(new_url)
                    migrated += 1
                    print(f'   ✅ Example {idx} migrated')
                    
                except Exception as e:
                    print(f'   ❌ Failed to migrate example {idx}: {str(e)}')
                    failed.append(f"{colortype}/example-{idx}: {str(e)}")
                    new_examples.append(example_url)
            
            new_data['examples'] = new_examples
        
        new_refs[colortype] = new_data
    
    # Сохраняем обновлённый JSON
    output_path = Path('backend/colortype-worker/colortype_references_NEW.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(new_refs, f, ensure_ascii=False, indent=2)
    
    print(f'\n\n✅ MIGRATION COMPLETE!')
    print(f'   Migrated: {migrated} images')
    print(f'   Failed: {len(failed)} images')
    if failed:
        print(f'\n❌ Failed items:')
        for item in failed:
            print(f'   - {item}')
    
    print(f'\n📝 New references saved to: {output_path}')
    print(f'   Please copy this file to colortype_references.json and redeploy')

if __name__ == '__main__':
    migrate_images()
