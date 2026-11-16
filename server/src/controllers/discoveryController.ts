import { Response } from 'express';
import { z } from 'zod';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { buildRecommendationProfile } from '../services/recommendationEngine';

import { visiblePerson, visibleResponse, visibleComment } from '../services/communitySafety';

const commentBodySchema = z.object({ body: z.string().trim().min(1).max(1000) });
const pageQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).optional(), offset: z.coerce.number().int().min(0).default(0) });
const pageRows = <T>(rows: T[], limit?: number) => limit === undefined ? rows : rows.slice(0, limit);
const nextOffset = (rows: unknown[], limit: number | undefined, offset: number) => limit !== undefined && rows.length > limit ? offset + limit : null;


export const loadFeed = async (viewerId: number | null, limit = 24, offset = 0, scope = 'everyone', cursor?: { at: string; id: number }) => {
  const result = await pool.query(
    `SELECT de.id, de.user_id, de.movie_id, de.watched_on, de.note, de.visibility, de.created_at, de.enjoyment, de.highlights,
            to_char(de.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_at,
            de.neutral::float, de.happy::float, de.sad::float, de.angry::float,
            de.fearful::float, de.disgusted::float, de.surprised::float,
            u.username, u.bio, m.title, m.poster_path, m.backdrop_path, m.release_date,
            em.asset_path AS expression_image_path,
            em.alt_text AS expression_image_alt,
            (SELECT COUNT(*)::int FROM entry_reactions er WHERE er.entry_id = de.id) AS like_count,
            CASE WHEN $1::int IS NULL THEN FALSE ELSE EXISTS(
              SELECT 1 FROM entry_reactions er WHERE er.entry_id = de.id AND er.user_id = $1
            ) END AS liked,
            (SELECT COUNT(*)::int FROM entry_comments ec WHERE ec.entry_id = de.id AND ${visibleComment('$1')}) AS comment_count,
            CASE WHEN $1::int IS NULL THEN FALSE ELSE EXISTS(
              SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followed_id = de.user_id
            ) END AS following
     FROM diary_entries de
     JOIN users u ON u.id = de.user_id
     JOIN movies m ON m.id = de.movie_id
     LEFT JOIN entry_media em ON em.entry_id = de.id AND em.kind = 'expression_photo'
     WHERE de.visibility = 'public' AND ${visibleResponse('$1')} AND ($4 <> 'following' OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followed_id = de.user_id))
       AND ($5::timestamp IS NULL OR (de.created_at, de.id) < ($5::timestamp, $6::bigint))
     ORDER BY de.created_at DESC, de.id DESC
     LIMIT $2 OFFSET $3`,
    [viewerId, limit, offset, scope, cursor?.at || null, cursor?.id || null],
  );
  return result.rows;
};

