import { z } from 'zod';
import pool, { DatabaseClient } from '../config/database';
import { visiblePerson, visibleResponse } from './communitySafety';

export const enjoymentSchema = z.enum(['loved', 'liked', 'mixed', 'not_for_me']);
export const highlightSchema = z.enum(['story', 'characters', 'performances', 'dialogue', 'images', 'music', 'ending']);
export const highlightsSchema = z.array(highlightSchema).max(7).transform(values => [...new Set(values)].sort());

export class SuggestionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

// Every read/write uses this participant guard, including blocks in either direction.
export async function requireSuggestion(client: DatabaseClient, id: number, viewer: number, recipientOnly = false) {
  const result = await client.query(`SELECT s.* FROM film_suggestions s
    WHERE s.id = $1 AND ${recipientOnly ? 's.recipient_id = $2' : '(s.recipient_id = $2 OR (s.sender_id = $2 AND (s.origin = \'sent\' OR s.shared_at IS NOT NULL)))'}
    AND ${visiblePerson('$2', 's.sender_id')} AND ${visiblePerson('$2', 's.recipient_id')}`, [id, viewer]);
  if (!result.rowCount) throw new SuggestionError(404, 'Recommendation not found.');
  return result.rows[0];
}

export async function linkSuggestion(client: DatabaseClient, id: number, viewer: number, movie: number, entry: number) {
  const suggestion = await requireSuggestion(client, id, viewer, true);
  if (suggestion.movie_id !== movie) throw new SuggestionError(400, 'Choose a viewing of this film.');
  const reply = (await client.query('SELECT entry_id FROM suggestion_replies WHERE suggestion_id=$1', [id])).rows[0];
  if (reply && Number(reply.entry_id) !== entry) throw new SuggestionError(409, 'Remove the existing reply before linking another viewing.');
  // A reminder is to watch the film. Once a viewing is linked it has done its work.
  await client.query('UPDATE film_suggestions SET linked_entry_id = $2, remind_at = NULL WHERE id = $1', [id, entry]);
}

// `progress` is how far a recommendation has got, as far as this viewer may know.
// The sender is never told about a save, an archive or a private viewing: for them
// it moves on a reply, or on a public response to the film that the recipient
// published after it was sent. `remind_at` is the recipient's alone.
const projection = `SELECT s.id, s.origin, s.reason, s.created_at,
  s.sender_id, sender.username AS sender_username, s.recipient_id, recipient.username AS recipient_username,
  s.movie_id, m.title, m.poster_path, m.backdrop_path, m.release_date,
  CASE WHEN s.recipient_id = $1 THEN s.archived ELSE FALSE END AS archived,
  (s.origin = 'sent' OR s.shared_at IS NOT NULL) AS conversation_open,
  CASE WHEN r.suggestion_id IS NOT NULL THEN 'replied'
       WHEN s.recipient_id <> $1 AND s.origin = 'discovered' THEN 'shared'
       WHEN s.recipient_id <> $1 THEN 'sent'
       WHEN s.linked_entry_id IS NOT NULL THEN 'watched'
       WHEN EXISTS(SELECT 1 FROM saved_films sf WHERE sf.user_id = $1 AND sf.movie_id = s.movie_id) THEN 'saved'
       ELSE 'suggested' END AS status,
  CASE WHEN r.suggestion_id IS NOT NULL THEN 'replied'
       WHEN s.recipient_id = $1 AND s.linked_entry_id IS NOT NULL THEN 'watched'
       WHEN s.recipient_id = $1 AND EXISTS(SELECT 1 FROM saved_films sf WHERE sf.user_id = $1 AND sf.movie_id = s.movie_id) THEN 'saved'
       WHEN s.recipient_id <> $1 AND EXISTS(SELECT 1 FROM diary_entries pw WHERE pw.user_id = s.recipient_id AND pw.movie_id = s.movie_id
         AND pw.visibility = 'public' AND pw.created_at >= s.created_at AND ${visibleResponse('$1', 'pw')}) THEN 'watched'
       ELSE 'sent' END AS progress,
  CASE WHEN s.recipient_id = $1 THEN s.linked_entry_id ELSE NULL END AS linked_entry_id,
  CASE WHEN s.recipient_id = $1 THEN s.remind_at ELSE NULL END AS remind_at,
  de.id AS source_entry_id, de.note AS source_note,
  CASE WHEN de.id IS NOT NULL THEN json_build_object('neutral',de.neutral::float,'happy',de.happy::float,
    'sad',de.sad::float,'angry',de.angry::float,'fearful',de.fearful::float,'disgusted',de.disgusted::float,'surprised',de.surprised::float) ELSE NULL END AS source_feelings,
  CASE WHEN r.suggestion_id IS NOT NULL THEN json_build_object(
    'enjoyment',r.enjoyment,'highlights',r.highlights,'note',r.note,'feelings',r.feelings,
    'contains_spoilers',r.contains_spoilers,'created_at',r.created_at,'updated_at',r.updated_at) ELSE NULL END AS reply,
  (SELECT COUNT(*)::int FROM suggestion_messages sm WHERE sm.suggestion_id = s.id) AS message_count,
  GREATEST(s.created_at, r.updated_at, (SELECT MAX(sm.created_at) FROM suggestion_messages sm WHERE sm.suggestion_id = s.id)) AS updated_at
  FROM film_suggestions s JOIN users sender ON sender.id = s.sender_id
  JOIN users recipient ON recipient.id = s.recipient_id JOIN movies m ON m.id = s.movie_id
  LEFT JOIN diary_entries de ON de.id = s.source_entry_id AND de.visibility = 'public' AND ${visibleResponse('$1')}
  LEFT JOIN suggestion_replies r ON r.suggestion_id = s.id`;

