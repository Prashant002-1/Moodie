import express, { Response } from 'express';
import { z } from 'zod';
import pool from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { visiblePerson, visibleResponse } from '../services/communitySafety';
import { ensureMovie } from '../services/movieCacheService';
import { enjoymentSchema, highlightsSchema, linkSuggestion, loadSuggestion, loadSuggestions, requireSuggestion, SuggestionError } from '../services/suggestionService';

const router = express.Router();
router.use(authenticateToken);
const idSchema = z.coerce.number().int().positive();
const handle = (fn: (req: AuthRequest, res: Response, user: number) => Promise<unknown>) => async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try { await fn(req, res, req.user.id); }
  catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Check your recommendation details.', details: error.errors });
    if (error instanceof SuggestionError) return res.status(error.status).json({ error: error.message });
    console.error('Recommendation conversation failed:', error);
    res.status(500).json({ error: 'Your recommendation could not be updated. Try again.' });
  }
};

// A person must already follow the sender to receive a direct suggestion.
// This is an inbox permission, not a minimum-friends or history gate.
router.get('/recipients', handle(async (req, res, user) => {
  const q = z.string().trim().max(100).default('').parse(req.query.q);
  const people = await pool.query(`SELECT u.id,u.username,u.bio FROM follows f JOIN users u ON u.id = f.follower_id
    WHERE f.followed_id = $1 AND POSITION(LOWER($2) IN LOWER(u.username)) > 0 AND ${visiblePerson('$1', 'u.id')}
    ORDER BY u.username LIMIT 50`, [user, q]);
  res.json({ people: people.rows });
}));

router.get('/', handle(async (req, res, user) => {
  const query = z.object({ box: z.enum(['received', 'sent', 'archived']).default('received'),
    movieId: idSchema.optional(), entryId: idSchema.optional(), personId: idSchema.optional(), q: z.string().trim().max(200).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().min(0).default(0) }).parse(req.query);
  const rows = await loadSuggestions(user, { ...query, limit: query.limit + 1 });
  res.json({ suggestions: rows.slice(0, query.limit), nextOffset: rows.length > query.limit ? query.offset + query.limit : null });
}));