export const getFeed = async (req: AuthRequest, res: Response) => {
  try {
    const limit = z.coerce.number().int().min(1).max(60).default(24).parse(req.query.limit);
    const viewerId = req.user?.id || null;
    const offset = z.coerce.number().int().min(0).default(0).parse(req.query.offset);
    const scope = z.enum(['everyone', 'following']).default('everyone').parse(req.query.scope);
    let cursor: { at: string; id: number } | undefined;
    if (req.query.cursor !== undefined) {
      const encoded = z.string().max(200).regex(/^[A-Za-z0-9_-]+$/).parse(req.query.cursor);
      try {
        cursor = z.object({ at: z.string().datetime(), id: z.coerce.number().int().positive() }).parse(JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')));
      } catch { return res.status(400).json({ error: 'Invalid feed cursor' }); }
    }
    const entries = await loadFeed(viewerId, limit + 1, cursor ? 0 : offset, scope, cursor);
    const page = entries.slice(0, limit), last = page[page.length - 1];
    const nextCursor = entries.length > limit && last ? Buffer.from(JSON.stringify({ at: last.cursor_at, id: Number(last.id) })).toString('base64url') : null;
    res.json({ entries: page.map(({ cursor_at: _cursorAt, ...entry }) => entry), nextCursor, nextOffset: entries.length > limit ? offset + limit : null });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid feed query' });
    res.status(500).json({ error: 'Community entries could not be loaded' });
  }
};

export const getFilmEntries = async (req: AuthRequest, res: Response) => {
  try {
    const movieId = z.coerce.number().int().positive().parse(req.params.movieId);
    const viewerId = req.user?.id || null;
    const { limit, offset } = pageQuerySchema.parse(req.query);
    const scope = z.enum(['everyone', 'following']).default('everyone').parse(req.query.scope);
    const result = await pool.query(
      `SELECT de.id, de.user_id, de.movie_id, de.watched_on, de.note, de.visibility, de.created_at, de.enjoyment, de.highlights,
              de.neutral::float, de.happy::float, de.sad::float, de.angry::float,
              de.fearful::float, de.disgusted::float, de.surprised::float,
              u.username, u.bio, m.title, m.poster_path, m.backdrop_path, m.release_date,
              em.asset_path AS expression_image_path,
              em.alt_text AS expression_image_alt,
              (SELECT COUNT(*)::int FROM entry_reactions er WHERE er.entry_id = de.id) AS like_count,
              CASE WHEN $2::int IS NULL THEN FALSE ELSE EXISTS(
                SELECT 1 FROM entry_reactions er WHERE er.entry_id = de.id AND er.user_id = $2
              ) END AS liked,
              (SELECT COUNT(*)::int FROM entry_comments ec WHERE ec.entry_id = de.id AND ${visibleComment('$2')}) AS comment_count,
              CASE WHEN $2::int IS NULL THEN FALSE ELSE EXISTS(
                SELECT 1 FROM follows f WHERE f.follower_id = $2 AND f.followed_id = de.user_id
              ) END AS following
       FROM diary_entries de
       JOIN users u ON u.id = de.user_id
       JOIN movies m ON m.id = de.movie_id
       LEFT JOIN entry_media em ON em.entry_id = de.id AND em.kind = 'expression_photo'
       WHERE de.visibility = 'public' AND de.movie_id = $1 AND ${visibleResponse('$2')}
         AND ($5 = 'everyone' OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$2 AND f.followed_id=de.user_id))
       ORDER BY de.created_at DESC, de.id DESC LIMIT $3 OFFSET $4`,
      [movieId, viewerId, limit === undefined ? null : limit + 1, offset, scope],
    );
    const summary = await pool.query(`SELECT COUNT(*)::int AS total,
      AVG(de.neutral)::float AS neutral, AVG(de.happy)::float AS happy, AVG(de.sad)::float AS sad,
      AVG(de.angry)::float AS angry, AVG(de.fearful)::float AS fearful, AVG(de.disgusted)::float AS disgusted, AVG(de.surprised)::float AS surprised
      FROM diary_entries de WHERE de.movie_id=$1 AND de.visibility='public' AND ${visibleResponse('$2')}
      AND ($3='everyone' OR EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$2 AND f.followed_id=de.user_id))`, [movieId, viewerId, scope]);
    const film = await pool.query('SELECT id,title,overview,release_date,poster_path,backdrop_path FROM movies WHERE id=$1', [movieId]);
    res.json({ entries: pageRows(result.rows, limit), nextOffset: nextOffset(result.rows, limit, offset), summary: summary.rows[0], film: film.rows[0] ?? null });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid film ID' });
    res.status(500).json({ error: 'Public film entries could not be loaded' });
  }
};

export const loadPeople = async (viewerId: number | null, query: { limit?: number; offset?: number; q?: string; scope?: 'all' | 'following' | 'discover' } = {}) => {
  const { matchedPeople } = await buildRecommendationProfile(viewerId || undefined);
  const byId = new Map(matchedPeople.map(person => [person.id, person]));
  const term = (query.q ?? '').toLowerCase();
  const matchingSharedFilms = matchedPeople.filter(person => person.sharedFilmTitle?.toLowerCase().includes(term)).map(person => person.id);
  const result = await pool.query(
      `WITH latest_response AS (
         SELECT DISTINCT ON (de.user_id)
                de.user_id, de.movie_id AS latest_movie_id, de.note AS latest_note,
                m.title AS latest_title, m.poster_path AS latest_poster_path
         FROM diary_entries de
         JOIN movies m ON m.id = de.movie_id
         WHERE de.visibility = 'public' AND ${visibleResponse('$1')}
         ORDER BY de.user_id, de.watched_on DESC, de.created_at DESC
       )
       SELECT u.id, u.username, u.bio,
              COUNT(de.id)::int AS entries,
              (SELECT COUNT(*)::int FROM follows followers WHERE followers.followed_id = u.id AND ${visiblePerson('$1', 'followers.follower_id')}) AS followers,
              (SELECT COUNT(*)::int FROM follows following WHERE following.follower_id = u.id AND ${visiblePerson('$1', 'following.followed_id')}) AS following_count,
              AVG(de.neutral)::float AS neutral, AVG(de.happy)::float AS happy,
              AVG(de.sad)::float AS sad, AVG(de.angry)::float AS angry,
              AVG(de.fearful)::float AS fearful, AVG(de.disgusted)::float AS disgusted,
              AVG(de.surprised)::float AS surprised,
              NULL::int AS shared_films, NULL::float AS pattern_overlap, NULL::text AS shared_film_title,
              latest.latest_movie_id, latest.latest_title, latest.latest_poster_path, latest.latest_note,
              CASE WHEN $1::int IS NULL THEN FALSE ELSE EXISTS(
                SELECT 1 FROM follows f WHERE f.follower_id = $1 AND f.followed_id = u.id
              ) END AS following,
              CASE WHEN $1::int IS NULL THEN FALSE ELSE EXISTS(
                SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.followed_id = $1
              ) END AS follows_you
       FROM users u LEFT JOIN diary_entries de ON de.user_id = u.id AND de.visibility = 'public' AND ${visibleResponse('$1')}
       LEFT JOIN latest_response latest ON latest.user_id = u.id
       WHERE ($1::int IS NULL OR u.id <> $1) AND ${visiblePerson('$1', 'u.id')}
         AND ($6 = 'all'
           OR ($6 = 'following' AND EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.followed_id=u.id))
           OR ($6 = 'discover' AND NOT EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$1 AND f.followed_id=u.id)))
         AND ($5 = '' OR POSITION($5 IN LOWER(u.username)) > 0 OR POSITION($5 IN LOWER(COALESCE(u.bio,''))) > 0
           OR POSITION($5 IN LOWER(COALESCE(latest.latest_title,''))) > 0 OR u.id=ANY($7::int[]))
       GROUP BY u.id,
                latest.latest_movie_id, latest.latest_title, latest.latest_poster_path, latest.latest_note
       ORDER BY array_position($2::int[], u.id) ASC NULLS LAST, following DESC, LOWER(u.username), u.id
       LIMIT $3 OFFSET $4`,
    [viewerId, matchedPeople.map(person => person.id), query.limit ?? null, query.offset ?? 0, term, query.scope ?? 'all', matchingSharedFilms],
  );
  return result.rows.map(row => {
    const peer = byId.get(Number(row.id));
    return { ...row, shared_films: peer?.sharedFilms ?? null,
      shared_film_title: peer?.sharedFilmTitle ?? null, pattern_overlap: null };
  });
};

export const getPeople = async (req: AuthRequest, res: Response) => {
  try {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).optional(), offset: z.coerce.number().int().min(0).default(0),
      q: z.string().trim().max(200).optional(), scope: z.enum(['all', 'following', 'discover']).default('all') }).parse(req.query);
    const people = await loadPeople(req.user?.id || null, { ...query, limit: query.limit === undefined ? undefined : query.limit + 1 });
    res.json({ people: query.limit === undefined ? people : people.slice(0, query.limit),
      nextOffset: query.limit !== undefined && people.length > query.limit ? query.offset + query.limit : null });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid people query' });
    console.error('People discovery error:', error);
    res.status(500).json({ error: 'People could not be loaded' });
  }
};

