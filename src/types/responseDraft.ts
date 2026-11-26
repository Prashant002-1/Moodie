import type { DiaryEntryInput } from './diary';
import type { Movie } from './movie';
import type { EmotionScores } from './emotion';
import type { Enjoyment, ResponseHighlight } from './suggestion';
import type { ResponseEntry } from '../services/discoveryService';
import { enjoymentLabels, highlightLabels } from './suggestion';

export type DraftFilm = Pick<Movie, 'id' | 'title' | 'poster_path' | 'release_date'>;
export interface ResponseDraft {
  version: 1;
  film: DraftFilm | null;
  editingId?: number;
  watchedOn: string;
  note: string;
  visibility: 'private' | 'public';
  emotions: EmotionScores;
  enjoyment: Enjoyment | null;
  highlights: ResponseHighlight[];
  expressionImage: string | null;
  suggestionId?: number;
  suggestionName?: string;
  clientRequestId: string;
}

export const emptyFeelings = (): EmotionScores => ({ neutral: 0, happy: 0, sad: 0, angry: 0, fearful: 0, disgusted: 0, surprised: 0 });
export const localDay = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
export const newResponseDraft = (film: DraftFilm | null = null): ResponseDraft => ({
  version: 1, film, watchedOn: localDay(), note: '', visibility: 'private', emotions: emptyFeelings(),
  enjoyment: null, highlights: [], expressionImage: null, clientRequestId: crypto.randomUUID(),
});
/** Nothing felt, said or attached yet. Such a draft is never worth interrupting a person to ask about. */
export const untouchedDraft = (draft: ResponseDraft) => !draft.editingId && !draft.note.trim() && !draft.expressionImage
  && !draft.enjoyment && !draft.highlights.length && !Object.values(draft.emotions).some(value => value > 0);
export const draftFromResponse = (entry: ResponseEntry): ResponseDraft => ({
  ...newResponseDraft({ id: entry.movie_id, title: entry.title, poster_path: entry.poster_path ?? null, release_date: entry.release_date ?? '' }),
  editingId: entry.id, watchedOn: entry.watched_on.slice(0, 10), note: entry.note, visibility: entry.visibility,
  emotions: (Object.keys(emptyFeelings()) as (keyof EmotionScores)[]).reduce((feelings, key) => {
    feelings[key] = Number(entry[key]);
    return feelings;
  }, emptyFeelings()),
  enjoyment: entry.enjoyment ?? null, highlights: entry.highlights ?? [], expressionImage: entry.expression_image_path,
});

export const responseDraftInput = (draft: ResponseDraft): DiaryEntryInput | null => {
  if (!draft.film || !draft.watchedOn || draft.watchedOn > localDay() || draft.note.length > 2000
    || !Object.values(draft.emotions).some(value => value >= .001)) return null;
  return {
    movieId: draft.film.id, watchedOn: draft.watchedOn, note: draft.note, visibility: draft.visibility,
    emotions: draft.emotions, enjoyment: draft.enjoyment, highlights: draft.highlights,
    expressionImage: draft.expressionImage, clientRequestId: draft.clientRequestId,
    ...(draft.suggestionId ? { suggestionId: draft.suggestionId } : {}),
  };
};

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const positiveID = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
const optionalID = (value: unknown) => value === undefined || positiveID(value);

// Local storage is versioned and validated independently of the API. A future
// schema must be migrated explicitly, never silently treated as an empty draft.
export function isResponseDraft(value: unknown): value is ResponseDraft {
  if (!object(value) || value.version !== 1 || !object(value.emotions)) return false;
  const film = value.film;
  return (film === null || (object(film) && positiveID(film.id) && typeof film.title === 'string'
      && (film.poster_path === null || typeof film.poster_path === 'string') && typeof film.release_date === 'string'))
    && optionalID(value.editingId) && optionalID(value.suggestionId)
    && (value.suggestionName === undefined || typeof value.suggestionName === 'string')
    && typeof value.watchedOn === 'string' && (value.watchedOn === '' || /^\d{4}-\d{2}-\d{2}$/.test(value.watchedOn))
    && typeof value.note === 'string' && value.note.length <= 2000
    && ['private', 'public'].includes(String(value.visibility))
    && (value.enjoyment === null || (typeof value.enjoyment === 'string' && Object.prototype.hasOwnProperty.call(enjoymentLabels, value.enjoyment)))
    && Array.isArray(value.highlights) && value.highlights.length <= 7
    && value.highlights.every(key => typeof key === 'string' && Object.prototype.hasOwnProperty.call(highlightLabels, key))
    && (value.expressionImage === null || (typeof value.expressionImage === 'string' && value.expressionImage.length <= 2_800_000))
    && typeof value.clientRequestId === 'string' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value.clientRequestId)
    && Object.keys(emptyFeelings()).every(key => {
      const intensity = (value.emotions as Record<string, unknown>)[key];
      return typeof intensity === 'number' && Number.isFinite(intensity) && intensity >= 0 && intensity <= 1;
    });
}
