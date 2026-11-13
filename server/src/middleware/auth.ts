import { Request, Response, NextFunction } from 'express';
import pool from '../config/database';
import { clearSessionCookie, hashToken, readSessionToken } from '../services/sessionService';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; username: string; bio: string; ai_mode: 'on' | 'off' | null };
}

const authenticate = (required: boolean) => async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = readSessionToken(req);
  if (!token) {
    if (required || req.headers.authorization || req.headers.cookie?.includes('moodie_session=')) return res.status(401).json({ error: 'Sign in to continue.' });
    return next();
  }
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.username, u.bio, u.ai_mode FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP`, [hashToken(token)],
    );
    if (!result.rowCount) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    }
    req.user = result.rows[0];
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !req.originalUrl.startsWith('/api/auth/')) {
      const restricted = await pool.query("SELECT 1 FROM moderation_actions WHERE target_kind = 'person' AND target_id = $1", [req.user!.id]);
      if (restricted.rowCount) return res.status(403).json({ error: 'This account is restricted. You can still manage or delete your account.' });
    }
    next();
  } catch (error) { next(error); }
};

export const authenticateToken = authenticate(true);
export const optionalAuthentication = authenticate(false);