export const getPersonProfile = async (req: AuthRequest, res: Response) => {
  try {
    const username = z.string().trim().min(1).max(100).parse(req.params.username);
    const viewerId = req.user?.id || null;
    const { limit, offset } = pageQuerySchema.parse(req.query);
    const view = z.enum(['responses', 'films']).default('responses').parse(req.query.view);
    const includeConnections = z.enum(['true', 'false']).default('true').parse(req.query.includeConnections) === 'true';
    const person = await pool.query(
      `SELECT u.id, u.username, u.bio,
              COUNT(de.id)::int AS entries, COUNT(DISTINCT de.movie_id)::int AS films,
              (SELECT COUNT(*)::int FROM follows followers WHERE followers.followed_id = u.id AND ${visiblePerson('$2', 'followers.follower_id')}) AS followers,
              (SELECT COUNT(*)::int FROM follows following WHERE following.follower_id = u.id AND ${visiblePerson('$2', 'following.followed_id')}) AS following_count,
              AVG(de.neutral)::float AS neutral, AVG(de.happy)::float AS happy,
              AVG(de.sad)::float AS sad, AVG(de.angry)::float AS angry,
              AVG(de.fearful)::float AS fearful, AVG(de.disgusted)::float AS disgusted,
              AVG(de.surprised)::float AS surprised,
              NULL::text AS shared_film_title,
              CASE WHEN $2::int IS NULL THEN FALSE ELSE EXISTS(
                SELECT 1 FROM follows f WHERE f.follower_id = $2 AND f.followed_id = u.id
              ) END AS following,
              CASE WHEN $2::int IS NULL THEN FALSE ELSE EXISTS(
                SELECT 1 FROM follows f WHERE f.follower_id = u.id AND f.followed_id = $2
              ) END AS follows_you
       FROM users u
       LEFT JOIN diary_entries de ON de.user_id = u.id AND de.visibility = 'public' AND ${visibleResponse('$2')}
       WHERE LOWER(u.username) = LOWER($1) AND ${visiblePerson('$2', 'u.id')}
       GROUP BY u.id`,
      [username, viewerId],
    );
    if (!person.rowCount) return res.status(404).json({ error: 'Member not found' });

    const entries = await pool.query(
      `SELECT * FROM (SELECT ${view === 'films' ? 'DISTINCT ON (de.movie_id)' : ''} de.id, de.user_id, de.movie_id, de.watched_on, de.note, de.visibility, de.created_at, de.enjoyment, de.highlights,
              de.neutral::float, de.happy::float, de.sad::float, de.angry::float,
              de.fearful::float, de.disgusted::float, de.surprised::float,
              u.username, u.bio, m.title, m.poster_path, m.backdrop_path, m.release_date,
              em.asset_path AS expression_image_path,
              em.alt_text AS expression_image_alt,
              (SELECT COUNT(*)::int FROM entry_reactions er WHERE er.entry_id = de.id) AS like_count,
              CASE WHEN $2::int IS NULL THEN FALSE ELSE EXISTS(
                SELECT 1 FROM entry_reactions er WHERE er.entry_id = de.id AND er.user_id = $2
              ) END AS liked,
              (SELECT COUNT(*)::int FROM entry_comments ec WHERE ec.entry_id = de.id AND ${visibleComment('$2')}) AS comment_count,
              EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$2 AND f.followed_id=de.user_id) AS following
       FROM diary_entries de
       JOIN users u ON u.id = de.user_id
       JOIN movies m ON m.id = de.movie_id
       LEFT JOIN entry_media em ON em.entry_id = de.id AND em.kind = 'expression_photo'
       WHERE de.visibility = 'public' AND u.id = $1 AND ${visibleResponse('$2')}
       ORDER BY ${view === 'films' ? 'de.movie_id,' : ''} de.watched_on DESC, de.created_at DESC, de.id DESC) response_page
       ORDER BY watched_on DESC, created_at DESC, id DESC LIMIT $3 OFFSET $4`,
      [person.rows[0].id, viewerId, limit === undefined ? null : limit + 1, offset],
    );

    const followers = includeConnections ? await pool.query(
      `SELECT u.id, u.username, u.bio,
       EXISTS(SELECT 1 FROM follows own WHERE own.follower_id = $2 AND own.followed_id = u.id) AS following
       FROM follows f
       JOIN users u ON u.id = f.follower_id
       WHERE f.followed_id = $1 AND ${visiblePerson('$2', 'u.id')}
       ORDER BY LOWER(u.username), u.id LIMIT $3`,
      [person.rows[0].id, viewerId, limit ?? null],
    ) : { rows: [] };
    const following = includeConnections ? await pool.query(
      `SELECT u.id, u.username, u.bio,
       EXISTS(SELECT 1 FROM follows own WHERE own.follower_id = $2 AND own.followed_id = u.id) AS following
       FROM follows f
       JOIN users u ON u.id = f.followed_id
       WHERE f.follower_id = $1 AND ${visiblePerson('$2', 'u.id')}
       ORDER BY LOWER(u.username), u.id LIMIT $3`,
      [person.rows[0].id, viewerId, limit ?? null],
    ) : { rows: [] };

    const { matchedPeople } = await buildRecommendationProfile(viewerId || undefined);
    person.rows[0].shared_film_title = matchedPeople.find(p => p.id === Number(person.rows[0].id))?.sharedFilmTitle ?? null;
    res.json({ person: person.rows[0], entries: pageRows(entries.rows, limit), nextOffset: nextOffset(entries.rows, limit, offset), followers: followers.rows, following: following.rows });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid member name' });
    res.status(500).json({ error: 'Member profile could not be loaded' });
  }
};

