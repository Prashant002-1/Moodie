/**
 * Reads what the discovery engine is allowed to know for one viewer, and turns
 * its answers back into people, films and words.
 *
 * What goes in: the viewer's own responses (private ones included, for the
 * viewer alone), everyone else's public responses, the follows around the
 * viewer, and recommendations the viewer took part in. Blocks and moderation
 * apply to every row. Nothing private to another person is ever loaded.
 */
import pool from '../config/database';
import { visiblePerson, visibleResponse } from '../services/communitySafety';
import { EMOTION_KEYS, EmotionKey } from '../services/emotionalLearning';
import { Community, Landing, Path, Reason, Seen, SharedFilm, Verdict, films, people, recipients, ties } from './engine';

interface ResponseRow extends Record<EmotionKey, number> {
  id: number; user_id: number; movie_id: number; note: string; enjoyment: Verdict | null; visibility: 'public' | 'private';
  username: string; title: string; release_date: string | null; poster_path: string | null; overview: string | null;
}
interface FilmCard { id: number; title: string; release_date: string | null; poster_path: string | null }

/** The words a person chose, strongest first. The stored numbers only carry the order. */
const feelingsOf = (row: Record<EmotionKey, number>): EmotionKey[] => EMOTION_KEYS.filter(key => Number(row[key]) >= 0.06)
  .sort((a, b) => Number(row[b]) - Number(row[a]) || a.localeCompare(b)).slice(0, 3);

export async function loadCommunity(viewerId: number) {
  // Oldest first, so a row's position is its age and the latest response to a film wins.
  const responses = await pool.query<ResponseRow>(`SELECT de.id, de.user_id, de.movie_id, de.note, de.enjoyment, de.visibility,
      de.neutral::float, de.happy::float, de.sad::float, de.angry::float, de.fearful::float, de.disgusted::float, de.surprised::float,
      u.username, m.title, m.release_date::text, m.poster_path, m.overview
    FROM diary_entries de JOIN users u ON u.id = de.user_id JOIN movies m ON m.id = de.movie_id
    WHERE (de.visibility = 'public' OR de.user_id = $1) AND ${visibleResponse('$1')}
    ORDER BY de.watched_on, de.created_at, de.id`, [viewerId]);
  const follows = await pool.query<{ follower_id: number; followed_id: number }>(`SELECT f.follower_id, f.followed_id FROM follows f
    WHERE (f.follower_id = $1 OR f.followed_id = $1 OR f.follower_id IN (SELECT followed_id FROM follows WHERE follower_id = $1))
      AND ${visiblePerson('$1', 'f.follower_id')} AND ${visiblePerson('$1', 'f.followed_id')}`, [viewerId]);
  // A recommendation counts once the person it was for has said how it went. The sender only ever
  // learns that from a reply; the recipient also knows their own verdict in their diary.
  const landed = await pool.query<{ sender_id: number; recipient_id: number; movie_id: number; verdict: Verdict | null }>(`SELECT s.sender_id, s.recipient_id, s.movie_id,
      COALESCE(r.enjoyment, CASE WHEN s.recipient_id = $1 THEN (SELECT own.enjoyment FROM diary_entries own
        WHERE own.user_id = $1 AND own.movie_id = s.movie_id AND own.enjoyment IS NOT NULL
        ORDER BY own.watched_on DESC, own.created_at DESC, own.id DESC LIMIT 1) END) AS verdict
    FROM film_suggestions s LEFT JOIN suggestion_replies r ON r.suggestion_id = s.id
    WHERE ((s.recipient_id = $1) OR (s.sender_id = $1 AND s.origin = 'sent'))
      AND ${visiblePerson('$1', '(CASE WHEN s.sender_id = $1 THEN s.recipient_id ELSE s.sender_id END)')}`, [viewerId]);
  // Not offered again: films the viewer set aside, and films already waiting for them, sent by someone or saved.
  const hidden = await pool.query<{ movie_id: number }>(`SELECT movie_id FROM discovery_hidden WHERE user_id = $1
    UNION SELECT movie_id FROM saved_films WHERE user_id = $1
    UNION SELECT movie_id FROM film_suggestions WHERE recipient_id = $1`, [viewerId]);

  const rows = new Map<number, ResponseRow>(), names = new Map<number, string>(), filmCards = new Map<number, FilmCard & { overview: string }>();
  const own: Seen[] = [], others: Seen[] = [];
  responses.rows.forEach((row, index) => {
    const seen: Seen = { id: Number(row.id), personId: Number(row.user_id), filmId: Number(row.movie_id), feelings: feelingsOf(row), verdict: row.enjoyment, at: index };
    rows.set(seen.id, row); names.set(seen.personId, row.username);
    filmCards.set(seen.filmId, { id: seen.filmId, title: row.title, release_date: row.release_date, poster_path: row.poster_path, overview: row.overview || '' });
    if (seen.personId === viewerId) own.push(seen);
    else if (row.visibility === 'public') others.push(seen);
  });
  const graph = new Map<number, Set<number>>();
  for (const row of follows.rows) { const a = Number(row.follower_id), set = graph.get(a) ?? new Set<number>(); set.add(Number(row.followed_id)); graph.set(a, set); }
  const landings: Landing[] = landed.rows.filter(row => row.verdict)
    .map(row => ({ fromId: Number(row.sender_id), toId: Number(row.recipient_id), filmId: Number(row.movie_id), verdict: row.verdict! }));
  const community: Community = { viewerId, own, others, follows: graph, landings, hidden: new Set(hidden.rows.map(row => Number(row.movie_id))) };
  return { community, rows, names, filmCards };
}

