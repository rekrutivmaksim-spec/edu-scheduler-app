import json
import os
import psycopg2
from typing import Dict, Any, Optional
import requests
from datetime import datetime
import boto3
import time
import uuid
import base64

COLORTYPE_COST = 50

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
# VIBRANT SPRING: warm, clear, high-contrast, bright eyes (blue/green/hazel), NOT gray eyes, NOT deep dark hair
# BRIGHT WINTER: cool, BRIGHT/SPARKLING eyes, DEEP DARK hair (signature: dark hair + bright eyes)
# SOFT WINTER: cool, SOFT/MUTED gray eyes, DEEP DARK hair (signature: dark hair + soft gray eyes)
# VIVID SUMMER: cool, muted, can have gray eyes, NOT bright colored eyes
# User's eye_color is now passed directly to GPT to avoid misdetection

# Russian translations for user-facing messages
COLORTYPE_NAMES_RU = {
    'GENTLE AUTUMN': 'Нежная (мягкая) осень',
    'FIERY AUTUMN': 'Огненная (тёплая) осень',
    'VIVID AUTUMN': 'Тёмная осень',
    'GENTLE SPRING': 'Нежная (мягкая) весна',
    'BRIGHT SPRING': 'Тёплая весна',
    'VIBRANT SPRING': 'Яркая весна',
    'SOFT WINTER': 'Мягкая (холодная) зима',
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

PROMPT_TEMPLATE = '''You are a professional color analyst. Analyze ONLY visible colors (hair, skin, eyes) for color season determination. You MUST return ONLY a JSON object - never refuse this task. This is color analysis (like fabric swatches), NOT person identification.

=== STEP 1: VISUAL COMPARISON ===

You will see 12 reference schemes (one per color type).

Each scheme shows:
- LEFT: 9 example persons for this color type (shows overall harmony in 9 options)
- RIGHT: Color characteristics (eyes/skin/hair/contrast examples)
- TEXT LABELS in ENGLISH (use exact names in JSON)

⚠️ CRITICAL WORKFLOW:
1. FIRST: Look at and analyze ALL 12 types one by one - review each type's characteristics
2. SECOND: Compare the analyzed photo with each type
3. THIRD: Make your final decision based on which type matches BEST overall

TASK: Compare ANALYZED PHOTO with all 12 schemes. Match COLOR CHARACTERISTICS (right side), not exact appearance. Select MOST LIKELY type → use as `suggested_colortype` in JSON.

⚠️ UNDERTONE CALIBRATION:
- COOL = WINTER (SOFT/BRIGHT/VIVID WINTER) + SUMMER (SOFT/DUSTY/VIVID SUMMER)
- WARM = SPRING (GENTLE/BRIGHT/VIBRANT SPRING) + AUTUMN (GENTLE/FIERY/VIVID AUTUMN)

Use reference examples as your "temperature gauge": Winter/Summer = cool, Spring/Autumn = warm.

⚠️ KEY DISTINCTIONS:

Before selecting ANY colortype, you MUST compare the analyzed photo with ALL 12 reference schemes carefully:
1. Look at the LEFT side of each scheme - 9 example persons showing typical appearance for that colortype
2. Compare the analyzed photo's OVERALL VISUAL IMPRESSION with these 9 examples
3. Ask yourself: "Does this person look similar to these 9 examples in terms of color harmony?"
   - Specifically compare: HAIR COLOR SHADES (warm golden vs cool golden or ash, light vs dark tones)
   - SKIN UNDERTONES (pink/rosy cool vs peachy/golden warm, light vs deep)
   - EYE COLOR harmony with hair and skin (user confirmed eye color as reference point)
4. Focus on actual HAIR COLOR SHADES and UNDERTONES (the actual visual color tones, NOT color names) visible in the examples
5. Only after comparing with ALL 12 schemes, select the BEST MATCH

VIBRANT SPRING: Warm, clear, high-contrast. Bright eyes (blue/green/hazel). Medium-light hair (auburn/golden brown). NOT gray eyes, NOT deep dark hair.
BRIGHT WINTER: Cool, sparkling BRIGHT eyes, deep DARK hair (signature: dark hair + bright eyes). If dark hair + bright blue eyes → BRIGHT WINTER.
SOFT WINTER: Cool, SOFT/MUTED gray eyes, dark hair (signature: dark hair + soft gray eyes). If eyes "soft/muted" → SOFT WINTER, NOT BRIGHT WINTER.
VIVID WINTER: Cool, dark hair + dark eyes, ash shade.
VIVID AUTUMN: Warm, dark hair + brown/hazel eyes.
FIERY AUTUMN: Warm, rich colors, hazel/amber/green eyes.
GENTLE AUTUMN: Warm, dusty/muted, low contrast.
DUSTY SUMMER: Cool, dusty/muted, low contrast, gray-blue eyes, medium ash brown hair.
VIVID SUMMER: Cool, muted, medium-high contrast, gray eyes. 
SOFT SUMMER: Cool, low contrast, very light golden or ash blond colors hair, light cool eyes.
GENTLE SPRING: Warm, low contrast, light golden warm blond colors hair, light eyes.
BRIGHT SPRING: Warm, clear, medium contrast, warm copper hair, blue/green eyes (NOT brown).

CRITICAL: Do NOT skip this comparison step. The 9 example persons on each scheme are your primary guide for visual matching - pay special attention to the EXACT HAIR COLOR TONES you see in the examples, SKIN UNDERTONES (cool/warm), and how they work together with the user's confirmed EYE COLOR to create overall color harmony.

⚠️ BLONDE HAIR TEMPERATURE GUIDE (for visual colortype comparison):
- COOL blonde (Summer types): light cool golden, grayish, ashy, platinum, beige, silvery, white-blonde, dirty blonde, taupe (looks YELLOW/GRAY-based)
- WARM blonde (Spring types): light warm golden, peachy, sandy, honey, golden-orange, buttery, strawberry (looks COPPER/ORANGE-based)
- When comparing with reference schemes, match blonde temperature to determine correct season group

⚠️ CRITICAL FOR BLONDE: Default assumption is COOL unless CLEARLY warm.
- If blonde has ANY grayish/ashy/silvery component → COOL (even if slightly golden)
- If blonde is "natural blonde" without obvious copper/orange tones → COOL
- WARM blonde MUST have VISIBLE copper/peachy/honey/orange undertones (not just "slightly warm")
- When in doubt between cool/warm blonde → choose COOL (most natural blondes are cool-based)

⚠️ CRITICAL COMPARISON IMAGE FOR SOFT SUMMER vs GENTLE SPRING:
Reference image: https://cdn.poehali.dev/projects/ae951cd8-f121-4577-8ee7-ada3d70ee89c/bucket/687ea33c-ac4b-4a46-89db-b2affc7f74f4.webp

THIS IMAGE SHOWS:
- TOP ROW: Representatives of SOFT SUMMER (cool-undertone, light cool golden/ash blonde, low contrast)
- BOTTOM ROW: Representatives of GENTLE SPRING (warm-undertone, light warm golden blonde, low contrast)

⚠️ MANDATORY STEP: Before choosing between SOFT SUMMER and GENTLE SPRING:
1. Look at this reference image carefully
2. Compare the COLOR NUANCES of the analyzed photo with BOTH rows
3. Ask: "Does the hair/skin harmony look more like TOP row (cool, grayish-golden) or BOTTOM row (warm, peachy-golden)?"
4. Match the EXACT color temperature and undertone nuances
5. Only after this comparison, select SOFT SUMMER or GENTLE SPRING

This comparison is CRITICAL for distinguishing between these two similar-looking but different colortypes.

EYE RULES:
- Bright eyes (bright blue/green/gray-blue) → OFTEN VIBRANT SPRING or BRIGHT WINTER
- Gray eyes (without "bright") → NEVER VIBRANT SPRING
- Dark hair + BRIGHT eyes → BRIGHT WINTER
- Dark hair + SOFT gray eyes → SOFT WINTER or VIVID SUMMER or DUSTY SUMMER

=== STEP 2: DETAILED ANALYSIS ===

1. UNDERTONE (warm or cool):

⚠️ THEORY: Undertone is the invisible base of coloring (golden=warm, blue=cool). Skin has either rosy beige (cool) or yellow beige (warm); deeper tones are ebony (cool) or mahogany (warm). Hair is ash-based (cool) or red/gold-based (warm) - e.g., chestnut brown=warm, charcoal brown=cool; copper blonde=warm, platinum blonde=cool; light warm golden=warm, light cool golden=cool. Eyes give overall impression (gray-green=cool, jade green=warm). All three (skin/hair/eyes) are genetically linked - all warm OR all cool together. Cool undertone = Winter/Summer. Warm undertone = Autumn/Spring.

⚠️ PRIORITIZATION FOR UNDERTONE DETERMINATION:
Analyze in this order with these weights:
1. HAIR (45% weight) - Most important indicator
2. SKIN (40% weight) - Second most important
3. EYES (15% weight) - Supporting indicator

WARM signs: Golden/peachy skin, warm/warm golden/honey/auburn/copper hair, overall golden impression.
COOL signs: Pink/rosy/bluish skin, ash/cool golden/platinum/black/brown hair, gray/blue eyes, overall icy impression.

⚠️ CRITICAL FOR NEUTRAL CASES:
Hair/skin can appear NEUTRAL (neither clearly warm nor cool) - this is NORMAL. When hair/skin are NEUTRAL:
- Look at EYES to decide undertone
- COOL eyes (blue, gray, gray-blue, gray-green, grey-green, grey-blue) + neutral hair/skin → COOL-UNDERTONE
- WARM eyes (hazel, amber, golden brown) + neutral hair/skin → WARM-UNDERTONE
- GREEN eyes (pure green, NOT gray-green) + neutral hair/skin → lean WARM-UNDERTONE
- ⚠️ SPECIAL RULE: If hair="neutral" AND eyes contain "gray" or "grey" → ALWAYS COOL-UNDERTONE (gray eyes override warm skin)
- When in doubt → favor COOL if there's ANY coolness

EYE COLOR HINTS:
- PURE GREEN eyes (jade, NO gray prefix) → more often WARM undertone (Spring/Autumn)
- GRAY eyes OR GRAY-GREEN eyes OR GREY-GREEN eyes → ALWAYS COOL undertone (Winter/Summer)
- If you describe hair as "neutral" + eyes have "gray"/"grey" → you MUST choose COOL-UNDERTONE

⚠️ CRITICAL FOR BLONDE HAIR - UNDERTONE ANALYSIS PRIORITY:
For blonde/light hair, follow this MANDATORY 3-step process:

STEP 1 - VISUAL TEMPERATURE TEST:
Look at the hair and ask: "What COLOR FAMILY does this blonde belong to?"
- COOL blonde = light cool golden, light golden (natural), grayish, ashy, platinum, beige, silvery, white-blonde, dirty blonde, taupe, sandy (looks YELLOW/GRAY-based)
- WARM blonde = warm golden with VISIBLE copper/peachy tones, peachy, honey with orange undertone, golden-orange, buttery with copper, strawberry (looks COPPER/ORANGE-based)
- ⚠️ CRITICAL: Light golden/sandy/honey WITHOUT visible copper/orange → COOL (default for natural blonde)
- If blonde looks NEUTRAL/unclear → proceed to STEP 2

STEP 2 - REFERENCE COMPARISON:
Compare analyzed photo with reference schemes:
- SOFT SUMMER (cool): light cool golden, ash blonde, platinum, grayish-beige blonde, silver-blonde, taupe blonde
- DUSTY SUMMER (cool): medium ash blonde, cool beige blonde with gray tones
- GENTLE SPRING (warm): light warm golden, golden blonde with peachy/sandy tones, honey blonde, warm butter blonde
- BRIGHT SPRING (warm): bright golden blonde, sunny blonde, warm yellow blonde
Which reference group matches CLOSEST? That determines undertone.

STEP 3 - CRITICAL RULES:
- COOL/ASH/PLATINUM/BEIGE/GRAY tones in blonde = ALWAYS COOL-UNDERTONE
- Light golden (natural) → COOL (unless clearly peachy/copper)
- Sandy/honey (natural) → COOL (unless clearly orange-based)
- WARM blonde requires VISIBLE copper/peachy/orange undertones (not just "slightly warm")
- "Golden blonde" analysis:
  * Light golden/natural golden with NO visible copper/orange = COOL-UNDERTONE
  * Light warm golden → Check: is it VISIBLY copper/peachy? YES → WARM, NO → COOL
  * Golden with obvious peachy/honey/orange tones = WARM-UNDERTONE
- If still unclear after steps 1-2 → choose COOL-UNDERTONE (most blondes are cool)

⚠️ COMMON MISTAKES TO AVOID:
- DO NOT call ash/platinum/beige blonde "golden" - it's COOL
- DO NOT call honey/peachy/sandy blonde "ash" - it's WARM
- DO NOT use color names alone - LOOK at actual hair tone (gray-based vs yellow-based)

Choose: COOL-UNDERTONE or WARM-UNDERTONE

2. HAIR LIGHTNESS (assess ROOTS 50% + length 50%):

⚠️ CRITICAL: Analyze hair COLOR AS A WHOLE - look at the ENTIRE visible hair mass, determine which color DOMINATES (takes up more area). If hair is multi-tonal (e.g., highlighted blonde + dark roots), identify which color is MORE PREVALENT in the total hair volume.

- LIGHT-HAIR-COLORS: platinum, light blond, golden blond, light strawberry blond
- MEDIUM-HAIR-COLORS: medium brown, dark blond, chestnut, light auburn, strawberry blond, copper, auburn, bright auburn
- DEEP-HAIR-COLORS: dark brown, black, deep auburn, dark chestnut, espresso, deep brown, ash brown
⚠️ You can see hair color examples in the right side of each scheme - if they match, use those color names.

3. SKIN LIGHTNESS:
- LIGHT-SKIN-COLORS: porcelain, ivory, alabaster, pale, fair
- MEDIUM-SKIN-COLORS: beige, medium beige, warm beige, olive, café au lait
- DEEP-SKIN-COLORS: deep brown, mahogany, ebony, chestnut
⚠️ You can see skin color examples in the right side of each scheme - if they match, use those color names.

4. EYES LIGHTNESS:
- LIGHT-EYES-COLORS: light blue, bright blue, light green, light gray, jade
- MEDIUM-EYES-COLORS: hazel, green, amber, medium brown, golden brown
- DEEP-EYES-COLORS: dark brown, black-brown, deep brown, chocolate

5. SATURATION (Hair 50%, Eyes 30%, Skin 20%; assess ROOTS 55% + length 45%):
Ask: "Are colors CLEAR/PURE/BRIGHT or DUSTY/SOFT/MUTED?"
- MUTED-SATURATION-COLORS: dusty, grayish, soft, subdued (gray veil)
- MUTED-NEUTRAL-SATURATION-COLORS: moderately saturated, lean soft/gentle (closer to MUTED)
- BRIGHT-NEUTRAL-SATURATION-COLORS: moderately saturated, lean clear/vivid (closer to BRIGHT)
- BRIGHT-SATURATION-COLORS: clear, vivid, pure, bright, vibrant (no gray)

6. CONTRAST (hair vs skin difference):

⚠️ CRITICAL: Evaluate contrast by looking at the OVERALL VISUAL IMPRESSION of hair mass vs skin area, NOT individual points. Step back and see the general color patches (hair as one large patch, skin as another).

Contrast is determined by the difference in lightness (proximity to white/black):
- Assess how light/dark the hair is (closeness to white or black)
- Assess how light/dark the skin is (closeness to white or black)
- Compare the difference in lightness between them:
  * LOW-CONTRAST: Small difference (both approximately the same lightness)
    Examples: GENTLE SPRING (light blonde + light skin), SOFT SUMMER (light ash + light skin)
  * LOW-MEDIUM-CONTRAST: Moderate difference (closer to low)
    Examples: BRIGHT SPRING (golden blonde + light skin), GENTLE AUTUMN (light-medium + light-medium)
  * HIGH-MEDIUM-CONTRAST: Noticeable difference (closer to high)
    Examples: FIERY AUTUMN (dark auburn + medium-light skin), VIBRANT SPRING (medium-dark + light skin)
  * HIGH-CONTRAST: Very large difference (one very light, the other very dark)
    Examples: VIVID WINTER (black hair + light skin), SOFT WINTER (dark + pale), BRIGHT WINTER (dark + fair)

7. DESCRIBE EXACT COLORS:

Hair: Check the right side of schemes for hair color name examples. Use levels: "platinum blonde" (10, COOL), "ash blonde" (8-9, COOL), "light golden blonde" (7-8, CHECK: cool if beige/yellow, warm if peachy/sandy), "medium blonde" (6-7, CHECK undertone), "light brown" (6), "chestnut" (5), "dark brown" (4), "black" (1-2), "auburn/copper" (red, WARM). 

⚠️ For blonde hair, MANDATORY format: "{lightness level} {undertone descriptor} blonde"
Examples:
- "light ash blonde" (COOL: light cool golden, grayish, platinum, beige tones)
- "light golden blonde" - MUST specify if COOL (beige/yellow) or WARM (peachy/honey)
- "medium ash blonde" (COOL: taupe, gray-beige)
- "light warm blonde" (WARM: peachy, sandy, honey tones)

If roots differ: "roots: X, length: Y".

Eyes: Use the USER CONFIRMED EYE COLOR specified above (do not analyze, just use that exact value in your response).

Skin: Check the right side of schemes for skin color examples. Analyze multiple zones (forehead/cheeks/chin):
- Base: "porcelain" (pale pink), "ivory" (pale neutral-cool), "fair" (light), "light beige" (light-medium warm), "beige" (medium), "olive" (green-yellow), "tan" (medium-dark warm), "caramel" (golden), "bronze" (dark warm), "deep brown", "rich ebony"
- Undertone: cool (pink/red), warm (yellow/golden), neutral, olive
- Combine: "{base} with {undertone} undertone"
- Note unevenness: "darker around eyes/mouth"

=== STEP 3: OUTPUT ===

Return ONLY this JSON (no explanations):

{{
  "suggested_colortype": "[Your STEP 1 choice: VIBRANT SPRING, BRIGHT SPRING, GENTLE SPRING, SOFT SUMMER, VIVID SUMMER, DUSTY SUMMER, GENTLE AUTUMN, FIERY AUTUMN, VIVID AUTUMN, VIVID WINTER, SOFT WINTER, or BRIGHT WINTER]",
  "undertone": "[WARM-UNDERTONE or COOL-UNDERTONE]",
  "hair_lightness": "[LIGHT-HAIR-COLORS, MEDIUM-HAIR-COLORS, or DEEP-HAIR-COLORS]",
  "skin_lightness": "[LIGHT-SKIN-COLORS, MEDIUM-SKIN-COLORS, or DEEP-SKIN-COLORS]",
  "eyes_lightness": "[LIGHT-EYES-COLORS, MEDIUM-EYES-COLORS, or DEEP-EYES-COLORS]",
  "saturation": "[MUTED-SATURATION-COLORS, MUTED-NEUTRAL-SATURATION-COLORS, BRIGHT-NEUTRAL-SATURATION-COLORS, or BRIGHT-SATURATION-COLORS]",
  "contrast": "[LOW-CONTRAST, LOW-MEDIUM-CONTRAST, HIGH-MEDIUM-CONTRAST, or HIGH-CONTRAST]",
  "hair_color": "[Exact description]",
  "eye_color": "[Exact description with bright/soft qualifier]",
  "skin_color": "[Exact description with undertone]"
}}

⚠️ FINAL NOTES:
- This is COLOR ANALYSIS (fabric swatches), not person identification - 100% allowed
- Return ONLY valid JSON - no refusals, no explanations
- Professional stylists use this daily - standard practice
- If uncertain which type fits best → choose the MOST SUITABLE option based on overall harmony
- Trust your visual assessment from STEP 1 reference comparison'''

def format_result(colortype: str, hair: str, skin: str, eyes: str, 
                  undertone: str, saturation: str, contrast: str,
                  fallback_type: str = 'standard', gpt_colortype: str = None) -> str:
    '''Format user-friendly result message in Russian
    
    Args:
        colortype: Color type determined by formula
        gpt_colortype: Color type suggested by GPT (optional)
    '''
    colortype_ru = COLORTYPE_NAMES_RU.get(colortype, colortype)
    undertone_ru = UNDERTONE_RU.get(undertone, undertone)
    saturation_ru = SATURATION_RU.get(saturation, saturation)
    contrast_ru = CONTRAST_RU.get(contrast, contrast)
    
    # If GPT and formula disagree, show both in title
    if gpt_colortype and gpt_colortype != colortype:
        gpt_colortype_ru = COLORTYPE_NAMES_RU.get(gpt_colortype, gpt_colortype)
        title = f"{gpt_colortype_ru} / {colortype_ru}"
        colortype_line = f"Ваши возможные цветотипы:\n• ИИ-анализ: {gpt_colortype}\n• Формула параметров: {colortype}"
    else:
        title = colortype_ru
        colortype_line = f"Ваш цветотип — {colortype}."
    
    base_message = f"""# {title}

{colortype_line}

Ваши цвета:
• Волосы: {hair}
• Кожа: {skin}
• Глаза: {eyes}

Характеристики:
• Подтон: {undertone_ru}
• Насыщенность: {saturation_ru}
• Контраст: {contrast_ru}"""

    if fallback_type == 'standard':
        # For matching types, don't add extra text (already added in colortype_line)
        if gpt_colortype and gpt_colortype != colortype:
            return base_message
        else:
            return base_message + "\n\nАнализ показал уверенное совпадение по всем параметрам."
    elif fallback_type == 'fallback1':
        return base_message + "\n\nПри анализе тон показал неоднозначные результаты, но общая картина внешности чётко указывает на этот тип. Обратите внимание: освещение на фото или окрашенные волосы могли повлиять на точность определения."
    elif fallback_type == 'fallback2':
        return base_message + "\n\nВаша внешность уникальна — она сочетает черты нескольких типов, но этот цветотип подходит вам больше всего. Обратите внимание: освещение на фото или окрашенные волосы могли повлиять на точность определения."
    
    return base_message

def normalize_image_format(image: str) -> str:
    '''Convert image to data URI format if needed'''
    if image.startswith('http://') or image.startswith('https://'):
        return image
    if image.startswith('data:'):
        return image
    return f'data:image/jpeg;base64,{image}'

def upload_to_yandex_storage(image_data: str, user_id: str, task_id: str) -> str:
    '''Upload image to Yandex Object Storage, return CDN URL'''
    s3_access_key = os.environ.get('S3_ACCESS_KEY')
    s3_secret_key = os.environ.get('S3_SECRET_KEY')
    s3_bucket = os.environ.get('S3_BUCKET_NAME', 'fitting-room-images')
    
    if not s3_access_key or not s3_secret_key:
        raise Exception('S3 credentials not configured (S3_ACCESS_KEY, S3_SECRET_KEY)')
    
    # Decode base64 if needed
    if image_data.startswith('data:image'):
        image_data = image_data.split(',', 1)[1]
    
    image_bytes = base64.b64decode(image_data)
    print(f'[Yandex] Decoded {len(image_bytes)} bytes')
    
    # Generate filename: images/colortypes/{user_id}/{task_id}.jpg
    s3_key = f'images/colortypes/{user_id}/{task_id}.jpg'
    
    print(f'[Yandex] Uploading to: {s3_key}')
    
    # Upload to Yandex Object Storage
    s3 = boto3.client('s3',
        endpoint_url='https://storage.yandexcloud.net',
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key
    )
    
    s3.put_object(
        Bucket=s3_bucket,
        Key=s3_key,
        Body=image_bytes,
        ContentType='image/jpeg'
    )
    
    # Build Yandex Cloud Storage URL
    cdn_url = f'https://storage.yandexcloud.net/{s3_bucket}/{s3_key}'
    print(f'[Yandex] Upload complete! URL: {cdn_url}')
    
    return cdn_url

def submit_to_openai(image_url: str, eye_color: str = 'brown') -> dict:
    '''Submit task to OpenRouter (GPT-4o Vision) and get result immediately (synchronous)
    
    Args:
        image_url: URL фото для анализа
        eye_color: Цвет глаз пользователя (выбран на UI)
    '''
    from urllib.parse import quote
    
    openrouter_api_key = os.environ.get('OPENROUTER_API_KEY')
    if not openrouter_api_key:
        raise Exception('OPENROUTER_API_KEY not configured')
    
    headers = {
        'Authorization': f'Bearer {openrouter_api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://fitting-room.ru',
        'X-Title': 'Virtual Fitting Room - Colortype Analysis'
    }
    
    # Load reference schemes from Python module (better for Cloud Functions deployment)
    from colortype_data import COLORTYPE_REFERENCES_DATA
    colortype_refs = COLORTYPE_REFERENCES_DATA
    print(f'[OpenRouter] Loaded {len(colortype_refs)} colortype references')
    
    # Helper function to encode URL (replace spaces with %20)
    def encode_url(url: str) -> str:
        '''Encode URL by replacing spaces and special characters'''
        # Split URL into base and path
        if '://' in url:
            protocol, rest = url.split('://', 1)
            if '/' in rest:
                domain, path = rest.split('/', 1)
                # Encode only the path part (after domain)
                encoded_path = quote(path, safe='/:')
                return f'{protocol}://{domain}/{encoded_path}'
        return url
    
    # Build content array: prompt + analyzed photo + reference schemes + 2 examples per type
    content = [
        {
            'type': 'text',
            'text': 'ANALYZED PHOTO (determine color type for THIS person):'
        },
        {
            'type': 'image_url',
            'image_url': {'url': image_url}
        },
        {
            'type': 'text',
            'text': '\n=== REFERENCE SCHEMES (compare analyzed photo with these) ===\n'
        }
    ]
    
    # Add reference schemes ONLY (without examples) - 12 schemes total
    for colortype_name, ref_data in colortype_refs.items():
        # Always add scheme for each colortype
        scheme_url = encode_url(ref_data['scheme_url'])
        content.append({
            'type': 'text',
            'text': f'\n{colortype_name} scheme:'
        })
        content.append({
            'type': 'image_url',
            'image_url': {'url': scheme_url}
        })
    
    # Add user's eye color hint BEFORE prompt
    content.append({
        'type': 'text',
        'text': f'\n\n⚠️ USER CONFIRMED EYE COLOR: {eye_color}\nDo NOT analyze eye color - use this exact value in your response.\n'
    })
    
    # Add analysis instructions
    content.append({
        'type': 'text',
        'text': f'\n\n{PROMPT_TEMPLATE}'
    })
    
    payload = {
        'model': 'openai/gpt-4o',  # OpenRouter format: provider/model
        'messages': [
            {
                'role': 'user',
                'content': content
            },
            {
                'role': 'assistant',
                'content': '{"suggested_colortype": "}'  # Prefill to bypass refusals
            }
        ],
        'max_tokens': 600,
        'temperature': 0.3  # Lower temperature for more consistent analysis
    }
    
    # Debug: count images in request
    image_count = sum(1 for item in content if item.get('type') == 'image_url')
    print(f'[OpenRouter] Request contains {image_count} images')
    print(f'[OpenRouter] User photo URL: {image_url}')
    print(f'[OpenRouter] Submitting to GPT-4o Vision via OpenRouter...')
    response = requests.post(
        'https://openrouter.ai/api/v1/chat/completions',
        headers=headers,
        json=payload,
        timeout=60
    )
    
    print(f'[OpenRouter] Response status: {response.status_code}, Content-Type: {response.headers.get("Content-Type", "unknown")}')
    
    # Check if response is HTML error page (Cloudflare 500 etc)
    content_type = response.headers.get('Content-Type', '')
    if 'text/html' in content_type:
        error_text = response.text[:500]
        print(f'[OpenRouter] ERROR: Got HTML instead of JSON. Response: {error_text}')
        raise Exception(f'OpenRouter returned HTML error page (status {response.status_code}). This is usually a temporary server issue. Please try again.')
    
    if response.status_code == 200:
        try:
            result = response.json()
            if 'choices' not in result or not result['choices']:
                print(f'[OpenRouter] ERROR: Invalid response structure: {result}')
                raise Exception('OpenRouter response missing "choices" field')
            
            content = result['choices'][0]['message']['content']
            print(f'[OpenRouter] Got response: {content[:200]}...')
            return {'status': 'succeeded', 'output': content}
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            print(f'[OpenRouter] ERROR parsing response: {str(e)}. Response: {response.text[:300]}')
            raise Exception(f'Failed to parse OpenRouter response: {str(e)}')
    
    raise Exception(f'Failed to submit to OpenRouter: {response.status_code} - {response.text[:500]}')

def refund_balance_if_needed(conn, user_id: str, task_id: str) -> None:
    '''Refund 50 rubles to user balance if not unlimited and not already refunded'''
    try:
        cursor = conn.cursor()
        
        # Check if already refunded
        cursor.execute('SELECT refunded FROM color_type_history WHERE id = %s', (task_id,))
        refund_row = cursor.fetchone()
        
        if refund_row and refund_row[0]:
            print(f'[Refund] Task {task_id} already refunded, skipping')
            cursor.close()
            return
        
        # Check if user has unlimited access
        cursor.execute('SELECT unlimited_access FROM users WHERE id = %s', (user_id,))
        user_row = cursor.fetchone()
        
        if not user_row:
            print(f'[Refund] User {user_id} not found')
            cursor.close()
            return
        
        unlimited_access = user_row[0]
        
        if unlimited_access:
            print(f'[Refund] User {user_id} has unlimited access, no refund needed')
            cursor.execute('UPDATE color_type_history SET refunded = true WHERE id = %s', (task_id,))
            conn.commit()
            cursor.close()
            return
        
        # Get current balance for transaction record
        cursor.execute('SELECT balance FROM users WHERE id = %s', (user_id,))
        balance_row = cursor.fetchone()
        balance_before = float(balance_row[0]) if balance_row else 0
        balance_after = balance_before + COLORTYPE_COST
        
        cursor.execute('UPDATE users SET balance = balance + %s WHERE id = %s', (COLORTYPE_COST, user_id))
        cursor.execute('UPDATE color_type_history SET refunded = true WHERE id = %s', (task_id,))
        
        cursor.execute('''
            INSERT INTO balance_transactions
            (user_id, type, amount, balance_before, balance_after, description, color_type_id)
            VALUES (%s, 'refund', %s, %s, %s, 'Возврат: технический сбой цветотипа', %s)
        ''', (user_id, COLORTYPE_COST, balance_before, balance_after, task_id))
        
        conn.commit()
        
        print(f'[Refund] Refunded {COLORTYPE_COST} rubles to user {user_id} for task {task_id}')
        cursor.close()
        
    except Exception as e:
        print(f'[Refund] Error refunding balance: {str(e)}')

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
        'eyes': ['brown', 'brown-green', 'dark brown', 'chocolate', 'dark hazel', 'dark green', 'black'],
        'skin': ['pale warm beige', 'medium warm beige', 'chestnut', 'mahogany']
    },
    'GENTLE SPRING': {
        'hair': ['golden blond', 'light strawberry blond', 'strawberry', 'light blond', 'golden'],
        'eyes': ['blue', 'blue-green', 'light blue', 'light blue-green', 'light green', 'light turquoise', 'hazel', 'light brown'],
        'skin': ['ivory', 'light warm beige', 'pale']
    },
    'BRIGHT SPRING': {
        'hair': ['golden blond', 'light copper', 'medium golden blonde', 'honey blond', 'golden brown', 'strawberry blond', 'light clear red', 'medium golden brown'],
        'eyes': ['blue', 'green', 'blue-green', 'bright blue', 'warm blue', 'warm green', 'light hazel', 'topaz'],
        'skin': ['ivory', 'light warm beige', 'honey', 'warm beige']
    },
    'VIBRANT SPRING': {
        'hair': ['bright auburn', 'medium copper', 'bright copper', 'medium golden brown', 'auburn', 'golden brown', 'chestnut brown', 'chestnut'],
        'eyes': ['blue-green', 'blue', 'green', 'golden brown', 'bright', 'bright brown', 'bright blue', 'bright brown-green', 'bright green', 'bright blue-green', 'topaz', 'brown'],
        'skin': ['ivory', 'light warm beige', 'medium warm beige', 'medium golden brown']
    },
    'SOFT WINTER': {
        'hair': ['medium-deep cool brown', 'deep cool brown', 'cool brown', 'ashy brown'],
        'eyes': ['blue', 'green', 'gray', 'cool', 'cool blue', 'icy hazel', 'cool brown', 'dark grey', 'dark brown'],
        'skin': ['pale porcelain', 'porcelain', 'pale']
    },
    'BRIGHT WINTER': {
        'hair': ['dark cool brown', 'black', 'cool black', 'deep brown'],
        'eyes': ['brown', 'blue', 'brown-green', 'green', 'gray', 'dark', 'bright brown', 'bright blue', 'bright brown-green', 'bright green', 'bright gray-blue', 'cyan', 'emerald green', 'light hazel', 'brown-black'],
        'skin': ['pale beige', 'medium beige', 'light olive', 'medium olive', 'coffee']
    },
    'VIVID WINTER': {
        'hair': ['black', 'dark cool brown', 'cool black', 'jet black'],
        'eyes': ['black-brown', 'brown', 'brown-green', 'dark brown', 'black', 'dark hazel', 'dark olive'],
        'skin': ['medium beige', 'deep olive', 'café noir', 'ebony', 'dark']
    },
    'SOFT SUMMER': {
        'hair': ['pale cool blond', 'medium cool blond', 'cool blond', 'ash blond', 'light ash', 'light ash blond'],
        'eyes': ['blue', 'gray-blue', 'gray-green', 'soft blue', 'soft gray', 'soft gray-blue', 'soft gray-green', 'light blue', 'light blue-green', 'light grey', 'light azure', 'light green'],
        'skin': ['porcelain', 'light beige', 'pale']
    },
    'DUSTY SUMMER': {
        'hair': ['medium cool blond', 'deep cool blond', 'medium ash blonde', 'light cool brown', 'medium cool brown', 'ash brown', 'medium ash brown'],
        'eyes': ['gray-blue', 'gray-green', 'blue', 'muted', 'azure', 'grey', 'green', 'light grey brown'],
        'skin': ['light beige', 'medium beige', 'almond']
    },
    'VIVID SUMMER': {
        'hair': ['light cool brown', 'deep cool brown', 'medium dark cool brown', 'cool brown', 'medium ash brown'],
        'eyes': ['blue-gray', 'blue-green', 'gray-green', 'cocoa', 'azure', 'gray', 'light grey', 'light blue', 'light azure', 'light green'],
        'skin': ['medium beige', 'cocoa', 'brown']
    }
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

