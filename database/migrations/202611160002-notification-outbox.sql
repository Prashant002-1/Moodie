-- Email notifications, up to the provider. A person can turn email off, and
-- every email waits in an outbox until something delivers it. One row per
-- person, kind and recommendation, so nothing is queued twice. `payload` is
-- what the email said when it was queued; delivery reads the recommendation
-- again and skips a row that no longer applies. `error` holds why a row was
-- skipped or failed. `claimed_at` is a short lease so two delivery runs never
-- hand the same row to a provider.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS notification_outbox (
    id BIGSERIAL PRIMARY KEY,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('recommendation', 'reminder', 'reply')),
    suggestion_id BIGINT NOT NULL REFERENCES film_suggestions(id) ON DELETE CASCADE,
    payload JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
    error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMP,
    sent_at TIMESTAMP,
    UNIQUE (recipient_id, kind, suggestion_id)
);
CREATE INDEX IF NOT EXISTS notification_outbox_pending ON notification_outbox(id) WHERE status = 'pending';