type Loaded = Awaited<ReturnType<typeof loadCommunity>>;

/** People and films named in a reason may have no response on the page: look the missing ones up. */
async function complete(loaded: Loaded, viewerId: number, personIds: Iterable<number>, filmIds: Iterable<number>) {
  const people = [...new Set(personIds)].filter(id => !loaded.names.has(id));
  if (people.length) {
    const found = await pool.query<{ id: number; username: string }>(`SELECT u.id, u.username FROM users u WHERE u.id = ANY($2::int[]) AND ${visiblePerson('$1', 'u.id')}`, [viewerId, people]);
    for (const row of found.rows) loaded.names.set(Number(row.id), row.username);
  }
  const missing = [...new Set(filmIds)].filter(id => !loaded.filmCards.has(id));
  if (missing.length) {
    const found = await pool.query<FilmCard & { overview: string | null }>('SELECT id, title, release_date::text, poster_path, overview FROM movies WHERE id = ANY($1::int[])', [missing]);
    for (const row of found.rows) loaded.filmCards.set(Number(row.id), { ...row, id: Number(row.id), overview: row.overview || '' });
  }
}

const filmOf = (loaded: Loaded, id: number): FilmCard => { const { overview: _overview, ...card } = loaded.filmCards.get(id) ?? { id, title: '', release_date: null, poster_path: null, overview: '' }; return card; };
const sharedOf = (loaded: Loaded, film: SharedFilm) => ({ film: filmOf(loaded, film.filmId), feelings: film.feelings,
  own_response_id: film.ownId, their_response_id: film.theirId, own_enjoyment: film.ownVerdict, their_enjoyment: film.theirVerdict });
const reasonOf = (loaded: Loaded, reason: Reason) => reason.kind === 'landed' ? { kind: reason.kind, film: filmOf(loaded, reason.filmId), enjoyment: reason.verdict }
  : reason.kind === 'shared' ? { kind: reason.kind, ...sharedOf(loaded, reason.film) } : { kind: reason.kind };
const reasonFilms = (paths: Path[]) => paths.flatMap(path => path.reason.kind === 'landed' ? [path.reason.filmId] : path.reason.kind === 'shared' ? [path.reason.film.filmId] : []);

export async function filmsFor(viewerId: number, limit = 12, offset = 0) {
  const loaded = await loadCommunity(viewerId);
  const known = ties(loaded.community);
  const all = films(loaded.community, undefined, known);
  const page = all.slice(offset, offset + limit);
  await complete(loaded, viewerId, [], page.flatMap(pick => reasonFilms(pick.paths)));
  return {
    films: page.map(pick => {
      const card = loaded.filmCards.get(pick.filmId)!;
      return { film: { id: card.id, title: card.title, release_date: card.release_date, poster_path: card.poster_path, overview: card.overview },
        // Three voices are shown; the count says how many more there are.
        paths: pick.paths.slice(0, 3).map(path => {
          const row = loaded.rows.get(path.responseId)!;
          return { person: { id: path.personId, username: row.username },
            response: { id: path.responseId, note: row.note, enjoyment: path.verdict, feelings: path.feelings },
            reason: reasonOf(loaded, path.reason) };
        }),
        more: Math.max(0, pick.paths.length - 3),
        against: pick.against.map(personId => ({ id: personId, username: loaded.names.get(personId) ?? '' })) };
    }),
    nextOffset: offset + limit < all.length ? offset + limit : null,
    total: all.length,
    // With nobody to go through yet, a client offers the first steps instead of an empty list.
    connected: known.some(tie => tie.weight > 0),
    diary: loaded.community.own.length,
  };
}

