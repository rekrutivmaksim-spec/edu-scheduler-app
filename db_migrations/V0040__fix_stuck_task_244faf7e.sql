-- Fix stuck task 244faf7e-5ab0-41ce-be9a-dfbdbdeb339d (completed on Replicate but stuck in DB)
UPDATE color_type_history
SET 
    status = 'completed',
    result_text = 'Soft Summer. The person has pale to medium cool blond hair, blue/gray-blue/gray-green eyes, and porcelain/light beige skin, which are characteristic of the Soft Summer color type.',
    color_type = 'SOFT SUMMER',
    updated_at = NOW()
WHERE id = '244faf7e-5ab0-41ce-be9a-dfbdbdeb339d' AND status = 'processing';