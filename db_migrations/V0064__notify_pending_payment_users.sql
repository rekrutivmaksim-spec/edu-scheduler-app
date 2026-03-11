INSERT INTO notifications (user_id, title, message, action_url, is_read)
SELECT DISTINCT p.user_id, 
  'Оплата снова работает!',
  'Мы исправили проблему с оплатой. Теперь ты можешь оформить подписку Premium и получить доступ ко всем функциям. Попробуй ещё раз!',
  '/pricing',
  false
FROM payments p
WHERE p.payment_status = 'pending'
AND NOT EXISTS (
  SELECT 1 FROM notifications n 
  WHERE n.user_id = p.user_id AND n.title = 'Оплата снова работает!'
);