import { EmotionScores } from '../../types/emotion';
import { Movie } from '../../types/movie';
import { RecommendationRow } from './RecommendationRow';

interface RecommendationSpotlightProps {
  movie: Movie;
  /** Accepted for existing callers. The row is always compact. */
  compact?: boolean;
  /** Accepted for existing callers. Not shown. */
  requestedFeelings?: (keyof EmotionScores)[];
  /** Accepted for existing callers. The row no longer links to the full list. */
  showAllLink?: boolean;
  headingLevel?: 2 | 3;
}

/** The same row as DiscoveryPathCard, with both people's responses to the shared film available. */
export function RecommendationSpotlight({ movie, headingLevel }: RecommendationSpotlightProps) {
  return <RecommendationRow headingLevel={headingLevel} movie={movie} showComparison />;
}