export const getActivity = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const limit = z.coerce.number().int().min(1).max(80).default(40).parse(req.query.limit);
    const offset = z.coerce.number().int().min(0).default(0).parse(req.query.offset);
    const includeResponses = z.enum(['true', 'false']).default('false').parse(req.query.includeResponses) === 'true';
    const includeSuggestions = z.enum(['true', 'false']).default('false').parse(req.query.includeSuggestions) === 'true';
    const kind = z.enum(['all', 'like', 'comment', 'follow', 'response', 'recommendations', 'suggestion', 'suggestion_reply', 'suggestion_message']).default('all').parse(req.query.kind);
    const result = await pool.query(
      `SELECT * FROM (
         SELECT 'like'::text AS kind, er.created_at,
                actor.id AS actor_id, actor.username,
                de.id AS entry_id, m.id AS movie_id, m.title, m.poster_path,
                de.note, NULL::text AS comment_body, NULL::bigint AS suggestion_id,
                'like:' || er.entry_id || ':' || er.user_id AS event_id
         FROM entry_reactions er
         JOIN users actor ON actor.id = er.user_id
         JOIN diary_entries de ON de.id = er.entry_id
         JOIN movies m ON m.id = de.movie_id
         WHERE de.user_id = $1 AND actor.id <> $1 AND de.visibility = 'public'

         UNION ALL

         SELECT 'comment'::text AS kind, ec.created_at,
                actor.id AS actor_id, actor.username,
                de.id AS entry_id, m.id AS movie_id, m.title, m.poster_path,
                de.note, ec.body AS comment_body, NULL::bigint AS suggestion_id, 'comment:' || ec.id AS event_id
         FROM entry_comments ec
         JOIN users actor ON actor.id = ec.user_id
         JOIN diary_entries de ON de.id = ec.entry_id
         JOIN movies m ON m.id = de.movie_id
         WHERE de.user_id = $1 AND actor.id <> $1 AND de.visibility = 'public' AND ${visibleComment('$1')}

         UNION ALL

         SELECT 'follow'::text AS kind, f.created_at,
                actor.id AS actor_id, actor.username,
                NULL::bigint AS entry_id, NULL::integer AS movie_id,
                NULL::varchar AS title, NULL::varchar AS poster_path,
                NULL::text AS note, NULL::text AS comment_body, NULL::bigint AS suggestion_id,
                'follow:' || f.follower_id || ':' || f.followed_id AS event_id
         FROM follows f
         JOIN users actor ON actor.id = f.follower_id
         WHERE f.followed_id = $1

         UNION ALL

         SELECT 'response'::text AS kind, de.created_at,
                actor.id AS actor_id, actor.username,
                de.id AS entry_id, m.id AS movie_id, m.title, m.poster_path,
                de.note, NULL::text AS comment_body, NULL::bigint AS suggestion_id, 'response:' || de.id AS event_id
         FROM follows f
         JOIN diary_entries de ON de.user_id = f.followed_id
         JOIN users actor ON actor.id = de.user_id
         JOIN movies m ON m.id = de.movie_id
         WHERE f.follower_id = $1 AND $4::boolean AND de.visibility = 'public' AND ${visibleResponse('$1')}

         UNION ALL

         SELECT 'suggestion'::text, s.created_at, actor.id, actor.username,
                NULL::bigint, m.id, m.title, m.poster_path, NULL::text, s.reason::text, s.id, 'suggestion:' || s.id
         FROM film_suggestions s JOIN users actor ON actor.id=s.sender_id JOIN movies m ON m.id=s.movie_id
         WHERE $5::boolean AND s.recipient_id=$1 AND s.origin='sent'

         UNION ALL

         SELECT 'suggestion_reply'::text, r.updated_at, actor.id, actor.username,
                NULL::bigint, m.id, m.title, m.poster_path, NULL::text,
                CASE WHEN r.contains_spoilers THEN NULL::text ELSE r.note::text END, s.id, 'suggestion_reply:' || s.id
         FROM suggestion_replies r JOIN film_suggestions s ON s.id=r.suggestion_id
         JOIN users actor ON actor.id=s.recipient_id JOIN movies m ON m.id=s.movie_id
         WHERE $5::boolean AND s.sender_id=$1

         UNION ALL

         SELECT 'suggestion_message'::text, sm.created_at, actor.id, actor.username,
                NULL::bigint, m.id, m.title, m.poster_path, NULL::text,
                CASE WHEN sm.contains_spoilers THEN NULL::text ELSE sm.body::text END, s.id, 'suggestion_message:' || sm.id
         FROM suggestion_messages sm JOIN film_suggestions s ON s.id=sm.suggestion_id
         JOIN users actor ON actor.id=sm.user_id JOIN movies m ON m.id=s.movie_id
         WHERE $5::boolean AND sm.user_id <> $1 AND (s.sender_id=$1 OR s.recipient_id=$1)
           AND (s.origin='sent' OR s.shared_at IS NOT NULL)
       ) activity
       WHERE ${visiblePerson('$1', 'actor_id')}
       AND NOT EXISTS (SELECT 1 FROM moderation_actions ma WHERE ma.target_kind = 'response' AND ma.target_id = activity.entry_id)
       AND ($6 = 'all' OR kind = $6 OR ($6 = 'recommendations' AND kind IN ('suggestion', 'suggestion_reply', 'suggestion_message')))
       ORDER BY created_at DESC, kind, actor_id, entry_id, suggestion_id, event_id
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit + 1, offset, includeResponses, includeSuggestions, kind],
    );
    res.json({ activity: result.rows.slice(0, limit), nextOffset: result.rows.length > limit ? offset + limit : null });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid activity query' });
    console.error('Activity error:', error);
    res.status(500).json({ error: 'Activity could not be loaded' });
  }
};

export const loadCommunityPulse = async (viewerId: number | null = null) => {
  const result = await pool.query(
      `WITH recent AS (
         SELECT de.id, de.user_id, de.movie_id, de.note, de.created_at,
                u.username, m.title, m.overview, m.release_date,
                m.poster_path, m.backdrop_path,
                ROW_NUMBER() OVER (PARTITION BY de.movie_id ORDER BY de.created_at DESC) AS recency
         FROM diary_entries de
         JOIN users u ON u.id = de.user_id
         JOIN movies m ON m.id = de.movie_id
         WHERE de.visibility = 'public' AND ${visibleResponse('$1')}
       )
       SELECT movie_id, title, overview, release_date, poster_path, backdrop_path,
              COUNT(*)::int AS response_count,
              COUNT(DISTINCT user_id)::int AS people_count,
              MAX(created_at) AS latest_at,
              (ARRAY_AGG(username ORDER BY created_at DESC))[1] AS latest_username,
              (ARRAY_AGG(note ORDER BY created_at DESC) FILTER (WHERE note <> ''))[1] AS latest_note
       FROM recent
       GROUP BY movie_id, title, overview, release_date, poster_path, backdrop_path
       ORDER BY MAX(created_at) DESC, COUNT(DISTINCT user_id) DESC
       LIMIT 14`, [viewerId],
  );
  return result.rows;
};

export const getCommunityPulse = async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ films: await loadCommunityPulse(_req.user?.id || null) });
  } catch (error) {
    console.error('Community pulse error:', error);
    res.status(500).json({ error: 'Community films could not be loaded' });
  }
};

export const followPerson = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const personId = z.coerce.number().int().positive().parse(req.params.personId);
    if (personId === req.user.id) return res.status(400).json({ error: 'You cannot follow yourself' });
    const exists = await pool.query(`SELECT 1 FROM users u WHERE u.id = $1 AND ${visiblePerson('$2', 'u.id')}`, [personId, req.user.id]);
    if (!exists.rowCount) return res.status(404).json({ error: 'Person not found' });
    await pool.query('INSERT INTO follows (follower_id, followed_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, personId]);
    res.status(201).json({ following: true });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid person ID' });
    res.status(500).json({ error: 'Follow could not be saved' });
  }
};

export const unfollowPerson = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const personId = z.coerce.number().int().positive().parse(req.params.personId);
    await pool.query('DELETE FROM follows WHERE follower_id = $1 AND followed_id = $2', [req.user.id, personId]);
    res.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid person ID' });
    res.status(500).json({ error: 'Follow could not be removed' });
  }
};

export const likeEntry = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const entryId = z.coerce.number().int().positive().parse(req.params.entryId);
    const entry = await pool.query(`SELECT 1 FROM diary_entries de WHERE de.id = $1 AND de.visibility = 'public' AND ${visibleResponse('$2')}`, [entryId, req.user?.id || null]);
    if (!entry.rowCount) return res.status(404).json({ error: 'Entry not found' });
    await pool.query('INSERT INTO entry_reactions (user_id, entry_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, entryId]);
    res.status(201).json({ liked: true });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid entry ID' });
    res.status(500).json({ error: 'Like could not be saved' });
  }
};

export const removeLike = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const entryId = z.coerce.number().int().positive().parse(req.params.entryId);
    await pool.query('DELETE FROM entry_reactions WHERE user_id = $1 AND entry_id = $2', [req.user.id, entryId]);
    res.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid entry ID' });
    res.status(500).json({ error: 'Like could not be removed' });
  }
};

export const getEntryComments = async (req: AuthRequest, res: Response) => {
  try {
    const entryId = z.coerce.number().int().positive().parse(req.params.entryId);
    const viewerId = req.user?.id || null;
    const { limit, offset } = pageQuerySchema.parse(req.query);
    const entry = await pool.query(`SELECT 1 FROM diary_entries de WHERE de.id = $1 AND de.visibility = 'public' AND ${visibleResponse('$2')}`, [entryId, req.user?.id || null]);
    if (!entry.rowCount) return res.status(404).json({ error: 'Response not found' });
    const comments = await pool.query(
      `SELECT ec.id, ec.entry_id, ec.user_id, ec.body, ec.created_at,
              u.username, ($2::int IS NOT NULL AND ec.user_id = $2) AS own
       FROM entry_comments ec
       JOIN users u ON u.id = ec.user_id
       WHERE ec.entry_id = $1 AND ${visibleComment('$2')}
       ORDER BY ec.created_at ASC, ec.id ASC LIMIT $3 OFFSET $4`,
      [entryId, viewerId, limit === undefined ? null : limit + 1, offset],
    );
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM entry_comments ec WHERE ec.entry_id=$1 AND ${visibleComment('$2')}`, [entryId, viewerId]);
    res.json({ comments: pageRows(comments.rows, limit), nextOffset: nextOffset(comments.rows, limit, offset), total: count.rows[0].total });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid response ID' });
    res.status(500).json({ error: 'Comments could not be loaded' });
  }
};

