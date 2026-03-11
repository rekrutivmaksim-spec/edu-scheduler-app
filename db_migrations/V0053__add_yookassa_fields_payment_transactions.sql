ALTER TABLE t_p29007832_virtual_fitting_room.payment_transactions ADD COLUMN yookassa_payment_id VARCHAR(255);
ALTER TABLE t_p29007832_virtual_fitting_room.payment_transactions ADD COLUMN yookassa_status VARCHAR(50);
ALTER TABLE t_p29007832_virtual_fitting_room.payment_transactions ALTER COLUMN payment_method SET DEFAULT 'yookassa';