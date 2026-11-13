import request from 'supertest';
import { randomUUID } from 'crypto';
import app from '../src/app';
import pool from '../src/config/database';
const get = (path: string, cookie: string) => request(app).get(`/api${path}`).set('Cookie', cookie);
const register = async (username: string) => {
  const result = await request(app).post('/api/auth/register').set('X-Moodie-Request', '1').send({ username, email: `${username}@example.test`, password: 'social-test-password' });
  expect(result.status).toBe(201);
  return { id: Number(result.body.user.id), cookie: result.headers['set-cookie'][0].split(';')[0] };
};
beforeEach(async () => {
  await pool.query('TRUNCATE users, movies, auth_attempts, moderation_actions RESTART IDENTITY CASCADE');
  await pool.query("INSERT INTO movies(id,title) VALUES(101,'A film')");
});
it('applies Following before cursor pagination rather than filtering a slice of Everyone', async () => {
  const viewer = await register('feed_viewer'), peer = await register('followed_peer'), other = await register('other_peer');
  await pool.query('INSERT INTO follows(follower_id,followed_id) VALUES($1,$2)', [viewer.id, peer.id]);
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,note,visibility,happy,created_at)
    SELECT $1,101,'Newer unconnected ' || n,'public',0.4,CURRENT_TIMESTAMP + n * INTERVAL '1 second' FROM generate_series(1,65) n`, [other.id]);
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,note,visibility,happy,created_at) VALUES
    ($1,101,'Older followed response','public',0.7,'2020-01-01'),($1,101,'More recent followed response','public',0.8,'2021-01-01'),
    ($1,101,'Private follow response','private',0.8,'2022-01-01')`, [peer.id]);
  const first = await get('/discovery/feed?scope=following&limit=1', viewer.cookie);
  expect(first.status).toBe(200);
  expect(first.body.entries[0].note).toBe('More recent followed response');
  const next = await get(`/discovery/feed?scope=following&limit=1&cursor=${encodeURIComponent(first.body.nextCursor)}`, viewer.cookie);
  expect(next.body.entries[0].note).toBe('Older followed response');
  expect(next.body.nextCursor).toBeNull();
});
it('filters people before limiting and keeps followed people out of Discover', async () => {
  const viewer = await register('people_viewer');
  await pool.query(`INSERT INTO users(username,email,password_hash,bio)
    SELECT 'peer' || LPAD(n::text,2,'0'), 'peer' || n || '@example.test','unused',CASE WHEN n=30 THEN '100%_literal' ELSE '' END FROM generate_series(1,30) n`);
  const peer = (await pool.query("SELECT id FROM users WHERE username='peer30'")).rows[0];
  await pool.query('INSERT INTO follows(follower_id,followed_id) VALUES($1,$2)', [viewer.id, peer.id]);
  const first = await get('/discovery/people?limit=3&scope=discover', viewer.cookie);
  expect(first.status).toBe(200);
  expect(first.body.people).toHaveLength(3);
  expect(first.body.nextOffset).toBe(3);
  expect(first.body.people.every((person: { following: boolean }) => !person.following)).toBe(true);
  const filtered = await get('/discovery/people?limit=1&q=%25_&scope=following', viewer.cookie);
  expect(filtered.body.people).toEqual([expect.objectContaining({ id: peer.id, following: true, username: 'peer30' })]);
  expect(filtered.body.nextOffset).toBeNull();
  expect((await get('/discovery/people?limit=1&q=peer30&scope=discover', viewer.cookie)).body.people).toEqual([]);
  const legacy = await get('/discovery/people', viewer.cookie);
  expect(legacy.body.people).toHaveLength(30);
  await pool.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)', [peer.id,viewer.id]);
  expect((await get('/discovery/people?limit=1&q=peer30', viewer.cookie)).body.people).toEqual([]);
});
it('finds old filtered activity and distinguishes comments created at exactly the same time', async () => {
  const viewer = await register('activity_viewer'), peer = await register('activity_peer');
  await pool.query('INSERT INTO follows(follower_id,followed_id,created_at) VALUES($1,$2,$3)', [peer.id,viewer.id,'2020-01-01']);
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,note,visibility,happy)
    SELECT $1,101,'Owner viewing ' || n,'public',0.5 FROM generate_series(1,85) n`, [viewer.id]);
  await pool.query('INSERT INTO entry_reactions(user_id,entry_id) SELECT $1,id FROM diary_entries', [peer.id]);
  const follow = await get('/discovery/activity?kind=follow&limit=1', viewer.cookie);
  expect(follow.status).toBe(200);
  expect(follow.body.activity).toEqual([expect.objectContaining({ kind: 'follow', event_id: `follow:${peer.id}:${viewer.id}` })]);
  await pool.query(`INSERT INTO entry_comments(entry_id,user_id,body,created_at) VALUES
    (1,$1,'First comment','2022-01-01'),(1,$1,'Second comment','2022-01-01')`, [peer.id]);
  const first = await get('/discovery/activity?kind=comment&limit=1', viewer.cookie);
  const second = await get('/discovery/activity?kind=comment&limit=1&offset=1', viewer.cookie);
  expect(first.body.activity[0].event_id).not.toBe(second.body.activity[0].event_id);
  expect(first.body.activity[0].comment_body).not.toBe(second.body.activity[0].comment_body);
  expect(second.body.nextOffset).toBeNull();
  expect((await get('/discovery/activity?kind=unknown', viewer.cookie)).status).toBe(400);
});
it('opts into recommendations and stable conversation events without exposing spoiler previews', async () => {
  const viewer = await register('message_viewer'), peer = await register('message_peer');
  const suggestion = (await pool.query(`INSERT INTO film_suggestions(sender_id,recipient_id,movie_id,origin,reason,shared_at)
    VALUES($1,$2,101,'sent','For your quiet evening',CURRENT_TIMESTAMP) RETURNING id`, [peer.id,viewer.id])).rows[0];
  await pool.query(`INSERT INTO suggestion_messages(suggestion_id,user_id,client_request_id,body,contains_spoilers,created_at) VALUES
    ($1,$2,$3,'Secret ending',true,'2023-01-01'),($1,$2,$4,'Did it stay with you?',false,'2023-01-01')`, [suggestion.id,peer.id,randomUUID(),randomUUID()]);
  expect((await get('/discovery/activity?kind=recommendations', viewer.cookie)).body.activity).toEqual([]);
  const page = await get('/discovery/activity?includeSuggestions=true&kind=recommendations', viewer.cookie);
  expect(page.status).toBe(200);
  expect(page.body.activity).toHaveLength(3);
  expect(new Set(page.body.activity.map((event: { event_id: string }) => event.event_id)).size).toBe(3);
  expect(JSON.stringify(page.body)).not.toContain('Secret ending');
  expect(page.body.activity.every((event: { suggestion_id: number }) => event.suggestion_id === suggestion.id)).toBe(true);
  await pool.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)', [viewer.id,peer.id]);
  expect((await get('/discovery/activity?includeSuggestions=true', viewer.cookie)).body.activity).toEqual([]);
});

it('pages film responses after scope and safety filters and keeps totals independent of the page', async () => {
  const viewer = await register('film_viewer'), peer = await register('film_peer'), other = await register('film_other');
  await pool.query('INSERT INTO follows(follower_id,followed_id) VALUES($1,$2)', [viewer.id,peer.id]);
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,note,visibility,happy,created_at) VALUES
    ($1,101,'Older','public',0.2,'2020-01-01'),($1,101,'Newer','public',0.8,'2021-01-01'),($1,101,'Private','private',1,'2022-01-01'),
    ($2,101,'Other','public',1,'2023-01-01')`, [peer.id,other.id]);
  const first = await get('/discovery/films/101?scope=following&limit=1', viewer.cookie);
  expect(first.status).toBe(200);
  expect(first.body.entries.map((entry: { note: string }) => entry.note)).toEqual(['Newer']);
  expect(first.body.summary.total).toBe(2);
  expect(first.body.summary.happy).toBeCloseTo(0.5);
  expect(first.body.film).toEqual(expect.objectContaining({ id: 101, title: 'A film' }));
  const second = await get(`/discovery/films/101?scope=following&limit=1&offset=${first.body.nextOffset}`, viewer.cookie);
  expect(second.body.entries[0].note).toBe('Older'); expect(second.body.nextOffset).toBeNull();
  expect((await get('/discovery/films/101', viewer.cookie)).body.entries).toHaveLength(3);
  await pool.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)', [viewer.id,peer.id]);
  const blocked = await get('/discovery/films/101?scope=following&limit=1', viewer.cookie);
  expect(blocked.body.entries).toEqual([]); expect(blocked.body.summary.total).toBe(0);
  expect(blocked.body.summary.happy).toBeNull();
});

