import type { components, operations } from './generated/suggestions';

export type FilmSuggestion = components['schemas']['Suggestion'];
export type SuggestionReply = components['schemas']['Reply'];
export type SuggestionMessage = components['schemas']['Message'];
export type SuggestionInput = components['schemas']['CreateSuggestion'];
export type SuggestionAction = components['schemas']['SuggestionAction'];
export type SuggestionReplyInput = components['schemas']['ReplyInput'];
export type SuggestionMessageInput = components['schemas']['MessageInput'];
export type SuggestionRecipient = components['schemas']['Recipients']['people'][number];
export type SuggestionQuery = NonNullable<operations['listSuggestions']['parameters']['query']>;
export type Enjoyment = components['schemas']['Enjoyment'];
export type ResponseHighlight = components['schemas']['Highlights'][number];

export const enjoymentLabels: Record<Enjoyment, string> = {
  loved: 'Loved it', liked: 'Liked it', mixed: 'Mixed feelings', not_for_me: 'Not for me',
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
