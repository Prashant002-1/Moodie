import pool, { DatabaseClient } from '../config/database';
import { visiblePerson } from '../services/communitySafety';
import type { EmailKind } from './emails';

/**
 * The outbox: what should be emailed, decided in one place.
 *
 * `emailSource(kind)` is the only definition of who may be emailed about a
 * recommendation. Queueing and delivery both read through it, so a block, a
 * moderated or deleted account, or a person who turned email off stops an email
 * whether it happened before the row was queued or after.
 *
 * A row keeps who and which film, never anyone's words. The email is rendered
 * from the recommendation at delivery, so removing a reply also removes it from
 * any email that has not gone out.
 */

// Who reads each email: the recipient of the recommendation, or for a reply, its sender.
const reader: Record<EmailKind, 'recipient' | 'sender'> = { recommendation: 'recipient', reminder: 'recipient', reply: 'sender' };
// When each email applies. A reminder applies only while it is still due and the film is still waiting.
const applies: Record<EmailKind, string> = {
  recommendation: "s.origin = 'sent'",
  reminder: 's.remind_at IS NOT NULL AND s.remind_at <= CURRENT_TIMESTAMP AND NOT s.archived AND s.linked_entry_id IS NULL',
  reply: 'r.suggestion_id IS NOT NULL',
};

/** Rows that may be emailed now. Ends inside its WHERE clause so a caller can add `AND s.id = $1`. */
export const emailSource = (kind: EmailKind) => {
  const to = reader[kind], other = to === 'recipient' ? 'sender' : 'recipient';
  // A reply marked as having spoilers is never put in an email.
  const words = kind === 'reply' ? "CASE WHEN r.contains_spoilers THEN '' ELSE r.note END" : 's.reason';
  return `SELECT ${to}.id AS recipient_id, '${kind}'::text AS kind, s.id AS suggestion_id, ${to}.email AS email,
    jsonb_build_object('from', ${other}.username, 'title', m.title, 'remindAt', s.remind_at::text) AS payload,
    jsonb_build_object('from', ${other}.username, 'origin', s.origin, 'suggestionId', s.id, 'title', m.title,
      'releaseDate', m.release_date::text, 'posterPath', m.poster_path, 'backdropPath', m.backdrop_path, 'words', ${words},
      'enjoyment', r.enjoyment, 'highlights', COALESCE(to_jsonb(r.highlights), '[]'::jsonb),
      'containsSpoilers', COALESCE(r.contains_spoilers, FALSE)) AS data
    FROM film_suggestions s JOIN users sender ON sender.id = s.sender_id
    JOIN users recipient ON recipient.id = s.recipient_id JOIN movies m ON m.id = s.movie_id
    LEFT JOIN suggestion_replies r ON r.suggestion_id = s.id
    WHERE ${to}.email_notifications AND ${visiblePerson('s.sender_id', 's.recipient_id')} AND ${visiblePerson('s.recipient_id', 's.sender_id')}
    AND ${applies[kind]}`;
};

/**
 * Queue the email for something that just happened, inside the same transaction.
 * Queued once per person, kind and recommendation: sending the same film again
 * or editing a reply does not send a second email.
 */
export async function queueEmail(client: DatabaseClient, kind: 'recommendation' | 'reply', suggestionId: number) {
  const queued = await client.query(`INSERT INTO notification_outbox(recipient_id, kind, suggestion_id, payload)
    SELECT x.recipient_id, x.kind, x.suggestion_id, x.payload FROM (${emailSource(kind)} AND s.id = $1) x
    ON CONFLICT (recipient_id, kind, suggestion_id) DO NOTHING RETURNING id`, [suggestionId]);
  return queued.rows.length;
}

/**
 * Queue an email for every reminder whose time has passed. Each reminder is
 * queued once. A reminder moved to a new time ("Later") is a new reminder: its
 * one row goes back to pending when the new time comes.
 */
export async function queueDueReminders(client: DatabaseClient = pool) {
  const queued = await client.query(`INSERT INTO notification_outbox(recipient_id, kind, suggestion_id, payload)
    SELECT x.recipient_id, x.kind, x.suggestion_id, x.payload FROM (${emailSource('reminder')}) x
    ON CONFLICT (recipient_id, kind, suggestion_id) DO UPDATE SET payload = EXCLUDED.payload, status = 'pending',
      error = NULL, claimed_at = NULL, sent_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE notification_outbox.payload->>'remindAt' IS DISTINCT FROM EXCLUDED.payload->>'remindAt'
    RETURNING id`);
  return queued.rows.length;
}
