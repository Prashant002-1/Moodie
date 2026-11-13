import { Link } from 'react-router-dom';
import { EmotionScores } from '../../types/emotion';
import { Movie } from '../../types/movie';
import { feelingsFromOrder } from '../../utils/feelings';
import { Feelings } from '../response/Feelings';

type RecommendationConnection = NonNullable<Movie['recommended_by']>[number];

interface RecommendationEvidenceProps {
  connection: RecommendationConnection;
  /** Accepted for existing callers. The evidence is about the shared film only. */
  movieTitle?: string;
  /** Accepted for existing callers. Not shown: Moodie does not ask what a person wants to feel. */
  requestedFeelings?: (keyof EmotionScores)[];
  showComparison?: boolean;
}

/** Why this person: the film both people responded to and, when they matched, the feelings they share. */
export function RecommendationEvidence({ connection, showComparison = false }: RecommendationEvidenceProps) {
  const shared = connection.shared_feelings || [];
  const film = connection.shared_film_title;
  const to = connection.shared_response_id ? `/response/${connection.shared_response_id}`
    : connection.shared_movie_id ? `/movie/${connection.shared_movie_id}` : null;
  return (
    <>
      <p className="t-callout secondary">You both responded to {to ? <Link className="link" to={to}>{film}</Link> : film}</p>
      {shared.length > 0 && <div className="evidence__felt"><span>You both felt</span><Feelings entry={feelingsFromOrder(shared)} /></div>}
      {showComparison && connection.viewer_shared_note && connection.person_shared_note && (
        <details className="disclosure">
          <summary>Your responses to {film}</summary>
          <div className="two-up">
            <div className="stack stack--tight"><p className="byline"><strong>You</strong></p><p className="note">{connection.viewer_shared_note}</p></div>
            <div className="stack stack--tight"><p className="byline"><strong>@{connection.username}</strong></p><p className="note">{connection.person_shared_note}</p></div>
          </div>
        </details>
      )}
    </>
  );
}
