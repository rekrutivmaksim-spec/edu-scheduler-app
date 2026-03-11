#!/usr/bin/env python3
"""
List all webp files in S3 bucket 'files' at bucket.poehali.dev endpoint
Based on the S3 configuration from backend/save-image-ftp/index.py
"""

import boto3
from botocore.config import Config
import os

def list_webp_files():
    # S3 configuration - using bucket.poehali.dev endpoint as specified
    endpoint_url = 'https://bucket.poehali.dev'
    bucket_name = 'files'
    
    # Try to get credentials from environment variables
    # You may need to set these:
    # export S3_ACCESS_KEY=your_access_key
    # export S3_SECRET_KEY=your_secret_key
    
    access_key = os.environ.get('S3_ACCESS_KEY')
    secret_key = os.environ.get('S3_SECRET_KEY')
    
    if not access_key or not secret_key:
        print("ERROR: S3_ACCESS_KEY and S3_SECRET_KEY environment variables must be set")
        print("\nUsage:")
        print("  export S3_ACCESS_KEY=your_access_key")
        print("  export S3_SECRET_KEY=your_secret_key")
        print("  python list_s3_webp.py")
        return
    
    try:
        # Create S3 client
        s3_client = boto3.client(
            's3',
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(signature_version='s3v4')
        )
        
        print(f"Connecting to {endpoint_url}")
        print(f"Listing files in bucket: {bucket_name}")
        print("\n" + "="*80)
        print("WebP files in S3 bucket:")
        print("="*80 + "\n")
        
        webp_files = []
        continuation_token = None
        
        # List all objects in the bucket
        while True:
            if continuation_token:
                response = s3_client.list_objects_v2(
                    Bucket=bucket_name,
                    ContinuationToken=continuation_token
                )
            else:
                response = s3_client.list_objects_v2(Bucket=bucket_name)
            
            # Filter webp files
            if 'Contents' in response:
                for obj in response['Contents']:
                    key = obj['Key']
                    if key.lower().endswith('.webp'):
                        webp_files.append(key)
            
            # Check if there are more results
            if response.get('IsTruncated'):
                continuation_token = response.get('NextContinuationToken')
            else:
                break
        
        # Organize files by folder structure
        organized_files = {}
        for file_key in sorted(webp_files):
            # Extract folder path
            parts = file_key.split('/')
            if len(parts) > 1:
                folder = '/'.join(parts[:-1])
            else:
                folder = 'root'
            
            if folder not in organized_files:
                organized_files[folder] = []
            organized_files[folder].append(file_key)
        
        # Print organized list
        total_count = 0
        for folder in sorted(organized_files.keys()):
            files = organized_files[folder]
            print(f"\n[{folder}] ({len(files)} files)")
            print("-" * 80)
            for file_path in files:
                print(f"  {file_path}")
                total_count += 1
        
        print("\n" + "="*80)
        print(f"Total WebP files found: {total_count}")
        print("="*80)
        
    except Exception as e:
        print(f"Error accessing S3: {str(e)}")
        print("\nMake sure:")
        print("1. S3_ACCESS_KEY and S3_SECRET_KEY are set correctly")
        print("2. The endpoint URL is correct: https://bucket.poehali.dev")
        print("3. You have access to the 'files' bucket")

if __name__ == '__main__':
    list_webp_files()
