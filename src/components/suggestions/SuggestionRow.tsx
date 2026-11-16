import { FilmSuggestion } from '../../types/suggestion';
import { RecommendationNote } from './RecommendationNote';

/** One recommendation in a list. A recommendation is always shown as a note: this is the small one. */
export function SuggestionRow({ item, viewerId, headingLevel = 2 }: { item: FilmSuggestion; viewerId: number; headingLevel?: 2 | 3 }) {
  return <RecommendationNote compact headingLevel={headingLevel} item={item} viewerId={viewerId} />;
}
