-- Пополнение баланса для тестового пользователя apollinaria-b@yandex.ru на 60 рублей
UPDATE t_p29007832_virtual_fitting_room.users 
SET balance = balance + 60
WHERE email = 'apollinaria-b@yandex.ru';