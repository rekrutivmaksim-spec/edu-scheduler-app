-- Fix color_type=NULL in completed tasks by extracting from result_text
UPDATE color_type_history
SET color_type = CASE
    WHEN result_text ILIKE '%SOFT WINTER%' THEN 'SOFT WINTER'
    WHEN result_text ILIKE '%BRIGHT WINTER%' THEN 'BRIGHT WINTER'
    WHEN result_text ILIKE '%VIVID WINTER%' THEN 'VIVID WINTER'
    WHEN result_text ILIKE '%SOFT SUMMER%' THEN 'SOFT SUMMER'
    WHEN result_text ILIKE '%DUSTY SUMMER%' THEN 'DUSTY SUMMER'
    WHEN result_text ILIKE '%VIVID SUMMER%' THEN 'VIVID SUMMER'
    WHEN result_text ILIKE '%GENTLE AUTUMN%' THEN 'GENTLE AUTUMN'
    WHEN result_text ILIKE '%FIERY AUTUMN%' THEN 'FIERY AUTUMN'
    WHEN result_text ILIKE '%VIVID AUTUMN%' THEN 'VIVID AUTUMN'
    WHEN result_text ILIKE '%GENTLE SPRING%' THEN 'GENTLE SPRING'
    WHEN result_text ILIKE '%BRIGHT SPRING%' THEN 'BRIGHT SPRING'
    WHEN result_text ILIKE '%VIBRANT SPRING%' THEN 'VIBRANT SPRING'
    ELSE NULL
END
WHERE status = 'completed' AND color_type IS NULL AND result_text IS NOT NULL;