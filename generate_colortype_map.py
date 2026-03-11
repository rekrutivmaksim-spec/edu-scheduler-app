#!/usr/bin/env python3
"""
Generate COLORTYPE_MAP based on (hair_lightness, skin_lightness, eyes_lightness) combinations
"""

# Colortype definitions with their allowed combinations
COLORTYPE_COMBINATIONS = {
    'VIBRANT SPRING': {
        'undertone': 'WARM-UNDERTONE',
        'combinations': [
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ],
        'saturation': ['BRIGHT-NEUTRAL-SATURATION-COLORS', 'BRIGHT-SATURATION-COLORS'],
        'contrast': ['HIGH-MEDIUM-CONTRAST', 'HIGH-CONTRAST', 'LOW-MEDIUM-CONTRAST', 'LOW-CONTRAST']
    },
    'BRIGHT SPRING': {
        'undertone': 'WARM-UNDERTONE',
        'combinations': [
            ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ],
        'saturation': ['BRIGHT-NEUTRAL-SATURATION-COLORS', 'BRIGHT-SATURATION-COLORS'],
        'contrast': ['HIGH-MEDIUM-CONTRAST', 'HIGH-CONTRAST', 'LOW-MEDIUM-CONTRAST']
    },
    'GENTLE SPRING': {
        'undertone': 'WARM-UNDERTONE',
        'combinations': [
            ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ],
        'saturation': ['MUTED-NEUTRAL-SATURATION-COLORS'],
        'contrast': ['LOW-MEDIUM-CONTRAST', 'LOW-CONTRAST']
    },
    'SOFT SUMMER': {
        'undertone': 'COOL-UNDERTONE',
        'combinations': [
            ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ],
        'saturation': ['MUTED-SATURATION-COLORS'],
        'contrast': ['LOW-MEDIUM-CONTRAST', 'LOW-CONTRAST']
    },
    'VIVID SUMMER': {
        'undertone': 'COOL-UNDERTONE',
        'combinations': [
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ],
        'saturation': ['MUTED-NEUTRAL-SATURATION-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'BRIGHT-SATURATION-COLORS'],
        'contrast': ['HIGH-MEDIUM-CONTRAST', 'HIGH-CONTRAST', 'LOW-CONTRAST', 'LOW-MEDIUM-CONTRAST']
    },
    'DUSTY SUMMER': {
        'undertone': 'COOL-UNDERTONE',
        'combinations': [
            ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ],
        'saturation': ['MUTED-SATURATION-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS'],
        'contrast': ['LOW-MEDIUM-CONTRAST', 'LOW-CONTRAST']
    },
    'GENTLE AUTUMN': {
        'undertone': 'WARM-UNDERTONE',
        'combinations': [
            ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ],
        'saturation': ['MUTED-NEUTRAL-SATURATION-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS'],
        'contrast': ['LOW-MEDIUM-CONTRAST', 'LOW-CONTRAST']
    },
    'FIERY AUTUMN': {
        'undertone': 'WARM-UNDERTONE',
        'combinations': [
            ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ],
        'saturation': ['BRIGHT-NEUTRAL-SATURATION-COLORS', 'BRIGHT-SATURATION-COLORS'],
        'contrast': ['HIGH-MEDIUM-CONTRAST', 'LOW-MEDIUM-CONTRAST', 'LOW-CONTRAST']
    },
    'VIVID AUTUMN': {
        'undertone': 'WARM-UNDERTONE',
        'combinations': [
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ],
        'saturation': ['BRIGHT-SATURATION-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS'],
        'contrast': ['HIGH-MEDIUM-CONTRAST', 'LOW-MEDIUM-CONTRAST', 'LOW-CONTRAST']
    },
    'VIVID WINTER': {
        'undertone': 'COOL-UNDERTONE',
        'combinations': [
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ],
        'saturation': ['BRIGHT-NEUTRAL-SATURATION-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS'],
        'contrast': ['HIGH-CONTRAST', 'HIGH-MEDIUM-CONTRAST']
    },
    'SOFT WINTER': {
        'undertone': 'COOL-UNDERTONE',
        'combinations': [
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ],
        'saturation': ['MUTED-NEUTRAL-SATURATION-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS'],
        'contrast': ['HIGH-CONTRAST', 'HIGH-MEDIUM-CONTRAST', 'LOW-MEDIUM-CONTRAST']
    },
    'BRIGHT WINTER': {
        'undertone': 'COOL-UNDERTONE',
        'combinations': [
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
            ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ],
        'saturation': ['MUTED-NEUTRAL-SATURATION-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS'],
        'contrast': ['HIGH-MEDIUM-CONTRAST', 'HIGH-CONTRAST', 'LOW-MEDIUM-CONTRAST', 'LOW-CONTRAST']
    },
}

# Generate COLORTYPE_MAP
colortype_map = {}

for colortype, config in COLORTYPE_COMBINATIONS.items():
    undertone = config['undertone']
    combinations = config['combinations']
    saturations = config['saturation']
    contrasts = config['contrast']
    
    for hair_l, skin_l, eyes_l in combinations:
        for saturation in saturations:
            for contrast in contrasts:
                key = (undertone, hair_l, skin_l, eyes_l, saturation, contrast)
                colortype_map[key] = colortype

# Print the map
print("# Mapping table: (undertone, hair_lightness, skin_lightness, eyes_lightness, saturation, contrast) -> colortype")
print("COLORTYPE_MAP = {")

# Group by colortype for better readability
for colortype in COLORTYPE_COMBINATIONS.keys():
    entries = [(k, v) for k, v in colortype_map.items() if v == colortype]
    if entries:
        print(f"    # ============ {colortype} ============")
        for key, value in entries:
            print(f"    {key}: '{value}',")
        print()

print("}")

# Count total entries
print(f"\n# Total entries: {len(colortype_map)}")

# Check for duplicate keys (shouldn't happen)
print(f"# Unique keys: {len(set(colortype_map.keys()))}")
