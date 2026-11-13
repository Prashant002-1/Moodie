import request from 'supertest';
import app from '../src/app';
import pool from '../src/config/database';
import { hashToken } from '../src/services/sessionService';

const password = 'a-long-test-password';
const feelings = { neutral: 0, happy: .8, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: .2 };
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const cookieOf = (response: request.Response) => response.headers['set-cookie'][0].split(';')[0];
const post = (path: string, cookie?: string) => request(app).post(`/api${path}`).set('X-Moodie-Request', '1').set('Cookie', cookie || '');
const patch = (path: string, cookie: string) => request(app).patch(`/api${path}`).set('X-Moodie-Request', '1').set('Cookie', cookie);
const del = (path: string, cookie: string) => request(app).delete(`/api${path}`).set('X-Moodie-Request', '1').set('Cookie', cookie);
const get = (path: string, cookie?: string) => request(app).get(`/api${path}`).set('Cookie', cookie || '');
const register = (name: string) => post('/auth/register').send({ email: `${name}@example.test`, username: name, password });

beforeEach(async () => {
  await pool.query('TRUNCATE users, movies, auth_attempts RESTART IDENTITY CASCADE');
  await pool.query("INSERT INTO movies (id, title, overview, release_date) VALUES (101,'Shared Film','An existing film','2020-01-01'), (102,'Next Film','A second film','2021-01-01')");
});

it('registers, restores, signs out, and signs in to the same independent account', async () => {
  const alice = await register('alice');
  expect(alice.status).toBe(201);
  expect(alice.body.user).toMatchObject({ username: 'alice', email: 'alice@example.test', bio: '' });
  expect(alice.body).not.toHaveProperty('token');
  expect(alice.body.recoveryCode).toHaveLength(48);
  expect(alice.headers['set-cookie'][0]).toContain('HttpOnly');
  expect(alice.headers['set-cookie'][0]).toContain('SameSite=Lax');
  const cookie = cookieOf(alice);
  const bob = await register('bob');
  expect(bob.status).toBe(201);
  expect(bob.body.user.id).not.toBe(alice.body.user.id);
  expect((await get('/auth/me', cookie)).body.user.username).toBe('alice');
  expect((await get('/diary', cookie)).body.entries).toEqual([]);
  expect((await get('/library/saved', cookie)).body.films).toEqual([]);
  const stored = await pool.query('SELECT password_hash, recovery_hash FROM users WHERE id = $1', [alice.body.user.id]);
  expect(stored.rows[0].password_hash).toMatch(/^scrypt\$/);
  expect(stored.rows[0].password_hash).not.toContain(password);
  expect(stored.rows[0].recovery_hash).not.toContain(alice.body.recoveryCode);
  const token = cookie.split('=')[1];
  expect((await pool.query('SELECT token_hash FROM sessions WHERE token_hash = $1', [hashToken(token)])).rowCount).toBe(1);
  expect((await post('/auth/logout', cookie)).status).toBe(204);
  expect((await get('/auth/me', cookie)).status).toBe(401);
  const signedIn = await post('/auth/login').send({ identifier: 'ALICE@EXAMPLE.TEST', password });
  expect(signedIn.status).toBe(200);
  expect(signedIn.body.user.id).toBe(alice.body.user.id);
  expect((await get('/auth/me', cookieOf(signedIn))).status).toBe(200);
  expect((await post('/auth/login').send({ identifier: 'alice', password: 'wrong' })).status).toBe(401);
  expect((await post('/auth/register').send({ email: 'other@example.test', username: 'ALICE', password })).status).toBe(409);
});

