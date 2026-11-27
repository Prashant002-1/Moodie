/**
 * A sample community for looking at Moodie: people, films, responses, follows
 * and recommendations from database/sample-world.json. Only the disposable
 * preview loads it. It expects the preview's four starting accounts to exist.
 */
import { readFile } from 'fs/promises';
import path from 'path';
import pool from '../config/database';
import { projectRoot } from '../config/env';

interface SampleEntry { person: string; film: number; note: string; visibility: 'public' | 'private'; feelings: string[]; verdict: string | null; days: number; key?: string }
interface SampleWorld {
  people: { username: string; bio: string }[];
  films: { id: number; title: string; release_date: string; poster_path: string | null; backdrop_path: string | null; runtime: number | null; overview: string }[];
  entries: SampleEntry[];
  follows: [string, string][];
  suggestions: { from: string; to: string; film: number; reason: string; days: number; entry?: string; reply?: { enjoyment: string; highlights: string[]; note: string; days: number } }[];
  likes: [string, string][];
}
const KEYS = ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'];
const ORDER = [1, 0.6, 0.3];

export async function addSampleWorld(passwordHash: string) {
  const world = JSON.parse(await readFile(path.join(projectRoot, 'database/sample-world.json'), 'utf8')) as SampleWorld;
  for (const person of world.people) {
    await pool.query("INSERT INTO users(username,email,password_hash,bio,ai_mode) VALUES ($1,$2,$3,$4,'off') ON CONFLICT DO NOTHING",
      [person.username, `${person.username}@example.test`, passwordHash, person.bio]);
  }
  const ids = new Map((await pool.query<{ id: number; username: string }>('SELECT id, username FROM users')).rows.map(row => [row.username, Number(row.id)]));
  for (const film of world.films) {
    const tmdb = { ...film, genre_ids: [], genres: [], popularity: 0, vote_average: 0, vote_count: 0 };
    await pool.query('INSERT INTO movies(id,title,overview,release_date,poster_path,backdrop_path,tmdb_data,runtime) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING',
      [film.id, film.title, film.overview, film.release_date, film.poster_path, film.backdrop_path, JSON.stringify(tmdb), film.runtime]);
  }
  const keyed = new Map<string, number>();
  for (const entry of world.entries) {
    const values = KEYS.map(key => ORDER[entry.feelings.indexOf(key)] ?? 0);
    const result = await pool.query<{ id: number }>(`INSERT INTO diary_entries(user_id,movie_id,note,watched_on,visibility,enjoyment,neutral,happy,sad,angry,fearful,disgusted,surprised,created_at)
      VALUES ($1,$2,$3,(CURRENT_DATE - $13::int),$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP - ($13::int * INTERVAL '1 day') - INTERVAL '5 hours') RETURNING id`,
    [ids.get(entry.person), entry.film, entry.note, entry.visibility, entry.verdict, ...values, entry.days]);
    if (entry.key) keyed.set(entry.key, Number(result.rows[0].id));
  }
  for (const [follower, followed] of world.follows) {
    await pool.query('INSERT INTO follows(follower_id,followed_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [ids.get(follower), ids.get(followed)]);
  }
  for (const item of world.suggestions) {
    const entryId = item.entry ? keyed.get(item.entry) ?? null : null;
    const result = await pool.query<{ id: number }>(`INSERT INTO film_suggestions(sender_id,recipient_id,movie_id,origin,reason,linked_entry_id,shared_at,created_at)
      VALUES ($1,$2,$3,'sent',$4,$5,CASE WHEN $6::int IS NULL THEN NULL ELSE CURRENT_TIMESTAMP - ($6::int * INTERVAL '1 day') END,CURRENT_TIMESTAMP - ($7::int * INTERVAL '1 day')) RETURNING id`,
    [ids.get(item.from), ids.get(item.to), item.film, item.reason, entryId, item.reply?.days ?? null, item.days]);
    if (item.reply && entryId) {
      await pool.query(`INSERT INTO suggestion_replies(suggestion_id,entry_id,enjoyment,highlights,note,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP - ($6::int * INTERVAL '1 day'),CURRENT_TIMESTAMP - ($6::int * INTERVAL '1 day'))`,
      [result.rows[0].id, entryId, item.reply.enjoyment, item.reply.highlights, item.reply.note, item.reply.days]);
    }
  }
  for (const [person, key] of world.likes) {
    await pool.query('INSERT INTO entry_reactions(entry_id,user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [keyed.get(key), ids.get(person)]);
  }
}
