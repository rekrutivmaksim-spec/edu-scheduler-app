
CREATE TABLE IF NOT EXISTS referral_invites (
    id SERIAL PRIMARY KEY,
    referrer_id INTEGER NOT NULL REFERENCES users(id),
    invited_id INTEGER NOT NULL REFERENCES users(id),
    reward_type VARCHAR(50) DEFAULT '7_days_premium',
    reward_granted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(invited_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_invites_referrer ON referral_invites(referrer_id);
