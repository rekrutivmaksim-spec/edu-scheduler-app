-- Добавляем payment_id для связи возвратов с поступлениями
ALTER TABLE balance_transactions 
ADD COLUMN IF NOT EXISTS payment_id UUID NULL;

-- Индексы для быстрого поиска по связям
CREATE INDEX IF NOT EXISTS idx_balance_transactions_try_on_id ON balance_transactions(try_on_id);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_color_type_id ON balance_transactions(color_type_id);
CREATE INDEX IF NOT EXISTS idx_balance_transactions_payment_id ON balance_transactions(payment_id);

COMMENT ON COLUMN balance_transactions.try_on_id IS 'ID виртуальной примерки (копия из try_on_history)';
COMMENT ON COLUMN balance_transactions.color_type_id IS 'ID анализа цветотипа (копия из color_type_history)';
COMMENT ON COLUMN balance_transactions.payment_id IS 'ID платежа ЮКассы для связи возврата с поступлением';