import request from 'supertest';
import app from '../src/app';
import pool from '../src/config/database';
const get = (path: string, cookie: string) => request(app).get(`/api${path}`).set('Cookie', cookie);
const register = async (username: string) => {
  const result = await request(app).post('/api/auth/register').set('X-Moodie-Request', '1')
    .send({ username, email: `${username}@example.test`, password: 'platform-test-password' });
  expect(result.status).toBe(201);
  return { id: Number(result.body.user.id), cookie: result.headers['set-cookie'][0].split(';')[0] };
};
beforeEach(async () => {
  await pool.query('TRUNCATE users, movies, auth_attempts, moderation_actions RESTART IDENTITY CASCADE');
  await pool.query("INSERT INTO movies(id,title,release_date) SELECT n,'Film ' || n,'2020-01-01' FROM generate_series(101,160) n");
});

it('pages and searches the saved library before limiting without changing legacy reads', async () => {
  const owner = await register('saved_owner'), other = await register('saved_other');
  await pool.query('INSERT INTO saved_films(user_id,movie_id) SELECT $1,id FROM movies ORDER BY id', [owner.id]);
  await pool.query('INSERT INTO saved_films(user_id,movie_id) VALUES($1,101)', [other.id]);
  const first = await get('/library/saved?limit=10', owner.cookie);
  expect(first.status).toBe(200);
  expect(first.body.films).toHaveLength(10);
  expect(first.body.nextOffset).toBe(10);
  const second = await get('/library/saved?limit=10&offset=10', owner.cookie);
  expect(new Set([...first.body.films, ...second.body.films].map((film: { id: number }) => film.id)).size).toBe(20);
  const filtered = await get('/library/saved?limit=1&q=Film%20101', owner.cookie);
  expect(filtered.body.films).toEqual([expect.objectContaining({ movie_id: 101 })]);
  expect(filtered.body.nextOffset).toBeNull();
  expect((await get('/library/saved?q=%25_', owner.cookie)).body.films).toEqual([]);
  expect((await get('/library/saved', owner.cookie)).body.films).toHaveLength(60);
  expect((await get('/library/saved?limit=101', owner.cookie)).status).toBe(400);
});

it('returns bounded owner-specific status and authoritative rewatch counts', async () => {
  const owner = await register('status_owner'), other = await register('status_other');
  await pool.query('INSERT INTO saved_films(user_id,movie_id) VALUES($1,101),($2,102)', [owner.id, other.id]);
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,watched_on,note,visibility,happy) VALUES
    ($1,101,CURRENT_DATE,'My first','private',0.8),($1,101,CURRENT_DATE,'My second','public',0.4),
    ($2,102,CURRENT_DATE,'Other person','private',0.5)`, [owner.id,other.id]);
  const status = await get('/library/status?movieIds=101,102,101', owner.cookie);
  expect(status.status).toBe(200);
  expect(status.body.films).toEqual([{ id: 101, saved: true, viewing_count: 2 }, { id: 102, saved: false, viewing_count: 0 }]);
  expect((await get('/diary/summary', owner.cookie)).body).toMatchObject({ entries: 2, public_entries: 1, rewatches: 1, saved: 1 });
  expect((await get('/library/status?movieIds=bad', owner.cookie)).status).toBe(400);
  expect((await get('/library/status?movieIds=2147483648', owner.cookie)).status).toBe(400);
  expect((await get('/library/status?movieIds=' + Array.from({ length: 101 }, (_, i) => i + 1).join(','), owner.cookie)).status).toBe(400);
  expect((await request(app).get('/api/library/status?movieIds=101')).status).toBe(401);
});

it('finds shared films throughout history and returns only the viewers private side', async () => {
  const viewer = await register('shared_viewer'), peer = await register('shared_peer'), stranger = await register('shared_stranger');
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,watched_on,note,visibility,happy)
    SELECT $1,id,CURRENT_DATE,'My private words ' || id,'private',0.7 FROM movies`, [viewer.id]);
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,watched_on,note,visibility,happy) VALUES
    ($1,101,'2020-01-01','First public','public',0.2),($1,101,'2021-01-01','Latest public','public',0.5),
    ($1,101,CURRENT_DATE,'Never expose this private rewatch','private',0.9),($1,102,'2020-01-01','Another public','public',0.4)`, [peer.id]);
  const first = await get('/discovery/people/shared_peer/shared?limit=1', viewer.cookie);
  expect(first.status).toBe(200);
  expect(first.body.films).toHaveLength(1);
  expect(first.body.films[0]).toMatchObject({ id: 101, personEntry: { note: 'Latest public' }, ownEntry: { note: 'My private words 101', visibility: 'private' } });
  expect(first.body.nextOffset).toBe(1);
  const second = await get('/discovery/people/shared_peer/shared?limit=1&offset=1', viewer.cookie);
  expect(second.body.films[0].id).toBe(102);
  expect(second.body.nextOffset).toBeNull();
  expect((await get('/discovery/people/shared_peer/shared', stranger.cookie)).body.films).toEqual([]);
  expect((await request(app).get('/api/discovery/people/shared_peer/shared')).status).toBe(401);
  await pool.query("UPDATE diary_entries SET visibility='private' WHERE user_id=$1 AND movie_id=101", [peer.id]);
  expect((await get('/discovery/people/shared_peer/shared', viewer.cookie)).body.films.map((film: { id: number }) => film.id)).toEqual([102]);
});

it('applies response moderation and mutual blocking before shared-film paging', async () => {
  const viewer = await register('safe_viewer'), peer = await register('safe_peer');
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,watched_on,note,visibility,happy) VALUES
    ($1,101,CURRENT_DATE,'Mine','private',0.7),($2,101,CURRENT_DATE,'Hidden','public',0.5)`, [viewer.id,peer.id]);
  const before = await get('/discovery/people/safe_peer/shared', viewer.cookie);
  expect(before.body.films).toHaveLength(1);
  const entryId = before.body.films[0].personEntry.id;
  await pool.query("INSERT INTO moderation_actions(target_kind,target_id,reason) VALUES('response',$1,'QA fixture')", [entryId]);
  expect((await get('/discovery/people/safe_peer/shared', viewer.cookie)).body.films).toEqual([]);
  await pool.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)', [peer.id,viewer.id]);
  expect((await get('/discovery/people/safe_peer/shared', viewer.cookie)).status).toBe(404);
});
