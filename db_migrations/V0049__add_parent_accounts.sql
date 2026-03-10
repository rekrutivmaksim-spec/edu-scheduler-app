
CREATE TABLE IF NOT EXISTS t_p72971514_edu_scheduler_app.parent_accounts (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    full_name VARCHAR(255),
    child_user_id INTEGER REFERENCES t_p72971514_edu_scheduler_app.users(id),
    access_code VARCHAR(8) NOT NULL,
    subscription_active BOOLEAN DEFAULT false,
    subscription_expires_at TIMESTAMP,
    payment_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_parent_phone ON t_p72971514_edu_scheduler_app.parent_accounts(phone);
CREATE INDEX IF NOT EXISTS idx_parent_child ON t_p72971514_edu_scheduler_app.parent_accounts(child_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_parent_phone_child ON t_p72971514_edu_scheduler_app.parent_accounts(phone, child_user_id);

ALTER TABLE t_p72971514_edu_scheduler_app.users ADD COLUMN IF NOT EXISTS parent_code VARCHAR(8);
