-- Set balance to 30 rubles for testing user apollinaria-b@yandex.ru
UPDATE t_p29007832_virtual_fitting_room.users 
SET balance = 30, unlimited_access = false 
WHERE email = 'apollinaria-b@yandex.ru';