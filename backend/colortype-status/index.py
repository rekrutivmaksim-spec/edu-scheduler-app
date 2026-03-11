import json
import os
import psycopg2
import requests
from typing import Dict, Any
from datetime import datetime

# Updated with 18 exclusion rules + bright/soft eyes distinction + penalties for accurate color type matching
# Rule 1: Brown eyes → exclude GENTLE SPRING, BRIGHT SPRING, all SUMMER, SOFT WINTER
# Rule 2: Cool light eyes → exclude VIVID AUTUMN, VIVID WINTER
# Rule 3: Chestnut brown hair → exclude BRIGHT SPRING
# Rule 4: Light skin + cool eyes → exclude GENTLE AUTUMN
# Rule 5: Blonde hair → exclude FIERY AUTUMN, VIVID AUTUMN
# Rule 6: Copper hair (NOT light copper) → exclude GENTLE SPRING
# Rule 7: Gray/grey eyes → exclude VIBRANT SPRING (gray = VIVID SUMMER or SOFT WINTER characteristic)
# Rule 8: Bright blue/bright green eyes → exclude VIVID SUMMER (bright eyes = VIBRANT SPRING or BRIGHT WINTER)
# Rule 9: Light blue/light green/light turquoise eyes → ONLY SOFT SUMMER or GENTLE SPRING
# Rule 10: Bright eyes (bright blue, bright green, bright blue-green, bright brown) → ONLY VIBRANT SPRING or BRIGHT WINTER
# Rule 11: Dark/deep brown hair + bright blue/gray-blue eyes → BRIGHT WINTER (NOT VIBRANT SPRING, NOT SOFT WINTER)
# Rule 12: Dark/deep brown hair + soft/muted gray/gray-blue eyes → SOFT WINTER or VIVID SUMMER (NOT BRIGHT WINTER)
# Rule 13: Dark brown hair with warm undertone + brown eyes → VIVID AUTUMN (NOT VIBRANT SPRING, NOT GENTLE AUTUMN, NOT FIERY AUTUMN)
# Rule 14: Light hair → exclude BRIGHT WINTER, DEEP WINTER, VIVID AUTUMN (these types require ONLY dark hair)
# Rule 15: Brown hair (any shade) OR auburn hair + brown eyes → exclude VIBRANT SPRING (VIBRANT SPRING has bright eyes, NOT brown)
# Rule 16: Brown hair (any shade: medium/dark/light brown) → exclude GENTLE SPRING (GENTLE SPRING requires ONLY blonde hair)
# Rule 17: Medium ash brown hair → exclude SOFT SUMMER (SOFT SUMMER requires light/blonde hair)
# Rule 18: Blonde hair (any shade) → exclude VIVID SUMMER (VIVID SUMMER requires medium/dark hair)
# BONUS: Ash blond hair → +0.15 for SOFT SUMMER (characteristic hair color)
# PENALTY: Non-bright eyes → -0.25 for VIBRANT SPRING (prefers bright/sparkling eyes, but not excluded)

# Russian translations for user-facing messages
COLORTYPE_NAMES_RU = {
    'GENTLE AUTUMN': 'Нежная (мягкая) осень',
    'FIERY AUTUMN': 'Огненная осень',
    'VIVID AUTUMN': 'Тёмная осень',
    'GENTLE SPRING': 'Нежная (мягкая) весна',
    'BRIGHT SPRING': 'Тёплая весна',
    'VIBRANT SPRING': 'Яркая весна',
    'SOFT WINTER': 'Мягкая зима',
    'BRIGHT WINTER': 'Яркая зима',
    'VIVID WINTER': 'Тёмная зима',
    'SOFT SUMMER': 'Светлое (мягкое) лето',
    'DUSTY SUMMER': 'Пыльное (мягкое) лето',
    'VIVID SUMMER': 'Яркое (холодное) лето'
}

UNDERTONE_RU = {
    'WARM-UNDERTONE': 'тёплый',
    'COOL-UNDERTONE': 'холодный'
}

LIGHTNESS_RU = {
    'LIGHT-COLORS': 'светлые цвета',
    'MEDIUM-LIGHTNESS-COLORS': 'средне-светлые цвета',
    'DEEP-COLORS': 'глубокие насыщенные цвета'
}

SATURATION_RU = {
    'MUTED-SATURATION-COLORS': 'приглушённая',
    'MUTED-NEUTRAL-SATURATION-COLORS': 'приглушённо-нейтральная',
    'BRIGHT-NEUTRAL-SATURATION-COLORS': 'ярко-нейтральная',
    'BRIGHT-SATURATION-COLORS': 'яркая'
}

CONTRAST_RU = {
    'LOW-CONTRAST': 'низкий',
    'LOW-MEDIUM-CONTRAST': 'средне-низкий',
    'HIGH-MEDIUM-CONTRAST': 'средне-высокий',
    'HIGH-CONTRAST': 'высокий'
}

def format_result(colortype: str, hair: str, skin: str, eyes: str, 
                  undertone: str, saturation: str, contrast: str,
                  fallback_type: str = 'standard') -> str:
    '''Format user-friendly result message in Russian'''
    colortype_ru = COLORTYPE_NAMES_RU.get(colortype, colortype)
    undertone_ru = UNDERTONE_RU.get(undertone, undertone)
    saturation_ru = SATURATION_RU.get(saturation, saturation)
    contrast_ru = CONTRAST_RU.get(contrast, contrast)
    
    base_message = f"""# {colortype_ru}

Ваш цветотип — {colortype}.

Ваши цвета:
• Волосы: {hair}
• Кожа: {skin}
• Глаза: {eyes}

Характеристики:
• Подтон: {undertone_ru}
• Насыщенность: {saturation_ru}
• Контраст: {contrast_ru}"""

    if fallback_type == 'standard':
        return base_message + "\n\nАнализ показал уверенное совпадение по всем параметрам."
    elif fallback_type == 'fallback1':
        return base_message + "\n\nПри анализе тон показал неоднозначные результаты, но общая картина внешности чётко указывает на этот тип. Обратите внимание: освещение на фото или окрашенные волосы могли повлиять на точность определения."
    elif fallback_type == 'fallback2':
        return base_message + "\n\nВаша внешность уникальна — она сочетает черты нескольких типов, но этот цветотип подходит вам больше всего. Обратите внимание: освещение на фото или окрашенные волосы могли повлиять на точность определения."
    
    return base_message

def check_replicate_status(prediction_id: str) -> dict:
    '''Check status directly on Replicate API'''
    replicate_api_key = os.environ.get('REPLICATE_API_TOKEN')
    if not replicate_api_key:
        raise Exception('REPLICATE_API_TOKEN not configured')
    
    headers = {
        'Authorization': f'Bearer {replicate_api_key}',
        'Content-Type': 'application/json'
    }
    
    response = requests.get(
        f'https://api.replicate.com/v1/predictions/{prediction_id}',
        headers=headers,
        timeout=10
    )
    
    if response.status_code == 200:
        return response.json()
    
    raise Exception(f'Failed to check status: {response.status_code}')