export const addEntryComment = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const entryId = z.coerce.number().int().positive().parse(req.params.entryId);
    const { body } = commentBodySchema.parse(req.body);
    const entry = await pool.query(`SELECT 1 FROM diary_entries de WHERE de.id = $1 AND de.visibility = 'public' AND ${visibleResponse('$2')}`, [entryId, req.user?.id || null]);
    if (!entry.rowCount) return res.status(404).json({ error: 'Response not found' });
    const created = await pool.query(
      `WITH inserted AS (
         INSERT INTO entry_comments (user_id, entry_id, body)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, entry_id, body, created_at
       )
       SELECT inserted.*, u.username, TRUE AS own
       FROM inserted JOIN users u ON u.id = inserted.user_id`,
      [req.user.id, entryId, body],
    );
    res.status(201).json({ comment: created.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Write a comment between 1 and 1000 characters' });
    res.status(500).json({ error: 'Comment could not be added' });
  }
};

export const deleteEntryComment = async (req: AuthRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  try {
    const commentId = z.coerce.number().int().positive().parse(req.params.commentId);
    const deleted = await pool.query('DELETE FROM entry_comments WHERE id = $1 AND user_id = $2 RETURNING id', [commentId, req.user.id]);
    if (!deleted.rowCount) return res.status(404).json({ error: 'Comment not found' });
    res.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid comment ID' });
    res.status(500).json({ error: 'Comment could not be removed' });
  }
};

