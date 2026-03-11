#!/usr/bin/env python3
"""
Extract all webp file paths from colortype_references.json
"""

import json
import re

def extract_webp_paths():
    # Read the JSON file
    with open('backend/colortype-worker/colortype_references.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Extract all webp URLs
    webp_files = []
    
    for colortype, info in data.items():
        if 'examples' in info:
            for url in info['examples']:
                if url.endswith('.webp'):
                    # Extract the S3 key (path after /bucket/)
                    match = re.search(r'/bucket/(.+\.webp)', url)
                    if match:
                        s3_key = match.group(1)
                        webp_files.append({
                            'colortype': colortype,
                            'url': url,
                            's3_key': s3_key
                        })
    
    # Group by colortype
    grouped = {}
    for item in webp_files:
        colortype = item['colortype']
        if colortype not in grouped:
            grouped[colortype] = []
        grouped[colortype].append(item['s3_key'])
    
    # Print results
    print("=" * 80)
    print("WebP files in S3 bucket 'files' (organized by colortype)")
    print("=" * 80)
    print()
    
    total_count = 0
    for colortype in sorted(grouped.keys()):
        files = grouped[colortype]
        print(f"\n{colortype} ({len(files)} files):")
        print("-" * 80)
        for s3_key in sorted(files):
            print(f"  {s3_key}")
            total_count += 1
    
    print()
    print("=" * 80)
    print(f"Total webp files: {total_count}")
    print("=" * 80)
    print()
    
    # Also print as a simple list of S3 keys
    print("\nAll S3 keys (flat list):")
    print("=" * 80)
    all_keys = []
    for colortype in sorted(grouped.keys()):
        all_keys.extend(sorted(grouped[colortype]))
    
    for key in sorted(all_keys):
        print(key)

if __name__ == '__main__':
    extract_webp_paths()
