import { beforeEach, describe, expect, it } from '@jest/globals';
import pool from '../src/config/database';
import request from 'supertest';
import app from '../src/app';
import { simulatedResponses } from '../src/evaluation/responseBenchmark';
import { buildRecommendationProfile, recommend } from '../src/services/recommendationEngine';
import { loadPeople } from '../src/controllers/discoveryController';
import { EMOTION_KEYS } from '../src/services/emotionalLearning';

describe('learned discovery lifecycle', () => {
  beforeEach(async () => {
    await pool.query('TRUNCATE users, movies RESTART IDENTITY CASCADE');
    await pool.query(`INSERT INTO users (id, email, username, password_hash) SELECT n, 'person' || n || '@example.com', 'person' || n, 'unused' FROM generate_series(1,20) n`);
    await pool.query(`INSERT INTO movies (id, title) SELECT n, 'Film ' || n FROM generate_series(1,64) n`);
    const records = simulatedResponses(17).map(r => ({ id: r.id, user_id: r.userId, movie_id: r.movieId,
      at: new Date(Date.UTC(2026, 0, 1) + r.availableAt).toISOString(),
      ...Object.fromEntries(EMOTION_KEYS.map((key, d) => [key, r.values[d]])) }));
    await pool.query(`INSERT INTO diary_entries (id, user_id, movie_id, note, visibility, watched_on, created_at, updated_at, ${EMOTION_KEYS.join(',')})
      SELECT id, user_id, movie_id, 'A public response ' || id, 'public', at::date, at, at, ${EMOTION_KEYS.join(',')}
      FROM jsonb_to_recordset($1::jsonb) AS r(id int, user_id int, movie_id int, at timestamp, ${EMOTION_KEYS.map(k => k + ' float').join(',')})`, [JSON.stringify(records)]);
    await pool.query("SELECT setval('diary_entries_id_seq', (SELECT MAX(id) FROM diary_entries))");
    await pool.query("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))");
  });

  it('serves learned results with retrievable source paths and uses those connections on the people surface', async () => {
    const result = await recommend(1);
    expect(result.profile.model.status).toBe('learning');
    expect(result.forYou.length).toBeGreaterThan(0);
    const profile = await buildRecommendationProfile(1);
    const people = await loadPeople(1);
    expect(people[0].id).toBe(profile.matchedPeople[0].id);
    for (const film of [...result.forYou, ...result.adjacent]) for (const path of film.recommended_by!) {
      const source = await pool.query('SELECT user_id, movie_id, visibility FROM diary_entries WHERE id = $1', [path.response_id]);
      const shared = await pool.query('SELECT user_id, movie_id, visibility FROM diary_entries WHERE id = $1', [path.shared_response_id]);
      expect(source.rows[0]).toMatchObject({ user_id: path.id, movie_id: film.id, visibility: 'public' });
      expect(shared.rows[0]).toMatchObject({ user_id: path.id, movie_id: path.shared_movie_id, visibility: 'public' });
    }
  });

  it('immediately retracts private or deleted sources and never trains other viewers on private entries', async () => {
    const initial = await recommend(1);
    const source = initial.forYou[0].recommended_by![0];
    await pool.query("UPDATE diary_entries SET visibility = 'private' WHERE id = $1", [source.response_id]);
    const changed = await recommend(1);
    expect(JSON.stringify(changed)).not.toContain(`"response_id":${source.response_id},`);
    // Changing only a private vector cannot alter another person's learned rank.
    await pool.query('UPDATE diary_entries SET happy = 1, sad = 0, angry = 0, neutral = 0, fearful = 0, disgusted = 0, surprised = 0 WHERE id = $1', [source.response_id]);
    expect(await recommend(1)).toEqual(changed);
    const next = changed.forYou[0].recommended_by![0];
    await pool.query('DELETE FROM users WHERE id = $1', [next.id]);
    const deleted = await recommend(1);
    expect([...deleted.forYou, ...deleted.adjacent].flatMap(f => f.recommended_by!).some(p => p.id === next.id)).toBe(false);
  });

  it('recomputes from a revised diary and excludes a newly watched recommendation', async () => {
    const initial = await recommend(1);
    const film = initial.forYou[0];
    await pool.query(`INSERT INTO diary_entries (user_id, movie_id, note, visibility, happy)
      VALUES (1, $1, 'My new private response', 'private', .8)`, [film.id]);
    const next = await recommend(1);
    expect([...next.forYou, ...next.adjacent, ...next.community].some(f => f.id === film.id)).toBe(false);
    expect(next.watchedCount).toBe(initial.watchedCount + 1);
  });
  it('takes a new signed-up member through the live learned recommendation, response, follow, save and viewing APIs', async () => {
    const member = request.agent(app);
    const signup = await member.post('/api/auth/register').set('X-Moodie-Request','1').send({ username: 'newmember', email: 'new@example.test', password: 'a-long-test-password' });
    expect(signup.status).toBe(201);
    const row = (await pool.query('SELECT * FROM diary_entries WHERE user_id = 1 ORDER BY id LIMIT 1')).rows[0];
    const emotions = Object.fromEntries(EMOTION_KEYS.map(k => [k, Number(row[k])]));
    const diary = await member.post('/api/diary').set('X-Moodie-Request','1').send({ movieId: row.movie_id, watchedOn: '2026-07-01', note: 'My own starting point', visibility: 'private', emotions });
    expect(diary.status).toBe(201);
    const result = await member.post('/api/recommendations').set('X-Moodie-Request','1').send({});
    expect(result.status).toBe(200);
    expect(result.body.profile.model.status).toBe('learning');
    const film = result.body.forYou[0], source = film.recommended_by[0];
    const page = await member.get('/api/discovery/films/' + film.id);
    expect(page.status).toBe(200);
    expect(page.body.entries.some((e: { id: number }) => Number(e.id) === source.response_id)).toBe(true);
    expect((await member.post('/api/discovery/people/' + source.id + '/follow').set('X-Moodie-Request','1')).status).toBe(201);
    const feed = await member.get('/api/discovery/feed?scope=following');
    expect(feed.status).toBe(200);
    expect(feed.body.entries.every((e: { user_id: number }) => e.user_id === source.id)).toBe(true);
    expect((await member.post('/api/library/saved').set('X-Moodie-Request','1').send({ movieId: film.id })).status).toBe(201);
    expect((await member.get('/api/library/saved')).body.films[0].movie_id).toBe(film.id);
    expect((await member.post('/api/diary').set('X-Moodie-Request','1').send({ movieId: film.id, watchedOn: '2026-07-02', note: 'How it actually felt', visibility: 'private', emotions })).status).toBe(201);
    const refreshed = await member.post('/api/recommendations').set('X-Moodie-Request','1').send({});
    expect([...refreshed.body.forYou, ...refreshed.body.adjacent].some((m: { id: number }) => m.id === film.id)).toBe(false);
  });

  it('keeps wording and photo edits out of learned ordering while tracking emotional changes', async () => {
    const original = await recommend(1);
    const source = original.forYou[0].recommended_by![0];
    const before = (await pool.query('SELECT signal_updated_at, published_at FROM diary_entries WHERE id = $1', [source.response_id])).rows[0];
    await pool.query("UPDATE diary_entries SET note = 'Edited wording only', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [source.response_id]);
    await pool.query("INSERT INTO entry_media (entry_id, kind, asset_path, alt_text) VALUES ($1, 'expression_photo', 'photo-only', 'A photo')", [source.response_id]);
    const after = (await pool.query('SELECT signal_updated_at, published_at FROM diary_entries WHERE id = $1', [source.response_id])).rows[0];
    expect(after).toEqual(before);
    const revised = await recommend(1);
    expect(revised.forYou.map(f => f.id)).toEqual(original.forYou.map(f => f.id));
    expect(revised.forYou[0].recommended_by![0].response_note).toBe('Edited wording only');
    await pool.query('UPDATE diary_entries SET happy = 1 WHERE id = $1', [source.response_id]);
    const changed = (await pool.query('SELECT signal_updated_at FROM diary_entries WHERE id = $1', [source.response_id])).rows[0];
    expect(new Date(changed.signal_updated_at).getTime()).toBeGreaterThan(new Date(before.signal_updated_at).getTime());
  });

});