it('completes the film, diary, social, privacy, and recommendation loop across two accounts', async () => {
  const alice = await register('alice'), bob = await register('bob');
  const a = cookieOf(alice), b = cookieOf(bob);
  expect((await get('/discovery/people', a)).body.people.map((p: any) => p.username)).toContain('bob');
  expect((await post(`/discovery/people/${bob.body.user.id}/follow`, a)).status).toBe(201);
  expect((await post(`/discovery/people/${alice.body.user.id}/follow`, a)).status).toBe(400);
  expect((await get('/discovery/activity', b)).body.activity[0].kind).toBe('follow');
  const mine = await post('/diary', a).send({ movieId: 101, watchedOn: '2026-07-01', note: 'My private words', visibility: 'private', emotions: feelings, expressionImage: photo });
  expect(mine.status).toBe(201);
  expect(mine.body.entry.expression_image_path).toBe(photo);
  const id = mine.body.entry.id;
  expect((await get('/diary', b)).body.entries).toEqual([]);
  expect((await get('/discovery/people/alice', b)).body.entries).toEqual([]);
  expect((await get('/discovery/feed', b)).body.entries).toEqual([]);
  expect((await post(`/discovery/entries/${id}/like`, b)).status).toBe(404);
  expect((await get(`/discovery/entries/${id}/comments`, b)).status).toBe(404);
  expect((await patch(`/diary/${id}`, b).send({ note: 'Not yours' })).status).toBe(404);
  expect((await del(`/diary/${id}`, b)).status).toBe(404);
  const shared = await post('/diary', b).send({ movieId: 101, watchedOn: '2026-07-01', note: 'Shared joy', visibility: 'public', emotions: feelings });
  const next = await post('/diary', b).send({ movieId: 102, watchedOn: '2026-07-02', note: 'Joy in an unexpected place', visibility: 'public', emotions: feelings });
  expect(shared.status).toBe(201); expect(next.status).toBe(201);
  const recs = await post('/recommendations', a).send({ signal: feelings });
  expect(recs.status).toBe(200);
  expect(recs.body.forYou[0].id).toBe(102);
  expect(recs.body.forYou[0].recommended_by[0]).toMatchObject({ username: 'bob', shared_film_title: 'Shared Film', response_id: Number(next.body.entry.id), viewer_shared_note: 'My private words' });
  expect(JSON.stringify((await post('/recommendations', b).send({})).body)).not.toContain('My private words');
  expect((await get('/discovery/feed?scope=following', a)).body.entries).toHaveLength(2);
  expect((await post('/library/saved', a).send({ movieId: 102 })).status).toBe(201);
  await post('/library/saved', a).send({ movieId: 102 });
  expect((await get('/library/saved', a)).body.films).toHaveLength(1);
  expect((await get('/library/saved', b)).body.films).toEqual([]);
  expect((await patch(`/diary/${id}`, a).send({ visibility: 'public', expressionImage: null })).status).toBe(200);
  expect((await get('/diary', a)).body.entries[0].expression_image_path).toBeNull();
  await post(`/discovery/entries/${id}/like`, b); await post(`/discovery/entries/${id}/like`, b);
  const comment = await post(`/discovery/entries/${id}/comments`, b).send({ body: 'Same here.' });
  expect(comment.status).toBe(201);
  expect((await get(`/discovery/entries/${id}/comments`, b)).body.comments[0].own).toBe(true);
  expect((await del(`/discovery/comments/${comment.body.comment.id}`, a)).status).toBe(404);
  expect((await get('/discovery/activity', a)).body.activity.map((e: any) => e.kind).sort()).toEqual(['comment','like']);
  expect((await get('/discovery/films/101', b)).body.entries.find((e: any) => e.user_id === alice.body.user.id).like_count).toBe(1);
  await patch(`/diary/${id}`, a).send({ visibility: 'private' });
  expect((await get(`/discovery/entries/${id}/comments`, b)).status).toBe(404);
  expect((await get('/discovery/activity', a)).body.activity).toEqual([]);
  expect(JSON.stringify((await get('/discovery/pulse', b)).body)).not.toContain('My private words');
  expect((await del(`/discovery/comments/${comment.body.comment.id}`, b)).status).toBe(204);
  expect((await del(`/discovery/entries/${id}/like`, b)).status).toBe(204);
  expect((await del('/library/saved/102', a)).status).toBe(204);
  const rewatch = await post('/diary', a).send({ movieId: 101, watchedOn: '2026-07-02', note: 'Felt different', emotions: { ...feelings, happy: 0, sad: 1 } });
  expect(rewatch.status).toBe(201); expect(rewatch.body.entry.id).not.toBe(id);
  expect((await get('/diary/summary', a)).body.entries).toBe(2);
  expect((await del(`/diary/${id}`, a)).status).toBe(204);
  expect((await get('/diary/summary', a)).body.entries).toBe(1);
  expect((await del(`/discovery/people/${bob.body.user.id}/follow`, a)).status).toBe(204);
  expect((await get('/discovery/feed?scope=following', a)).body.entries).toEqual([]);
});

