-- Изменяем дефолтные значения для новых пользователей
ALTER TABLE t_p29007832_virtual_fitting_room.users 
ALTER COLUMN balance SET DEFAULT 0.00;

-- Обнуляем баланс и бесплатные попытки у ВСЕХ существующих пользователей
UPDATE t_p29007832_virtual_fitting_room.users 
SET balance = 0.00, 
    free_tries_used = 0,
    updated_at = CURRENT_TIMESTAMP;