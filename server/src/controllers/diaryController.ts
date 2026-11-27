import { Response } from 'express';
import { createHash } from 'crypto';
import { z } from 'zod';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth';
import { ensureMovie } from '../services/movieCacheService';
import { enjoymentSchema, highlightsSchema, linkSuggestion, SuggestionError } from '../services/suggestionService';

const emotionSchema = z.object({
  neutral: z.number().min(0).max(1),
  happy: z.number().min(0).max(1),
  sad: z.number().min(0).max(1),
  angry: z.number().min(0).max(1),
  fearful: z.number().min(0).max(1),
  disgusted: z.number().min(0).max(1),
  surprised: z.number().min(0).max(1),
});
const someFeeling = (scores: Record<string, number>) => Object.values(scores).some(value => value >= 0.001);

const MAX_EXPRESSION_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_EXPRESSION_IMAGE_DATA_URL_LENGTH = 2_800_000;
const EXPRESSION_IMAGE_PATTERN = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

const hasExpectedImageSignature = (mime: string, bytes: Buffer) => {
  if (mime === 'jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  return bytes.length >= 12
    && bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP';
};

const expressionImageSchema = z.string().max(MAX_EXPRESSION_IMAGE_DATA_URL_LENGTH).superRefine((value, ctx) => {
  const match = EXPRESSION_IMAGE_PATTERN.exec(value);
  if (!match) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expression image must be a JPEG, PNG, or WebP data URL' });
    return;
  }
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_EXPRESSION_IMAGE_BYTES) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expression image must be no larger than 2 MiB' });
    return;
  }
  if (!hasExpectedImageSignature(match[1], bytes)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Expression image bytes do not match the declared image type' });
  }
});

const entrySchema = z.object({
  movieId: z.number().int().positive(),
  watchedOn: z.string().date().refine(date => date <= new Date().toISOString().slice(0, 10), 'Watched date cannot be in the future.'),
  note: z.string().trim().max(2000).default(''),
  visibility: z.enum(['private', 'public']).default('private'),
  emotions: emotionSchema,
  expressionImage: expressionImageSchema.nullable().optional(),
  enjoyment: enjoymentSchema.nullable().optional(),
  highlights: highlightsSchema.optional(),
  suggestionId: z.number().int().positive().optional(),
  clientRequestId: z.string().uuid().optional(),
});

// A verdict alone is a complete short answer ("Loved it"). With neither a feeling nor a verdict there is nothing to keep.
const entryCreateSchema = entrySchema.refine(entry => someFeeling(entry.emotions) || Boolean(entry.enjoyment), { message: 'Choose at least one feeling.', path: ['emotions'] });
const entryUpdateSchema = entrySchema.omit({ movieId: true, suggestionId: true, clientRequestId: true }).partial()
  .refine(entry => !entry.emotions || someFeeling(entry.emotions) || Boolean(entry.enjoyment), { message: 'Choose at least one feeling.', path: ['emotions'] });

const selectEntry = `
  SELECT de.id, de.user_id, de.movie_id, de.watched_on, de.note, de.visibility,
         de.enjoyment, de.highlights,
         de.neutral::float, de.happy::float, de.sad::float, de.angry::float,
         de.fearful::float, de.disgusted::float, de.surprised::float,
         de.created_at, de.updated_at,
         u.username, m.title, m.overview, m.release_date, m.poster_path, m.backdrop_path,
         COALESCE((SELECT ARRAY_AGG(mg.genre_id ORDER BY mg.genre_id) FROM movie_genres mg WHERE mg.movie_id = m.id), ARRAY[]::integer[]) AS genre_ids,
         (SELECT COUNT(*)::int FROM entry_reactions er WHERE er.entry_id = de.id) AS like_count,
         (SELECT COUNT(*)::int FROM entry_comments ec WHERE ec.entry_id = de.id) AS comment_count,
         (SELECT COUNT(*)::int FROM diary_entries viewed WHERE viewed.user_id = de.user_id AND viewed.movie_id = de.movie_id) AS viewing_count,
         em.asset_path AS expression_image_path,
         em.alt_text AS expression_image_alt
  FROM diary_entries de
  JOIN users u ON u.id = de.user_id
  JOIN movies m ON m.id = de.movie_id
  LEFT JOIN entry_media em ON em.entry_id = de.id AND em.kind = 'expression_photo'
`;

