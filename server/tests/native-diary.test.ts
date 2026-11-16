import request from 'supertest';
import app from '../src/app';
import pool from '../src/config/database';

const get = (path: string, cookie: string) => request(app).get(`/api${path}`).set('Cookie', cookie);
const register = async (name: string) => {
  const response = await request(app).post('/api/auth/register').set('X-Moodie-Request', '1')
    .send({ username: name, email: `${name}@example.test`, password: 'native-test-password' });
  expect(response.status).toBe(201);
  return { id: Number(response.body.user.id), cookie: response.headers['set-cookie'][0].split(';')[0] };
};
beforeEach(async () => {
  await pool.query('TRUNCATE users, movies, auth_attempts RESTART IDENTITY CASCADE');
  await pool.query("INSERT INTO movies(id,title,release_date) VALUES(101,'A Shared Film','2020-01-01'),(102,'Another Film','2021-01-01')");
});

it('searches the complete owner diary before pagination and treats query characters literally', async () => {
  const owner = await register('diary_owner'), other = await register('other_owner');
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,watched_on,note,visibility,happy)
    SELECT $1,101,CURRENT_DATE,'Ordinary viewing ' || n,'public',0.6 FROM generate_series(1,55) n`, [owner.id]);
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,watched_on,note,visibility,happy) VALUES
    ($1,102,'2020-01-01','100%_stayed with me','private',0.8),
    ($2,102,'2020-01-01','100%_belongs to another person','private',0.4)`, [owner.id, other.id]);
  expect((await get('/diary?limit=50', owner.cookie)).body.entries).toHaveLength(50);
  const found = await get('/diary?q=%25_&visibility=private&limit=1', owner.cookie);
  expect(found.status).toBe(200);
  expect(found.body.entries).toHaveLength(1);
  expect(found.body.entries[0].note).toBe('100%_stayed with me');
  expect(found.body.nextOffset).toBeNull();
  expect((await get('/diary?q=100&visibility=public', owner.cookie)).body.entries).toEqual([]);
  expect((await get('/diary?q=ANOTHER', owner.cookie)).body.entries).toHaveLength(1);
  expect((await get('/diary?visibility=everything', owner.cookie)).status).toBe(400);
});

it('returns every viewing of one film with an owner-scoped rewatch count', async () => {
  const owner = await register('rewatch_owner'), other = await register('rewatch_other');
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,watched_on,note,visibility,sad) VALUES
    ($1,101,'2026-01-01','First viewing','private',0.3),($1,101,'2026-02-01','Second viewing','public',0.8),
    ($1,102,'2026-02-01','Other film','private',0.5),($2,101,'2026-03-01','Not mine','private',1)`, [owner.id, other.id]);
  const first = await get('/diary?movieId=101&limit=1', owner.cookie);
  expect(first.body.entries[0]).toMatchObject({ note: 'Second viewing', viewing_count: 2 });
  expect(first.body.nextOffset).toBe(1);
  const second = await get('/diary?movieId=101&limit=1&offset=1', owner.cookie);
  expect(second.body.entries[0]).toMatchObject({ note: 'First viewing', viewing_count: 2 });
  expect(second.body.nextOffset).toBeNull();
  expect((await get('/diary?movieId=-1', owner.cookie)).status).toBe(400);
});

it('describes only the owners past 30 viewing days in the recent summary', async () => {
  const owner = await register('recent_owner'), other = await register('recent_other');
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,watched_on,note,happy,sad) VALUES
    ($1,101,CURRENT_DATE,'Today',0.8,0.2),($1,102,CURRENT_DATE - 29,'In window',0.4,0.6),
    ($1,101,CURRENT_DATE - 30,'Outside window',0,1),($2,102,CURRENT_DATE,'Someone else',1,0)`, [owner.id, other.id]);
  const result = await get('/diary/summary', owner.cookie);
  expect(result.body.entries).toBe(3);
  expect(result.body.recent.entries).toBe(2);
  expect(result.body.recent.feelings.happy).toBeCloseTo(0.6);
  expect(result.body.recent.feelings.sad).toBeCloseTo(0.4);
});

it('returns the viewers actual follow state inside profile connection lists', async () => {
  const viewer = await register('list_viewer'), person = await register('list_person'), third = await register('list_third');
  await pool.query('INSERT INTO follows(follower_id,followed_id) VALUES($1,$2),($2,$3),($1,$3)', [viewer.id,person.id,third.id]);
  const profile = await get('/discovery/people/list_person', viewer.cookie);
  expect(profile.body.following).toEqual([expect.objectContaining({ id: third.id, following: true })]);
  expect(profile.body.followers).toEqual([expect.objectContaining({ id: viewer.id, following: false })]);
});

it('includes followed public responses in activity while respecting private and blocked people', async () => {
  const viewer = await register('activity_viewer'), person = await register('activity_person');
  await pool.query('INSERT INTO follows(follower_id,followed_id) VALUES($1,$2)', [viewer.id, person.id]);
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,watched_on,note,visibility,happy) VALUES
    ($1,101,CURRENT_DATE,'A shared thought','public',0.8),($1,102,CURRENT_DATE,'Private thought','private',0.2)`, [person.id]);
  expect((await get('/discovery/activity', viewer.cookie)).body.activity).toEqual([]);
  const events = await get('/discovery/activity?includeResponses=true', viewer.cookie);
  expect(events.body.activity).toEqual([expect.objectContaining({ kind: 'response', note: 'A shared thought', movie_id: 101 })]);
  await pool.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)', [person.id, viewer.id]);
  expect((await get('/discovery/activity?includeResponses=true', viewer.cookie)).body.activity).toEqual([]);
});

it('preserves visibility in every public response surface so editing does not silently change it', async () => {
  const owner = await register('visibility_owner');
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,watched_on,note,visibility,happy)
    VALUES($1,101,CURRENT_DATE,'Keep this shared','public',0.6)`, [owner.id]);
  for (const path of ['/discovery/feed', '/discovery/films/101', '/discovery/people/visibility_owner']) {
    const result = await get(path, owner.cookie);
    expect(result.status).toBe(200);
    expect(result.body.entries[0]).toMatchObject({ visibility: 'public', note: 'Keep this shared' });
  }
});
