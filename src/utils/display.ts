import { EmotionScores } from '../types/emotion';

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

export const imageUrl = (path: string | null | undefined, size = 'w500') =>
  path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;

export const releaseYear = (date?: string | null) => {
  if (!date) return 'Date unknown';
  // Release dates are calendar dates, not instants in the viewer's timezone.
  const parsed = calendarDate(date);
  return parsed ? String(parsed.getFullYear()) : 'Date unknown';
};

export const calendarDate = (value?: string | Date | null) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const datePart = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatCalendarDate = (value: string | Date | null | undefined, options: Intl.DateTimeFormatOptions) =>
  calendarDate(value)?.toLocaleDateString(undefined, options) || 'Date unknown';

export const formatRuntime = (minutes?: number) => {
  if (!minutes) return null;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
};

export const emotionLabels: Record<keyof EmotionScores, string> = {
  neutral: 'Stillness',
  happy: 'Joy',
  sad: 'Melancholy',
  angry: 'Friction',
  fearful: 'Tension',
  disgusted: 'Unease',
  surprised: 'Wonder',
};

export const emotionColors: Record<keyof EmotionScores, string> = {
  // Mirrors design/tokens.json → feeling.light. Hue is a secondary cue; the word is always shown.
  neutral: '#7C8589',
  happy: '#C0862F',
  sad: '#3C6585',
  angry: '#963F37',
  fearful: '#82506B',
  disgusted: '#306E64',
  surprised: '#726928',
};

const emotionKeys = Object.keys(emotionLabels) as (keyof EmotionScores)[];

export const dominantEmotion = (scores?: EmotionScores | null) => {
  if (!scores) return null;
  const [emotion, score] = emotionKeys
    .map(key => [key, Number(scores[key]) || 0] as const)
    .sort(([, first], [, second]) => second - first)[0] || [];
  return emotion ? { emotion, label: emotionLabels[emotion], score } : null;
};
