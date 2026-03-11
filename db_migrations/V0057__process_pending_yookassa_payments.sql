-- Обработка 4 pending платежей для пользователя igbakova@gmail.com
-- Обрабатываем транзакции: 28263ae7, 066f4b52, 6b51393d, 57f85f11

-- Транзакция 1: 28263ae7-7a49-4071-9ac9-a47d3bed4eaf
UPDATE t_p29007832_virtual_fitting_room.payment_transactions
SET status = 'completed', yookassa_status = 'succeeded', updated_at = CURRENT_TIMESTAMP
WHERE id = '28263ae7-7a49-4071-9ac9-a47d3bed4eaf';

UPDATE t_p29007832_virtual_fitting_room.users
SET balance = balance + 30, updated_at = CURRENT_TIMESTAMP
WHERE id = '3125b2ef-1b63-44c9-b0ed-d70596941cc2';

INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
(user_id, type, amount, balance_before, balance_after, description, payment_transaction_id, yookassa_payment_id)
SELECT 
    '3125b2ef-1b63-44c9-b0ed-d70596941cc2',
    'deposit',
    30,
    balance - 30,
    balance,
    'Пополнение через ЮКасса',
    '28263ae7-7a49-4071-9ac9-a47d3bed4eaf',
    '3116a14a-000f-5001-8000-1b9e97234d47'
FROM t_p29007832_virtual_fitting_room.users 
WHERE id = '3125b2ef-1b63-44c9-b0ed-d70596941cc2';


-- Транзакция 2: 066f4b52-b869-42e6-ba6a-2dc1e77505c4
UPDATE t_p29007832_virtual_fitting_room.payment_transactions
SET status = 'completed', yookassa_status = 'succeeded', updated_at = CURRENT_TIMESTAMP
WHERE id = '066f4b52-b869-42e6-ba6a-2dc1e77505c4';

UPDATE t_p29007832_virtual_fitting_room.users
SET balance = balance + 30, updated_at = CURRENT_TIMESTAMP
WHERE id = '3125b2ef-1b63-44c9-b0ed-d70596941cc2';

INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
(user_id, type, amount, balance_before, balance_after, description, payment_transaction_id, yookassa_payment_id)
SELECT 
    '3125b2ef-1b63-44c9-b0ed-d70596941cc2',
    'deposit',
    30,
    balance - 30,
    balance,
    'Пополнение через ЮКасса',
    '066f4b52-b869-42e6-ba6a-2dc1e77505c4',
    '31169ce5-000f-5001-8000-199ab83b83e5'
FROM t_p29007832_virtual_fitting_room.users 
WHERE id = '3125b2ef-1b63-44c9-b0ed-d70596941cc2';


-- Транзакция 3: 6b51393d-89e3-482f-a7e2-57549b57f60c
UPDATE t_p29007832_virtual_fitting_room.payment_transactions
SET status = 'completed', yookassa_status = 'succeeded', updated_at = CURRENT_TIMESTAMP
WHERE id = '6b51393d-89e3-482f-a7e2-57549b57f60c';

UPDATE t_p29007832_virtual_fitting_room.users
SET balance = balance + 30, updated_at = CURRENT_TIMESTAMP
WHERE id = '3125b2ef-1b63-44c9-b0ed-d70596941cc2';

INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
(user_id, type, amount, balance_before, balance_after, description, payment_transaction_id, yookassa_payment_id)
SELECT 
    '3125b2ef-1b63-44c9-b0ed-d70596941cc2',
    'deposit',
    30,
    balance - 30,
    balance,
    'Пополнение через ЮКасса',
    '6b51393d-89e3-482f-a7e2-57549b57f60c',
    '311697e6-000f-5001-9000-1956643488ed'
FROM t_p29007832_virtual_fitting_room.users 
WHERE id = '3125b2ef-1b63-44c9-b0ed-d70596941cc2';


-- Транзакция 4: 57f85f11-890b-480f-9cc9-b04d27b31f27
UPDATE t_p29007832_virtual_fitting_room.payment_transactions
SET status = 'completed', yookassa_status = 'succeeded', updated_at = CURRENT_TIMESTAMP
WHERE id = '57f85f11-890b-480f-9cc9-b04d27b31f27';

UPDATE t_p29007832_virtual_fitting_room.users
SET balance = balance + 30, updated_at = CURRENT_TIMESTAMP
WHERE id = '3125b2ef-1b63-44c9-b0ed-d70596941cc2';

INSERT INTO t_p29007832_virtual_fitting_room.balance_transactions
(user_id, type, amount, balance_before, balance_after, description, payment_transaction_id, yookassa_payment_id)
SELECT 
    '3125b2ef-1b63-44c9-b0ed-d70596941cc2',
    'deposit',
    30,
    balance - 30,
    balance,
    'Пополнение через ЮКасса',
    '57f85f11-890b-480f-9cc9-b04d27b31f27',
    '311695f9-000f-5001-8000-112a656749ef'
FROM t_p29007832_virtual_fitting_room.users 
WHERE id = '3125b2ef-1b63-44c9-b0ed-d70596941cc2';