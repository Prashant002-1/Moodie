import { Link } from 'react-router-dom';
import { FilmSuggestion, suggestionByline, suggestionContext, suggestionStatus } from '../../types/suggestion';
import { imageUrl } from '../../utils/display';

/** One recommendation in a list: the person first, then the film and their reason. */
export function SuggestionRow({ item, viewerId, headingLevel = 2 }: { item: FilmSuggestion; viewerId: number; headingLevel?: 2 | 3 }) {
  const poster = imageUrl(item.poster_path, 'w154');
  const Title = headingLevel === 3 ? 'h3' : 'h2';
  // "Recommended to you" and "Sent" only repeat the byline and the tab.
  const status = item.archived ? 'Archived' : item.status === 'suggested' || item.status === 'sent' ? null : suggestionStatus[item.status];
  return <Link className="row" to={`/suggestions/${item.id}`}>
    <span className="poster poster--sm">{poster && <img alt="" loading="lazy" src={poster} />}</span>
    <div className="row__main">
      <p className="byline">{suggestionByline(item, viewerId)}</p>
      <Title className="row__title">{item.title}</Title>
      <p className="note clamp">{suggestionContext(item)}</p>
      {status && <p className="t-caption muted">{status}</p>}
    </div>
  </Link>;
}
