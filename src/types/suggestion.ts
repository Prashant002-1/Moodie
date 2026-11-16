import type { components, operations } from './generated/suggestions';

export type FilmSuggestion = components['schemas']['Suggestion'];
export type SuggestionReply = components['schemas']['Reply'];
export type SuggestionMessage = components['schemas']['Message'];
export type SuggestionInput = components['schemas']['CreateSuggestion'];
export type SuggestionAction = components['schemas']['SuggestionAction'];
export type SuggestionSummary = components['schemas']['SuggestionSummary'];
export type SuggestionProgress = FilmSuggestion['progress'];
export type SuggestionReplyInput = components['schemas']['ReplyInput'];
export type SuggestionMessageInput = components['schemas']['MessageInput'];
export type SuggestionRecipient = components['schemas']['Recipients']['people'][number];
export type SuggestionQuery = NonNullable<operations['listSuggestions']['parameters']['query']>;
export type Enjoyment = components['schemas']['Enjoyment'];
export type ResponseHighlight = components['schemas']['Highlights'][number];

export const enjoymentLabels: Record<Enjoyment, string> = {
  loved: 'Loved it', liked: 'Liked it', mixed: 'Mixed', not_for_me: 'Not for me',
};
export const highlightLabels: Record<ResponseHighlight, string> = {
  story: 'Story', characters: 'Characters', performances: 'Performances', dialogue: 'Dialogue',
  images: 'Images', music: 'Music', ending: 'Ending',
};
export const suggestionStatus: Record<FilmSuggestion['status'], string> = {
  suggested: 'Recommended to you', sent: 'Sent', saved: 'Saved for later',
  watched: 'Watched · reply when you’re ready', replied: 'Replied', shared: 'Conversation',
};

export const suggestionContext = (item: FilmSuggestion) => item.origin === 'sent'
  ? item.reason : item.source_note ?? 'Their response is no longer shared.';

export const suggestionPerson = (item: FilmSuggestion, viewerId: number) => item.recipient_id === viewerId
  ? item.sender_username : item.recipient_username;

export const suggestionByline = (item: FilmSuggestion, viewerId: number) => {
  if (item.recipient_id === viewerId) return item.origin === 'sent'
    ? `${item.sender_username} thought of you` : `Found through ${item.sender_username}`;
  return item.origin === 'sent' ? `You thought of ${item.recipient_username}` : `${item.recipient_username} found this through you`;
};

/** The four things that can happen to a recommendation, in order. The server says how far it has got. */
export const progressSteps: SuggestionProgress[] = ['sent', 'saved', 'watched', 'replied'];
export const progressLabels: Record<SuggestionProgress, string> = { sent: 'Sent', saved: 'Saved', watched: 'Watched', replied: 'Replied' };

/** A reminder is due once its time has passed. Only the recipient ever has one. */
export const reminderDue = (item: Pick<FilmSuggestion, 'remind_at'>, now = Date.now()) =>
  item.remind_at != null && new Date(item.remind_at).getTime() <= now;

/** "Sat 21 Nov, 11:00" in the person's own language and time zone, always in that order. */
export const formatReminder = (value: string | Date, withTime = true) => {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? '';
  const day = `${part('weekday')} ${part('day')} ${part('month')}`;
  return withTime ? `${day}, ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` : day;
};

const at = (base: Date, days: number, hour: number) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + days, hour, 0, 0, 0);
/** The three quick times, worked out in the person's own time zone. */
export function reminderChoices(now = new Date()): { label: string; at: Date }[] {
  const tonight = at(now, 0, 20);
  const evening = tonight > now ? { label: 'Tonight', at: tonight } : { label: 'Tomorrow night', at: at(now, 1, 20) };
  // Saturday at 11:00. Once that has passed, Sunday; once that has passed, next Saturday.
  const toSaturday = (6 - now.getDay() + 7) % 7;
  const saturday = at(now, toSaturday, 11), sunday = at(now, now.getDay() === 0 ? 0 : toSaturday + 1, 11);
  const weekend = now.getDay() !== 0 && saturday > now ? { label: 'This weekend', at: saturday }
    : sunday > now ? { label: 'This weekend', at: sunday }
      : { label: 'Next weekend', at: at(now, now.getDay() === 0 ? 6 : 7, 11) };
  return [evening, weekend, { label: 'In a week', at: at(now, 7, 20) }];
}
