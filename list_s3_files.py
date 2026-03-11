import boto3
import os

s3 = boto3.client('s3',
    endpoint_url='https://bucket.poehali.dev',
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
)

# List all objects with prefix 'colortype-schemes/'
response = s3.list_objects_v2(Bucket='files', Prefix='colortype-schemes/')

if 'Contents' in response:
    files = [obj['Key'] for obj in response['Contents']]
    print(f"Found {len(files)} files in colortype-schemes/:")
    for file in files:
        print(f"  - {file}")
else:
    print("No files found in colortype-schemes/")
