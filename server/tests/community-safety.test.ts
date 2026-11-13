import request from 'supertest';
import app from '../src/app';
import pool from '../src/config/database';
const password = 'safe-test-password';
const feelings = { neutral: 0, happy: 1, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 };
const post = (path: string, cookie = '') => request(app).post('/api' + path).set('X-Moodie-Request', '1').set('Cookie', cookie);
const get = (path: string, cookie = '') => request(app).get('/api' + path).set('Cookie', cookie);
const del = (path: string, cookie: string) => request(app).delete('/api' + path).set('X-Moodie-Request', '1').set('Cookie', cookie);
async function account(username: string) {
  const r = await post('/auth/register').send({ username, email: username + '@example.test', password });
  expect(r.status).toBe(201); return { id: r.body.user.id, cookie: r.headers['set-cookie'][0].split(';')[0] };
}
async function entry(cookie: string, id = 101, visibility = 'public') {
  const r = await post('/diary', cookie).send({ movieId: id, watchedOn: '2026-07-01', visibility, emotions: feelings, note: 'This film felt unexpectedly joyful.' });
  expect(r.status).toBe(201); return r.body.entry.id;
}
beforeEach(async () => {
  await pool.query('TRUNCATE users, movies, auth_attempts, moderation_actions RESTART IDENTITY CASCADE');
  await pool.query("INSERT INTO movies(id,title) VALUES (101,'Shared film'),(102,'Another film')");
});
it('enforces blocking in both directions across discovery, interactions, profiles, and recommendation sources', async () => {
  const a = await account('alice'), b = await account('bob');
  await entry(a.cookie); const bobEntry = await entry(b.cookie); await entry(b.cookie, 102);
  await post(`/discovery/people/${b.id}/follow`, a.cookie);
  await post(`/discovery/people/${a.id}/follow`, b.cookie);
  expect((await post('/recommendations', a.cookie).send({})).body.forYou).toHaveLength(1);
  expect((await post(`/safety/blocks/${b.id}`, a.cookie)).status).toBe(201);
  expect((await get('/safety/blocks', a.cookie)).body.people[0].id).toBe(b.id);
  expect((await get('/discovery/feed', a.cookie)).body.entries.every((e: any) => e.user_id !== b.id)).toBe(true);
  expect((await get('/discovery/feed', b.cookie)).body.entries.every((e: any) => e.user_id !== a.id)).toBe(true);
  expect((await get('/discovery/people', a.cookie)).body.people).toEqual([]);
  expect((await get('/discovery/people/bob', a.cookie)).status).toBe(404);
  expect((await get('/discovery/films/101', a.cookie)).body.entries).toHaveLength(1);
  expect((await get(`/discovery/entries/${bobEntry}/comments`, a.cookie)).status).toBe(404);
  expect((await post(`/discovery/entries/${bobEntry}/comments`, a.cookie).send({ body: 'Hello' })).status).toBe(404);
  expect((await post(`/discovery/entries/${bobEntry}/like`, a.cookie)).status).toBe(404);
  expect((await post(`/discovery/people/${a.id}/follow`, b.cookie)).status).toBe(404);
  expect((await post('/recommendations', a.cookie).send({})).body.forYou).toEqual([]);
  expect((await get('/discovery/pulse', a.cookie)).body.films.every((f: any) => f.latest_username !== 'bob')).toBe(true);
  expect((await get('/discovery/activity', a.cookie)).body.activity).toEqual([]);
  expect((await pool.query('SELECT * FROM follows')).rowCount).toBe(0);
  expect((await del(`/safety/blocks/${b.id}`, a.cookie)).status).toBe(204);
  expect((await get('/discovery/people/bob', a.cookie)).status).toBe(200);
});
it('reports only visible content, deduplicates reports, and never exposes private responses', async () => {
  const a = await account('alice'), b = await account('bob');
  const publicID = await entry(b.cookie), privateID = await entry(b.cookie, 102, 'private');
  const input = { targetKind: 'response', targetId: publicID, reason: 'Harassment', details: 'Please review this response.' };
  expect((await post('/safety/reports').send(input)).status).toBe(401);
  expect((await post('/safety/reports', a.cookie).send({ ...input, targetId: privateID })).status).toBe(404);
  expect((await post('/safety/reports', a.cookie).send(input)).status).toBe(201);
  expect((await post('/safety/reports', a.cookie).send(input)).status).toBe(201);
  expect((await pool.query('SELECT * FROM moderation_reports')).rowCount).toBe(1);
  expect((await post(`/safety/blocks/${a.id}`, a.cookie)).status).toBe(400);
  await pool.query("INSERT INTO moderation_actions(target_kind,target_id,reason) VALUES ('response',$1,'Reviewed and removed')", [publicID]);
  expect((await get('/discovery/feed', a.cookie)).body.entries).toEqual([]);
  expect((await get('/discovery/people/bob', a.cookie)).body.entries).toEqual([]);
  expect((await get('/discovery/films/101', a.cookie)).body.entries).toEqual([]);
  expect((await get(`/discovery/entries/${publicID}/comments`, a.cookie)).status).toBe(404);
  expect((await post('/recommendations', a.cookie).send({})).body.community).toEqual([]);
  expect((await get('/diary', b.cookie)).body.entries).toHaveLength(2);
});
it('filters removed and blocked comments and restricts posting while preserving account management', async () => {
  const a = await account('alice'), b = await account('bob'), c = await account('clara');
  const id = await entry(c.cookie);
  const r = await post(`/discovery/entries/${id}/comments`, b.cookie).send({ body: 'Comment to review' });
  expect(r.status).toBe(201);
  await post(`/safety/blocks/${b.id}`, a.cookie);
  expect((await get(`/discovery/entries/${id}/comments`, a.cookie)).body.comments).toEqual([]);
  expect((await get(`/discovery/entries/${id}/comments`, c.cookie)).body.comments).toHaveLength(1);
  await pool.query("INSERT INTO moderation_actions(target_kind,target_id,reason) VALUES ('comment',$1,'Removed')", [r.body.comment.id]);
  expect((await get(`/discovery/entries/${id}/comments`, c.cookie)).body.comments).toEqual([]);
  expect((await get('/discovery/activity', c.cookie)).body.activity).toEqual([]);
  await pool.query("INSERT INTO moderation_actions(target_kind,target_id,reason) VALUES ('person',$1,'Restricted')", [b.id]);
  expect((await post('/diary', b.cookie).send({ movieId: 101, watchedOn: '2026-07-01', emotions: feelings })).status).toBe(403);
  expect((await get('/auth/me', b.cookie)).status).toBe(200);
  expect((await del('/auth/account', b.cookie).send({ password })).status).toBe(204);
});
it('opens exact activity responses while enforcing private ownership and blocked visibility', async () => {
  const a = await account('alice'), b = await account('bob');
  const publicID = await entry(b.cookie), privateID = await entry(b.cookie, 102, 'private');
  expect((await get(`/discovery/entries/${publicID}`, a.cookie)).body.entry.id).toBe(publicID);
  expect((await get(`/discovery/entries/${privateID}`, a.cookie)).status).toBe(404);
  expect((await get(`/discovery/entries/${privateID}`, b.cookie)).body.entry.visibility).toBe('private');
  await post(`/safety/blocks/${b.id}`, a.cookie);
  expect((await get(`/discovery/entries/${publicID}`, a.cookie)).status).toBe(404);
});
it('pages blocked people in stable order and preserves all-results legacy reads', async () => {
  const a = await account('alice'), b = await account('bob'), c = await account('clara');
  await post(`/safety/blocks/${c.id}`, a.cookie);
  await post(`/safety/blocks/${b.id}`, a.cookie);
  const first = await get('/safety/blocks?limit=1', a.cookie);
  expect(first.status).toBe(200);
  expect(first.body.people.map((p: any) => p.id)).toEqual([b.id]);
  expect(first.body.nextOffset).toBe(1);
  const second = await get('/safety/blocks?limit=1&offset=1', a.cookie);
  expect(second.body.people.map((p: any) => p.id)).toEqual([c.id]);
  expect(second.body.nextOffset).toBeNull();
  expect((await get('/safety/blocks', a.cookie)).body.people).toHaveLength(2);
  expect((await get('/safety/blocks?limit=1', b.cookie)).body.people).toEqual([]);
  expect((await get('/safety/blocks?limit=101', a.cookie)).status).toBe(400);
});
