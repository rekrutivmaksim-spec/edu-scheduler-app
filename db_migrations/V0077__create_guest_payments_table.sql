CREATE TABLE IF NOT EXISTS guest_payments (
    id SERIAL PRIMARY KEY,
    fingerprint VARCHAR(255),
    amount INTEGER NOT NULL,
    plan_type VARCHAR(20) NOT NULL,
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    payment_id VARCHAR(255),
    yokassa_payment_id VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP,
    claimed_by_user_id INTEGER REFERENCES users(id),
    claimed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_guest_payments_fingerprint ON guest_payments(fingerprint);
CREATE INDEX IF NOT EXISTS idx_guest_payments_payment_id ON guest_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_guest_payments_status ON guest_payments(payment_status);