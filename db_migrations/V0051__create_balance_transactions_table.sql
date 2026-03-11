CREATE TABLE t_p29007832_virtual_fitting_room.balance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES t_p29007832_virtual_fitting_room.users(id),
  type VARCHAR(20) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance_before DECIMAL(10, 2) NOT NULL,
  balance_after DECIMAL(10, 2) NOT NULL,
  description TEXT NOT NULL,
  payment_transaction_id UUID,
  try_on_id UUID,
  color_type_id UUID,
  yookassa_payment_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);