import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { Request, Response } from 'express';
import pool, { DatabaseClient } from '../config/database';

export const cookieName = 'moodie_session';
const maxAge = 30 * 24 * 60 * 60 * 1000;
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
const derive = (value: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(value, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key));
});
export const hashPassword = async (value: string) => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${(await derive(value, salt)).toString('hex')}`;
};
export const verifyPassword = async (value: string, hash: string | null) => {
  const parts = hash?.split('$');
  const valid = parts?.length === 3 && parts[0] === 'scrypt' && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  const key = await derive(value, valid ? parts[1] : '0'.repeat(32));
  return Boolean(valid && timingSafeEqual(key, Buffer.from(parts![2], 'hex')));
};
export const readSessionToken = (req: Request) => {
  const value = req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
};
const cookieOptions = () => ({ httpOnly: true, secure: process.env.COOKIE_SECURE === 'true' || (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'false'), sameSite: 'lax' as const, path: '/' });
export const clearSessionCookie = (res: Response) => res.clearCookie(cookieName, cookieOptions());
export const newSession = async (userId: number, client: DatabaseClient = pool) => {
  const token = randomBytes(32).toString('hex');
  await client.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [hashToken(token), userId, new Date(Date.now() + maxAge)]);
  return token;
};
export const setSessionCookie = (res: Response, token: string) => res.cookie(cookieName, token, { ...cookieOptions(), maxAge });
export const makeRecoveryCode = () => randomBytes(24).toString('hex');
