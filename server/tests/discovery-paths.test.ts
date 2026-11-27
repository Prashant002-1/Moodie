import request from 'supertest';
import app from '../src/app';
import pool from '../src/config/database';

const get = (path: string, cookie: string) => request(app).get(`/api${path}`).set('Cookie', cookie);
const register = async (username: string) => {
  const result = await request(app).post('/api/auth/register').set('X-Moodie-Request', '1').send({ username, email: `${username}@example.test`, password: 'discovery-test-password' });
  expect(result.status).toBe(201);
  return { id: Number(result.body.user.id), username, cookie: result.headers['set-cookie'][0].split(';')[0] };
};
type Feelings = Partial<Record<'neutral' | 'happy' | 'sad' | 'angry' | 'fearful' | 'disgusted' | 'surprised', number>>;
const respond = async (userId: number, movieId: number, options: { enjoyment?: string | null; feelings?: Feelings; visibility?: string; note?: string } = {}) => {
  const f = { neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0, ...options.feelings };
  const result = await pool.query(`INSERT INTO diary_entries(user_id,movie_id,note,visibility,enjoyment,neutral,happy,sad,angry,fearful,disgusted,surprised)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
  [userId, movieId, options.note ?? 'A few words.', options.visibility ?? 'public', options.enjoyment ?? null, f.neutral, f.happy, f.sad, f.angry, f.fearful, f.disgusted, f.surprised]);
  return Number(result.rows[0].id);
};
const follow = (a: number, b: number) => pool.query('INSERT INTO follows(follower_id,followed_id) VALUES($1,$2)', [a, b]);
const titles = (body: { films: { film: { title: string } }[] }) => body.films.map(item => item.film.title);

beforeEach(async () => {
  await pool.query('TRUNCATE users, movies, auth_attempts, moderation_actions RESTART IDENTITY CASCADE');
  await pool.query(`INSERT INTO movies(id,title,poster_path) VALUES(10,'Shared','/a.jpg'),(11,'Second shared','/b.jpg'),(20,'Loved','/c.jpg'),(21,'Liked','/d.jpg'),(22,'Mixed','/e.jpg'),(23,'Disliked','/f.jpg'),(30,'Sent','/g.jpg')`);
});

describe('films through people', () => {
  it('requires an account', async () => {
    expect((await request(app).get('/api/discovery/for-you')).status).toBe(401);
  });

  it('offers nothing to someone with no connection, and says they are not connected', async () => {
    const viewer = await register('alone'), other = await register('stranger');
    await respond(other.id, 20, { enjoyment: 'loved' });
    const result = await get('/discovery/for-you', viewer.cookie);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ films: [], connected: false, diary: 0, total: 0 });
  });

  it('reaches a newcomer through the people they follow, warmest verdict first, and names the person and their words', async () => {
    const viewer = await register('newcomer'), friend = await register('friend');
    await follow(viewer.id, friend.id);
    await respond(friend.id, 22, { enjoyment: 'mixed' });
    const loved = await respond(friend.id, 20, { enjoyment: 'loved', feelings: { surprised: 1, happy: 0.6 }, note: 'I walked home the long way.' });
    await respond(friend.id, 21, { enjoyment: 'liked' });
    await respond(friend.id, 23, { enjoyment: 'not_for_me' });
    const result = await get('/discovery/for-you', viewer.cookie);
    expect(titles(result.body)).toEqual(['Loved', 'Liked', 'Mixed']);
    expect(result.body.films[0].paths[0]).toEqual({ person: { id: friend.id, username: 'friend' },
      response: { id: loved, note: 'I walked home the long way.', enjoyment: 'loved', feelings: ['surprised', 'happy'] }, reason: { kind: 'following' } });
    expect(result.body.connected).toBe(true);
  });

  it('goes through a person who felt the same about a shared film, and shows the film and the words in common', async () => {
    const viewer = await register('viewer'), kindred = await register('kindred');
    const mine = await respond(viewer.id, 10, { enjoyment: 'loved', feelings: { fearful: 1, surprised: 0.6 }, visibility: 'private' });
    const theirs = await respond(kindred.id, 10, { enjoyment: 'loved', feelings: { fearful: 1, happy: 0.6 } });
    await respond(kindred.id, 20, { enjoyment: 'loved' });
    const result = await get('/discovery/for-you', viewer.cookie);
    expect(titles(result.body)).toEqual(['Loved']);
    expect(result.body.films[0].paths[0].reason).toEqual({ kind: 'shared', film: { id: 10, title: 'Shared', release_date: null, poster_path: '/a.jpg' },
      feelings: ['fearful'], own_response_id: mine, their_response_id: theirs, own_enjoyment: 'loved', their_enjoyment: 'loved' });
  });

  it('never goes through a private response, a blocked person or a removed response', async () => {
    const viewer = await register('careful'), hidden = await register('hidden'), blocked = await register('blocked'), removed = await register('removed');
    for (const person of [hidden, blocked, removed]) await follow(viewer.id, person.id);
    await respond(hidden.id, 20, { enjoyment: 'loved', visibility: 'private' });
    await respond(blocked.id, 21, { enjoyment: 'loved' });
    const gone = await respond(removed.id, 22, { enjoyment: 'loved' });
    await pool.query('INSERT INTO user_blocks(blocker_id,blocked_id) VALUES($1,$2)', [blocked.id, viewer.id]);
    await pool.query("INSERT INTO moderation_actions(target_kind,target_id,reason) VALUES('response',$1,'Removed')", [gone]);
    expect((await get('/discovery/for-you', viewer.cookie)).body.films).toEqual([]);
  });

  it('gives the same list whatever another person keeps private', async () => {
    const viewer = await register('steady'), friend = await register('open_friend');
    await follow(viewer.id, friend.id);
    await respond(viewer.id, 10, { enjoyment: 'loved', feelings: { happy: 1 } });
    await respond(friend.id, 10, { enjoyment: 'loved', feelings: { happy: 1 } });
    await respond(friend.id, 20, { enjoyment: 'loved' });
    const before = (await get('/discovery/for-you', viewer.cookie)).body;
    await respond(friend.id, 10, { enjoyment: 'not_for_me', feelings: { angry: 1 }, visibility: 'private' });
    await respond(friend.id, 21, { enjoyment: 'loved', visibility: 'private' });
    expect((await get('/discovery/for-you', viewer.cookie)).body).toEqual(before);
  });

  it('counts a recommendation that landed for the person it was sent to, and tells the sender only what a reply told them', async () => {
    const viewer = await register('recipient'), sender = await register('sender');
    await follow(viewer.id, sender.id);
    await pool.query("INSERT INTO film_suggestions(sender_id,recipient_id,movie_id,origin,reason) VALUES($1,$2,30,'sent','For you.')", [sender.id, viewer.id]);
    await respond(viewer.id, 30, { enjoyment: 'loved', visibility: 'private' });
    await respond(sender.id, 20, { enjoyment: 'loved' });
    const mine = await get('/discovery/for-you', viewer.cookie);
    expect(mine.body.films[0].paths[0].reason).toEqual({ kind: 'landed', film: { id: 30, title: 'Sent', release_date: null, poster_path: '/g.jpg' }, enjoyment: 'loved' });
    // The sender follows nobody and was told nothing: the private viewing must not connect them.
    await respond(viewer.id, 21, { enjoyment: 'loved' });
    expect((await get('/discovery/for-you', sender.cookie)).body).toMatchObject({ films: [], connected: false });
  });

  it('stops offering a film the viewer set aside, until they change their mind', async () => {
    const viewer = await register('picky'), friend = await register('keen');
    await follow(viewer.id, friend.id);
    await respond(friend.id, 20, { enjoyment: 'loved' });
    await respond(friend.id, 21, { enjoyment: 'liked' });
    const put = await request(app).put('/api/discovery/for-you/20/hidden').set('Cookie', viewer.cookie).set('X-Moodie-Request', '1');
    expect(put.status).toBe(204);
    expect(titles((await get('/discovery/for-you', viewer.cookie)).body)).toEqual(['Liked']);
    expect((await request(app).put('/api/discovery/for-you/999/hidden').set('Cookie', viewer.cookie).set('X-Moodie-Request', '1')).status).toBe(404);
    expect((await request(app).delete('/api/discovery/for-you/20/hidden').set('Cookie', viewer.cookie).set('X-Moodie-Request', '1')).status).toBe(204);
    expect(titles((await get('/discovery/for-you', viewer.cookie)).body)).toEqual(['Loved', 'Liked']);
  });

  it('goes one step out through a friend, and says which friend', async () => {
    const viewer = await register('one_step'), friend = await register('middle'), beyond = await register('beyond'), far = await register('too_far');
    await follow(viewer.id, friend.id); await follow(friend.id, beyond.id); await follow(beyond.id, far.id);
    await respond(beyond.id, 20, { enjoyment: 'loved' });
    await respond(far.id, 21, { enjoyment: 'loved' });
    const result = await get('/discovery/for-you', viewer.cookie);
    expect(titles(result.body)).toEqual(['Loved']);
    expect(result.body.films[0].paths[0].reason).toEqual({ kind: 'friend', through: [{ id: friend.id, username: 'middle' }] });
  });

  it('leaves out a film that is already waiting for the viewer, sent by someone or saved', async () => {
    const viewer = await register('waiting'), friend = await register('sender_two');
    await follow(viewer.id, friend.id);
    for (const movie of [20, 21, 22]) await respond(friend.id, movie, { enjoyment: 'loved' });
    await pool.query("INSERT INTO film_suggestions(sender_id,recipient_id,movie_id,origin,reason) VALUES($1,$2,20,'sent','This one.')", [friend.id, viewer.id]);
    await pool.query('INSERT INTO saved_films(user_id,movie_id) VALUES($1,21)', [viewer.id]);
    expect(titles((await get('/discovery/for-you', viewer.cookie)).body)).toEqual(['Mixed']);
  });

  it('pages without repeating or dropping a film', async () => {
    const viewer = await register('pager'), friend = await register('prolific');
    await follow(viewer.id, friend.id);
    for (const [movie, enjoyment] of [[20, 'loved'], [21, 'liked'], [22, 'mixed']] as const) await respond(friend.id, movie, { enjoyment });
    const first = await get('/discovery/for-you?limit=2', viewer.cookie), second = await get('/discovery/for-you?limit=2&offset=2', viewer.cookie);
    expect(first.body.nextOffset).toBe(2);
    expect([...titles(first.body), ...titles(second.body)]).toEqual(['Loved', 'Liked', 'Mixed']);
    expect(second.body.nextOffset).toBeNull();
  });
});

describe('people to meet', () => {
  it('introduces people through a shared film, a friend in common, or because they follow the viewer', async () => {
    const viewer = await register('seeker'), friend = await register('friend_one'), friendOfFriend = await register('second_step');
    const kindred = await register('same_film'), fan = await register('fan'), nobody = await register('nobody');
    await follow(viewer.id, friend.id); await follow(friend.id, friendOfFriend.id); await follow(fan.id, viewer.id);
    await respond(viewer.id, 10, { enjoyment: 'loved', feelings: { sad: 1 } });
    const theirs = await respond(kindred.id, 10, { enjoyment: 'loved', feelings: { sad: 1 } });
    await respond(nobody.id, 20, { enjoyment: 'loved' });
    const result = await get('/discovery/introductions', viewer.cookie);
    expect(result.status).toBe(200);
    const byName = Object.fromEntries(result.body.people.map((person: { username: string }) => [person.username, person]));
    expect(Object.keys(byName).sort()).toEqual(['fan', 'same_film', 'second_step']);
    expect(byName.same_film.shared).toMatchObject({ film: { id: 10, title: 'Shared' }, feelings: ['sad'], their_response_id: theirs, count: 1 });
    expect(byName.second_step.mutuals).toEqual([{ id: friend.id, username: 'friend_one' }]);
    expect(byName.fan.follows_you).toBe(true);
  });
});

describe('who to send a film to', () => {
  it('lists followers, those with a reason first, and sets apart anyone who has already written about the film', async () => {
    const viewer = await register('giver'), close = await register('close'), plain = await register('plain'), wrote = await register('wrote'), outsider = await register('outsider');
    for (const person of [close, plain, wrote]) await follow(person.id, viewer.id);
    await respond(viewer.id, 10, { enjoyment: 'loved', feelings: { happy: 1 } });
    await respond(close.id, 10, { enjoyment: 'loved', feelings: { happy: 1 } });
    await respond(wrote.id, 20, { enjoyment: 'liked' });
    await respond(outsider.id, 10, { enjoyment: 'loved', feelings: { happy: 1 } });
    const result = await get('/discovery/recipients?movieId=20', viewer.cookie);
    expect(result.body.people.map((person: { username: string }) => person.username)).toEqual(['close', 'plain']);
    expect(result.body.people[0].reason).toMatchObject({ kind: 'shared', film: { id: 10, title: 'Shared' }, feelings: ['happy'] });
    expect(result.body.people[1].reason).toBeNull();
    expect(result.body.wrote).toEqual([{ id: wrote.id, username: 'wrote' }]);
    expect((await get('/discovery/recipients', viewer.cookie)).status).toBe(400);
  });
});

describe('where a newcomer starts', () => {
  it('asks about the films most people here have written about, leaving out ones already in the diary', async () => {
    const viewer = await register('starter'), a = await register('a_person'), b = await register('b_person');
    await respond(a.id, 20); await respond(b.id, 20); await respond(a.id, 21); await respond(viewer.id, 10);
    const result = await get('/discovery/starter?limit=2', viewer.cookie);
    expect(result.body.films.map((film: { title: string }) => film.title)).toEqual(['Loved', 'Liked']);
  });
});

describe('streams of words', () => {
  it('leaves a verdict with no words out of a written feed and keeps it in the full one', async () => {
    const viewer = await register('reader'), friend = await register('terse');
    await respond(friend.id, 20, { enjoyment: 'loved', note: '' });
    await respond(friend.id, 21, { enjoyment: 'liked', note: 'Stayed for the credits.' });
    expect((await get('/discovery/feed?kind=written', viewer.cookie)).body.entries.map((entry: { title: string }) => entry.title)).toEqual(['Liked']);
    expect((await get('/discovery/feed', viewer.cookie)).body.entries).toHaveLength(2);
    expect((await get('/discovery/feed?kind=other', viewer.cookie)).status).toBe(400);
  });
});