// Exact activity links must resolve a response, not silently land on a profile.
export const getResponse = async (req: AuthRequest, res: Response) => {
  try {
    const id = z.coerce.number().int().positive().parse(req.params.entryId);
    const result = await pool.query(`SELECT de.id, de.user_id, de.movie_id, de.watched_on, de.note, de.visibility, de.created_at, de.enjoyment, de.highlights,
      de.neutral::float, de.happy::float, de.sad::float, de.angry::float,
      de.fearful::float, de.disgusted::float, de.surprised::float,
      u.username, u.bio, m.title, m.poster_path, m.backdrop_path, m.release_date,
      em.asset_path AS expression_image_path, em.alt_text AS expression_image_alt,
      (SELECT COUNT(*)::int FROM entry_reactions er WHERE er.entry_id = de.id) AS like_count,
      EXISTS(SELECT 1 FROM entry_reactions er WHERE er.entry_id = de.id AND er.user_id = $2) AS liked,
      EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=$2 AND f.followed_id=de.user_id) AS following,
      (SELECT COUNT(*)::int FROM entry_comments ec WHERE ec.entry_id = de.id AND ${visibleComment('$2')}) AS comment_count
      FROM diary_entries de JOIN users u ON u.id = de.user_id JOIN movies m ON m.id = de.movie_id
      LEFT JOIN entry_media em ON em.entry_id = de.id AND em.kind = 'expression_photo'
      WHERE de.id = $1 AND (de.visibility = 'public' OR de.user_id = $2) AND ${visibleResponse('$2')}`, [id, req.user?.id || null]);
    if (!result.rowCount) return res.status(404).json({ error: 'This response is no longer available.' });
    res.json({ entry: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid response ID' });
    res.status(500).json({ error: 'Response could not be loaded' });
  }
};


export const getPersonConnections = async (req: AuthRequest, res: Response) => {
  try {
    const username = z.string().trim().min(1).max(100).parse(req.params.username);
    const viewer = req.user?.id || null;
    const { limit = 30, offset } = pageQuerySchema.parse(req.query);
    const kind = z.enum(['followers', 'following']).parse(req.query.kind);
    const person = await pool.query(`SELECT u.id FROM users u WHERE LOWER(u.username)=LOWER($1) AND ${visiblePerson('$2', 'u.id')}`, [username, viewer]);
    if (!person.rowCount) return res.status(404).json({ error: 'Member not found' });
    const people = await pool.query(`SELECT u.id,u.username,u.bio,
      EXISTS(SELECT 1 FROM follows own WHERE own.follower_id=$2 AND own.followed_id=u.id) AS following
      FROM follows f JOIN users u ON u.id=f.${kind === 'followers' ? 'follower_id' : 'followed_id'}
      WHERE f.${kind === 'followers' ? 'followed_id' : 'follower_id'}=$1 AND ${visiblePerson('$2', 'u.id')}
      ORDER BY LOWER(u.username),u.id LIMIT $3 OFFSET $4`, [person.rows[0].id, viewer, limit + 1, offset]);
    res.json({ people: pageRows(people.rows, limit), nextOffset: nextOffset(people.rows, limit, offset) });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid connection query' });
    res.status(500).json({ error: 'Connections could not be loaded' });
  }
};
