import pool from '../config/database';
import { env } from '../config/env';
import { EmailKind, renderEmail } from './emails';
import { emailSource } from './outbox';

/**
 * Delivery behind a port. Moodie renders the email and hands it to a `Mailer`;
 * the mailer is the only thing that knows a provider. None is connected, so the
 * default sends nothing and says so.
 */
export type MailMessage = { to: string; kind: EmailKind; subject: string; html: string; text: string };
export type MailResult = { status: 'sent' } | { status: 'skipped'; reason: string };
export interface Mailer {
  /** Resolve with what happened. Reject (throw) when the provider failed: the row is marked failed with the message. */
  send(message: MailMessage): Promise<MailResult>;
}

export const NO_PROVIDER = 'no email provider connected';
export const NO_LONGER_APPLIES = 'no longer applies';
/** The default: sends nothing. Every row it is handed is marked skipped with the reason. */
export const unconnectedMailer: Mailer = { send: async () => ({ status: 'skipped', reason: NO_PROVIDER }) };

/**
 * Render pending rows and hand them to the mailer, oldest first. A row is
 * claimed for ten minutes first, so two runs at once never hand over the same
 * email. Each row is read again through `emailSource`: one that no longer
 * applies (a block, email turned off, a removed reply, a reminder cleared or
 * moved) is skipped without reaching the mailer. A failed row stays failed
 * until someone sets it back to pending.
 */
export async function deliverPending(mailer: Mailer = unconnectedMailer, limit = 100) {
  const claimed = await pool.query(`UPDATE notification_outbox SET claimed_at = CURRENT_TIMESTAMP
    WHERE id IN (SELECT id FROM notification_outbox WHERE status = 'pending'
      AND (claimed_at IS NULL OR claimed_at < CURRENT_TIMESTAMP - INTERVAL '10 minutes') ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED)
    RETURNING id, kind, suggestion_id`, [limit]);
  const counts = { sent: 0, skipped: 0, failed: 0 };
  for (const row of [...claimed.rows].sort((a, b) => Number(a.id) - Number(b.id))) {
    let status: keyof typeof counts, reason: string | null = null;
    try {
      const live = (await pool.query(`SELECT x.email, x.data FROM (${emailSource(row.kind)} AND s.id = $1) x`, [row.suggestion_id])).rows[0];
      if (!live) { status = 'skipped'; reason = NO_LONGER_APPLIES; }
      else {
        const result = await mailer.send({ to: live.email, kind: row.kind, ...renderEmail(row.kind, { ...live.data, webUrl: env.webUrl }) });
        status = result.status;
        if (result.status === 'skipped') reason = result.reason;
      }
    } catch (error) { status = 'failed'; reason = String((error as Error)?.message ?? error).slice(0, 500); }
    await pool.query(`UPDATE notification_outbox SET status = $2::text, error = $3, claimed_at = NULL, updated_at = CURRENT_TIMESTAMP,
      sent_at = CASE WHEN $2::text = 'sent' THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id = $1`, [row.id, status, reason]);
    counts[status]++;
  }
  return counts;
}
