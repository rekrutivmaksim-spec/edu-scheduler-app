ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS rustore_token TEXT;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT 'web';
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_rustore_token_idx ON push_subscriptions (rustore_token) WHERE rustore_token IS NOT NULL;