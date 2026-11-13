import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useDiary } from '../../contexts/DiaryContext';
import { usePagedResource } from '../../hooks/usePagedResource';
import { discoveryService } from '../../services/discoveryService';
import { Feelings } from '../response/Feelings';
import { formatCalendarDate, imageUrl } from '../../utils/display';

export function SharedFilms({ username }: { username: string }) {
  const { user } = useUser();
  const { revision } = useDiary();
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await discoveryService.sharedFilms(username, offset, signal);
    return { items: result.films, next: result.nextOffset };
  }, [username]);
  const page = usePagedResource(`${user?.id}:shared:${username}:${revision}`, load);
  const date = (value: string) => formatCalendarDate(value, { month: 'short', day: 'numeric', year: 'numeric' });
  return <section aria-label={`Films you share with @${username}`}>
    {page.error && <p className="notice notice--error" role="alert">{page.error} <button className="link" onClick={page.refresh} type="button">Retry shared films</button></p>}
    <div className="list">{page.items.map(({ ownEntry, personEntry }) => <article className="shared" key={personEntry.movie_id}>
      <header className="row row--center">
        <Link className="poster poster--xs" tabIndex={-1} to={`/movie/${personEntry.movie_id}`}>{imageUrl(personEntry.poster_path, 'w154') && <img alt={`Poster for ${personEntry.title}`} loading="lazy" src={imageUrl(personEntry.poster_path, 'w154')!} />}</Link>
        <h2 className="row__main"><Link to={`/movie/${personEntry.movie_id}`}>{personEntry.title}</Link></h2>
      </header>
      <div className="two-up">
        <div className="shared__side">
          <p className="byline"><strong>You</strong></p>
          <Feelings entry={ownEntry} />
          {ownEntry.note && <p className="note">{ownEntry.note}</p>}
          <p className="meta"><Link aria-label={`Your response, ${date(ownEntry.watched_on)}`} to={`/response/${ownEntry.id}`}>{date(ownEntry.watched_on)}</Link>{ownEntry.visibility === 'private' && <span>Only you can see this</span>}</p>
        </div>
        <div className="shared__side">
          <p className="byline"><strong>@{username}</strong></p>
          <Feelings entry={personEntry} />
          {personEntry.note && <p className="note">{personEntry.note}</p>}
          <p className="meta"><Link aria-label={`Their response, ${date(personEntry.watched_on)}`} to={`/response/${personEntry.id}`}>{date(personEntry.watched_on)}</Link></p>
        </div>
      </div>
    </article>)}</div>
    {page.loading && <p className="status" role="status">Loading shared films</p>}
    {page.loaded && !page.loading && !page.error && !page.items.length && <div className="empty"><p>No films in common.</p></div>}
    {page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore} type="button">More shared films</button></div>}
  </section>;
}
