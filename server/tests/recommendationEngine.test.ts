import { beforeEach, describe, expect, it } from '@jest/globals';
import pool from '../src/config/database';
import { recommend } from '../src/services/recommendationEngine';

type Feelings = {
  neutral: number;
  happy: number;
  sad: number;
  angry: number;
  fearful: number;
  disgusted: number;
  surprised: number;
};

const feelings = (input: Partial<Feelings>): Feelings => ({
  neutral: 0,
  happy: 0,
  sad: 0,
  angry: 0,
  fearful: 0,
  disgusted: 0,
  surprised: 0,
  ...input,
});

const quietSadness: Feelings = {
  neutral: 0.13, happy: 0.05, sad: 0.76, angry: 0.01, fearful: 0.02, disgusted: 0.01, surprised: 0.08,
};

const addUser = async (email: string, username: string) => {
  const result = await pool.query(
    `INSERT INTO users (email, username, password_hash, bio)
     VALUES ($1,$2,'not-used-in-recommendation-tests','A person with a real response.')
     RETURNING id`,
    [email, username],
  );
  return Number(result.rows[0].id);
};

const addMovie = async (id: number, title: string) => {
  await pool.query(
    `INSERT INTO movies (id, title, overview, release_date, poster_path)
     VALUES ($1,$2,'A film kept only for recommendation tests.','2020-01-01',$3)`,
    [id, title, `/poster-${id}.jpg`],
  );
};