export async function loadSuggestions(viewer: number, filters: { id?: number; box?: string; movieId?: number; entryId?: number; personId?: number; q?: string; limit?: number; offset?: number }) {
  const values: unknown[] = [viewer];
  const where = [`${visiblePerson('$1', 's.sender_id')}`, `${visiblePerson('$1', 's.recipient_id')}`];
  const param = (value: unknown) => { values.push(value); return `$${values.length}`; };
  if (filters.id) {
    where.push(`s.id = ${param(filters.id)}`, `(s.recipient_id = $1 OR (s.sender_id = $1 AND (s.origin = 'sent' OR s.shared_at IS NOT NULL)))`);
  } else if (filters.box === 'sent') {
    where.push(`s.sender_id = $1 AND (s.origin = 'sent' OR s.shared_at IS NOT NULL)`);
  } else {
    where.push('s.recipient_id = $1');
    if (!filters.entryId) where.push(filters.box === 'archived' ? 's.archived' : 'NOT s.archived');
    if (filters.box === 'reminders') where.push('s.remind_at IS NOT NULL');
  }
  if (filters.movieId) where.push(`s.movie_id = ${param(filters.movieId)}`);
  // Filtering must not reveal a recipient's private viewing through a sender's inbox.
  if (filters.entryId) where.push('s.recipient_id = $1', `s.linked_entry_id = ${param(filters.entryId)}`);
  if (filters.personId) where.push(`(s.sender_id = ${param(filters.personId)} OR s.recipient_id = $${values.length})`);
  if (filters.q) where.push(`POSITION(${param(filters.q.toLowerCase())} IN LOWER(m.title || ' ' || sender.username || ' ' || recipient.username || ' ' || s.reason)) > 0`);
  const limit = param(filters.limit ?? 31), offset = param(filters.offset ?? 0);
  const order = filters.box === 'reminders' && !filters.id ? 's.remind_at, s.id' : 'updated_at DESC, s.id DESC';
  return (await pool.query(`${projection} WHERE ${where.join(' AND ')} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, values)).rows;
}

// Counts over the same viewer-specific projection the lists use, so a number
// here always agrees with what its list shows.
export async function summarizeSuggestions(viewer: number) {
  const received = 'x.recipient_id = $1 AND NOT x.archived', sent = 'x.sender_id = $1 AND x.conversation_open';
  const count = (condition: string, name: string) => `COUNT(*) FILTER (WHERE ${condition})::int AS ${name}`;
  return (await pool.query(`SELECT ${[
    count(received, 'received_total'),
    count(`${received} AND x.status = 'suggested'`, 'received_new'),
    count(`${received} AND x.status = 'saved'`, 'received_saved'),
    count(`${received} AND x.status = 'watched'`, 'received_to_reply'),
    count(`${received} AND x.remind_at IS NOT NULL`, 'reminders'),
    count(`${received} AND x.remind_at <= CURRENT_TIMESTAMP`, 'reminders_due'),
    count(sent, 'sent_total'),
    count(`${sent} AND x.progress IN ('watched','replied')`, 'sent_watched'),
    count(`${sent} AND x.status = 'replied'`, 'sent_replied'),
  ].join(', ')} FROM (${projection} WHERE ${visiblePerson('$1', 's.sender_id')} AND ${visiblePerson('$1', 's.recipient_id')}
    AND (s.recipient_id = $1 OR s.sender_id = $1)) x`, [viewer])).rows[0];
}

export async function loadSuggestion(viewer: number, id: number) {
  const row = (await loadSuggestions(viewer, { id }))[0];
  if (!row) throw new SuggestionError(404, 'Recommendation not found.');
  return row;
}