const requireUser = (req: AuthRequest, res: Response): number | null => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return req.user.id;
};

export const loadDiaryEntries = async (userId: number, limit = 50, offset = 0,
  filters: { q?: string; visibility?: 'private' | 'public'; movieId?: number } = {}) => {
  const clauses = ['de.user_id = $1'];
  const values: unknown[] = [userId];
  if (filters.q) {
    values.push(filters.q.toLowerCase());
    clauses.push(`(POSITION($${values.length} IN LOWER(m.title)) > 0 OR POSITION($${values.length} IN LOWER(de.note)) > 0)`);
  }
  if (filters.visibility) { values.push(filters.visibility); clauses.push(`de.visibility = $${values.length}`); }
  if (filters.movieId) { values.push(filters.movieId); clauses.push(`de.movie_id = $${values.length}`); }
  values.push(limit, offset);
  const result = await pool.query(
    `${selectEntry} WHERE ${clauses.join(' AND ')} ORDER BY de.watched_on DESC, de.created_at DESC, de.id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return result.rows;
};

export const loadDiarySummary = async (userId: number) => {
  const summary = await pool.query(
    `SELECT COUNT(*)::int AS entries,
            COUNT(*) FILTER (WHERE visibility = 'public')::int AS public_entries,
            (COUNT(*) - COUNT(DISTINCT movie_id))::int AS rewatches,
            AVG(neutral)::float AS neutral, AVG(happy)::float AS happy, AVG(sad)::float AS sad,
            AVG(angry)::float AS angry, AVG(fearful)::float AS fearful,
            AVG(disgusted)::float AS disgusted, AVG(surprised)::float AS surprised,
            (SELECT COUNT(*)::int FROM saved_films sf WHERE sf.user_id = $1) AS saved
     FROM diary_entries WHERE user_id = $1`,
    [userId],
  );
  const recent = await pool.query(`SELECT COUNT(*)::int AS entries,
    COALESCE(AVG(neutral),0)::float AS neutral, COALESCE(AVG(happy),0)::float AS happy,
    COALESCE(AVG(sad),0)::float AS sad, COALESCE(AVG(angry),0)::float AS angry,
    COALESCE(AVG(fearful),0)::float AS fearful, COALESCE(AVG(disgusted),0)::float AS disgusted,
    COALESCE(AVG(surprised),0)::float AS surprised
    FROM diary_entries WHERE user_id = $1 AND watched_on BETWEEN CURRENT_DATE - 29 AND CURRENT_DATE`, [userId]);
  const { entries, ...feelings } = recent.rows[0];
  return { ...summary.rows[0], recent: { entries, feelings } };
};

export const loadSavedFilms = async (userId: number, limit?: number, offset = 0, q = '') => {
  const result = await pool.query(
    `SELECT sf.id, sf.movie_id, sf.created_at, m.title, m.overview, m.release_date, m.poster_path, m.backdrop_path,
            COALESCE((SELECT ARRAY_AGG(mg.genre_id) FROM movie_genres mg WHERE mg.movie_id = m.id), ARRAY[]::integer[]) AS genre_ids
     FROM saved_films sf JOIN movies m ON m.id = sf.movie_id
     WHERE sf.user_id = $1 AND POSITION(LOWER($4) IN LOWER(m.title)) > 0
     ORDER BY sf.created_at DESC, sf.id DESC LIMIT $2 OFFSET $3`,
    [userId, limit ?? null, offset, q],
  );
  return result.rows;
};

export const listEntries = async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const limit = z.coerce.number().int().min(1).max(100).default(50).parse(req.query.limit);
    const offset = z.coerce.number().int().min(0).default(0).parse(req.query.offset);
    const filters = z.object({ q: z.string().trim().max(200).optional(),
      visibility: z.enum(['private', 'public']).optional(), movieId: z.coerce.number().int().positive().optional() }).parse(req.query);
    const entries = await loadDiaryEntries(userId, limit + 1, offset, filters);
    res.json({ entries: entries.slice(0, limit), nextOffset: entries.length > limit ? offset + limit : null });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid diary query' });
    res.status(500).json({ error: 'Diary entries could not be loaded' });
  }
};

export const createEntry = async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const data = entryCreateSchema.parse(req.body);
    await ensureMovie(data.movieId);
    const e = data.emotions;
    const requestHash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
    const entryId = await pool.transaction(async client => {
      if (data.clientRequestId) {
        const prior = (await client.query('SELECT id,request_hash FROM diary_entries WHERE user_id=$1 AND client_request_id=$2', [userId,data.clientRequestId])).rows[0];
        if (prior) {
          if (prior.request_hash !== requestHash) throw new SuggestionError(409, 'This response was already saved with different details. Open your diary before saving another viewing.');
          return Number(prior.id);
        }
      }
      const inserted = await client.query(
        `INSERT INTO diary_entries (
          user_id, movie_id, watched_on, rating, note, visibility,
          neutral, happy, sad, angry, fearful, disgusted, surprised,
          enjoyment, highlights, client_request_id, request_hash
         ) VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING id`,
        [userId, data.movieId, data.watchedOn, data.note, data.visibility,
          e.neutral, e.happy, e.sad, e.angry, e.fearful, e.disgusted, e.surprised,
          data.enjoyment ?? null, data.highlights ?? [], data.clientRequestId ?? null, data.clientRequestId ? requestHash : null],
      );
      const insertedEntryId = Number(inserted.rows[0].id);
      if (data.suggestionId) await linkSuggestion(client,data.suggestionId,userId,data.movieId,insertedEntryId);
      if (data.expressionImage) {
        await client.query(
          `INSERT INTO entry_media (entry_id, kind, asset_path, alt_text)
           VALUES ($1, 'expression_photo', $2, $3)`,
          [insertedEntryId, data.expressionImage, 'Expression photo shared with this response'],
        );
      }
      return insertedEntryId;
    });
    const result = await pool.query(`${selectEntry} WHERE de.id = $1`, [entryId]);
    res.status(201).json({ entry: result.rows[0] });
  } catch (error) {
    if (error instanceof SuggestionError) return res.status(error.status).json({ error: error.message });
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid diary entry', details: error.errors });
    res.status(500).json({ error: 'Diary entry could not be saved' });
  }
};

export const updateEntry = async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const entryId = z.coerce.number().int().positive().parse(req.params.entryId);
    const data = entryUpdateSchema.parse(req.body);
    const updates: string[] = [];
    const values: unknown[] = [entryId, userId];
    const add = (column: string, value: unknown) => {
      values.push(value);
      updates.push(`${column} = $${values.length}`);
    };

    if (data.watchedOn !== undefined) add('watched_on', data.watchedOn);
    if (data.note !== undefined) add('note', data.note);
    if (data.visibility !== undefined) add('visibility', data.visibility);
    if (data.enjoyment !== undefined) add('enjoyment', data.enjoyment);
    if (data.highlights !== undefined) add('highlights', data.highlights);
    if (data.emotions) Object.entries(data.emotions).forEach(([key, value]) => add(key, value));
    if (!updates.length && data.expressionImage === undefined) return res.status(400).json({ error: 'No diary changes supplied' });

    const updated = await pool.transaction(async client => {
      const result = updates.length
        ? await client.query(
          `UPDATE diary_entries SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND user_id = $2 RETURNING id`,
          values,
        )
        : await client.query(
          'UPDATE diary_entries SET updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING id',
          [entryId, userId],
        );
      if (result.rowCount && data.expressionImage !== undefined) {
        if (data.expressionImage === null) {
          await client.query("DELETE FROM entry_media WHERE entry_id = $1 AND kind = 'expression_photo'", [entryId]);
        } else {
          await client.query(
            `INSERT INTO entry_media (entry_id, kind, asset_path, alt_text)
             VALUES ($1, 'expression_photo', $2, $3)
             ON CONFLICT (entry_id, kind) DO UPDATE SET
               asset_path = EXCLUDED.asset_path,
               alt_text = EXCLUDED.alt_text,
               updated_at = CURRENT_TIMESTAMP`,
            [entryId, data.expressionImage, 'Expression photo shared with this response'],
          );
        }
      }
      return result;
    });
    if (!updated.rowCount) return res.status(404).json({ error: 'Diary entry not found' });
    const result = await pool.query(`${selectEntry} WHERE de.id = $1`, [entryId]);
    res.json({ entry: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid diary changes', details: error.errors });
    res.status(500).json({ error: 'Diary entry could not be updated' });
  }
};

export const deleteEntry = async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const entryId = z.coerce.number().int().positive().parse(req.params.entryId);
    const result = await pool.query('DELETE FROM diary_entries WHERE id = $1 AND user_id = $2 RETURNING id', [entryId, userId]);
    if (!result.rowCount) return res.status(404).json({ error: 'Diary entry not found' });
    res.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid diary entry ID' });
    res.status(500).json({ error: 'Diary entry could not be deleted' });
  }
};

export const getSummary = async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    res.json(await loadDiarySummary(userId));
  } catch {
    res.status(500).json({ error: 'Diary summary could not be loaded' });
  }
};

export const listSaved = async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    // Older clients omit limit. New clients request an explicit bounded page.
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).optional(),
      offset: z.coerce.number().int().min(0).default(0), q: z.string().trim().max(200).default('') }).parse(req.query);
    const films = await loadSavedFilms(userId, query.limit === undefined ? undefined : query.limit + 1, query.offset, query.q);
    res.json({ films: query.limit === undefined ? films : films.slice(0, query.limit),
      nextOffset: query.limit !== undefined && films.length > query.limit ? query.offset + query.limit : null });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid saved films query' });
    res.status(500).json({ error: 'Saved films could not be loaded' });
  }
};

export const getLibraryStatus = async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const ids = z.string().max(1500).transform(value => value.split(','))
      .pipe(z.array(z.coerce.number().int().positive().max(2147483647)).min(1).max(100)).parse(req.query.movieIds);
    const result = await pool.query(`SELECT requested.id,
      EXISTS(SELECT 1 FROM saved_films sf WHERE sf.user_id=$1 AND sf.movie_id=requested.id) AS saved,
      (SELECT COUNT(*)::int FROM diary_entries de WHERE de.user_id=$1 AND de.movie_id=requested.id) AS viewing_count
      FROM (SELECT DISTINCT UNNEST($2::int[]) AS id) requested ORDER BY requested.id`, [userId, ids]);
    res.json({ films: result.rows });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Provide up to 100 film IDs' });
    res.status(500).json({ error: 'Your library status could not be loaded' });
  }
};

export const saveFilm = async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const movieId = z.number().int().positive().parse(req.body.movieId);
    await ensureMovie(movieId);
    await pool.query(
      `INSERT INTO saved_films (user_id, movie_id) VALUES ($1, $2)
       ON CONFLICT (user_id, movie_id) DO NOTHING`,
      [userId, movieId],
    );
    res.status(201).json({ movieId });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid film ID' });
    res.status(500).json({ error: 'Film could not be saved' });
  }
};

export const removeSavedFilm = async (req: AuthRequest, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const movieId = z.coerce.number().int().positive().parse(req.params.movieId);
    await pool.query('DELETE FROM saved_films WHERE user_id = $1 AND movie_id = $2', [userId, movieId]);
    res.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid film ID' });
    res.status(500).json({ error: 'Saved film could not be removed' });
  }
};