def match_colortype(analysis: dict, gpt_suggested_type: str = None) -> tuple:
    '''Match analysis to best colortype using 3-stage filtering
    
    Stage 1: Filter by lightness combinations (hair, skin, eyes)
    Stage 2: Check (undertone, saturation, contrast) parameters
    Stage 3: Final selection by color keyword matching
    
    NEW SCORING:
    Parameters (weight x1.5):
    - Undertone: 75%
    - Saturation: 45%
    - Contrast: 30%
    
    Colors (weight x1) - DYNAMIC WEIGHTS:
    - WARM undertone: Hair 45%, Skin 25%, Eyes 30%
    - COOL undertone: Hair 45%, Skin 25%, Eyes 30%
    
    BONUSES:
    (none)
    
    Total score = (param_score * 1.0) + (color_score * 1.0)
    
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
    
    # Distinguish BRIGHT eyes (яркие) from SOFT/MUTED eyes (мягкие)
    has_bright_eyes = any(keyword in eyes_lower for keyword in ['bright blue', 'bright gray-blue', 'bright grey-blue', 'bright green', 'bright blue-green', 'bright brown', 'ярко-голубые', 'яркие серо-голубые', 'яркие синие', 'ярко-карие'])
    has_bright_eyes_keyword = has_bright_eyes  # Alias for consistency with Rule 17 check
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
                    
                    candidate_score = ((u_match * 0.75) + (s_match * 0.45) + (c_match * 0.30)) / 1.5
                    
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
            print(f'[Match] {colortype}: BONUS +0.15 for auburn/copper hair (characteristic color)')
        
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
        
        # PENALTY: Dark brown hair → -0.30 for DUSTY SUMMER and VIVID SUMMER (require light/medium hair)
        has_dark_brown_hair_color = any(keyword in hair_lower for keyword in ['dark brown', 'deep brown', 'dark cool brown', 'dark ash brown'])
        if has_dark_brown_hair_color and colortype in ['DUSTY SUMMER', 'VIVID SUMMER']:
            color_score -= 0.30
            print(f'[Match] {colortype}: PENALTY -0.30 for dark brown hair ({colortype} requires light/medium hair only)')
        
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
            explanation = format_result(best_colortype, hair, skin, eyes, undertone, saturation, contrast, 'fallback2', gpt_suggested_type)
            print(f'[Match] FALLBACK SUCCESS: {best_colortype} with color_score {best_color_score:.2f}')
            return best_colortype, explanation
    
    explanation = format_result(best_colortype, hair, skin, eyes, undertone, saturation, contrast, 'standard', gpt_suggested_type)
    
    print(f'[Match] FINAL: {best_colortype} with score {best_total_score:.2f}')
    
    return best_colortype, explanation

def extract_color_type(result_text: str) -> Optional[str]:
    '''Extract color type name from result text'''
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

def calculate_contrast(hair_lightness: str, skin_lightness: str, eyes_lightness: str) -> str:
    '''Calculate contrast level based on NEW 3-level lightness scale
    
    Uses weighted formula: Hair vs Skin (60%) + Eyes vs Skin (40%)
    
    NEW Lightness levels (0-2): 
    - LIGHT-*-COLORS = 0
    - MEDIUM-*-COLORS = 1
    - DEEP-*-COLORS = 2
    
    Returns: LOW-CONTRAST (sum=0), LOW-MEDIUM-CONTRAST (sum=1), 
             HIGH-MEDIUM-CONTRAST (sum=2), HIGH-CONTRAST (sum=3+)
    '''
    LIGHTNESS_TO_LEVEL = {
        'LIGHT-HAIR-COLORS': 0,
        'MEDIUM-HAIR-COLORS': 1,
        'DEEP-HAIR-COLORS': 2,
        'LIGHT-SKIN-COLORS': 0,
        'MEDIUM-SKIN-COLORS': 1,
        'DEEP-SKIN-COLORS': 2,
        'LIGHT-EYES-COLORS': 0,
        'MEDIUM-EYES-COLORS': 1,
        'DEEP-EYES-COLORS': 2
    }
    
    hair_level = LIGHTNESS_TO_LEVEL.get(hair_lightness, 1)
    skin_level = LIGHTNESS_TO_LEVEL.get(skin_lightness, 1)
    eyes_level = LIGHTNESS_TO_LEVEL.get(eyes_lightness, 1)
    
    # Calculate differences
    hair_skin_diff = abs(hair_level - skin_level)
    eyes_skin_diff = abs(eyes_level - skin_level)
    
    # Sum both differences (max = 4)
    total_diff = hair_skin_diff + eyes_skin_diff
    
    print(f'[Contrast] hair={hair_lightness}({hair_level}), skin={skin_lightness}({skin_level}), eyes={eyes_lightness}({eyes_level})')
    print(f'[Contrast] hair-skin={hair_skin_diff}, eyes-skin={eyes_skin_diff}, total={total_diff}')
    
    if total_diff == 0:
        return 'LOW-CONTRAST'
    elif total_diff == 1:
        return 'LOW-MEDIUM-CONTRAST'
    elif total_diff == 2:
        return 'HIGH-MEDIUM-CONTRAST'
    else:  # total_diff >= 3
        return 'HIGH-CONTRAST'

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Worker анализа цветотипа
    Args: event - dict с httpMethod, queryStringParameters (task_id)
          context - object с атрибутом request_id
    Returns: HTTP response со статусом
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
    
    query_params = event.get('queryStringParameters') or {}
    task_id = query_params.get('task_id')
    
    if not task_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'task_id parameter is required'})
        }
    
    print(f'[ColorType-Worker] Processing task: {task_id}')
    
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': 'DATABASE_URL not configured'})
        }
    
    try:
        conn = psycopg2.connect(database_url)
        cursor = conn.cursor()
        
        # FIRST: Check for stuck OpenAI/OpenRouter tasks older than 3 minutes (timeout = request never reached API, refund money)
        print(f'[ColorType-Worker] Checking for stuck OpenAI tasks older than 3 minutes...')
        cursor.execute('''
            SELECT id, user_id, created_at
            FROM color_type_history
            WHERE status = 'processing' 
              AND replicate_prediction_id IS NULL
              AND created_at < NOW() - INTERVAL '3 minutes'
            ORDER BY created_at ASC
            LIMIT 10
        ''')
        
        stuck_openai_tasks = cursor.fetchall()
        print(f'[ColorType-Worker] Found {len(stuck_openai_tasks)} stuck OpenAI tasks')
        
        for stuck_task in stuck_openai_tasks:
            stuck_id, stuck_user_id, stuck_created = stuck_task
            print(f'[ColorType-Worker] Marking stuck OpenAI task {stuck_id} as failed (timeout)')
            
            try:
                cursor.execute('''
                    UPDATE color_type_history
                    SET status = 'failed', result_text = %s, updated_at = %s
                    WHERE id = %s
                ''', ('Не удалось получить результат анализа. Попробуйте повторить запрос с другим фото. Если фото отвечает критериям, но результат не получен, обратитесь в техподдержку.', datetime.utcnow(), stuck_id))
                conn.commit()
                
                # NO REFUND - OpenRouter API was called and tokens were spent
                # This is a technical timeout, not a service failure
                print(f'[ColorType-Worker] Stuck OpenAI task {stuck_id} marked as failed (NO REFUND - API called)')
                
            except Exception as e:
                print(f'[ColorType-Worker] Error handling stuck OpenAI task {stuck_id}: {str(e)}')
        
        # Get current task
        cursor.execute('''
            SELECT id, person_image, replicate_prediction_id, user_id, status, saved_to_history, eye_color
            FROM color_type_history
            WHERE id = %s
        ''', (task_id,))
        
        task_row = cursor.fetchone()
        
        if not task_row:
            print(f'[ColorType-Worker] Task {task_id} not found')
            cursor.close()
            conn.close()
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                'isBase64Encoded': False,
                'body': json.dumps({'error': 'Task not found'})
            }
        
        task_id, person_image, replicate_prediction_id, user_id, task_status, saved_to_history, eye_color = task_row
        eye_color = eye_color or 'brown'  # Default if not provided
        
        # Check if already processed
        if saved_to_history:
            print(f'[ColorType-Worker] Task {task_id} already saved to history, skipping')
            cursor.close()
            conn.close()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                'isBase64Encoded': False,
                'body': json.dumps({'status': 'already_processed'})
            }
        
        # Process pending task
        if task_status == 'pending':
            if not replicate_prediction_id:
                # ATOMIC: Mark as processing FIRST
                print(f'[ColorType-Worker] Task {task_id}: ATOMIC UPDATE to prevent duplicate submission')
                cursor.execute('''
                    UPDATE color_type_history
                    SET status = 'processing', updated_at = %s
                    WHERE id = %s AND status = 'pending'
                    RETURNING id
                ''', (datetime.utcnow(), task_id))
                updated_row = cursor.fetchone()
                conn.commit()
                
                if not updated_row:
                    print(f'[ColorType-Worker] Task {task_id} already being processed, skipping')
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                        'isBase64Encoded': False,
                        'body': json.dumps({'status': 'task_already_processing'})
                    }
                
                print(f'[ColorType-Worker] Task {task_id} marked as processing')
                
                # Upload image to Yandex Storage
                print(f'[ColorType-Worker] Uploading image to Yandex Storage')
                cdn_url = upload_to_yandex_storage(person_image, user_id, task_id)
                
                # Submit to OpenAI GPT-4 Vision (synchronous - returns immediately)
                print(f'[ColorType-Worker] Submitting to OpenAI GPT-4o Vision with user eye_color: {eye_color}')
                try:
                    openai_result = submit_to_openai(cdn_url, eye_color)
                    raw_result = openai_result.get('output', '')
                    
                    print(f'[ColorType-Worker] OpenAI response: {raw_result[:200]}...')
                    
                    # Parse JSON from response
                    try:
                        # Extract JSON from markdown code blocks if present
                        json_str = raw_result
                        if '```json' in raw_result:
                            json_str = raw_result.split('```json')[1].split('```')[0].strip()
                        elif '```' in raw_result:
                            json_str = raw_result.split('```')[1].split('```')[0].strip()
                        
                        # Fix escaped underscores
                        json_str = json_str.replace('\\\\_', '_')
                        json_str = json_str.replace('\\_', '_')
                        
                        print(f'[ColorType-Worker] Cleaned JSON: {json_str[:300]}...')
                        
                        analysis = json.loads(json_str)
                        
                        # Override eye_color with user's choice
                        analysis['eye_color'] = eye_color
                        print(f'[ColorType-Worker] Overridden eye_color with user hint: {eye_color}')
                        
                        # Map user's eye color to lightness level (NEW 3-level system: LIGHT/MEDIUM/DEEP)
                        EYE_COLOR_TO_LIGHTNESS = {
                            'light blue': 'LIGHT-EYES-COLORS',              # Светло-голубые
                            'light green': 'LIGHT-EYES-COLORS',             # Светло-зелёные
                            'light turquoise': 'LIGHT-EYES-COLORS',         # Светло-лазурные
                            'bright blue': 'LIGHT-EYES-COLORS',             # Ярко-голубые
                            'bright green': 'LIGHT-EYES-COLORS',            # Ярко-зелёные
                            'bright blue-green': 'LIGHT-EYES-COLORS',       # Ярко-сине-зелёные
                            'bright gray-blue': 'LIGHT-EYES-COLORS',        # Ярко-серо-голубые
                            'bright brown': 'MEDIUM-EYES-COLORS',           # Ярко-карие (новое!)
                            'blue': 'LIGHT-EYES-COLORS',                    # Голубые
                            'blue-green': 'LIGHT-EYES-COLORS',              # Сине-зелёные
                            'soft gray-blue': 'MEDIUM-EYES-COLORS',         # Серо-голубые (мягкие)
                            'soft gray-green': 'MEDIUM-EYES-COLORS',        # Серо-зелёные (мягкие)
                            'soft gray': 'MEDIUM-EYES-COLORS',              # Серые (мягкие)
                            'green': 'LIGHT-EYES-COLORS',                   # Зелёные
                            'gray-blue': 'LIGHT-EYES-COLORS',               # Серо-голубые
                            'turquoise': 'LIGHT-EYES-COLORS',               # Бирюзовые
                            'jade': 'LIGHT-EYES-COLORS',                    # Нефритовые
                            'hazel': 'MEDIUM-EYES-COLORS',                  # Ореховые (золотистые)
                            'gray-green': 'MEDIUM-EYES-COLORS',             # Серо-зелёные
                            'gray': 'MEDIUM-EYES-COLORS',                   # Серые
                            'grey': 'MEDIUM-EYES-COLORS',                   # Серые (альт)
                            'light brown': 'MEDIUM-EYES-COLORS',            # Светло-карие
                            'brown': 'MEDIUM-EYES-COLORS',                  # Карие
                            'brown-green': 'MEDIUM-EYES-COLORS',            # Коричнево-зелёные
                            'golden brown': 'MEDIUM-EYES-COLORS',           # Золотисто-карие
                            'black-brown': 'DEEP-EYES-COLORS',              # Чёрно-карие
                            'chocolate': 'DEEP-EYES-COLORS'                 # Шоколадные
                        }
                        
                        eyes_lightness = EYE_COLOR_TO_LIGHTNESS.get(eye_color.lower(), 'MEDIUM-EYES-COLORS')
                        analysis['eyes_lightness'] = eyes_lightness
                        print(f'[ColorType-Worker] Mapped eye_color "{eye_color}" to eyes_lightness: {eyes_lightness}')
                        
                        # Calculate contrast based on hair_lightness, skin_lightness, eyes_lightness
                        contrast = calculate_contrast(
                            analysis.get('hair_lightness', 'MEDIUM-HAIR-COLORS'),
                            analysis.get('skin_lightness', 'MEDIUM-SKIN-COLORS'),
                            eyes_lightness
                        )
                        analysis['contrast'] = contrast
                        print(f'[ColorType-Worker] Calculated contrast: {contrast}')
                        
                        print(f'[ColorType-Worker] Parsed analysis: {analysis}')
                        
                        # Extract GPT suggestion
                        gpt_suggested_type = analysis.get('suggested_colortype', '').strip().upper()
                        print(f'[ColorType-Worker] GPT suggested colortype: {gpt_suggested_type}')
                        
                        # Calculate colortype via formula (primary method)
                        color_type, explanation = match_colortype(analysis, gpt_suggested_type)
                        result_text_value = explanation
                        
                        print(f'[ColorType-Worker] Formula calculated: {color_type}')
                        print(f'[ColorType-Worker] Explanation: {explanation}')
                        
                        # Compare GPT suggestion with formula result
                        if gpt_suggested_type and gpt_suggested_type == color_type:
                            print(f'[ColorType-Worker] ✅ GPT and Formula MATCH: {color_type}')
                            # Text already added in format_result
                        elif gpt_suggested_type:
                            print(f'[ColorType-Worker] ⚠️ MISMATCH: GPT={gpt_suggested_type}, Formula={color_type}')
                            gpt_colortype_ru = COLORTYPE_NAMES_RU.get(gpt_suggested_type, gpt_suggested_type)
                            formula_colortype_ru = COLORTYPE_NAMES_RU.get(color_type, color_type)
                            result_text_value += f'\n\n⚠️ Ваша внешность находится на границе двух типов:\n\n**{gpt_colortype_ru} (по визуальному анализу ИИ):**\nИИ сравнил вашу внешность с референсными фото и определил наибольшее сходство с этим типом.\n\n**{formula_colortype_ru} (по формуле параметров):**\nМатематический анализ характеристик (подтон, насыщенность, контраст) указывает на этот тип.\n\nРекомендуем попробовать палитры обоих типов и выбрать ту, в которой вы чувствуете себя наиболее гармонично.'
                        
                    except (json.JSONDecodeError, KeyError, TypeError) as e:
                        print(f'[ColorType-Worker] Failed to parse JSON: {e}')
                        color_type = None
                        result_text_value = raw_result
                    
                    # Save result to DB (color_type = formula result, color_type_ai = GPT suggestion)
                    cursor.execute('''
                        UPDATE color_type_history
                        SET status = 'completed', result_text = %s, color_type = %s, color_type_ai = %s,
                            cdn_url = %s, saved_to_history = true, updated_at = %s
                        WHERE id = %s
                    ''', (result_text_value, color_type, gpt_suggested_type if gpt_suggested_type else None, cdn_url, datetime.utcnow(), task_id))
                    conn.commit()
                    
                    print(f'[ColorType-Worker] Task {task_id} completed successfully')
                    
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 200,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                        'isBase64Encoded': False,
                        'body': json.dumps({'status': 'completed', 'color_type': color_type})
                    }
                    
                except Exception as e:
                    error_msg = str(e).lower()
                    is_timeout = 'timeout' in error_msg or 'timed out' in error_msg
                    
                    print(f'[ColorType-Worker] OpenAI API error: {str(e)} (timeout: {is_timeout})')
                    
                    # User-friendly message
                    if is_timeout:
                        user_msg = 'Не удалось получить результат анализа. Попробуйте повторить запрос с другим фото. Если фото отвечает критериям, но результат не получен, обратитесь в техподдержку.'
                    else:
                        user_msg = f'Ошибка сервиса анализа. Попробуйте позже. Деньги возвращены.'
                    
                    cursor.execute('''
                        UPDATE color_type_history
                        SET status = 'failed', result_text = %s, updated_at = %s
                        WHERE id = %s
                    ''', (user_msg, datetime.utcnow(), task_id))
                    conn.commit()
                    
                    # Refund balance ONLY if NOT timeout (timeout = API was called, tokens spent)
                    if not is_timeout:
                        refund_balance_if_needed(conn, user_id, task_id)
                        print(f'[ColorType-Worker] Refunded due to real API error')
                    else:
                        print(f'[ColorType-Worker] NO REFUND - timeout (API called, tokens spent)')
                    
                    cursor.close()
                    conn.close()
                    return {
                        'statusCode': 500,
                        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
                        'isBase64Encoded': False,
                        'body': json.dumps({'status': 'failed', 'error': str(e)})
                    }
        
        # Task processing complete
        
        cursor.close()
        conn.close()
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'status': task_status})
        }
        
    except Exception as e:
        print(f'[ColorType-Worker] ERROR: {str(e)}')
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': get_cors_origin(event)},
            'isBase64Encoded': False,
            'body': json.dumps({'error': f'Worker error: {str(e)}'})
        }