export async function introductionsFor(viewerId: number, limit = 12) {
  const loaded = await loadCommunity(viewerId);
  const found = people(loaded.community).slice(0, limit);
  await complete(loaded, viewerId, found.flatMap(person => [person.personId, ...person.mutuals]), found.flatMap(person => person.shared ? [person.shared.filmId] : []));
  const latest = new Map<number, Seen>();
  for (const row of loaded.community.others) latest.set(row.personId, row);
  const bios = await pool.query<{ id: number; bio: string | null }>('SELECT id, bio FROM users WHERE id = ANY($1::int[])', [found.map(person => person.personId)]);
  const bio = new Map(bios.rows.map(row => [Number(row.id), row.bio || '']));
  return { people: found.filter(person => loaded.names.has(person.personId)).map(person => {
    const last = latest.get(person.personId);
    return { id: person.personId, username: loaded.names.get(person.personId)!, bio: bio.get(person.personId) ?? '', following: false, follows_you: person.followsYou,
      shared: person.shared ? { ...sharedOf(loaded, person.shared), count: person.sharedCount } : null,
      mutuals: person.mutuals.filter(id => loaded.names.has(id)).map(id => ({ id, username: loaded.names.get(id)! })),
      latest: last ? { response_id: last.id, film: filmOf(loaded, last.filmId), enjoyment: last.verdict } : null };
  }) };
}

export async function recipientsFor(viewerId: number, movieId: number, q = '') {
  const loaded = await loadCommunity(viewerId);
  // A recommendation can go to people who follow the sender, as everywhere else.
  const eligible = await pool.query<{ id: number; username: string; bio: string | null }>(`SELECT u.id, u.username, u.bio FROM follows f JOIN users u ON u.id = f.follower_id
    WHERE f.followed_id = $1 AND POSITION(LOWER($2) IN LOWER(u.username)) > 0 AND ${visiblePerson('$1', 'u.id')} ORDER BY u.username LIMIT 200`, [viewerId, q]);
  const byId = new Map(eligible.rows.map(row => [Number(row.id), row]));
  const wrote = new Set(loaded.community.others.filter(row => row.filmId === movieId).map(row => row.personId));
  const ordered = recipients(loaded.community, movieId, [...byId.keys()]);
  await complete(loaded, viewerId, [], ordered.flatMap(person => person.reason?.kind === 'returned' ? [person.reason.filmId] : person.reason?.kind === 'shared' ? [person.reason.film.filmId] : []));
  return { people: ordered.slice(0, 50).map(person => {
    const row = byId.get(person.personId)!;
    return { id: person.personId, username: row.username, bio: row.bio || '',
      reason: !person.reason ? null : person.reason.kind === 'returned' ? { kind: person.reason.kind, film: filmOf(loaded, person.reason.filmId), enjoyment: person.reason.verdict }
        : { kind: person.reason.kind, ...sharedOf(loaded, person.reason.film) } };
  }),
    // People who can receive it but have already written about this film in public.
    wrote: [...wrote].filter(id => byId.has(id)).map(id => ({ id, username: byId.get(id)!.username })) };
}

/**
 * Films to ask a newcomer about: the ones most people here have written about, which the viewer has not.
 * Answers to these are what first connect a person to others.
 */
export async function starterFor(viewerId: number, limit = 18) {
  const result = await pool.query<FilmCard & { responses: number }>(`SELECT m.id, m.title, m.release_date::text, m.poster_path, COUNT(DISTINCT de.user_id)::int AS responses
    FROM movies m LEFT JOIN diary_entries de ON de.movie_id = m.id AND de.visibility = 'public' AND de.user_id <> $1 AND ${visibleResponse('$1')}
    WHERE NOT EXISTS (SELECT 1 FROM diary_entries own WHERE own.user_id = $1 AND own.movie_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM discovery_hidden h WHERE h.user_id = $1 AND h.movie_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM saved_films s WHERE s.user_id = $1 AND s.movie_id = m.id)
      AND NOT EXISTS (SELECT 1 FROM film_suggestions fs WHERE fs.recipient_id = $1 AND fs.movie_id = m.id)
      AND m.poster_path IS NOT NULL
    GROUP BY m.id ORDER BY responses DESC, m.id LIMIT $2`, [viewerId, limit]);
  return { films: result.rows.map(({ responses: _responses, ...film }) => ({ ...film, id: Number(film.id) })) };
}

export async function hide(viewerId: number, movieId: number) {
  await pool.query('INSERT INTO discovery_hidden(user_id, movie_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [viewerId, movieId]);
}
export async function unhide(viewerId: number, movieId: number) {
  await pool.query('DELETE FROM discovery_hidden WHERE user_id = $1 AND movie_id = $2', [viewerId, movieId]);
}
