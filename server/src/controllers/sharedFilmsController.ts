import { Response } from 'express';
import { z } from 'zod';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { visiblePerson, visibleResponse } from '../services/communitySafety';

// A private owner viewing can be compared with another person's public viewing.
// The owner is always the authenticated viewer, never an input parameter.
export const getSharedFilms = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const username = z.string().trim().min(1).max(100).parse(req.params.username);
    const { limit, offset } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30),
      offset: z.coerce.number().int().min(0).default(0) }).parse(req.query);
    const person = await pool.query(`SELECT u.id FROM users u WHERE LOWER(u.username)=LOWER($2)
      AND ${visiblePerson('$1', 'u.id')}`, [req.user.id, username]);
    if (!person.rowCount) return res.status(404).json({ error: 'Member not found' });
    const result = await pool.query(`WITH peer AS (
      SELECT DISTINCT ON (de.movie_id) de.id, de.movie_id, de.watched_on, de.created_at, de.note,
        de.neutral::float, de.happy::float, de.sad::float, de.angry::float,
        de.fearful::float, de.disgusted::float, de.surprised::float,
        m.title, m.poster_path, m.release_date
      FROM diary_entries de JOIN movies m ON m.id=de.movie_id
      WHERE de.user_id=$2 AND de.visibility='public' AND ${visibleResponse('$1')}
      ORDER BY de.movie_id, de.watched_on DESC, de.created_at DESC, de.id DESC
    ) SELECT peer.movie_id AS id, row_to_json(peer) AS "personEntry", row_to_json(own) AS "ownEntry"
      FROM peer JOIN LATERAL (
        SELECT de.id, de.movie_id, de.watched_on, de.note, de.visibility,
          de.neutral::float, de.happy::float, de.sad::float, de.angry::float,
          de.fearful::float, de.disgusted::float, de.surprised::float
        FROM diary_entries de WHERE de.user_id=$1 AND de.movie_id=peer.movie_id
        ORDER BY de.watched_on DESC, de.created_at DESC, de.id DESC LIMIT 1
      ) own ON TRUE
      ORDER BY peer.watched_on DESC, peer.created_at DESC, peer.id DESC LIMIT $3 OFFSET $4`,
    [req.user.id, person.rows[0].id, limit + 1, offset]);
    res.json({ films: result.rows.slice(0, limit), nextOffset: result.rows.length > limit ? offset + limit : null });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid shared films query' });
    res.status(500).json({ error: 'Shared films could not be loaded' });
  }
};