it('updates profile, rotates passwords and recovery codes, revokes sessions, and deletes owned data', async () => {
  const first = await register('alice'); const cookie = cookieOf(first);
  const second = await post('/auth/login').send({ identifier: 'alice', password });
  const profile = await patch('/auth/profile', cookie).send({ bio: 'Films stayed with me.' });
  expect(profile.status).toBe(200);
  expect((await get('/discovery/people/alice')).body.person.bio).toBe('Films stayed with me.');
  const changed = await post('/auth/password', cookie).send({ currentPassword: password, password: 'another-good-password' });
  expect(changed.status).toBe(200);
  expect((await get('/auth/me', cookie)).status).toBe(401);
  expect((await get('/auth/me', cookieOf(second))).status).toBe(401);
  expect((await get('/auth/me', cookieOf(changed))).status).toBe(200);
  expect((await post('/auth/login').send({ identifier: 'alice', password })).status).toBe(401);
  const recovered = await post('/auth/recover').send({ identifier: 'alice', recoveryCode: first.body.recoveryCode, password: 'recovered-password' });
  expect(recovered.status).toBe(200);
  expect(recovered.body.recoveryCode).not.toBe(first.body.recoveryCode);
  expect((await get('/auth/me', cookieOf(changed))).status).toBe(401);
  expect((await post('/auth/recover').send({ identifier: 'alice', recoveryCode: first.body.recoveryCode, password })).status).toBe(400);
  const current = cookieOf(recovered);
  await post('/diary', current).send({ movieId: 101, watchedOn: '2026-07-01', emotions: feelings, expressionImage: photo });
  await post('/library/saved', current).send({ movieId: 102 });
  expect((await del('/auth/account', current).send({ password: 'wrong' })).status).toBe(400);
  expect((await del('/auth/account', current).send({ password: 'recovered-password' })).status).toBe(204);
  expect((await get('/auth/me', current)).status).toBe(401);
  expect((await get('/discovery/people/alice')).status).toBe(404);
  for (const table of ['diary_entries','entry_media','sessions','saved_films']) expect((await pool.query(`SELECT * FROM ${table}`)).rowCount).toBe(0);
});

it('paginates diary and feed so older records remain reachable', async () => {
  const alice = await register('alice'); const cookie = cookieOf(alice);
  await pool.query(`INSERT INTO diary_entries (user_id, movie_id, watched_on, note, visibility, happy)
    SELECT $1, 101, '2026-07-01', 'Response ' || n, 'public', 1 FROM generate_series(1, 125) n`, [alice.body.user.id]);
  const diary = await get('/diary?limit=100', cookie);
  expect(diary.body.entries).toHaveLength(100); expect(diary.body.nextOffset).toBe(100);
  const older = await get('/diary?limit=100&offset=100', cookie);
  expect(older.body.entries).toHaveLength(25); expect(older.body.nextOffset).toBeNull();
  expect(new Set([...diary.body.entries, ...older.body.entries].map((e: any) => e.id)).size).toBe(125);
  expect((await get('/discovery/films/101', cookie)).body.entries).toHaveLength(125);
  expect((await get('/discovery/people/alice', cookie)).body.entries).toHaveLength(125);
  expect((await get('/discovery/feed?limit=60', cookie)).body.nextOffset).toBe(60);
});

it('rate limits repeated authentication attempts', async () => {
  for (let i = 0; i < 40; i++) expect((await post('/auth/login').send({})).status).toBe(400);
  expect((await post('/auth/login').send({})).status).toBe(429);
});

it('paginates an active feed without repeating or dropping old responses when a new response arrives', async () => {
  const alice = await register('alice'); const cookie = cookieOf(alice);
  await pool.query(`INSERT INTO diary_entries (user_id, movie_id, note, visibility, happy)
    SELECT $1, 101, 'Response ' || n, 'public', 1 FROM generate_series(1, 10) n`, [alice.body.user.id]);
  const first = await get('/discovery/feed?limit=6', cookie);
  expect(first.status).toBe(200);
  const inserted = await post('/diary', cookie).send({ movieId: 102, watchedOn: '2026-07-02', note: 'Just arrived', visibility: 'public', emotions: feelings });
  expect(inserted.status).toBe(201);
  const next = await get('/discovery/feed?limit=6&cursor=' + first.body.nextCursor, cookie);
  expect(next.status).toBe(200);
  expect(next.body.entries).toHaveLength(4);
  expect(new Set([...first.body.entries, ...next.body.entries].map((e: any) => e.id)).size).toBe(10);
  expect(next.body.nextCursor).toBeNull();
  expect((await get('/discovery/feed?cursor=bad', cookie)).status).toBe(400);
});