it('pages profile responses and distinct films separately, with authoritative follow eligibility', async () => {
  const viewer = await register('z_profile_viewer'), peer = await register('profile_peer'), hidden = await register('a_hidden');
  await pool.query("INSERT INTO movies(id,title) VALUES(102,'Second film')");
  await pool.query(`INSERT INTO follows(follower_id,followed_id) VALUES($1,$2),($1,$3),($2,$1)`, [peer.id,viewer.id,hidden.id]);
  await pool.query(`INSERT INTO diary_entries(user_id,movie_id,note,visibility,watched_on,created_at) VALUES
    ($1,101,'Old rewatch','public','2020-01-01','2020-01-01'),($1,101,'Latest rewatch','public','2024-01-01','2024-01-01'),
    ($1,102,'Other public film','public','2021-01-01','2021-01-01'),($1,102,'Private rewatch','private','2025-01-01','2025-01-01')`, [peer.id]);
  const first = await get('/discovery/people/profile_peer?limit=1&view=films&includeConnections=false', viewer.cookie);
  expect(first.status).toBe(200);
  expect(first.body.person).toEqual(expect.objectContaining({ entries: 3, films: 2, follows_you: true, following: true }));
  expect(first.body.entries[0].note).toBe('Latest rewatch'); expect(first.body.following).toEqual([]);
  const next = await get(`/discovery/people/profile_peer?limit=1&view=films&offset=${first.body.nextOffset}`, viewer.cookie);
  expect(next.body.entries[0].note).toBe('Other public film'); expect(next.body.nextOffset).toBeNull();
  const connections = await get('/discovery/people/profile_peer/connections?kind=following&limit=1', viewer.cookie);
  expect(connections.status).toBe(200); expect(connections.body.people[0].username).toBe('a_hidden'); expect(connections.body.nextOffset).toBe(1);
  expect((await get('/discovery/people/profile_peer/connections?kind=following&limit=1&offset=1', viewer.cookie)).body.people[0].id).toBe(viewer.id);
  await pool.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)', [viewer.id,hidden.id]);
  expect((await get('/discovery/people/profile_peer/connections?kind=following&limit=1', viewer.cookie)).body.people[0].id).toBe(viewer.id);
  const legacy = await get('/discovery/people/profile_peer', viewer.cookie);
  expect(legacy.body.entries).toHaveLength(3);
  expect(legacy.body.person.following_count).toBe(1);
});

