#!/usr/bin/env python3
"""
Generate AMBIGUOUS_COMBINATIONS from COLORTYPE_MAP
Find all parameter combinations that map to multiple colortypes
"""

from generate_colortype_map import COLORTYPE_COMBINATIONS

# Generate full colortype_map first
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
                if key not in colortype_map:
                    colortype_map[key] = []
                colortype_map[key].append(colortype)

# Find ambiguous combinations (multiple colortypes for same params)
ambiguous = {}
for key, colortypes in colortype_map.items():
    if len(colortypes) > 1:
        ambiguous[key] = colortypes

# Print results
print("# Ambiguous parameter combinations that require color-based resolution")
print("# If parameters match one of these keys, compare color scores for all candidates")
print("AMBIGUOUS_COMBINATIONS = {")

# Sort by undertone (COOL first, then WARM), then by other params
cool_combos = [(k, v) for k, v in ambiguous.items() if k[0] == 'COOL-UNDERTONE']
warm_combos = [(k, v) for k, v in ambiguous.items() if k[0] == 'WARM-UNDERTONE']

if cool_combos:
    print("    # COOL-UNDERTONE combinations")
    for key, colortypes in sorted(cool_combos):
        print(f"    {key}: {colortypes},")
    print()

if warm_combos:
    print("    # WARM-UNDERTONE combinations")
    for key, colortypes in sorted(warm_combos):
        print(f"    {key}: {colortypes},")

print("}")

print(f"\n# Total ambiguous combinations: {len(ambiguous)}")
print(f"# Total unique parameter combinations: {len(colortype_map)}")
print(f"# Non-ambiguous (direct match): {len([k for k, v in colortype_map.items() if len(v) == 1])}")
