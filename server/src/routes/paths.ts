import express, { Response } from 'express';
import { z } from 'zod';
import pool from '../config/database';
import { filmsFor, hiddenFor, hide, introductionsFor, recipientsFor, starterFor, unhide } from '../discovery/service';
import { AuthRequest, authenticateToken } from '../middleware/auth';

// Discovery through people: films, people to follow, who to send a film to, and where a newcomer starts.
const router = express.Router();
const id = z.coerce.number().int().positive();
const handle = (fn: (req: AuthRequest, res: Response, user: number) => Promise<unknown>) => async (req: AuthRequest, res: Response) => {
  try { await fn(req, res, req.user!.id); }
  catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid request' });
    console.error('Discovery error:', error);
    res.status(500).json({ error: 'This could not be loaded' });
  }
};

router.get('/for-you', authenticateToken, handle(async (req, res, user) => {
  const { limit, offset } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(12), offset: z.coerce.number().int().min(0).default(0) }).parse(req.query);
  res.json(await filmsFor(user, limit, offset));
}));
router.get('/for-you/hidden', authenticateToken, handle(async (_req, res, user) => {
  res.json(await hiddenFor(user));
}));
router.put('/for-you/:movieId/hidden', authenticateToken, handle(async (req, res, user) => {
  const movieId = id.parse(req.params.movieId);
  if (!(await pool.query('SELECT 1 FROM movies WHERE id = $1', [movieId])).rowCount) return res.status(404).json({ error: 'Film not found' });
  await hide(user, movieId);
  res.status(204).end();
}));
router.delete('/for-you/:movieId/hidden', authenticateToken, handle(async (req, res, user) => {
  await unhide(user, id.parse(req.params.movieId));
  res.status(204).end();
}));
router.get('/introductions', authenticateToken, handle(async (req, res, user) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(12) }).parse(req.query);
  res.json(await introductionsFor(user, limit));
}));
router.get('/recipients', authenticateToken, handle(async (req, res, user) => {
  const { movieId, q } = z.object({ movieId: id, q: z.string().trim().max(100).default('') }).parse(req.query);
  res.json(await recipientsFor(user, movieId, q));
}));
router.get('/starter', authenticateToken, handle(async (req, res, user) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(40).default(18) }).parse(req.query);
  res.json(await starterFor(user, limit));
}));

export default router;
