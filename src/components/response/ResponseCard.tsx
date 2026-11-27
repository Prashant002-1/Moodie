import { useState } from 'react';
import { Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ResponseEntry } from '../../services/discoveryService';
import { imageUrl, releaseYear } from '../../utils/display';
import { ResponseDetails } from '../diary/ResponseDetails';
import { ResponseComments } from '../discovery/ResponseComments';
import { KeepRecommendation } from '../suggestions/KeepRecommendation';
import { Avatar } from '../common/Avatar';
import { personHue } from '../../utils/person';
import { Feelings } from './Feelings';

interface ResponseCardProps {
  entry: ResponseEntry;
  ownUserId?: number;
  onFollow?: (entry: ResponseEntry) => void;
  onLike: (entry: ResponseEntry) => void;
}

/** One person's response to one film: who, which film, their words, their feelings. */
export function ResponseCard({ entry, ownUserId, onFollow, onLike }: ResponseCardProps) {
  const poster = imageUrl(entry.poster_path, 'w342');
  // The heart answers a tap with a small bounce; one that was already filled when the page opened stays still.
  const [tapped, setTapped] = useState(false);
  const likes = entry.like_count || 0;
  return <article className="response">
    <header className="response__head" data-hue={personHue(entry.username)}>
      <Avatar username={entry.username} />
      <p className="byline"><Link to={`/member/${entry.username}`}>@{entry.username}</Link></p>
      {onFollow && entry.user_id !== ownUserId && entry.following === false && <button aria-label={`Follow @${entry.username}`} aria-pressed={false} className="btn btn--secondary btn--small" onClick={() => onFollow(entry)} type="button">Follow</button>}
      <Link aria-label="Read response" className="t-caption muted" to={`/response/${entry.id}`}><time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></Link>
    </header>
    <div className="response__body">
      <div className="response__text">
        <Link className="response__film" to={`/movie/${entry.movie_id}`}>{entry.title} <span>{releaseYear(entry.release_date)}</span></Link>
        <Feelings entry={entry} />
        {entry.note && <p className="note">{entry.note}</p>}
        <ResponseDetails enjoyment={entry.enjoyment} highlights={entry.highlights} />
        {entry.expression_image_path && <img alt={entry.expression_image_alt || `Photo shared by ${entry.username}`} className="response__photo" loading="lazy" src={entry.expression_image_path} />}
      </div>
      <Link className="poster" tabIndex={-1} to={`/movie/${entry.movie_id}`}>{poster && <img alt={`Poster for ${entry.title}`} loading="lazy" src={poster} />}</Link>
    </div>
    <footer className="response__foot">
      <button aria-label={`${entry.liked ? 'Unlike' : 'Like'} ${entry.username}'s response`} aria-pressed={entry.liked} onClick={() => { setTapped(true); onLike(entry); }} type="button"><Heart aria-hidden="true" className={tapped && entry.liked ? 'pop' : undefined} fill={entry.liked ? 'currentColor' : 'none'} size={16} />{likes > 0 && <span>{likes}<span className="sr-only"> {likes === 1 ? 'like' : 'likes'}</span></span>}</button>
      <ResponseComments entryId={entry.id} initialCount={entry.comment_count} />
      <span className="push"><KeepRecommendation entryId={entry.id} authorId={entry.user_id} movieId={entry.movie_id} /></span>
    </footer>
  </article>;
}
