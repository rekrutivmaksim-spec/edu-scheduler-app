#!/usr/bin/env python3
"""
Script to analyze COLORTYPE_MAP and AMBIGUOUS_COMBINATIONS 
to find missing combinations and logical inconsistencies.
"""

# All 12 colortypes from COLORTYPE_REFERENCES
ALL_COLORTYPES = [
    'SOFT SUMMER', 'DUSTY SUMMER', 'VIVID SUMMER',
    'GENTLE AUTUMN', 'FIERY AUTUMN', 'VIVID AUTUMN',
    'GENTLE SPRING', 'BRIGHT SPRING', 'VIBRANT SPRING',
    'SOFT WINTER', 'BRIGHT WINTER', 'VIVID WINTER'
]

# Color theory expectations
COLOR_THEORY = {
    'SOFT SUMMER': {'undertone': 'COOL', 'expected_lightness': ['LIGHT', 'MEDIUM'], 'season': 'SUMMER'},
    'DUSTY SUMMER': {'undertone': 'COOL', 'expected_lightness': ['LIGHT', 'MEDIUM'], 'season': 'SUMMER'},
    'VIVID SUMMER': {'undertone': 'COOL', 'expected_lightness': ['MEDIUM', 'DEEP'], 'season': 'SUMMER'},
    
    'GENTLE AUTUMN': {'undertone': 'WARM', 'expected_lightness': ['LIGHT', 'MEDIUM'], 'season': 'AUTUMN'},
    'FIERY AUTUMN': {'undertone': 'WARM', 'expected_lightness': ['MEDIUM', 'DEEP'], 'season': 'AUTUMN'},
    'VIVID AUTUMN': {'undertone': 'WARM', 'expected_lightness': ['DEEP'], 'season': 'AUTUMN'},
    
    'GENTLE SPRING': {'undertone': 'WARM', 'expected_lightness': ['LIGHT'], 'season': 'SPRING'},
    'BRIGHT SPRING': {'undertone': 'WARM', 'expected_lightness': ['LIGHT', 'MEDIUM'], 'season': 'SPRING'},
    'VIBRANT SPRING': {'undertone': 'WARM', 'expected_lightness': ['LIGHT', 'MEDIUM', 'DEEP'], 'season': 'SPRING'},
    
    'SOFT WINTER': {'undertone': 'COOL', 'expected_lightness': ['MEDIUM', 'DEEP'], 'season': 'WINTER'},
    'BRIGHT WINTER': {'undertone': 'COOL', 'expected_lightness': ['LIGHT', 'MEDIUM', 'DEEP'], 'season': 'WINTER'},
    'VIVID WINTER': {'undertone': 'COOL', 'expected_lightness': ['DEEP'], 'season': 'WINTER'},
}

# COLORTYPE_MAP from worker file
COLORTYPE_MAP = {
    # ============ SOFT SUMMER (COOL, LIGHT, BRIGHT/MUTED-NEUTRAL, LOW) ============
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',

    # ============ VIVID SUMMER (COOL, DEEP/MEDIUM, BRIGHT/MUTED, LOW) ============
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID SUMMER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID SUMMER',

    # ============ DUSTY SUMMER (COOL, LIGHT/MEDIUM, MUTED, LOW) ============
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'DUSTY SUMMER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'DUSTY SUMMER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'DUSTY SUMMER',

    # ============ GENTLE AUTUMN (WARM, LIGHT/MEDIUM, MUTED, LOW) ============
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',

    # ============ FIERY AUTUMN (WARM, MEDIUM, BRIGHT, HIGH/LOW) ============
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'FIERY AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'HIGH-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'FIERY AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'FIERY AUTUMN',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'FIERY AUTUMN',

    # ============ VIVID AUTUMN (WARM, DEEP, MUTED, HIGH/LOW) ============
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID AUTUMN',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID AUTUMN',

    # ============ VIVID WINTER (COOL, DEEP, BRIGHT, LOW) ============
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'VIVID WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'VIVID WINTER',

    # ============ SOFT WINTER (COOL, MEDIUM/DEEP, BRIGHT/MUTED, HIGH) ============
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'SOFT WINTER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'SOFT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'SOFT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'SOFT WINTER',

    # ============ BRIGHT WINTER (COOL, LIGHT/MEDIUM/DEEP, BRIGHT, HIGH/LOW) ============
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',

    # ============ VIBRANT SPRING (WARM, LIGHT/MEDIUM/DEEP, BRIGHT/MUTED, HIGH) ============
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',

    # ============ BRIGHT SPRING (WARM, LIGHT/MEDIUM, BRIGHT, LOW) ============
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT SPRING',
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'BRIGHT SPRING',

    # ============ GENTLE SPRING (WARM, LIGHT, BRIGHT/MUTED-NEUTRAL, LOW) ============
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'GENTLE SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE SPRING',
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE SPRING',
}

