import { EmotionScores } from '../../types/emotion';
import { Movie } from '../../types/movie';
import { RecommendationRow } from './RecommendationRow';

interface DiscoveryPathCardProps {
  movie: Movie;
  /** Accepted for existing callers. Not shown. */
  requestedFeelings?: (keyof EmotionScores)[];
  headingLevel?: 2 | 3;
}

/** One recommended film as a row. Render it inside a `.list`. */
export function DiscoveryPathCard({ movie, headingLevel }: DiscoveryPathCardProps) {
  return <RecommendationRow headingLevel={headingLevel} movie={movie} />;
}
