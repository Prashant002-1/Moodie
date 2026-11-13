import express from 'express';
import { z } from 'zod';
import pool from '../config/database';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { visiblePerson, visibleResponse, visibleComment } from '../services/communitySafety';

const router = express.Router();
router.use(authenticateToken);
const idSchema = z.coerce.number().int().positive();
const reportSchema = z.object({
  targetKind: z.enum(['response', 'comment', 'person']), targetId: idSchema,
  reason: z.enum(['Harassment', 'Hate or threats', 'Sexual content', 'Violence', 'Spam', 'Privacy', 'Other']),
  details: z.string().trim().max(1000).default(''),
});
router.get('/blocks', async (req: AuthRequest, res, next) => {
  try {
    const { limit, offset } = z.object({ limit: z.coerce.number().int().min(1).max(100).optional(), offset: z.coerce.number().int().min(0).default(0) }).parse(req.query);
    const result = await pool.query(`SELECT u.id, u.username, u.bio FROM user_blocks b
      JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = $1 ORDER BY LOWER(u.username), u.id LIMIT $2 OFFSET $3`, [req.user!.id, limit === undefined ? null : limit + 1, offset]);
    res.json({ people: limit === undefined ? result.rows : result.rows.slice(0, limit), nextOffset: limit !== undefined && result.rows.length > limit ? offset + limit : null });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid block list query.' });
    next(error);
  }
});
router.post('/blocks/:personId', async (req: AuthRequest, res, next) => {
  try {
    const id = idSchema.parse(req.params.personId);
    if (id === req.user!.id) return res.status(400).json({ error: 'You cannot block yourself.' });
    if (!(await pool.query('SELECT 1 FROM users WHERE id = $1', [id])).rowCount) return res.status(404).json({ error: 'Person not found.' });
    await pool.transaction(async client => {
      await client.query('INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user!.id, id]);
      await client.query('DELETE FROM follows WHERE (follower_id = $1 AND followed_id = $2) OR (follower_id = $2 AND followed_id = $1)', [req.user!.id, id]);
    });
    res.status(201).json({ blocked: true });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid person.' });
    next(error);
  }
});
router.delete('/blocks/:personId', async (req: AuthRequest, res, next) => {
  try {
    const id = idSchema.parse(req.params.personId);
    await pool.query('DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2', [req.user!.id, id]);
    res.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid person.' });
    next(error);
  }
});
router.post('/reports', async (req: AuthRequest, res, next) => {
  try {
    const data = reportSchema.parse(req.body), viewer = req.user!.id;
    const target = data.targetKind === 'response'
      ? await pool.query(`SELECT de.user_id FROM diary_entries de WHERE de.id = $1 AND de.visibility = 'public' AND ${visibleResponse('$2')}`, [data.targetId, viewer])
      : data.targetKind === 'comment'
        ? await pool.query(`SELECT ec.user_id FROM entry_comments ec JOIN diary_entries de ON de.id = ec.entry_id
          WHERE ec.id = $1 AND de.visibility = 'public' AND ${visibleResponse('$2')} AND ${visibleComment('$2')}`, [data.targetId, viewer])
        : await pool.query(`SELECT u.id AS user_id FROM users u WHERE u.id = $1 AND ${visiblePerson('$2', 'u.id')}`, [data.targetId, viewer]);
    if (!target.rowCount) return res.status(404).json({ error: 'That content is not available.' });
    if (Number(target.rows[0].user_id) === viewer) return res.status(400).json({ error: 'You can edit or delete your own content.' });
    const result = await pool.transaction(async client => {
      // Serialize each reporter's quota check to prevent concurrent bypass.
      await client.query('SELECT pg_advisory_xact_lock(7812402, $1)', [viewer]);
      const count = await client.query("SELECT COUNT(*)::int AS count FROM moderation_reports WHERE reporter_id = $1 AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 day'", [viewer]);
      if (count.rows[0].count >= 30) return false;
      await client.query(`INSERT INTO moderation_reports (reporter_id,target_kind,target_id,reason,details)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (reporter_id,target_kind,target_id) DO NOTHING`, [viewer, data.targetKind, data.targetId, data.reason, data.details]);
      return true;
    });
    if (!result) return res.status(429).json({ error: 'You have sent several reports today. Please try again tomorrow.' });
    res.status(201).json({ received: true });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Choose a report reason and keep details under 1,000 characters.' });
    next(error);
  }
});
export default router;
