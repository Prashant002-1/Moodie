import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { authenticateToken, optionalAuthentication } from '../src/middleware/auth';
import { createEntry } from '../src/controllers/diaryController';

describe('Current API security boundaries', () => {
  const app = express();

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    app.use(express.json({ limit: '100kb' }));
    app.get('/public', optionalAuthentication, (req, res) => res.json({ ok: true, user: (req as any).user || null }));
    app.get('/private', authenticateToken, (req, res) => res.json({ user: (req as any).user }));
    app.post('/diary', authenticateToken, createEntry);
  });

  it('keeps public discovery available without a token', async () => {
    const response = await request(app).get('/public');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, user: null });
  });

  it('rejects invalid optional-auth tokens instead of silently accepting them', async () => {
    const response = await request(app).get('/public').set('Authorization', 'Bearer invalid');
    expect(response.status).toBe(401);
  });

  it('requires a valid token for private diary routes', async () => {
    const response = await request(app).get('/private');
    expect(response.status).toBe(401);
  });

  it('attaches the authenticated identity to private requests', () => {
    const token = jwt.sign({ id: 42, email: 'reader@test.com', username: 'reader' }, process.env.JWT_SECRET!);
    const req = { headers: { authorization: `Bearer ${token}` } } as any;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
    const next = jest.fn();
    authenticateToken(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.id).toBe(42);
  });

  it('rejects incomplete diary records before any database write', async () => {
    const token = jwt.sign({ id: 42, email: 'reader@test.com', username: 'reader' }, process.env.JWT_SECRET!);
    const response = await request(app)
      .post('/diary')
      .set('Authorization', `Bearer ${token}`)
      .send({ movieId: 12, watchedOn: '2026-07-10', note: '<script>alert(1)</script>' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid diary entry');
  });

  it('rejects expression image bytes that do not match the declared type before any database write', async () => {
    const token = jwt.sign({ id: 42, email: 'reader@test.com', username: 'reader' }, process.env.JWT_SECRET!);
    const response = await request(app)
      .post('/diary')
      .set('Authorization', `Bearer ${token}`)
      .send({
        movieId: 12,
        watchedOn: '2026-07-10',
        note: 'I felt unexpectedly hopeful.',
        visibility: 'public',
        emotions: {
          neutral: 0.1,
          happy: 0.7,
          sad: 0.1,
          angry: 0.02,
          fearful: 0.02,
          disgusted: 0.01,
          surprised: 0.2,
        },
        expressionImage: 'data:image/png;base64,/9j/4AAQSkZJRg==',
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid diary entry');
  });

  it('rejects payloads above the API limit', async () => {
    const response = await request(app)
      .post('/diary')
      .set('Authorization', `Bearer ${jwt.sign({ id: 42 }, process.env.JWT_SECRET!)}`)
      .send({ note: 'x'.repeat(150_000) });
    expect(response.status).toBe(413);
  });
});
