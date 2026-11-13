import { Link } from 'react-router-dom';
import { FilmSuggestion, suggestionByline, suggestionContext, suggestionStatus } from '../../types/suggestion';
import { imageUrl } from '../../utils/display';

export function SuggestionRow({ item, viewerId }: { item: FilmSuggestion; viewerId: number }) {
  const poster = imageUrl(item.poster_path, 'w154');
  return <Link className="suggestion-row" to={`/suggestions/${item.id}`}>
    <div><span className="suggestion-row__person">{suggestionByline(item, viewerId)}</span>
      <h2>{item.title}</h2><p>{suggestionContext(item)}</p>
      <small>{item.archived ? 'Archived' : suggestionStatus[item.status]}</small>
    </div>
    {poster && <img alt="" src={poster} loading="lazy" />}
  </Link>;
}
