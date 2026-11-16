import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { clearSessionCookie, hashPassword, hashToken, makeRecoveryCode, newSession, readSessionToken, setSessionCookie, verifyPassword } from '../services/sessionService';

const password = z.string().min(10, 'Use at least 10 characters.').max(128);
const email = z.string().trim().toLowerCase().email().max(255);
const username = z.string().trim().toLowerCase().min(3).max(30).regex(/^[a-z0-9_]+$/, 'Use letters, numbers, and underscores.');
const registerSchema = z.object({ email, username, password });
const loginSchema = z.object({ identifier: z.string().trim().toLowerCase().min(1).max(255), password: z.string().min(1).max(128) });
// ai_mode is null until the person makes the choice during onboarding.
const publicUser = (row: Record<string, unknown>) => ({ id: row.id, email: row.email, username: row.username, bio: row.bio || '', ai_mode: row.ai_mode ?? null, email_notifications: row.email_notifications ?? true });

const failure = (error: unknown, res: Response, next: NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors[0].message, details: error.errors });
  if ((error as { code?: string }).code === '23505') return res.status(409).json({ error: 'That email or username is already in use.' });
  next(error);
};

export const rateLimitAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = hashToken(req.ip || req.socket.remoteAddress || 'unknown');
    await pool.query('DELETE FROM auth_attempts WHERE expires_at < CURRENT_TIMESTAMP');
    await pool.query('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP');
    const result = await pool.query(
      `INSERT INTO auth_attempts (key, attempts, expires_at) VALUES ($1, 1, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
       ON CONFLICT (key) DO UPDATE SET attempts = auth_attempts.attempts + 1 RETURNING attempts`, [key],
    );
    if (result.rows[0].attempts > 40) {
      res.setHeader('Retry-After', '900');
      return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
    }
    next();
  } catch (error) { next(error); }
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = registerSchema.parse(req.body);
    const recoveryCode = makeRecoveryCode();
    const [passwordHash, recoveryHash] = await Promise.all([hashPassword(data.password), hashPassword(recoveryCode)]);
    const result = await pool.transaction(async client => {
      // Serialize identity writes, including on upgraded databases with mixed-case legacy names.
      await client.query('SELECT pg_advisory_xact_lock(7812401)');
      const existing = await client.query('SELECT 1 FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $2', [data.email, data.username]);
      if (existing.rowCount) throw Object.assign(new Error('Account exists'), { code: '23505' });
      const inserted = await client.query('INSERT INTO users (email, username, password_hash, recovery_hash) VALUES ($1, $2, $3, $4) RETURNING id, email, username, bio, ai_mode, email_notifications', [data.email, data.username, passwordHash, recoveryHash]);
      return { user: publicUser(inserted.rows[0]), token: await newSession(inserted.rows[0].id, client) };
    });
    setSessionCookie(res, result.token);
    res.status(201).json({ user: result.user, recoveryCode });
  } catch (error) { failure(error, res, next); }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1', [data.identifier]);
    const user = result.rows[0];
    if (!await verifyPassword(data.password, user?.password_hash)) return res.status(401).json({ error: 'Email, username, or password is incorrect.' });
    const token = await newSession(user.id);
    const oldToken = readSessionToken(req);
    if (oldToken) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(oldToken)]);
    setSessionCookie(res, token);
    res.json({ user: publicUser(user) });
  } catch (error) { failure(error, res, next); }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = readSessionToken(req);
    if (token) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [hashToken(token)]);
    clearSessionCookie(res);
    res.status(204).send();
  } catch (error) { next(error); }
};

export const me = (req: AuthRequest, res: Response) => res.json({ user: req.user });

export const updateProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { bio } = z.object({ bio: z.string().trim().max(240) }).parse(req.body);
    const result = await pool.query('UPDATE users SET bio = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, username, bio, ai_mode, email_notifications', [bio, req.user!.id]);
    res.json({ user: publicUser(result.rows[0]) });
  } catch (error) { failure(error, res, next); }
};

// The AI choice is an account setting, not a device setting: it decides whether any
// language-model feature or external assistant connection may act for this person.
// The email choice decides whether anything is queued for their inbox. Each is
// optional so one can be changed without restating the other.
const preferencesSchema = z.object({ aiMode: z.enum(['on', 'off']).optional(), emailNotifications: z.boolean().optional() }).strict()
  .refine(data => data.aiMode !== undefined || data.emailNotifications !== undefined, 'Choose a preference to change.');
export const updatePreferences = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { aiMode, emailNotifications } = preferencesSchema.parse(req.body);
    const result = await pool.query(`UPDATE users SET ai_mode = COALESCE($1, ai_mode), email_notifications = COALESCE($2::boolean, email_notifications),
      updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING id, email, username, bio, ai_mode, email_notifications`, [aiMode ?? null, emailNotifications ?? null, req.user!.id]);
    res.json({ user: publicUser(result.rows[0]) });
  } catch (error) { failure(error, res, next); }
};

export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ currentPassword: z.string().max(128), password }).parse(req.body);
    const current = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    if (!await verifyPassword(data.currentPassword, current.rows[0].password_hash)) return res.status(400).json({ error: 'Current password is incorrect.' });
    const passwordHash = await hashPassword(data.password);
    const token = await pool.transaction(async client => {
      const updated = await client.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND password_hash = $3 RETURNING id', [passwordHash, req.user!.id, current.rows[0].password_hash]);
      if (!updated.rowCount) throw new Error('Account changed. Try again.');
      await client.query('DELETE FROM sessions WHERE user_id = $1', [req.user!.id]);
      return newSession(req.user!.id, client);
    });
    setSessionCookie(res, token);
    res.json({ message: 'Password changed. Other sessions have been signed out.' });
  } catch (error) { failure(error, res, next); }
};

export const recover = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = z.object({ identifier: z.string().trim().toLowerCase().min(1).max(255), recoveryCode: z.string().trim().min(1).max(128), password }).parse(req.body);
    const current = await pool.query('SELECT * FROM users WHERE LOWER(email) = $1 OR LOWER(username) = $1', [data.identifier]);
    const user = current.rows[0];
    if (!await verifyPassword(data.recoveryCode, user?.recovery_hash)) return res.status(400).json({ error: 'Account or recovery code is incorrect.' });
    const recoveryCode = makeRecoveryCode();
    const [passwordHash, recoveryHash] = await Promise.all([hashPassword(data.password), hashPassword(recoveryCode)]);
    const token = await pool.transaction(async client => {
      const updated = await client.query('UPDATE users SET password_hash = $1, recovery_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND recovery_hash = $4 RETURNING id', [passwordHash, recoveryHash, user.id, user.recovery_hash]);
      if (!updated.rowCount) throw new Error('Recovery code already used.');
      await client.query('DELETE FROM sessions WHERE user_id = $1', [user.id]);
      return newSession(user.id, client);
    });
    setSessionCookie(res, token);
    res.json({ user: publicUser(user), recoveryCode });
  } catch (error) { failure(error, res, next); }
};

export const deleteAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { password: supplied } = z.object({ password: z.string().min(1).max(128) }).parse(req.body);
    const user = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user!.id]);
    if (!await verifyPassword(supplied, user.rows[0].password_hash)) return res.status(400).json({ error: 'Password is incorrect.' });
    await pool.query('DELETE FROM users WHERE id = $1', [req.user!.id]);
    clearSessionCookie(res);
    res.status(204).send();
  } catch (error) { failure(error, res, next); }
};
