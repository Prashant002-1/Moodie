-- The person's AI choice. NULL means not chosen yet; 'off' keeps every
-- language-model feature and external assistant connection away from the account.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_mode VARCHAR(8) CHECK (ai_mode IN ('on', 'off'));
