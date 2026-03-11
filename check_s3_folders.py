#!/usr/bin/env python3
import boto3
import os
from collections import defaultdict
from botocore.config import Config

# Get credentials from environment
s3_access_key = os.environ.get('S3_ACCESS_KEY')
s3_secret_key = os.environ.get('S3_SECRET_KEY')
bucket_name = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')

if not s3_access_key or not s3_secret_key:
    print("ERROR: S3_ACCESS_KEY and S3_SECRET_KEY environment variables must be set")
    print("\nUsage:")
    print("  export S3_ACCESS_KEY=your_access_key")
    print("  export S3_SECRET_KEY=your_secret_key")
    print("  python check_s3_folders.py")
    exit(1)

# Connect to Yandex Cloud Storage
s3 = boto3.client(
    's3',
    endpoint_url='https://storage.yandexcloud.net',
    aws_access_key_id=s3_access_key,
    aws_secret_access_key=s3_secret_key,
    region_name='ru-central1',
    config=Config(signature_version='s3v4')
)
prefix = 'colortype-schemes/'

print(f"Connecting to bucket: {bucket_name}")
print(f"Listing objects under prefix: {prefix}\n")
print("=" * 80)

# List all objects under the prefix
response = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix)

if 'Contents' not in response:
    print(f"No objects found under {prefix}")
    exit()

# Group files by folder
folders = defaultdict(list)

for obj in response['Contents']:
    key = obj['Key']
    
    # Skip the prefix itself if it's listed
    if key == prefix:
        continue
    
    # Extract folder name (everything between prefix and the file)
    remainder = key[len(prefix):]
    
    if '/' in remainder:
        folder_name = remainder.split('/')[0]
        file_name = remainder.split('/', 1)[1] if '/' in remainder else ''
        
        if file_name:  # Only add if there's a file
            full_folder_path = f"{prefix}{folder_name}/"
            folders[full_folder_path].append(file_name)

# Sort folders alphabetically
sorted_folders = sorted(folders.keys())

print(f"FOUND {len(sorted_folders)} FOLDERS:\n")

for i, folder in enumerate(sorted_folders, 1):
    folder_name = folder.replace(prefix, '').rstrip('/')
    print(f"{i}. Folder: '{folder}'")
    print(f"   Name only: '{folder_name}'")
    print(f"   Files ({len(folders[folder])}):")
    
    # Sort files for consistent display
    for file in sorted(folders[folder]):
        print(f"      - {file}")
    
    # Check if scheme.webp exists
    has_scheme = 'scheme.webp' in folders[folder]
    print(f"   ✓ scheme.webp exists: {has_scheme}")
    print()

print("=" * 80)
print("\nSUMMARY - Exact folder names for colortype_references.json:")
print("-" * 80)
for folder in sorted_folders:
    folder_name = folder.replace(prefix, '').rstrip('/')
    print(f"  '{folder_name}'")

print("\n" + "=" * 80)
print(f"\nTotal folders: {len(sorted_folders)}")