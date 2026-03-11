-- Fix stuck payment transaction
-- User: 3125b2ef-1b63-44c9-b0ed-d70596941cc2
-- Transaction: f8913bd3-e4f4-4005-b71e-cd7bfa87ef06
-- Amount: 30 RUB

UPDATE t_p29007832_virtual_fitting_room.payment_transactions 
SET status = 'completed', 
    yookassa_status = 'succeeded', 
    updated_at = CURRENT_TIMESTAMP 
WHERE id = 'f8913bd3-e4f4-4005-b71e-cd7bfa87ef06' 
  AND status = 'pending';

UPDATE t_p29007832_virtual_fitting_room.users 
SET balance = balance + 30.00, 
    updated_at = CURRENT_TIMESTAMP 
WHERE id = '3125b2ef-1b63-44c9-b0ed-d70596941cc2';

INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
(user_id, type, amount, balance_before, balance_after, description, payment_transaction_id, yookassa_payment_id)
VALUES (
    '3125b2ef-1b63-44c9-b0ed-d70596941cc2', 
    'deposit', 
    30.00, 
    0.00, 
    30.00, 
    'Пополнение через ЮКасса', 
    'f8913bd3-e4f4-4005-b71e-cd7bfa87ef06', 
    '31168c18-000f-5001-8000-1bfabe0ec155'
);