# AMBIGUOUS_COMBINATIONS from worker file
AMBIGUOUS_COMBINATIONS = {
    # COOL-UNDERTONE combinations
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['DUSTY SUMMER', 'SOFT SUMMER'],
    ('COOL-UNDERTONE', 'LIGHT-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['BRIGHT WINTER', 'VIVID SUMMER'],
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): ['BRIGHT WINTER', 'VIVID SUMMER'],
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['BRIGHT WINTER', 'SOFT WINTER'],
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['BRIGHT WINTER', 'VIVID SUMMER', 'SOFT WINTER'],
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): ['BRIGHT WINTER', 'SOFT WINTER'],
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['BRIGHT WINTER', 'VIVID SUMMER', 'SOFT WINTER'],
    ('COOL-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['BRIGHT WINTER', 'DUSTY SUMMER'],
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['VIVID WINTER', 'BRIGHT WINTER'],
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): ['SOFT WINTER', 'VIVID WINTER'],
    ('COOL-UNDERTONE', 'DEEP-COLORS', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['SOFT WINTER', 'VIVID WINTER'],
    
    # WARM-UNDERTONE combinations
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['BRIGHT SPRING', 'VIBRANT SPRING'],
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): ['BRIGHT SPRING', 'VIBRANT SPRING'],
    ('WARM-UNDERTONE', 'LIGHT-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['BRIGHT SPRING', 'VIBRANT SPRING'],
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIBRANT SPRING', 'BRIGHT SPRING'],
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIBRANT SPRING', 'GENTLE AUTUMN', 'BRIGHT SPRING'],
    ('WARM-UNDERTONE', 'MEDIUM-LIGHTNESS-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): ['FIERY AUTUMN', 'VIBRANT SPRING', 'GENTLE AUTUMN'],
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIVID AUTUMN'],
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIVID AUTUMN'],
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): ['FIERY AUTUMN', 'VIVID AUTUMN'],
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIVID AUTUMN'],
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIVID AUTUMN'],
    ('WARM-UNDERTONE', 'DEEP-COLORS', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): ['FIERY AUTUMN', 'VIVID AUTUMN'],
}

