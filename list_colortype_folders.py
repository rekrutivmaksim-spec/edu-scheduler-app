#!/usr/bin/env python3
import boto3
import os
from botocore.config import Config

# Get credentials from environment
s3_access_key = os.environ.get('S3_ACCESS_KEY')
s3_secret_key = os.environ.get('S3_SECRET_KEY')

if not s3_access_key or not s3_secret_key:
    print("ERROR: S3_ACCESS_KEY and S3_SECRET_KEY must be set")
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

bucket_name = 'fitting-room-images'
prefix = 'colortype-schemes/'

# List all objects under the prefix
response = s3.list_objects_v2(Bucket=bucket_name, Prefix=prefix)

if 'Contents' not in response:
    print(f"No objects found under {prefix}")
    exit()

# Extract unique folder names
folders = set()
for obj in response['Contents']:
    key = obj['Key']
    if key == prefix:
        continue
    
    remainder = key[len(prefix):]
    if '/' in remainder:
        folder_name = remainder.split('/')[0]
        folders.add(folder_name)

# Sort and print
sorted_folders = sorted(folders)
print(f"\nFound {len(sorted_folders)} folders under colortype-schemes/:\n")
for folder in sorted_folders:
    print(f"- {folder}")
print()
