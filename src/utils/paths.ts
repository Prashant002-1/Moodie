import { emotionLabels } from './display';
import { FeelingKey } from './feelings';

export type Enjoyment = 'loved' | 'liked' | 'mixed' | 'not_for_me';

/** "a", "a and b", "a, b and c". */
export const listed = (words: string[]) => words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;

/** Feelings as they read inside a sentence. */
export const feltWords = (keys: FeelingKey[]) => keys.map(key => emotionLabels[key].toLowerCase());

/** What a person made of a film, as the end of a sentence that starts with their name. */
export const madeOfIt = (enjoyment: Enjoyment | null) =>
  enjoyment === 'loved' ? 'loved it' : enjoyment === 'liked' ? 'liked it' : enjoyment === 'mixed' ? 'was mixed on it' : enjoyment === 'not_for_me' ? 'did not take to it' : 'wrote about it';
