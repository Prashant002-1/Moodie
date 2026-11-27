import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FilmForYou, pathService } from '../../services/pathService';
import { apiError } from '../../services/apiClient';
import { imageUrl, releaseYear } from '../../utils/display';
import { feelingsFromOrder } from '../../utils/feelings';
import { listed, madeOfIt } from '../../utils/paths';
import { Avatar } from '../common/Avatar';
import { Feelings } from '../response/Feelings';
import { KeepRecommendation } from '../suggestions/KeepRecommendation';
import { PathWhy } from './Reason';

/**
 * A film that reaches you through people: who loved it, what they wrote, and what you have in common with them.
 * "Not for me" sets the film aside where it stands, and can be taken back.
 */
export function PathCard({ item, headingLevel = 3 }: { item: FilmForYou; headingLevel?: 2 | 3 }) {
  const [aside, setAside] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { film, paths } = item;
  const [lead, ...others] = paths;
  const Title = headingLevel === 2 ? 'h2' : 'h3';
  const poster = imageUrl(film.poster_path, 'w154');
  const filmLink = `/movie/${film.id}#response-${lead.response.id}`;
  const set = async (hidden: boolean) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await (hidden ? pathService.hide(film.id) : pathService.unhide(film.id)); setAside(hidden); }
    catch (caught) { setError(apiError(caught, 'That could not be saved. Try again.')); }
    finally { setBusy(false); }
  };
  if (aside) return <article aria-label={film.title} className="path path--aside">
    <p className="status" role="status"><span className="film-inline">{film.title}</span> will not be offered again. <button className="link" disabled={busy} onClick={() => void set(false)} type="button">Undo</button></p>
    {error && <p className="error t-caption" role="alert">{error}</p>}
  </article>;
  const also = [...others.map(path => path.person.username), ...(item.more ? [`${item.more} more`] : [])];
  return <article aria-label={film.title} className="path">
    <Link className="poster poster--sm" tabIndex={-1} to={filmLink}>{poster && <img alt={`Poster for ${film.title}`} loading="lazy" src={poster} />}</Link>
    <div className="path__main">
      <Title className="row__title"><Link to={filmLink}>{film.title}</Link>{film.release_date && <> <span className="year">{releaseYear(film.release_date)}</span></>}</Title>
      <div className="path__lead">
        <Avatar size="sm" to={null} username={lead.person.username} />
        <p className="byline"><Link to={`/member/${lead.person.username}`}>{lead.person.username}</Link> {madeOfIt(lead.response.enjoyment)}</p>
        <Feelings entry={feelingsFromOrder(lead.response.feelings)} />
      </div>
      {lead.response.note && <p className="note clamp clamp--2">{lead.response.note}</p>}
      <PathWhy person={lead.person.username} reason={lead.reason} />
      {(also.length > 0 || item.against.length > 0) && <p className="path__also">
        {others.length > 0 && <span className="path__faces">{others.map(path => <Avatar key={path.person.id} size="sm" to={null} username={path.person.username} />)}</span>}
        {also.length > 0 && <span>Also {listed(also)}.</span>}
        {item.against.length > 0 && <span>Not for {listed(item.against.map(person => person.username))}.</span>}
      </p>}
      <div className="actions path__actions">
        <KeepRecommendation authorId={lead.person.id} className="btn btn--secondary btn--small" entryId={lead.response.id} movieId={film.id} />
        <Link className="btn btn--quiet btn--small" to={`/log?movieId=${film.id}`}>Seen it</Link>
        <button aria-label={`${film.title} is not for me`} className="btn btn--quiet btn--small" disabled={busy} onClick={() => void set(true)} type="button">Not for me</button>
      </div>
      {error && <p className="error t-caption" role="alert">{error}</p>}
    </div>
  </article>;
}
