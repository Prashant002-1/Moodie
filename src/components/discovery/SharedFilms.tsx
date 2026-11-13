import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useDiary } from '../../contexts/DiaryContext';
import { usePagedResource } from '../../hooks/usePagedResource';
import { discoveryService } from '../../services/discoveryService';
import { ResponseFeelingTrace } from './ResponseFeelingTrace';
import { imageUrl } from '../../utils/display';

export function SharedFilms({ username }: { username: string }) {
  const { user } = useUser();
  const { revision } = useDiary();
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await discoveryService.sharedFilms(username, offset, signal);
    return { items: result.films, next: result.nextOffset };
  }, [username]);
  const page = usePagedResource(`${user?.id}:shared:${username}:${revision}`, load);
  return <section aria-label={`Films you share with @${username}`} className="member-shared-list">
    {page.error && <p role="alert">{page.error} <button className="text-link" onClick={page.refresh}>Retry shared films</button></p>}
    {page.items.map(({ ownEntry, personEntry }) => <article className="member-shared-card" key={personEntry.movie_id}>
      <Link className="member-shared-card__poster" to={`/movie/${personEntry.movie_id}`}>{personEntry.poster_path ? <img alt={`Poster for ${personEntry.title}`} loading="lazy" src={imageUrl(personEntry.poster_path, 'w342') || ''} /> : <span />}</Link>
      <div className="member-shared-card__body"><Link to={`/movie/${personEntry.movie_id}`}><h2>{personEntry.title}</h2></Link>
        <div className="member-shared-card__responses">
          <article><span>You{ownEntry.visibility === 'private' ? ' · Only you can see this' : ''}</span><blockquote>{ownEntry.note || 'No words added.'}</blockquote><ResponseFeelingTrace entry={ownEntry} /><Link className="text-link" to={`/response/${ownEntry.id}`}>Your response</Link></article>
          <article><span>@{username}</span><blockquote>{personEntry.note || 'No words added.'}</blockquote><ResponseFeelingTrace entry={personEntry} /><Link className="text-link" to={`/response/${personEntry.id}`}>Their response</Link></article>
        </div>
      </div>
    </article>)}
    {page.loading && <p role="status">Finding shared films</p>}
    {page.loaded && !page.loading && !page.error && !page.items.length && <div className="product-empty"><p>You have not responded to the same film yet.</p><Link className="text-link" to="/log">Add a response</Link></div>}
    {page.next !== null && <button className="button button--secondary" disabled={page.loading} onClick={page.loadMore}>More shared films</button>}
  </section>;
}
