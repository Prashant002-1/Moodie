-- The recipient's own reminder to watch a recommended film. Only they can see
-- it. It is cleared when they archive the recommendation or link a viewing.
-- Nothing delivers a reminder yet: clients show it when the person opens Moodie.
ALTER TABLE film_suggestions ADD COLUMN IF NOT EXISTS remind_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS suggestions_reminders ON film_suggestions(recipient_id, remind_at) WHERE remind_at IS NOT NULL;