const addResponse = async (
  userId: number,
  movieId: number,
  note: string,
  feelings: Feelings,
  visibility: 'public' | 'private' = 'public',
  watchedOn = '2026-07-01',
) => {
  const result = await pool.query(
    `INSERT INTO diary_entries (
       user_id, movie_id, watched_on, note, visibility,
       neutral, happy, sad, angry, fearful, disgusted, surprised
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      userId, movieId, watchedOn, note, visibility,
      feelings.neutral, feelings.happy, feelings.sad, feelings.angry,
      feelings.fearful, feelings.disgusted, feelings.surprised,
    ],
  );
  return Number(result.rows[0].id);
};

describe('people-led recommendations', () => {
  beforeEach(async () => {
    await pool.query('TRUNCATE entry_comments, entry_reactions, follows, entry_media, diary_entries, saved_films, users, movies RESTART IDENTITY CASCADE');
  });

  it('keeps every personalized result attached to a matched person and their public response', async () => {
    const viewerId = await addUser('viewer@example.com', 'viewer');
    const mayaId = await addUser('maya@example.com', 'maya');
    const strangerId = await addUser('stranger@example.com', 'stranger');

    await Promise.all([
      addMovie(101, 'Shared Film'),
      addMovie(102, 'Maya First'),
      addMovie(103, 'Maya Second'),
      addMovie(104, 'Unconnected Public Film'),
    ]);

    await addResponse(viewerId, 101, 'I kept thinking about the tenderness in the ending.', quietSadness, 'private');
    await addResponse(mayaId, 101, 'The quiet sadness stayed with me for days.', quietSadness);
    await addResponse(mayaId, 102, 'This gave me room to grieve without explaining myself.', quietSadness);
    await addResponse(mayaId, 103, 'I felt less alone after the final scene.', quietSadness);
    await addResponse(strangerId, 104, 'A public response with no shared film should not enter this path.', quietSadness);

    const first = await recommend(viewerId);
    const second = await recommend(viewerId);

    expect(first.profile.source).toBe('people');
    expect(first.profile.connectedPeople).toBe(1);
    expect(first.forYou.map(movie => movie.title).sort()).toEqual(['Maya First', 'Maya Second']);
    expect(second.forYou).toEqual(first.forYou);
    expect(first.forYou.every(movie => movie.id !== 101 && movie.id !== 104)).toBe(true);
    expect(first.forYou.every(movie => movie.recommended_by?.length === 1)).toBe(true);
    first.forYou.forEach(movie => expect(movie.recommended_by?.[0]).toMatchObject({
      username: 'maya',
      shared_film_title: 'Shared Film',
      shared_feelings: expect.arrayContaining(['sad']),
      viewer_shared_note: 'I kept thinking about the tenderness in the ending.',
      person_shared_note: 'The quiet sadness stayed with me for days.',
    }));
    expect(first.forYou.every(movie => movie.recommended_by?.[0].response_note.length)).toBe(true);
    expect(first.community.every(movie => movie.recommended_by?.length)).toBe(true);
    expect(JSON.stringify(first)).not.toMatch(/evidenceScore|connectionScore|similarity/);
  });

  it('does not expose a private source response in a personalized result', async () => {
    const viewerId = await addUser('viewer@example.com', 'viewer');
    const mayaId = await addUser('maya@example.com', 'maya');
    await Promise.all([addMovie(201, 'Shared Film'), addMovie(202, 'Maya Private Film')]);
    await addResponse(viewerId, 201, 'A shared response.', quietSadness);
    await addResponse(mayaId, 201, 'A public shared response.', quietSadness);
    await addResponse(mayaId, 202, 'This must stay private.', quietSadness, 'private');

    const result = await recommend(viewerId);
    expect(result.forYou).toEqual([]);
    expect(result.adjacent).toEqual([]);
  });

  it('carries the intended Whiplash connection to a joyful Scream response', async () => {
    const viewerId = await addUser('viewer@example.com', 'viewer');
    const ananyaId = await addUser('ananya@example.com', 'ananya_sen');
    await Promise.all([addMovie(301, 'Whiplash'), addMovie(302, 'Scream')]);

    await addResponse(viewerId, 301, 'Cruelty kept disguising itself as belief in someone.', feelings({ angry: 0.74, fearful: 0.18, disgusted: 0.12 }), 'private');
    await addResponse(ananyaId, 301, 'The result did not make the harm worthwhile.', feelings({ angry: 0.79, fearful: 0.14, disgusted: 0.19 }));
    await addResponse(ananyaId, 302, 'Horror night became the kind of laughter that only works in a room together.', feelings({ happy: 0.78, fearful: 0.27, surprised: 0.32 }));

    const result = await recommend(viewerId, feelings({ happy: 1 }));

    expect(result.forYou[0]?.title).toBe('Scream');
    expect(result.forYou[0]?.recommended_by?.[0]).toMatchObject({
      username: 'ananya_sen',
      shared_film_title: 'Whiplash',
      response_feelings: ['happy', 'surprised', 'fearful'],
    });
  });

  it('gives repeated overlap a modest advantage over a single shared film', async () => {
    const viewerId = await addUser('viewer@example.com', 'viewer');
    const repeatId = await addUser('repeat@example.com', 'repeat');
    const singleId = await addUser('single@example.com', 'single');
    await Promise.all([
      addMovie(401, 'Shared Joy'),
      addMovie(402, 'Shared Sadness'),
      addMovie(403, 'Repeat Candidate'),
      addMovie(404, 'Single Candidate'),
    ]);

    await addResponse(viewerId, 401, 'Joy stayed with me.', feelings({ happy: 1 }));
    await addResponse(viewerId, 402, 'Sadness stayed with me.', feelings({ sad: 1 }));
    await addResponse(repeatId, 401, 'The same joy stayed with me.', feelings({ happy: 1 }));
    await addResponse(repeatId, 402, 'The same sadness stayed with me.', feelings({ sad: 1 }));
    await addResponse(repeatId, 403, 'A public path from repeated common ground.', feelings({ neutral: 0.7, happy: 0.3 }));
    await addResponse(singleId, 401, 'The same joy stayed with me too.', feelings({ happy: 1 }));
    await addResponse(singleId, 404, 'A public path from one shared film.', feelings({ neutral: 0.7, happy: 0.3 }));

    const result = await recommend(viewerId);

    expect(result.forYou.slice(0, 2).map(movie => movie.title)).toEqual(['Repeat Candidate', 'Single Candidate']);
  });

  it('lets a conflicting shared film weaken a connection', async () => {
    const viewerId = await addUser('viewer@example.com', 'viewer');
    const alignedId = await addUser('aligned@example.com', 'aligned');
    const mixedId = await addUser('mixed@example.com', 'mixed');
    await Promise.all([
      addMovie(501, 'Film A'),
      addMovie(502, 'Film B'),
      addMovie(503, 'Aligned Candidate'),
      addMovie(504, 'Mixed Candidate'),
    ]);

    await addResponse(viewerId, 501, 'This felt joyful.', feelings({ happy: 1 }));
    await addResponse(viewerId, 502, 'This felt sad.', feelings({ sad: 1 }));
    await addResponse(alignedId, 501, 'This felt joyful to me too.', feelings({ happy: 1 }));
    await addResponse(alignedId, 502, 'This felt sad to me too.', feelings({ sad: 1 }));
    await addResponse(alignedId, 503, 'A response from the aligned person.', feelings({ neutral: 0.6, happy: 0.4 }));
    await addResponse(mixedId, 501, 'This felt joyful to me.', feelings({ happy: 1 }));
    await addResponse(mixedId, 502, 'This felt joyful instead.', feelings({ happy: 1 }));
    await addResponse(mixedId, 504, 'A response from the mixed person.', feelings({ neutral: 0.6, happy: 0.4 }));

    const result = await recommend(viewerId);

    expect(result.forYou.slice(0, 2).map(movie => movie.title)).toEqual(['Aligned Candidate', 'Mixed Candidate']);
  });

  it('uses the source response for feeling intent instead of a genre assumption', async () => {
    const viewerId = await addUser('viewer@example.com', 'viewer');
    const personId = await addUser('person@example.com', 'person');
    await Promise.all([
      addMovie(601, 'Shared Film'),
      addMovie(602, 'Horror Comedy'),
      addMovie(603, 'Gentle Drama'),
    ]);

    await addResponse(viewerId, 601, 'I felt anger and fear together.', feelings({ angry: 0.8, fearful: 0.2 }));
    await addResponse(personId, 601, 'I felt the same difficult mix.', feelings({ angry: 0.75, fearful: 0.25 }));
    await addResponse(personId, 602, 'This made the whole room laugh together.', feelings({ happy: 0.8, surprised: 0.2 }));
    await addResponse(personId, 603, 'This left me watchful and uneasy.', feelings({ fearful: 0.8, neutral: 0.2 }));

    const joyful = await recommend(viewerId, feelings({ happy: 1 }));
    const uneasy = await recommend(viewerId, feelings({ fearful: 1 }));

    expect(joyful.forYou[0]?.title).toBe('Horror Comedy');
    expect(uneasy.forYou[0]?.title).toBe('Gentle Drama');
  });

  it('keeps the strongest evidence as the visible lead even when another response is newer', async () => {
    const viewerId = await addUser('viewer@example.com', 'viewer');
    const strongId = await addUser('strong@example.com', 'strong');
    const weakerId = await addUser('weaker@example.com', 'weaker');
    await Promise.all([addMovie(701, 'Film A'), addMovie(702, 'Film B'), addMovie(703, 'Same Candidate')]);

    await addResponse(viewerId, 701, 'This was uncomplicated joy.', feelings({ happy: 1 }));
    await addResponse(viewerId, 702, 'This was uncomplicated joy too.', feelings({ happy: 1 }));
    await addResponse(strongId, 701, 'I felt that same joy.', feelings({ happy: 1 }));
    await addResponse(strongId, 703, 'An older response with stronger human evidence.', feelings({ happy: 0.8, neutral: 0.2 }), 'public', '2026-01-01');
    await addResponse(weakerId, 702, 'I felt joy mixed with sadness.', feelings({ happy: 0.7, sad: 0.3 }));
    await addResponse(weakerId, 703, 'A newer response with weaker common ground.', feelings({ happy: 0.8, neutral: 0.2 }), 'public', '2026-06-01');

    const result = await recommend(viewerId);

    expect(result.forYou[0]?.recommended_by?.map(person => person.username)).toEqual(['strong', 'weaker']);
  });

  it('keeps rewatches separate while using the latest viewer mix and latest public source mix', async () => {
    const viewerId = await addUser('viewer@example.com', 'viewer');
    const personId = await addUser('person@example.com', 'person');
    await Promise.all([addMovie(801, 'Rewatched Film'), addMovie(802, 'Candidate')]);

    await addResponse(viewerId, 801, 'The first viewing felt joyful.', feelings({ happy: 1 }), 'public', '2026-01-01');
    await addResponse(viewerId, 801, 'The rewatch felt sad.', feelings({ sad: 1 }), 'private', '2026-03-01');
    await addResponse(personId, 801, 'My public viewing felt sad.', feelings({ sad: 1 }), 'public', '2026-01-15');
    await addResponse(personId, 801, 'My private rewatch felt joyful.', feelings({ happy: 1 }), 'private', '2026-04-01');
    await addResponse(personId, 802, 'This public response can still create a path.', feelings({ sad: 0.8, neutral: 0.2 }));

    const result = await recommend(viewerId);

    expect(result.forYou[0]?.title).toBe('Candidate');
    expect(result.forYou[0]?.recommended_by?.[0]).toMatchObject({
      viewer_shared_note: 'The rewatch felt sad.',
      person_shared_note: 'My public viewing felt sad.',
    });
  });

  it('keeps cold start community activity separate from personalized results', async () => {
    const viewerId = await addUser('viewer@example.com', 'viewer');
    const strangerId = await addUser('stranger@example.com', 'stranger');
    await Promise.all([addMovie(901, 'Viewer Film'), addMovie(902, 'Public Film')]);
    await addResponse(viewerId, 901, 'Only the viewer has seen this.', feelings({ sad: 1 }));
    await addResponse(strangerId, 902, 'A public response with no shared film.', feelings({ sad: 1 }));

    const result = await recommend(viewerId, feelings({}));

    expect(result.profile.source).toBe('community');
    expect(result.forYou).toEqual([]);
    expect(result.adjacent).toEqual([]);
    expect(result.community.map(movie => movie.title)).toEqual(['Public Film']);
    expect(result.community[0]?.recommended_by).toBeUndefined();
  });

  it('does not connect two empty feeling vectors', async () => {
    const viewerId = await addUser('viewer@example.com', 'viewer');
    const personId = await addUser('person@example.com', 'person');
    await Promise.all([addMovie(1001, 'Shared Film'), addMovie(1002, 'Candidate')]);
    await addResponse(viewerId, 1001, 'The viewer has not set feelings.', feelings({}));
    await addResponse(personId, 1001, 'The other person has not set feelings.', feelings({}));
    await addResponse(personId, 1002, 'This should not appear through an empty match.', feelings({ happy: 1 }));

    const result = await recommend(viewerId);

    expect(result.forYou).toEqual([]);
  });
});