router.post('/', handle(async (req, res, user) => {
  const data = z.discriminatedUnion('origin', [
    z.object({ origin: z.literal('sent'), movieId: idSchema, recipientId: idSchema, reason: z.string().trim().min(1).max(1000), sourceEntryId: idSchema.optional() }),
    z.object({ origin: z.literal('discovered'), sourceEntryId: idSchema }),
  ]).parse(req.body);
  if (data.origin === 'sent') await ensureMovie(data.movieId);
  const id = await pool.transaction(async client => {
    let sender = user, recipient = data.origin === 'sent' ? data.recipientId : user;
    let movie = data.origin === 'sent' ? data.movieId : 0;
    if (data.sourceEntryId) {
      const source = await client.query(`SELECT de.user_id,de.movie_id FROM diary_entries de
        WHERE de.id = $1 AND de.visibility = 'public' AND ${visibleResponse('$2')}`, [data.sourceEntryId, user]);
      if (!source.rowCount) throw new SuggestionError(404, 'That response is no longer available.');
      if (data.origin === 'discovered') { sender = source.rows[0].user_id; movie = source.rows[0].movie_id; }
      else if (source.rows[0].movie_id !== movie || source.rows[0].user_id !== user) throw new SuggestionError(400, 'Only attach your own response to this film.');
    }
    if (sender === recipient) throw new SuggestionError(400, 'Choose another person.');
    const allowed = await client.query(`SELECT u.id FROM users u WHERE u.id = $1 AND ${visiblePerson('$2', 'u.id')}`, [recipient, sender]);
    if (!allowed.rowCount) throw new SuggestionError(404, 'Person not found.');
    if (data.origin === 'sent') {
      const follows = await client.query('SELECT 1 FROM follows WHERE follower_id = $1 AND followed_id = $2', [recipient, sender]);
      if (!follows.rowCount) throw new SuggestionError(403, 'You can send recommendations to people who follow you.');
    }
    // One conversation per person, film and origin also makes ambiguous send retries safe.
    const result = await client.query(`INSERT INTO film_suggestions(sender_id,recipient_id,movie_id,origin,reason,source_entry_id)
      VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(sender_id,recipient_id,movie_id,origin) DO NOTHING RETURNING id`,
      [sender,recipient,movie,data.origin,data.origin === 'sent' ? data.reason : '',data.sourceEntryId ?? null]);
    const existing = result.rows[0] ?? (await client.query('SELECT id FROM film_suggestions WHERE sender_id=$1 AND recipient_id=$2 AND movie_id=$3 AND origin=$4', [sender,recipient,movie,data.origin])).rows[0];
    if (data.origin === 'discovered') {
      await client.query('INSERT INTO saved_films(user_id,movie_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [recipient,movie]);
      await client.query('UPDATE film_suggestions SET archived=FALSE WHERE id=$1', [existing.id]);
    }
    return existing.id;
  });
  res.status(201).json({ suggestion: await loadSuggestion(user,id) });
}));

router.get('/:id', handle(async (req, res, user) => {
  res.json({ suggestion: await loadSuggestion(user,idSchema.parse(req.params.id)) });
}));

router.patch('/:id', handle(async (req, res, user) => {
  const id = idSchema.parse(req.params.id);
  const data = z.object({ action: z.enum(['save','archive','restore','link']), entryId: idSchema.optional() }).parse(req.body);
  await pool.transaction(async client => {
    const suggestion = await requireSuggestion(client,id,user,true);
    if (data.action === 'save') {
      await client.query('INSERT INTO saved_films(user_id,movie_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [user,suggestion.movie_id]);
      await client.query('UPDATE film_suggestions SET archived=FALSE WHERE id=$1', [id]);
    } else if (data.action === 'link') {
      const entry = await client.query('SELECT id FROM diary_entries WHERE id=$1 AND user_id=$2 AND movie_id=$3', [data.entryId ?? null,user,suggestion.movie_id]);
      if (!entry.rowCount) throw new SuggestionError(400, 'Choose one of your viewings of this film.');
      await linkSuggestion(client,id,user,suggestion.movie_id,entry.rows[0].id);
    } else await client.query('UPDATE film_suggestions SET archived=$2 WHERE id=$1', [id,data.action === 'archive']);
  });
  res.json({ suggestion: await loadSuggestion(user,id) });
}));

router.put('/:id/reply', handle(async (req, res, user) => {
  const id = idSchema.parse(req.params.id);
  const data = z.object({ entryId: idSchema, enjoyment: enjoymentSchema, highlights: highlightsSchema.default([]),
    note: z.string().trim().max(1000).default(''), shareFeelings: z.boolean().default(false), containsSpoilers: z.boolean().default(false) }).parse(req.body);
  await pool.transaction(async client => {
    const suggestion = await requireSuggestion(client,id,user,true);
    const entry = (await client.query(`SELECT de.* FROM diary_entries de WHERE de.id=$1 AND de.user_id=$2 AND de.movie_id=$3
      AND ${visibleResponse('$2')}`, [data.entryId,user,suggestion.movie_id])).rows[0];
    if (!entry) throw new SuggestionError(400, 'Choose one of your viewings of this film.');
    const feelings = data.shareFeelings ? Object.fromEntries(['neutral','happy','sad','angry','fearful','disgusted','surprised'].map(key => [key,Number(entry[key])])) : null;
    await client.query(`INSERT INTO suggestion_replies(suggestion_id,entry_id,enjoyment,highlights,note,feelings,contains_spoilers)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(suggestion_id) DO UPDATE SET
      entry_id=EXCLUDED.entry_id,enjoyment=EXCLUDED.enjoyment,highlights=EXCLUDED.highlights,note=EXCLUDED.note,
      feelings=EXCLUDED.feelings,contains_spoilers=EXCLUDED.contains_spoilers,updated_at=CURRENT_TIMESTAMP
      WHERE ROW(suggestion_replies.entry_id,suggestion_replies.enjoyment,suggestion_replies.highlights,suggestion_replies.note,suggestion_replies.feelings,suggestion_replies.contains_spoilers)
        IS DISTINCT FROM ROW(EXCLUDED.entry_id,EXCLUDED.enjoyment,EXCLUDED.highlights,EXCLUDED.note,EXCLUDED.feelings,EXCLUDED.contains_spoilers)`,
      [id,data.entryId,data.enjoyment,data.highlights,data.note,feelings ? JSON.stringify(feelings) : null,data.containsSpoilers]);
    await linkSuggestion(client,id,user,suggestion.movie_id,data.entryId);
    await client.query('UPDATE film_suggestions SET shared_at=COALESCE(shared_at,CURRENT_TIMESTAMP) WHERE id=$1', [id]);
  });
  res.json({ suggestion: await loadSuggestion(user,id) });
}));

router.delete('/:id/reply', handle(async (req, res, user) => {
  const id = idSchema.parse(req.params.id);
  await pool.transaction(async client => { await requireSuggestion(client,id,user,true); await client.query('DELETE FROM suggestion_replies WHERE suggestion_id=$1', [id]); });
  res.status(204).send();
}));

router.get('/:id/messages', handle(async (req, res, user) => {
  const id = idSchema.parse(req.params.id);
  const offset = z.coerce.number().int().min(0).default(0).parse(req.query.offset);
  await requireSuggestion(pool,id,user);
  const result = await pool.query(`SELECT sm.id,sm.user_id,u.username,sm.body,sm.contains_spoilers,sm.created_at
    FROM suggestion_messages sm JOIN users u ON u.id=sm.user_id WHERE sm.suggestion_id=$1 ORDER BY sm.id LIMIT 51 OFFSET $2`, [id,offset]);
  res.json({ messages: result.rows.slice(0,50), nextOffset: result.rows.length > 50 ? offset + 50 : null });
}));

router.post('/:id/messages', handle(async (req, res, user) => {
  const id = idSchema.parse(req.params.id);
  const data = z.object({ body: z.string().trim().min(1).max(1000), clientRequestId: z.string().uuid(), containsSpoilers: z.boolean().default(false) }).parse(req.body);
  await pool.transaction(async client => {
    const suggestion = await requireSuggestion(client,id,user);
    // A discovered save remains owner-only until its first explicit reply.
    if (suggestion.origin === 'discovered' && suggestion.shared_at == null)
      throw new SuggestionError(409, 'Send your response before starting the conversation.');
    const existing = (await client.query('SELECT * FROM suggestion_messages WHERE user_id=$1 AND client_request_id=$2', [user,data.clientRequestId])).rows[0];
    if (existing) {
      if (Number(existing.suggestion_id) !== id || existing.body !== data.body || existing.contains_spoilers !== data.containsSpoilers)
        throw new SuggestionError(409, 'This send was already used for a different message.');
      return;
    }
    await client.query('INSERT INTO suggestion_messages(suggestion_id,user_id,client_request_id,body,contains_spoilers) VALUES($1,$2,$3,$4,$5)', [id,user,data.clientRequestId,data.body,data.containsSpoilers]);
  });
  res.status(201).json({ sent: true });
}));

router.delete('/:id/messages/:messageId', handle(async (req, res, user) => {
  const id = idSchema.parse(req.params.id), message = idSchema.parse(req.params.messageId);
  await pool.transaction(async client => {
    await requireSuggestion(client,id,user);
    const deleted = await client.query('DELETE FROM suggestion_messages WHERE id=$1 AND suggestion_id=$2 AND user_id=$3 RETURNING id', [message,id,user]);
    if (!deleted.rowCount) throw new SuggestionError(404, 'Message not found.');
  });
  res.status(204).send();
}));

export default router;
