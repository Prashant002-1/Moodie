import { Link } from 'react-router-dom';
import { Movie } from '../../types/movie';
import { imageUrl, releaseYear } from '../../utils/display';
import { KeepRecommendation } from '../suggestions/KeepRecommendation';
import { RecommendationEvidence } from './RecommendationEvidence';

interface RecommendationRowProps {
  movie: Movie;
  showComparison?: boolean;
  headingLevel?: 2 | 3;
}

/** A film that reached the viewer through a person: who, which film, the film they share, the person's words. */
export function RecommendationRow({ movie, showComparison = false, headingLevel = 3 }: RecommendationRowProps) {
  const person = movie.recommended_by?.[0];
  if (!person) return null;

  const poster = imageUrl(movie.poster_path, 'w154');
  const filmLink = `/movie/${movie.id}?from=${encodeURIComponent(person.username)}&through=${encodeURIComponent(person.shared_film_title)}#response-${person.response_id}`;
  const Title = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <article className="row">
      <Link className="poster poster--sm" tabIndex={-1} to={filmLink}>{poster && <img alt={`Poster for ${movie.title}`} loading="lazy" src={poster} />}</Link>
      <div className="row__main">
        <p className="byline">Through <Link to={`/member/${person.username}`}>@{person.username}</Link></p>
        <Title className="row__title"><Link to={filmLink}>{movie.title}</Link></Title>
        {movie.release_date && <p className="t-caption muted">{releaseYear(movie.release_date)}</p>}
        <RecommendationEvidence connection={person} movieTitle={movie.title} showComparison={showComparison} />
        {person.response_note && <p className="note clamp">{person.response_note}</p>}
        <div className="actions" style={{ marginTop: 'var(--m-space-2)' }}>
          <KeepRecommendation authorId={person.id} className="btn btn--secondary btn--small" entryId={person.response_id} movieId={movie.id} />
        </div>
      </div>
    </article>
  );
}
