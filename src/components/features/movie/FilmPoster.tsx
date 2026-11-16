import React from 'react';
import { Link } from 'react-router-dom';
import { Movie } from '../../../types/movie';
import { imageUrl, releaseYear } from '../../../utils/display';

interface FilmPosterProps {
  movie: Pick<Movie, 'id' | 'title' | 'poster_path'> & { release_date?: string | null };
  actionLabel?: string;
}

/** A film on a wall: its poster, with the title and year under it. */
const FilmPoster: React.FC<FilmPosterProps> = ({ movie, actionLabel = 'View film' }) => {
  const poster = imageUrl(movie.poster_path, 'w342');
  return (
    <Link aria-label={`${actionLabel}: ${movie.title}`} className="tile" to={`/movie/${movie.id}`}>
      <span className="poster">{poster && <img alt={`Poster for ${movie.title}`} loading="lazy" src={poster} />}</span>
      <h3 className="tile__title">{movie.title}</h3>
      <span className="tile__sub">{releaseYear(movie.release_date)}</span>
    </Link>
  );
};

export default FilmPoster;