# Ambiguous parameter combinations that require color-based resolution
# If parameters match one of these keys, compare color scores for all candidates
AMBIGUOUS_COMBINATIONS = {
    # COOL-UNDERTONE combinations
    ('COOL-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): ['VIVID WINTER', 'BRIGHT WINTER'],
    ('COOL-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['VIVID WINTER', 'BRIGHT WINTER'],
    ('COOL-UNDERTONE', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['SOFT SUMMER', 'DUSTY SUMMER'],
    ('COOL-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['SOFT SUMMER', 'VIVID WINTER'],
    ('COOL-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): ['SOFT SUMMER', 'VIVID WINTER'],
    ('COOL-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['SOFT SUMMER', 'VIVID WINTER'],
    ('COOL-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): ['SOFT SUMMER', 'VIVID WINTER'],
    ('COOL-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): ['VIVID SUMMER', 'SOFT WINTER'],
    ('COOL-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['DUSTY SUMMER', 'SOFT WINTER'],
    ('COOL-UNDERTONE', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): ['DUSTY SUMMER', 'SOFT SUMMER'],
    
    
    # WARM-UNDERTONE combinations
    ('WARM-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'VIBRANT SPRING', 'BRIGHT SPRING'],
    ('WARM-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'BRIGHT SPRING', 'GENTLE AUTUMN', 'VIVID AUTUMN'],
    ('WARM-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): ['FIERY AUTUMN', 'GENTLE AUTUMN', 'GENTLE SPRING'],
    ('WARM-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): ['FIERY AUTUMN', 'BRIGHT SPRING', 'GENTLE SPRING'],
    ('WARM-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'LOW-CONTRAST'): ['BRIGHT SPRING', 'GENTLE SPRING'],
    ('WARM-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): ['GENTLE AUTUMN', 'GENTLE SPRING'],
    ('WARM-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['GENTLE AUTUMN', 'VIVID AUTUMN', 'VIBRANT SPRING', 'BRIGHT SPRING'],
    ('WARM-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): ['VIVID AUTUMN', 'VIBRANT SPRING', 'BRIGHT SPRING'],
    ('WARM-UNDERTONE', 'MUTED-SATURATION-COLORS', 'HIGH-CONTRAST'): ['VIVID AUTUMN', 'VIBRANT SPRING'],
    ('WARM-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): ['VIVID AUTUMN', 'VIBRANT SPRING'],
    ('WARM-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): ['FIERY AUTUMN', 'VIBRANT SPRING'],
}

# Colortype reference data with keywords
COLORTYPE_REFERENCES = {
    'GENTLE AUTUMN': {
        'hair': ['dark honey', 'tawny', 'gentle auburn', 'honey', 'auburn'],
        'eyes': ['turquoise blue', 'jade', 'light brown', 'turquoise', 'hazel', 'blue', 'green', 'light hazel'],
        'skin': ['light warm beige', 'warm beige', 'beige']
    },
    'FIERY AUTUMN': {
        'hair': ['dark honey', 'warm brown', 'chestnut', 'auburn', 'deep auburn', 'medium auburn'],
        'eyes': ['turquoise blue', 'hazel', 'golden', 'green', 'brown-green', 'brown', 'dark hazel', 'olive green', 'amber', 'golden brown'],
        'skin': ['alabaster', 'light warm beige', 'warm beige', 'café au lait', 'russet']
    },
    'VIVID AUTUMN': {
        'hair': ['dark chestnut', 'dark auburn', 'espresso', 'deep brown', 'black'],
        'eyes': ['brown', 'brown-green', 'dark brown', 'dark hazel', 'dark green', 'black'],
        'skin': ['pale warm beige', 'medium warm beige', 'chestnut', 'mahogany']
    },
    'GENTLE SPRING': {
        'hair': ['golden blond', 'light strawberry blond', 'strawberry', 'light blond', 'golden'],
        'eyes': ['blue', 'blue-green', 'light blue', 'light blue-green', 'light green', 'hazel', 'light brown'],
        'skin': ['ivory', 'light warm beige', 'pale']
    },
    'BRIGHT SPRING': {
        'hair': ['golden blond', 'light copper', 'medium golden blonde', 'honey blond', 'golden brown', 'strawberry blond', 'light clear red', 'medium golden brown'],
        'eyes': ['blue', 'green', 'blue-green', 'bright blue', 'warm blue', 'warm green', 'light hazel', 'topaz'],
        'skin': ['ivory', 'light warm beige', 'honey', 'warm beige']
    },
    'VIBRANT SPRING': {
        'hair': ['bright auburn', 'medium copper', 'bright copper', 'medium golden brown', 'auburn', 'golden brown', 'chestnut brown', 'chestnut'],
        'eyes': ['blue-green', 'blue', 'green', 'golden brown', 'bright', 'bright brown', 'bright blue', 'bright brown-green', 'bright green', 'topaz', 'brown'],
        'skin': ['ivory', 'light warm beige', 'medium warm beige', 'medium golden brown']
    },
    'SOFT WINTER': {
        'hair': ['medium-deep cool brown', 'deep cool brown', 'cool brown', 'ashy brown'],
        'eyes': ['blue', 'green', 'gray', 'cool', 'cool blue', 'icy hazel', 'cool brown', 'dark grey', 'dark brown'],
        'skin': ['pale porcelain', 'porcelain', 'pale']
    },
    'BRIGHT WINTER': {
        'hair': ['dark cool brown', 'black', 'cool black', 'deep brown'],
        'eyes': ['brown', 'blue', 'brown-green', 'green', 'gray', 'dark', 'bright brown', 'bright blue', 'bright brown-green', 'bright green', 'cyan', 'emerald green', 'light hazel', 'brown-black'],
        'skin': ['pale beige', 'medium beige', 'light olive', 'medium olive', 'coffee']
    },
    'VIVID WINTER': {
        'hair': ['black', 'dark cool brown', 'cool black', 'jet black'],
        'eyes': ['black-brown', 'brown', 'brown-green', 'dark brown', 'black', 'dark hazel', 'dark olive'],
        'skin': ['medium beige', 'deep olive', 'café noir', 'ebony', 'dark']
    },
    'SOFT SUMMER': {
        'hair': ['pale cool blond', 'medium cool blond', 'cool blond', 'ash blond', 'light ash', 'light ash blond'],
        'eyes': ['blue', 'gray-blue', 'gray-green', 'soft blue',  'light blue', 'light blue-green', 'light grey', 'light azure', 'light green'],
        'skin': ['porcelain', 'light beige', 'pale']
    },
    'DUSTY SUMMER': {
        'hair': ['medium cool blond', 'deep cool blond', 'medium ash blonde', 'light cool brown', 'medium cool brown', 'ash brown', 'medium ash brown'],
        'eyes': ['gray-blue', 'gray-green', 'blue', 'muted', 'azure', 'grey', 'green', 'light grey brown'],
        'skin': ['light beige', 'medium beige', 'almond']
    },
    'VIVID SUMMER': {
        'hair': ['light cool brown', 'deep cool brown', 'medium dark cool brown', 'cool brown', 'medium ash brown'],
        'eyes': ['blue-gray', 'blue-green', 'gray-green', 'cocoa', 'azure', 'light grey', 'light blue', 'light azure', 'light green'],
        'skin': ['medium beige', 'cocoa', 'brown']
    }
}

# Lightness combinations allowed for each colortype (hair, skin, eyes)
COLORTYPE_LIGHTNESS_COMBINATIONS = {
    'VIBRANT SPRING': [
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
    'BRIGHT SPRING': [
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
    ],
    'GENTLE SPRING': [
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
    ],
    'SOFT SUMMER': [
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),

    ],
    'VIVID SUMMER': [
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
    ],
    'DUSTY SUMMER': [
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
    'GENTLE AUTUMN': [
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
    ],
    'FIERY AUTUMN': [
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('LIGHT-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('MEDIUM-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),

    ],
    'VIVID AUTUMN': [
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
    'VIVID WINTER': [
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'DEEP-EYES-COLORS'),
    ],
    'SOFT WINTER': [
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'DEEP-EYES-COLORS'),
    ],
    'BRIGHT WINTER': [
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'LIGHT-SKIN-COLORS', 'DEEP-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'MEDIUM-SKIN-COLORS', 'MEDIUM-EYES-COLORS'),
        ('DEEP-HAIR-COLORS', 'DEEP-SKIN-COLORS', 'LIGHT-EYES-COLORS'),
    ],
}

# Mapping table: (undertone, saturation, contrast) -> colortype
COLORTYPE_MAP = {
    # ============ SOFT SUMMER ============
    ('COOL-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-CONTRAST'): 'SOFT SUMMER',

    # ============ VIVID SUMMER ============
    ('COOL-UNDERTONE', 'BRIGHT-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIVID SUMMER', 
    ('COOL-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'VIVID SUMMER',

    # ============ DUSTY SUMMER ============
    ('COOL-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'DUSTY SUMMER',

    # ============ GENTLE AUTUMN ============
    ('WARM-UNDERTONE', 'MUTED-SATURATION-COLORS', 'LOW-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MUTED-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'GENTLE AUTUMN',
    ('WARM-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'LOW-MEDIUM-CONTRAST'): 'GENTLE AUTUMN',

    # ============ FIERY AUTUMN ============
    ('WARM-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'HIGH-MEDIUM-CONTRAST'): 'FIERY AUTUMN',

    # ============ BRIGHT WINTER ============
    ('COOL-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',
    ('COOL-UNDERTONE', 'MUTED-NEUTRAL-SATURATION-COLORS', 'HIGH-CONTRAST'): 'BRIGHT WINTER',

    # ============ VIBRANT SPRING ============
    ('WARM-UNDERTONE', 'BRIGHT-SATURATION-COLORS', 'HIGH-CONTRAST'): 'VIBRANT SPRING',

}

COLOR_SYNONYMS = {
    # Hair colors
    'black': ['jet black', 'dark', 'ebony', 'raven', 'coal black'],
    'dark brown': ['espresso', 'dark', 'deep brown', 'chocolate', 'dark cool brown', 'dark warm brown'],
    'medium brown': ['brown', 'medium', 'chestnut brown'],
    'light brown': ['light', 'caramel', 'light warm brown'],
    'auburn': ['red', 'copper', 'reddish', 'red-brown', 'mahogany'],
    'blond': ['blonde', 'light', 'fair'],
    'golden blond': ['golden', 'honey', 'warm blond', 'sunny'],
    'ash blond': ['ash', 'cool blond', 'platinum', 'silver'],
    'honey': ['golden', 'warm', 'honey blond'],
    
    # Skin tones
    'porcelain': ['pale', 'fair', 'very light', 'ivory', 'alabaster'],
    'ivory': ['light', 'pale', 'fair', 'cream'],
    'beige': ['light beige', 'medium beige', 'neutral'],
    'warm beige': ['peachy', 'golden beige', 'warm'],
    'cool beige': ['pink beige', 'rosy beige', 'cool'],
    'olive': ['green undertone', 'medium olive', 'light olive'],
    'deep': ['dark', 'rich', 'deep brown'],
    
    # Eye colors
    'blue': ['light blue', 'bright blue', 'azure', 'sky blue'],
    'green': ['jade', 'emerald', 'hazel-green'],
    'brown': ['dark brown', 'light brown', 'amber', 'chestnut'],
    'hazel': ['brown-green', 'golden brown', 'amber'],
    'gray': ['grey', 'gray-blue', 'gray-green', 'silver']
}

def calculate_color_match_score(description: str, keywords: list) -> float:
    '''Calculate how well a color description matches reference keywords (with synonym support)'''
    if not keywords:
        return 0.0
    
    description_lower = description.lower()
    matches = 0
    
    for keyword in keywords:
        keyword_lower = keyword.lower()
        
        # Direct match
        if keyword_lower in description_lower:
            matches += 1
            continue
        
        # Synonym match
        found_synonym = False
        for base_word, synonyms in COLOR_SYNONYMS.items():
            if base_word in keyword_lower:
                # Check if any synonym appears in description
                if any(syn in description_lower for syn in synonyms):
                    matches += 0.8  # Synonym match = 80% score
                    found_synonym = True
                    break
        
        if found_synonym:
            continue
        
        # Partial word match (e.g., "dark" in "dark brown")
        keyword_words = keyword_lower.split()
        if any(word in description_lower for word in keyword_words if len(word) > 3):
            matches += 0.5  # Partial match = 50% score
    
    return matches / len(keywords)

def get_colortype_params(colortype: str) -> list:
    '''Get parameter combinations (undertone, saturation, contrast) for a colortype
    
    Returns: List of tuples with parameter combinations from COLORTYPE_MAP
    '''
    params_list = []
    for (undertone, saturation, contrast), ct in COLORTYPE_MAP.items():
        if ct == colortype:
            params_list.append((undertone, saturation, contrast))
    return params_list

def calculate_param_match_score(analysis_value: str, expected_value: str) -> float:
    '''Check if parameter matches expected value (1.0 if match, 0.0 if not)'''
    return 1.0 if analysis_value == expected_value else 0.0

def match_colortype(analysis: dict) -> tuple:
    '''Match analysis to best colortype using 3-stage filtering
    
    Stage 1: Filter by lightness combinations (hair, skin, eyes)
    Stage 2: Check (undertone, saturation, contrast) parameters
    Stage 3: Final selection by color keyword matching
    
    NEW SCORING:
    Parameters (weight x2):
    - Undertone: 100%
    - Saturation: 50%
    - Contrast: 50%
    
    Colors (weight x1):
    - Hair color: 32%
    - Skin color: 32%
    - Eye color: 36%
    
    Total score = (param_score * 2.0) + (color_score * 1.0)
    
    Returns: (colortype, explanation)
    '''
    undertone = analysis.get('undertone', '')
    hair_lightness = analysis.get('hair_lightness', '')
    skin_lightness = analysis.get('skin_lightness', '')
    eyes_lightness = analysis.get('eyes_lightness', '')
    saturation = analysis.get('saturation', '')
    contrast = analysis.get('contrast', '')
    hair = analysis.get('hair_color', '')
    eyes = analysis.get('eye_color', '')
    skin = analysis.get('skin_color', '')
    
    print(f'[Match] Analyzing: {undertone}/{saturation}/{contrast}')
    print(f'[Match] Lightness: hair={hair_lightness}, skin={skin_lightness}, eyes={eyes_lightness}')
    print(f'[Match] Colors: hair="{hair}", skin="{skin}", eyes="{eyes}"')
    
    # Determine exclusions based on eyes, hair, and skin
    eyes_lower = eyes.lower()
    hair_lower = hair.lower()
    skin_lower = skin.lower()
    excluded_types = set()
    
    # Rule 1: Brown eyes → exclude GENTLE AUTUMN, GENTLE SPRING, BRIGHT SPRING (NOT VIBRANT SPRING - it can have brown eyes), all SUMMER, and SOFT WINTER
    if any(keyword in eyes_lower for keyword in ['black-brown', 'brown', 'brown-green', 'dark brown', 'deep brown', 'chestnut', 'chocolate', 'amber']):
        excluded_types.update(['GENTLE AUTUMN', 'GENTLE SPRING', 'BRIGHT SPRING', 'SOFT SUMMER', 'DUSTY SUMMER', 'VIVID SUMMER', 'SOFT WINTER'])
        print(f'[Match] Brown eyes detected → excluding GENTLE AUTUMN, GENTLE SPRING, BRIGHT SPRING (keeping VIBRANT SPRING), all SUMMER, and SOFT WINTER')
    
    # Rule 2: Cool light eyes → exclude VIVID AUTUMN and VIVID WINTER
    if any(keyword in eyes_lower for keyword in ['blue', 'gray', 'grey', 'gray-green', 'gray-blue', 'grey-green', 'grey-blue', 'blue-gray', 'blue-grey']):
        excluded_types.update(['VIVID AUTUMN', 'VIVID WINTER'])
        print(f'[Match] Cool light eyes detected → excluding VIVID AUTUMN and VIVID WINTER')
    
    # Rule 3: Chestnut brown hair → exclude BRIGHT SPRING
    if any(keyword in hair_lower for keyword in ['chestnut brown', 'chestnut', 'medium brown', 'warm brown']):
        excluded_types.add('BRIGHT SPRING')
        print(f'[Match] Chestnut brown hair detected → excluding BRIGHT SPRING')
    
    # Rule 4: Light skin + blue/grey-blue eyes → exclude GENTLE AUTUMN
    light_skin = any(keyword in skin_lower for keyword in ['light', 'pale', 'ivory', 'porcelain', 'fair', 'alabaster'])
    cool_eyes = any(keyword in eyes_lower for keyword in ['blue', 'gray-blue', 'grey-blue', 'blue-gray', 'blue-grey'])
    if light_skin and cool_eyes:
        excluded_types.add('GENTLE AUTUMN')
        print(f'[Match] Light skin + cool blue eyes detected → excluding GENTLE AUTUMN')
    
    # Rule 5: Golden blonde or blonde hair → exclude FIERY AUTUMN and VIVID AUTUMN
    if any(keyword in hair_lower for keyword in ['golden blond', 'golden blonde', 'blonde', 'blond', 'light blond', 'light blonde', 'honey blond', 'honey blonde']):
        excluded_types.update(['FIERY AUTUMN', 'VIVID AUTUMN'])
        print(f'[Match] Golden blonde/blonde hair detected → excluding FIERY AUTUMN and VIVID AUTUMN')
    
    # Rule 6: Copper hair (medium-dark warm reddish) → exclude GENTLE SPRING
    # Exception: LIGHT COPPER (pale golden-reddish blonde) CAN be gentle spring
    if any(keyword in hair_lower for keyword in ['copper', 'auburn', 'red']):
        # Check if it's LIGHT copper (should contain "light" or "pale" or "golden blonde")
        is_light_copper = any(light_keyword in hair_lower for light_keyword in ['light copper', 'pale copper', 'light golden', 'pale golden', 'golden blonde', 'strawberry blonde', 'strawberry blond'])
        if not is_light_copper:
            excluded_types.add('GENTLE SPRING')
            print(f'[Match] Copper/auburn/red hair (NOT light) detected → excluding GENTLE SPRING')
    
    # Rule 7: Gray/grey eyes → exclude VIBRANT SPRING (gray eyes = VIVID SUMMER or SOFT WINTER characteristic)
    if any(keyword in eyes_lower for keyword in ['gray', 'grey', 'gray-blue', 'grey-blue', 'gray-green', 'grey-green']):
        excluded_types.add('VIBRANT SPRING')
        print(f'[Match] Gray eyes detected → excluding VIBRANT SPRING (gray = VIVID SUMMER or SOFT WINTER)')
    
    # Rule 8: Bright blue/bright green eyes → exclude VIVID SUMMER (bright eyes = VIBRANT SPRING or BRIGHT WINTER)
    if any(keyword in eyes_lower for keyword in ['bright blue', 'bright green', 'bright blue-green', 'яркий']):
        excluded_types.add('VIVID SUMMER')
        print(f'[Match] Bright colored eyes detected → excluding VIVID SUMMER (bright eyes = VIBRANT SPRING or BRIGHT WINTER)')
    
    # Rule 9: Light blue/light green/light turquoise eyes → ONLY SOFT SUMMER or GENTLE SPRING (exclude all others)
    if any(keyword in eyes_lower for keyword in ['light blue', 'light green', 'light turquoise', 'светло-голубые', 'светло-зелёные', 'светло-лазурные']):
        # Keep only SOFT SUMMER and GENTLE SPRING
        all_types = {'VIBRANT SPRING', 'BRIGHT SPRING', 'VIVID SUMMER', 'DUSTY SUMMER', 'GENTLE AUTUMN', 'FIERY AUTUMN', 'VIVID AUTUMN', 'SOFT WINTER', 'BRIGHT WINTER', 'VIVID WINTER'}
        excluded_types.update(all_types)
        print(f'[Match] Light colored eyes detected → ONLY SOFT SUMMER or GENTLE SPRING allowed')
    
    # Rule 10: Bright eyes (bright blue, bright green, bright blue-green, bright brown) → ONLY VIBRANT SPRING or BRIGHT WINTER
    # This is more specific than Rule 8, so check last
    if any(keyword in eyes_lower for keyword in ['bright blue', 'bright green', 'bright blue-green', 'bright brown', 'яркие', 'ярко-голубые', 'ярко-зелёные', 'ярко-сине-зелёные', 'ярко-карие']):
        # Keep only VIBRANT SPRING and BRIGHT WINTER
        all_types = {'GENTLE SPRING', 'BRIGHT SPRING', 'SOFT SUMMER', 'DUSTY SUMMER', 'VIVID SUMMER', 'GENTLE AUTUMN', 'FIERY AUTUMN', 'VIVID AUTUMN', 'SOFT WINTER', 'VIVID WINTER'}
        excluded_types.update(all_types)
        print(f'[Match] Bright eyes detected → ONLY VIBRANT SPRING or BRIGHT WINTER allowed')
    
    # Rule 11: Dark/deep brown hair + bright eyes → BRIGHT WINTER (NOT VIBRANT SPRING, NOT SOFT WINTER)
    has_dark_hair = any(keyword in hair_lower for keyword in ['dark brown', 'deep brown', 'black', 'espresso', 'dark chestnut', 'dark cool brown'])
    has_bright_blue_eyes = any(keyword in eyes_lower for keyword in ['bright blue', 'bright gray-blue', 'bright grey-blue', 'ярко-голубые', 'яркие серо-голубые'])
    if has_dark_hair and has_bright_blue_eyes:
        excluded_types.update(['VIBRANT SPRING', 'SOFT WINTER'])
        print(f'[Match] Dark/deep brown hair + bright eyes → BRIGHT WINTER (excluding VIBRANT SPRING, SOFT WINTER)')
    
    # Rule 12: Dark/deep brown hair + soft/muted gray eyes → SOFT WINTER or VIVID SUMMER (NOT BRIGHT WINTER)
    # FIXED: VIVID SUMMER can also have dark hair + soft gray eyes at LOW-MEDIUM contrast!
    has_soft_gray_eyes = any(keyword in eyes_lower for keyword in ['soft gray', 'soft gray-blue', 'soft grey-blue', 'soft gray-green', 'мягкие серо-голубые', 'мягкие серые'])
    if has_dark_hair and has_soft_gray_eyes:
        excluded_types.add('BRIGHT WINTER')
        print(f'[Match] Dark/deep brown hair + soft/muted gray eyes → SOFT WINTER or VIVID SUMMER (excluding BRIGHT WINTER only)')
    
    # Rule 13: Dark brown hair + warm undertone + brown eyes → VIVID AUTUMN (NOT VIBRANT SPRING, NOT GENTLE AUTUMN, NOT FIERY AUTUMN)
    has_dark_brown_hair = any(keyword in hair_lower for keyword in ['dark brown', 'deep brown', 'dark chestnut', 'espresso', 'black'])
    has_brown_eyes = any(keyword in eyes_lower for keyword in ['brown', 'dark brown', 'deep brown', 'chestnut', 'chocolate'])
    is_warm_undertone = undertone == 'WARM-UNDERTONE'
    if has_dark_brown_hair and is_warm_undertone and has_brown_eyes:
        excluded_types.update(['VIBRANT SPRING', 'GENTLE AUTUMN', 'FIERY AUTUMN'])
        print(f'[Match] Dark brown hair + warm undertone + brown eyes → VIVID AUTUMN (excluding VIBRANT SPRING, GENTLE AUTUMN, FIERY AUTUMN)')
    
    # Rule 14: BRIGHT WINTER, DEEP WINTER, VIVID AUTUMN → ONLY dark hair allowed (validation)
    has_light_hair = any(keyword in hair_lower for keyword in ['light brown', 'light', 'blonde', 'blond', 'golden blond', 'ash blond', 'honey', 'caramel', 'strawberry'])
    dark_types_requiring_dark_hair = {'BRIGHT WINTER', 'DEEP WINTER', 'VIVID AUTUMN'}
    if has_light_hair:
        excluded_types.update(dark_types_requiring_dark_hair)
        print(f'[Match] Light hair detected → excluding {dark_types_requiring_dark_hair} (these types require dark hair ONLY)')
    
    # Rule 15: Brown hair (any shade) OR auburn hair + brown eyes → exclude VIBRANT SPRING (this is VIVID AUTUMN characteristic)
    # VIBRANT SPRING: bright eyes (blue/green/hazel), NOT brown eyes
    has_any_brown_or_auburn_hair = any(keyword in hair_lower for keyword in ['brown', 'chestnut', 'auburn', 'espresso', 'chocolate', 'dark', 'medium brown', 'light brown', 'golden brown', 'warm brown', 'copper', 'red'])
    if has_any_brown_or_auburn_hair and has_brown_eyes:
        excluded_types.add('VIBRANT SPRING')
        print(f'[Match] Brown/auburn hair + brown eyes → excluding VIBRANT SPRING (characteristic of VIVID AUTUMN)')
    
    # Rule 16: Brown hair (any shade) → exclude GENTLE SPRING (GENTLE SPRING requires ONLY blonde hair)
    has_any_brown_hair = any(keyword in hair_lower for keyword in ['brown', 'chestnut', 'espresso', 'chocolate', 'dark', 'medium brown', 'light brown', 'golden brown', 'warm brown'])
    if has_any_brown_hair:
        excluded_types.add('GENTLE SPRING')
        print(f'[Match] Brown hair detected → excluding GENTLE SPRING (requires blonde hair ONLY)')
    
    # Rule 17: Medium ash brown hair → exclude SOFT SUMMER (SOFT SUMMER requires light/blonde hair)
    has_medium_ash_brown = any(keyword in hair_lower for keyword in ['medium ash brown', 'medium cool brown', 'ash brown'])
    if has_medium_ash_brown:
        excluded_types.add('SOFT SUMMER')
        print(f'[Match] Medium ash brown hair detected → excluding SOFT SUMMER (requires light/blonde hair)')
    
    # Rule 18: Blonde hair (any shade) → exclude VIVID SUMMER (VIVID SUMMER requires medium/dark hair)
    has_blonde_hair = any(keyword in hair_lower for keyword in ['blonde', 'blond', 'golden blond', 'golden blonde', 'ash blond', 'ash blonde', 'light blond', 'light blonde', 'honey blond', 'honey blonde', 'platinum', 'strawberry blond', 'strawberry blonde'])
    if has_blonde_hair:
        excluded_types.add('VIVID SUMMER')
        print(f'[Match] Blonde hair detected → excluding VIVID SUMMER (requires medium/dark hair)')
    
    # Rule 19: Medium golden brown hair OR brown hair → exclude BRIGHT SPRING
    has_medium_golden_brown_or_brown = any(keyword in hair_lower for keyword in ['medium golden brown', 'brown hair', 'brown', 'golden brown'])
    if has_medium_golden_brown_or_brown:
        excluded_types.add('BRIGHT SPRING')
        print(f'[Match] Medium golden brown/brown hair detected → excluding BRIGHT SPRING')
    
    # Rule 20: Any brown hair (except ash brown) → exclude SOFT SUMMER (SOFT SUMMER requires light/blonde hair ONLY)
    has_any_brown_except_ash = any(keyword in hair_lower for keyword in ['medium brown', 'dark brown', 'light brown', 'golden brown', 'warm brown', 'medium golden brown', 'chestnut'])
    has_ash_qualifier = any(keyword in hair_lower for keyword in ['ash brown', 'cool brown', 'ash'])
    if has_any_brown_except_ash and not has_ash_qualifier:
        excluded_types.add('SOFT SUMMER')
        print(f'[Match] Brown hair (non-ash) detected → excluding SOFT SUMMER (requires light/blonde hair ONLY)')
    
    if excluded_types:
        print(f'[Match] Excluded types: {excluded_types}')
    
    # ============ STAGE 1: Prepare lightness scoring (NO FILTERING) ============
    lightness_key = (hair_lightness, skin_lightness, eyes_lightness)
    print(f'[Match] STAGE 1: Lightness combination ({lightness_key}) - will be used for SCORING, not filtering')
    
    # Start with all colortypes (except excluded by rules)
    stage1_candidates = [ct for ct in COLORTYPE_REFERENCES.keys() if ct not in excluded_types]
    print(f'[Match] After exclusion rules: {len(stage1_candidates)} candidates: {stage1_candidates}')
    
    if not stage1_candidates:
        print(f'[Match] WARNING: All candidates excluded! Using fallback')
        stage1_candidates = list(COLORTYPE_REFERENCES.keys())
    
    # ============ STAGE 2: Check (undertone, saturation, contrast) ============
    param_key = (undertone, saturation, contrast)
    ambiguous_candidates = AMBIGUOUS_COMBINATIONS.get(param_key)
    
    if ambiguous_candidates:
        # Intersect with stage1 candidates
        stage2_candidates = [ct for ct in ambiguous_candidates if ct in stage1_candidates]
        print(f'[Match] STAGE 2: AMBIGUOUS params ({param_key}) → {ambiguous_candidates}')
        print(f'[Match] After stage1 filter: {stage2_candidates}')
        
        if not stage2_candidates:
            print(f'[Match] No intersection with stage1! Using stage1 candidates')
            stage2_candidates = stage1_candidates
    else:
        # Check COLORTYPE_MAP for matching colortypes
        matching_colortypes = []
        for (u, s, c), ct in COLORTYPE_MAP.items():
            if (u, s, c) == param_key and ct in stage1_candidates:
                matching_colortypes.append(ct)
        
        if matching_colortypes:
            stage2_candidates = matching_colortypes
            print(f'[Match] STAGE 2: Exact params match → {stage2_candidates}')
        else:
            # No exact match - score all stage1 candidates by parameter closeness
            print(f'[Match] STAGE 2: No exact match. Scoring all stage1 candidates')
            stage2_candidates = stage1_candidates
    
    # ============ STAGE 3: Final selection by color keyword matching ============
    print(f'[Match] STAGE 3: Scoring {len(stage2_candidates)} candidates by color matching + params')
    
    # Check if current param_key is ambiguous (multiple colortypes share same parameters)
    is_ambiguous_combination = param_key in AMBIGUOUS_COMBINATIONS
    if is_ambiguous_combination:
        print(f'[Match] AMBIGUOUS combination detected → all candidates will get param_match=1.0')
    
    # Detect characteristic features
    has_auburn_hair = any(keyword in hair_lower for keyword in ['auburn', 'copper', 'red', 'bright auburn', 'ginger'])
    has_gray_eyes = any(keyword in eyes_lower for keyword in ['gray', 'grey', 'gray-blue', 'grey-blue', 'gray-green', 'grey-green'])
    has_green_eyes = any(keyword in eyes_lower for keyword in ['green', 'jade', 'emerald', 'olive-green', 'olive green'])
    has_dark_hair = any(keyword in hair_lower for keyword in ['dark brown', 'deep brown', 'black', 'espresso', 'dark chestnut', 'dark cool brown'])
    has_brown_eyes = any(keyword in eyes_lower for keyword in ['brown', 'dark brown', 'deep brown', 'chestnut', 'chocolate'])
    
    # Distinguish BRIGHT eyes (яркие) from SOFT/MUTED eyes (мягкие)
    has_bright_eyes = any(keyword in eyes_lower for keyword in ['bright blue', 'bright gray-blue', 'bright grey-blue', 'bright green', 'bright blue-green', 'bright brown', 'ярко-голубые', 'яркие серо-голубые', 'яркие синие', 'ярко-карие'])
    has_bright_eyes_keyword = has_bright_eyes  # Alias for consistency
    has_soft_muted_eyes = any(keyword in eyes_lower for keyword in ['soft gray', 'soft gray-blue', 'soft grey-blue', 'soft gray-green', 'soft grey-green', 'мягкие серо-голубые', 'мягкие серые', 'мягкие серо-зелёные'])
    
    is_warm_undertone = undertone == 'WARM-UNDERTONE'
    is_cool_undertone = undertone == 'COOL-UNDERTONE'
    
    print(f'[Match] Auburn/red hair: {has_auburn_hair}, Gray eyes: {has_gray_eyes}, Green eyes: {has_green_eyes}, Dark hair: {has_dark_hair}, Bright eyes: {has_bright_eyes}, Soft/muted eyes: {has_soft_muted_eyes}, Warm undertone: {is_warm_undertone}')
    
    best_colortype = None
    best_total_score = 0.0
    best_param_score = 0.0
    best_color_score = 0.0
    
    for colortype in stage2_candidates:
        # Calculate parameter match score (undertone, saturation, contrast)
        param_match = 0.0
        undertone_match = 0.0
        saturation_match = 0.0
        contrast_match = 0.0
        
        # ⚠️ CRITICAL FIX: If param_key is in AMBIGUOUS_COMBINATIONS, ALL candidates get param_match=1.0
        # This ensures ambiguous combinations give equal parameter scores, and winner is determined by colors+bonuses
        if is_ambiguous_combination and ambiguous_candidates and colortype in ambiguous_candidates:
            # Ambiguous combination → all candidates get equal parameter score
            undertone_match = 1.0
            saturation_match = 1.0
            contrast_match = 1.0
            param_match = 1.0
            print(f'[Match] {colortype}: AMBIGUOUS → param_match=1.0 (equal for all candidates)')
        else:
            # Normal logic: check COLORTYPE_MAP for exact or closest match
            params_list = get_colortype_params(colortype)
            
            if param_key in params_list:
                # Exact match
                undertone_match = 1.0
                saturation_match = 1.0
                contrast_match = 1.0
                param_match = 1.0
            else:
                # Find closest match
                for (u, s, c) in params_list:
                    u_match = 1.0 if u == undertone else 0.0
                    s_match = 1.0 if s == saturation else 0.0
                    c_match = 1.0 if c == contrast else 0.0
                    
                    candidate_score = ((u_match * 0.68) + (s_match * 0.46) + (c_match * 0.36)) / 1.5
                    
                    if candidate_score > param_match:
                        param_match = candidate_score
                        undertone_match = u_match
                        saturation_match = s_match
                        contrast_match = c_match
        
        # Calculate color match score with DYNAMIC WEIGHTS based on undertone
        ref = COLORTYPE_REFERENCES[colortype]
        hair_score = calculate_color_match_score(hair, ref['hair'])
        skin_score = calculate_color_match_score(skin, ref['skin'])
        eyes_score = calculate_color_match_score(eyes, ref['eyes'])
        
        # UPDATED WEIGHTS: For WARM undertone, hair is MORE important
        if is_warm_undertone:
            # Warm types: hair 45%, skin 25%, eyes 30%
            hair_weight = 0.45
            skin_weight = 0.25
            eyes_weight = 0.30
        else:
            # Cool types: hair 45%, skin 25%, eyes 30%
            hair_weight = 0.45
            skin_weight = 0.25
            eyes_weight = 0.30
        
        color_score = (hair_score * hair_weight) + (skin_score * skin_weight) + (eyes_score * eyes_weight)
        
        # BONUS: Lightness combination match → +0.30 if (hair, skin, eyes) lightness matches colortype's allowed combinations
        if colortype in COLORTYPE_LIGHTNESS_COMBINATIONS:
            if lightness_key in COLORTYPE_LIGHTNESS_COMBINATIONS[colortype]:
                color_score += 0.30
                print(f'[Match] {colortype}: BONUS +0.30 for lightness combination match {lightness_key}')
        
        # BONUS: Auburn/copper/red hair → +0.15 for VIBRANT SPRING
        if has_auburn_hair and colortype == 'VIBRANT SPRING':
            color_score += 0.15
            print(f'[Match] {colortype}: BONUS +0.15 for auburn hair (characteristic color)')
        
        # BONUS: Auburn/copper/red hair → +0.15 for BRIGHT SPRING
        if has_auburn_hair and colortype == 'BRIGHT SPRING':
            color_score += 0.15
            print(f'[Match] {colortype}: BONUS +0.15 for auburn/copper hair (characteristic color)')
        
        # BONUS: Auburn/copper/red hair + brown eyes → +1.00 for FIERY AUTUMN (signature combination)
        if has_auburn_hair and has_brown_eyes and colortype == 'FIERY AUTUMN':
            color_score += 1.00
            print(f'[Match] {colortype}: BONUS +1.00 for auburn hair + brown eyes (signature FIERY AUTUMN)')
        
        # BONUS: Dark hair + BRIGHT eyes → +0.25 for BRIGHT WINTER (signature combination)
        if has_dark_hair and has_bright_eyes and colortype == 'BRIGHT WINTER':
            color_score += 0.25
            print(f'[Match] {colortype}: BONUS +0.25 for dark hair + bright eyes (signature BRIGHT WINTER)')
        
        # BONUS: Dark hair + SOFT/MUTED gray eyes → +0.25 for SOFT WINTER (signature combination)
        if has_dark_hair and has_soft_muted_eyes and colortype == 'SOFT WINTER':
            color_score += 0.25
            print(f'[Match] {colortype}: BONUS +0.25 for dark hair + soft/muted gray eyes (signature SOFT WINTER)')
        
        # BONUS: Dark hair + ANY gray eyes + HIGH-CONTRAST → +0.20 for SOFT WINTER (characteristic combination)
        # This covers cases where GPT doesn't specify "soft" in gray eyes description
        if has_dark_hair and has_gray_eyes and contrast == 'HIGH-CONTRAST' and colortype == 'SOFT WINTER' and not has_soft_muted_eyes:
            color_score += 0.20
            print(f'[Match] {colortype}: BONUS +0.20 for dark hair + gray eyes + HIGH-CONTRAST (characteristic SOFT WINTER)')
        
        # BONUS: Gray eyes → +0.15 for SOFT WINTER, VIVID SUMMER, DUSTY SUMMER (if not already applied above)
        if has_gray_eyes and colortype == 'SOFT WINTER' and not has_soft_muted_eyes and contrast != 'HIGH-CONTRAST':
            color_score += 0.15
            print(f'[Match] {colortype}: BONUS +0.15 for gray eyes (characteristic color)')
        
        if has_gray_eyes and colortype == 'VIVID SUMMER':
            color_score += 0.15
            print(f'[Match] {colortype}: BONUS +0.15 for gray eyes (characteristic color)')
        
        if has_gray_eyes and colortype == 'DUSTY SUMMER':
            color_score += 0.15
            print(f'[Match] {colortype}: BONUS +0.15 for gray eyes (characteristic color)')
        
        # BONUS: Green eyes → +0.15 for WARM undertone types (Spring/Autumn)
        if has_green_eyes and is_warm_undertone and colortype in ['GENTLE SPRING', 'BRIGHT SPRING', 'VIBRANT SPRING', 'GENTLE AUTUMN', 'FIERY AUTUMN', 'VIVID AUTUMN']:
            color_score += 0.15
            print(f'[Match] {colortype}: BONUS +0.15 for green eyes (more often warm undertone)')
        
        # BONUS: Gray eyes → +0.15 for COOL undertone types (Winter/Summer) - general bonus
        if has_gray_eyes and is_cool_undertone and colortype in ['SOFT WINTER', 'BRIGHT WINTER', 'VIVID WINTER', 'SOFT SUMMER', 'DUSTY SUMMER', 'VIVID SUMMER']:
            # Only apply if not already applied above (SOFT WINTER, VIVID SUMMER, DUSTY SUMMER)
            if colortype not in ['SOFT WINTER', 'VIVID SUMMER', 'DUSTY SUMMER']:
                color_score += 0.15
                print(f'[Match] {colortype}: BONUS +0.15 for gray eyes (more often cool undertone)')
        
        # BONUS: Light ash blonde hair → +0.20 for SOFT SUMMER (signature hair color)
        has_light_ash_blonde = any(keyword in hair_lower for keyword in ['light ash blonde', 'light ash blond', 'pale ash blonde', 'pale ash blond', 'ash blonde', 'ash blond', 'platinum'])
        if has_light_ash_blonde and colortype == 'SOFT SUMMER':
            color_score += 0.20
            print(f'[Match] {colortype}: BONUS +0.20 for light ash blonde hair (signature SOFT SUMMER)')
        
        # BONUS: Ash blond hair (any ash blonde shade) → +0.15 for SOFT SUMMER (characteristic hair color)
        has_ash_blond = any(keyword in hair_lower for keyword in ['ash blond', 'ash blonde'])
        if has_ash_blond and colortype == 'SOFT SUMMER' and not has_light_ash_blonde:
            color_score += 0.15
            print(f'[Match] {colortype}: BONUS +0.15 for ash blond hair (characteristic SOFT SUMMER)')
        
        # BONUS: Light ash blond hair → +0.30 for SOFT SUMMER (signature hair color)
        has_light_ash_blond_hair = any(keyword in hair_lower for keyword in ['light ash blond', 'light ash blonde'])
        if has_light_ash_blond_hair and colortype == 'SOFT SUMMER':
            color_score += 0.30
            print(f'[Match] {colortype}: BONUS +0.30 for light ash blond hair (signature SOFT SUMMER)')
        
        # BONUS: Medium ash blonde hair → +0.25 for DUSTY SUMMER (signature hair color)
        has_medium_ash_blonde_hair = any(keyword in hair_lower for keyword in ['medium ash blonde', 'medium ash blond'])
        if has_medium_ash_blonde_hair and colortype == 'DUSTY SUMMER':
            color_score += 0.25
            print(f'[Match] {colortype}: BONUS +0.25 for medium ash blonde hair (signature DUSTY SUMMER)')
        
        # BONUS: Medium ash brown hair → +0.25 for DUSTY SUMMER and VIVID SUMMER (signature hair color)
        has_medium_ash_brown_hair = any(keyword in hair_lower for keyword in ['medium ash brown', 'medium cool brown', 'ash brown', 'cool brown'])
        if has_medium_ash_brown_hair and colortype == 'DUSTY SUMMER':
            color_score += 0.25
            print(f'[Match] {colortype}: BONUS +0.25 for medium ash brown hair (signature DUSTY SUMMER)')
        
        if has_medium_ash_brown_hair and colortype == 'VIVID SUMMER':
            color_score += 0.25
            print(f'[Match] {colortype}: BONUS +0.25 for medium ash brown hair (signature VIVID SUMMER)')
        
        # BONUS: Medium golden brown hair + golden brown/brown eyes → +0.25 for FIERY AUTUMN (characteristic combination)
        has_medium_golden_brown_hair = any(keyword in hair_lower for keyword in ['medium golden brown', 'golden brown'])
        has_golden_brown_eyes = any(keyword in eyes_lower for keyword in ['golden brown', 'brown', 'dark brown', 'light brown'])
        if has_medium_golden_brown_hair and has_golden_brown_eyes and colortype == 'FIERY AUTUMN':
            color_score += 0.25
            print(f'[Match] {colortype}: BONUS +0.25 for medium golden brown hair + golden brown/brown eyes (characteristic FIERY AUTUMN)')
        
        # PENALTY: Dark brown hair → -0.30 for DUSTY SUMMER and VIVID SUMMER (require light/medium hair)
        has_dark_brown_hair_color = any(keyword in hair_lower for keyword in ['dark brown', 'deep brown', 'dark cool brown', 'dark ash brown'])
        if has_dark_brown_hair_color and colortype in ['DUSTY SUMMER', 'VIVID SUMMER']:
            color_score -= 0.30
            print(f'[Match] {colortype}: PENALTY -0.30 for dark brown hair ({colortype} requires light/medium hair only)')
        
        # PENALTY: Non-bright eyes → -0.25 for VIBRANT SPRING (BUT light blue/light green/blue/green ARE acceptable!)
        has_acceptable_light_eyes = any(keyword in eyes_lower for keyword in ['light blue', 'light green', 'light turquoise', 'blue-green', 'blue', 'green', 'hazel'])
        if not has_bright_eyes_keyword and not has_acceptable_light_eyes and colortype == 'VIBRANT SPRING':
            color_score -= 0.25
            print(f'[Match] {colortype}: PENALTY -0.25 for non-bright eyes (VIBRANT SPRING prefers bright eyes)')
        
        # PENALTY: Medium brown hair → -0.30 for BRIGHT WINTER (requires dark/deep hair only)
        has_medium_brown_hair = any(keyword in hair_lower for keyword in ['medium brown', 'medium ash brown', 'medium cool brown', 'medium warm brown'])
        if has_medium_brown_hair and colortype == 'BRIGHT WINTER':
            color_score -= 0.30
            print(f'[Match] {colortype}: PENALTY -0.30 for medium brown hair (BRIGHT WINTER requires dark/deep hair only)')
        
        # PENALTY: Medium brown hair → -0.20 for SOFT WINTER (requires dark/deep hair only)
        if has_medium_brown_hair and colortype == 'SOFT WINTER':
            color_score -= 0.20
            print(f'[Match] {colortype}: PENALTY -0.20 for medium brown hair (SOFT WINTER requires dark/deep hair only)')
        
        # BONUS: Black-brown eyes → +0.15 for VIVID WINTER (characteristic eye color)
        has_black_brown_eyes = any(keyword in eyes_lower for keyword in ['black-brown', 'black brown', 'very dark brown', 'blackish brown'])
        if has_black_brown_eyes and colortype == 'VIVID WINTER':
            color_score += 0.15
            print(f'[Match] {colortype}: BONUS +0.15 for black-brown eyes (characteristic VIVID WINTER)')
        
        # PENALTY: Dark brown hair → -0.30 for DUSTY SUMMER (requires light/medium hair, NOT dark)
        has_dark_brown_hair_color = any(keyword in hair_lower for keyword in ['dark brown', 'deep brown', 'dark cool brown', 'dark ash brown'])
        if has_dark_brown_hair_color and colortype == 'DUSTY SUMMER':
            color_score -= 0.30
            print(f'[Match] {colortype}: PENALTY -0.30 for dark brown hair (DUSTY SUMMER requires light/medium hair only)')
        
        # Total score: 1.5x parameters + 1x colors
        total_score = (param_match * 1.5) + (color_score * 1.0)
        
        print(f'[Match] {colortype}: param={param_match:.2f} (U:{undertone_match:.0f} S:{saturation_match:.0f} C:{contrast_match:.0f}), color={color_score:.2f} (h:{hair_score:.2f}*{hair_weight:.2f} s:{skin_score:.2f}*{skin_weight:.2f} e:{eyes_score:.2f}*{eyes_weight:.2f}), total={total_score:.2f}')
        
        if total_score > best_total_score:
            best_total_score = total_score
            best_colortype = colortype
            best_param_score = param_match
            best_color_score = color_score
    
    # FALLBACK: If no colortype found, use color-only scoring
    if best_colortype is None:
        print(f'[Match] FALLBACK: No candidates! Scoring all colortypes by color only...')
        
        for colortype in COLORTYPE_REFERENCES.keys():
            ref = COLORTYPE_REFERENCES[colortype]
            hair_score = calculate_color_match_score(hair, ref['hair'])
            skin_score = calculate_color_match_score(skin, ref['skin'])
            eyes_score = calculate_color_match_score(eyes, ref['eyes'])
            
            color_score = (hair_score * 0.32) + (skin_score * 0.32) + (eyes_score * 0.36)
            
            print(f'[Match] {colortype}: color={color_score:.2f} (h:{hair_score:.2f} s:{skin_score:.2f} e:{eyes_score:.2f})')
            
            if color_score > best_color_score:
                best_color_score = color_score
                best_colortype = colortype
                best_total_score = color_score
        
        if best_colortype:
            explanation = format_result(best_colortype, hair, skin, eyes, undertone, saturation, contrast, 'fallback2')
            print(f'[Match] FALLBACK SUCCESS: {best_colortype} with color_score {best_color_score:.2f}')
            return best_colortype, explanation
    
    explanation = format_result(best_colortype, hair, skin, eyes, undertone, saturation, contrast, 'standard')
    
    print(f'[Match] FINAL: {best_colortype} with score {best_total_score:.2f}')
    
    return best_colortype, explanation

def extract_color_type(result_text: str) -> str:
    '''Extract color type name from result text (fallback for old format)'''
    color_types = [
        'SOFT WINTER', 'BRIGHT WINTER', 'VIVID WINTER',
        'SOFT SUMMER', 'DUSTY SUMMER', 'VIVID SUMMER',
        'GENTLE AUTUMN', 'FIERY AUTUMN', 'VIVID AUTUMN',
        'GENTLE SPRING', 'BRIGHT SPRING', 'VIBRANT SPRING'
    ]
    
    result_upper = result_text.upper()
    for color_type in color_types:
        if color_type in result_upper:
            return color_type
    
    return None

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Проверка статуса анализа цветотипа с опциональной принудительной проверкой
    Args: event - dict с httpMethod, queryStringParameters (task_id, force_check)
          context - object с атрибутом request_id
    Returns: HTTP response со статусом задачи и результатом если готово
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
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    params = event.get('queryStringParameters', {}) or {}
    print(f'[ColorType-Status] Query params: {params}')
    task_id = params.get('task_id')
    force_check = params.get('force_check') == 'true'
    print(f'[ColorType-Status] task_id={task_id}, force_check={force_check}')
    
    if not task_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'task_id is required'})
        }
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT status, result_text, color_type, replicate_prediction_id, color_type_ai
            FROM color_type_history
            WHERE id = %s
        ''', (task_id,))
        
        row = cursor.fetchone()
        
        if not row:
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Task not found'})
            }
        
        status, result_text, color_type, replicate_prediction_id, color_type_ai = row
        
        # Direct API check (no worker trigger, like nanobananapro-async-status)
        if force_check and status == 'processing' and replicate_prediction_id:
            print(f'[ColorType-Status] Force checking task {task_id} on Replicate')
            try:
                replicate_data = check_replicate_status(replicate_prediction_id)
                replicate_status = replicate_data.get('status', 'unknown')
                
                print(f'[ColorType-Status] Replicate status: {replicate_status}')
                
                if replicate_status == 'succeeded':
                    output = replicate_data.get('output', '')
                    
                    # Extract text from output (LLaVA returns list of strings)
                    if isinstance(output, list) and len(output) > 0:
                        result_text_value = ''.join(output) if all(isinstance(x, str) for x in output) else str(output)
                    elif isinstance(output, str):
                        result_text_value = output
                    elif isinstance(output, dict):
                        result_text_value = output.get('text', str(output))
                    else:
                        result_text_value = str(output)
                    
                    if result_text_value:
                        print(f'[ColorType-Status] Raw result: {result_text_value[:200]}...')
                        
                        # Try to parse JSON from AI response
                        extracted_color_type = None
                        explanation = result_text_value
                        
                        try:
                            json_str = result_text_value
                            if '```json' in result_text_value:
                                json_str = result_text_value.split('```json')[1].split('```')[0].strip()
                            elif '```' in result_text_value:
                                json_str = result_text_value.split('```')[1].split('```')[0].strip()
                            
                            # Fix escaped underscores from LLaVA
                            # Handle both \_ and \\\_
                            json_str = json_str.replace('\\\\_', '_')  # Double-escaped
                            json_str = json_str.replace('\\_', '_')      # Single-escaped
                            
                            print(f'[ColorType-Status] Cleaned JSON: {json_str[:300]}...')
                            
                            analysis = json.loads(json_str)
                            print(f'[ColorType-Status] Parsed analysis: {analysis}')
                            
                            extracted_color_type, explanation = match_colortype(analysis)
                            
                            print(f'[ColorType-Status] Matched to: {extracted_color_type}')
                            print(f'[ColorType-Status] Explanation: {explanation}')
                            
                        except (json.JSONDecodeError, KeyError, TypeError) as e:
                            print(f'[ColorType-Status] Failed to parse JSON: {e}')
                            print(f'[ColorType-Status] Falling back to text extraction')
                            extracted_color_type = extract_color_type(result_text_value)
                            explanation = result_text_value
                        
                        print(f'[ColorType-Status] Task completed! Color type: {extracted_color_type}')
                        print(f'[ColorType-Status] Result preview: {explanation[:100]}...')
                        
                        cursor.execute('''
                            UPDATE color_type_history
                            SET status = 'completed', result_text = %s, color_type = %s, updated_at = %s
                            WHERE id = %s
                        ''', (explanation, extracted_color_type, datetime.utcnow(), task_id))
                        conn.commit()
                        
                        status = 'completed'
                        result_text = explanation
                        color_type = extracted_color_type
                        print(f'[ColorType-Status] DB updated successfully')
                    
                elif replicate_status == 'failed':
                    error_msg = replicate_data.get('error', 'Analysis failed')
                    print(f'[ColorType-Status] Task failed: {error_msg}')
                    cursor.execute('''
                        UPDATE color_type_history
                        SET status = 'failed', result_text = %s, updated_at = %s
                        WHERE id = %s
                    ''', (error_msg, datetime.utcnow(), task_id))
                    conn.commit()
                    
                    status = 'failed'
                    result_text = error_msg
                
            except Exception as e:
                print(f'[ColorType-Status] Force check error: {str(e)}')
        
        cursor.close()
        conn.close()
        
        response_data = {
            'task_id': task_id,
            'status': status,
            'result_text': result_text,
            'color_type': color_type,
            'color_type_ai': color_type_ai
        }
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps(response_data)
        }
        
    except Exception as e:
        print(f'[ColorType-Status] ERROR: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Database error: {str(e)}'})
        }