it('pages comments deterministically and gives the same visible count on every response surface', async () => {
  const viewer = await register('comment_viewer'), peer = await register('comment_peer'), hidden = await register('comment_hidden');
  await pool.query("INSERT INTO diary_entries(user_id,movie_id,visibility) VALUES($1,101,'public')", [peer.id]);
  await pool.query(`INSERT INTO entry_comments(entry_id,user_id,body,created_at) VALUES
    (1,$1,'First','2020-01-01'),(1,$1,'Second','2020-01-01'),(1,$2,'Blocked comment','2020-01-01'),(1,$1,'Moderated comment','2020-01-01')`, [peer.id,hidden.id]);
  await pool.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)', [viewer.id,hidden.id]);
  await pool.query("INSERT INTO moderation_actions(target_kind,target_id,reason) VALUES('comment',4,'test')");
  const first = await get('/discovery/entries/1/comments?limit=1', viewer.cookie);
  expect(first.status).toBe(200); expect(first.body.comments[0].body).toBe('First'); expect(first.body.total).toBe(2);
  const next = await get('/discovery/entries/1/comments?limit=1&offset=1', viewer.cookie);
  expect(next.body.comments[0].body).toBe('Second'); expect(next.body.nextOffset).toBeNull();
  expect((await get('/discovery/entries/1', viewer.cookie)).body.entry.comment_count).toBe(2);
  expect((await get('/discovery/people/comment_peer?limit=1', viewer.cookie)).body.entries[0].comment_count).toBe(2);
  expect((await get('/discovery/films/101?limit=1', viewer.cookie)).body.entries[0].comment_count).toBe(2);
  expect((await get('/discovery/feed?limit=1', viewer.cookie)).body.entries[0].comment_count).toBe(2);
  expect((await get('/discovery/entries/1/comments', viewer.cookie)).body.comments).toHaveLength(2);
  await pool.query("UPDATE diary_entries SET visibility='private' WHERE id=1");
  expect((await get('/discovery/entries/1/comments?limit=1', viewer.cookie)).status).toBe(404);
});
