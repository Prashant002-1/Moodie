import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { KeepRecommendation } from '../suggestions/KeepRecommendation';
import { EmotionScores } from '../../types/emotion';
import { Movie } from '../../types/movie';
import { imageUrl, releaseYear } from '../../utils/display';
import BrandMark from '../brand/BrandMark';
import { RecommendationEvidence } from './RecommendationEvidence';

interface DiscoveryPathCardProps {
  movie: Movie;
  requestedFeelings?: (keyof EmotionScores)[];
}

export function DiscoveryPathCard({ movie, requestedFeelings = [] }: DiscoveryPathCardProps) {
  const person = movie.recommended_by?.[0];
  const poster = imageUrl(movie.poster_path, 'w342');

  if (!person) return null;

  const filmLink = `/movie/${movie.id}?from=${encodeURIComponent(person.username)}&through=${encodeURIComponent(person.shared_film_title)}#response-${person.response_id}`;

  return (
    <article className="path-card">
      <Link className="path-card__poster" to={filmLink}>
        {poster ? <img alt={`Poster for ${movie.title}`} loading="lazy" src={poster} /> : <span><BrandMark /></span>}
      </Link>
      <div className="path-card__body">
        <p className="path-card__through">Recommended through <Link to={`/member/${person.username}`}>@{person.username}</Link></p>
        <Link to={filmLink}><h3>{movie.title}</h3></Link>
        <p className="path-card__year">{releaseYear(movie.release_date)}</p>
        <RecommendationEvidence connection={person} movieTitle={movie.title} requestedFeelings={requestedFeelings} />
        {person.response_note && <blockquote><span className="path-card__response-label">@{person.username} on {movie.title}</span>“{person.response_note}”</blockquote>}
        <div className="path-card__actions">
          <Link to={filmLink}>Open <ArrowUpRight aria-hidden="true" size={15} /></Link>
          <KeepRecommendation entryId={person.response_id} authorId={person.id} movieId={movie.id} />
        </div>
      </div>
    </article>
  );
}