def analyze_colortypes():
    print("=" * 80)
    print("COLORTYPE ANALYSIS REPORT")
    print("=" * 80)
    print()
    
    # 1. Count mappings per colortype
    print("1. MAPPING COUNT PER COLORTYPE")
    print("-" * 80)
    
    colortype_counts = {}
    for colortype in ALL_COLORTYPES:
        count = sum(1 for v in COLORTYPE_MAP.values() if v == colortype)
        colortype_counts[colortype] = count
    
    # Sort by count
    sorted_counts = sorted(colortype_counts.items(), key=lambda x: x[1])
    
    zero_mappings = []
    few_mappings = []
    
    for colortype, count in sorted_counts:
        status = ""
        if count == 0:
            status = " ⚠️  ZERO MAPPINGS!"
            zero_mappings.append(colortype)
        elif count < 3:
            status = " ⚠️  FEW MAPPINGS (< 3)"
            few_mappings.append(colortype)
        
        print(f"  {colortype:20s}: {count:2d} combinations{status}")
    
    print()
    
    # 2. Check undertone consistency
    print("2. UNDERTONE CONSISTENCY CHECK")
    print("-" * 80)
    
    inconsistencies = []
    
    for combo, colortype in COLORTYPE_MAP.items():
        undertone_param = combo[0]  # WARM-UNDERTONE or COOL-UNDERTONE
        expected_undertone = COLOR_THEORY[colortype]['undertone']
        
        actual_undertone = 'WARM' if 'WARM' in undertone_param else 'COOL'
        
        if actual_undertone != expected_undertone:
            inconsistencies.append({
                'colortype': colortype,
                'expected': expected_undertone,
                'actual': actual_undertone,
                'combo': combo
            })
    
    if inconsistencies:
        print("  ⚠️  FOUND UNDERTONE INCONSISTENCIES:")
        for inc in inconsistencies:
            print(f"    {inc['colortype']}: Expected {inc['expected']}, got {inc['actual']}")
            print(f"      Combination: {inc['combo']}")
        print()
    else:
        print("  ✓ All colortypes have correct undertones")
        print()
    
    # 3. Check lightness consistency
    print("3. LIGHTNESS CONSISTENCY CHECK")
    print("-" * 80)
    
    lightness_issues = []
    
    for combo, colortype in COLORTYPE_MAP.items():
        lightness_param = combo[1]  # LIGHT-COLORS, MEDIUM-LIGHTNESS-COLORS, or DEEP-COLORS
        expected_lightness_list = COLOR_THEORY[colortype]['expected_lightness']
        
        # Extract actual lightness
        if 'LIGHT-COLORS' in lightness_param:
            actual_lightness = 'LIGHT'
        elif 'MEDIUM-LIGHTNESS-COLORS' in lightness_param:
            actual_lightness = 'MEDIUM'
        elif 'DEEP-COLORS' in lightness_param:
            actual_lightness = 'DEEP'
        else:
            actual_lightness = 'UNKNOWN'
        
        if actual_lightness not in expected_lightness_list:
            lightness_issues.append({
                'colortype': colortype,
                'expected': expected_lightness_list,
                'actual': actual_lightness,
                'combo': combo
            })
    
    if lightness_issues:
        print("  ⚠️  FOUND LIGHTNESS INCONSISTENCIES:")
        for issue in lightness_issues:
            print(f"    {issue['colortype']}: Expected {issue['expected']}, got {issue['actual']}")
        print()
    else:
        print("  ✓ All colortypes have appropriate lightness values")
        print()
    
    # 4. Verify AMBIGUOUS_COMBINATIONS
    print("4. AMBIGUOUS_COMBINATIONS VERIFICATION")
    print("-" * 80)
    
    ambiguous_issues = []
    
    for combo_tuple, colortype_list in AMBIGUOUS_COMBINATIONS.items():
        # Check if this combo actually appears in COLORTYPE_MAP
        if combo_tuple in COLORTYPE_MAP:
            # It's in the map, so it should NOT be in ambiguous
            assigned_colortype = COLORTYPE_MAP[combo_tuple]
            ambiguous_issues.append({
                'type': 'IN_MAP',
                'combo': combo_tuple,
                'map_colortype': assigned_colortype,
                'ambiguous_list': colortype_list
            })
        else:
            # It's NOT in the map (good for ambiguous)
            # But check if the colortypes in the list have ANY mappings at all
            for ct in colortype_list:
                if colortype_counts.get(ct, 0) == 0:
                    ambiguous_issues.append({
                        'type': 'MISSING_COLORTYPE',
                        'combo': combo_tuple,
                        'missing_colortype': ct,
                        'ambiguous_list': colortype_list
                    })
    
    if ambiguous_issues:
        print("  ⚠️  FOUND AMBIGUOUS_COMBINATIONS ISSUES:")
        for issue in ambiguous_issues:
            if issue['type'] == 'IN_MAP':
                print(f"    Combo is BOTH in MAP and AMBIGUOUS:")
                print(f"      {issue['combo']}")
                print(f"      Map assigns: {issue['map_colortype']}")
                print(f"      Ambiguous lists: {issue['ambiguous_list']}")
                print()
            elif issue['type'] == 'MISSING_COLORTYPE':
                print(f"    Ambiguous combo references colortype with ZERO mappings:")
                print(f"      {issue['combo']}")
                print(f"      Missing: {issue['missing_colortype']}")
                print(f"      Ambiguous list: {issue['ambiguous_list']}")
                print()
    else:
        print("  ✓ AMBIGUOUS_COMBINATIONS looks consistent")
        print()
    
    # 5. Summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    if zero_mappings:
        print(f"⚠️  Colortypes with ZERO mappings: {', '.join(zero_mappings)}")
    
    if few_mappings:
        print(f"⚠️  Colortypes with FEW mappings (< 3): {', '.join(few_mappings)}")
    
    if inconsistencies:
        print(f"⚠️  Found {len(inconsistencies)} undertone inconsistencies")
    
    if lightness_issues:
        print(f"⚠️  Found {len(lightness_issues)} lightness inconsistencies")
    
    if ambiguous_issues:
        print(f"⚠️  Found {len(ambiguous_issues)} ambiguous combination issues")
    
    if not (zero_mappings or few_mappings or inconsistencies or lightness_issues or ambiguous_issues):
        print("✓ All checks passed! No issues found.")
    
    print()
    print(f"Total combinations in COLORTYPE_MAP: {len(COLORTYPE_MAP)}")
    print(f"Total ambiguous combinations: {len(AMBIGUOUS_COMBINATIONS)}")
    print()

if __name__ == '__main__':
    analyze_colortypes()
