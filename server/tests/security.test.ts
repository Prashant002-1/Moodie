import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import pool from '../src/config/database';
import { newSession } from '../src/services/sessionService';

let cookie: string;
beforeAll(async () => {
  const user = await pool.query("INSERT INTO users (email, username, password_hash) VALUES ('security@example.test','security','unused') RETURNING id");
  cookie = `moodie_session=${await newSession(user.rows[0].id)}`;
});
const post = (path: string) => request(app).post(path).set('Cookie', cookie).set('X-Moodie-Request', '1');
const emotions = { neutral: 0, happy: 1, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 };

describe('Account and request boundaries', () => {
  it('rejects a legacy demo JWT even when its signature is valid', async () => {
    const response = await request(app).get('/api/diary').set('Authorization', `Bearer ${jwt.sign({ id: 1 }, 'emotionflix-local-development-secret')}`);
    expect(response.status).toBe(401);
  });
  it('rejects missing, invalid, and expired sessions', async () => {
    expect((await request(app).get('/api/diary')).status).toBe(401);
    expect((await request(app).get('/api/diary').set('Cookie', 'moodie_session=invalid')).status).toBe(401);
    const token = await newSession(1);
    await pool.query('UPDATE sessions SET expires_at = CURRENT_TIMESTAMP - INTERVAL \'1 second\' WHERE token_hash = $1', [require('../src/services/sessionService').hashToken(token)]);
    expect((await request(app).get('/api/diary').set('Cookie', `moodie_session=${token}`)).status).toBe(401);
  });
  it('requires the same-origin mutation header and rejects cross-site requests', async () => {
    expect((await request(app).post('/api/auth/logout').set('Cookie', cookie)).status).toBe(403);
    expect((await post('/api/auth/logout').set('Sec-Fetch-Site', 'cross-site')).status).toBe(403);
  });
  it('rejects incomplete, zero-feeling, and invalid-date diary records', async () => {
    for (const body of [{ movieId: 12 }, { movieId: 12, watchedOn: '2026-07-10', emotions: { ...emotions, happy: 0 } }, { movieId: 12, watchedOn: '2026-02-30', emotions }]) {
      expect((await post('/api/diary').send(body)).status).toBe(400);
    }
  });
  it('rejects invalid photo bytes, oversized payloads, and malformed JSON', async () => {
    expect((await post('/api/diary').send({ movieId: 12, watchedOn: '2026-07-10', emotions, expressionImage: 'data:image/png;base64,/9j/4AAQSkZJRg==' })).status).toBe(400);
    expect((await post('/api/diary').send({ note: 'x'.repeat(3_200_000) })).status).toBe(413);
    expect((await post('/api/diary').set('Content-Type', 'application/json').send('{oops')).status).toBe(400);
  });
  it('does not cache personal API responses', async () => {
    const response = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
