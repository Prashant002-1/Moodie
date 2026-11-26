import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useDiary } from '../../contexts/DiaryContext';
import { usePagedResource } from '../../hooks/usePagedResource';
import { discoveryService } from '../../services/discoveryService';
import { Avatar } from '../common/Avatar';
import { Feelings } from '../response/Feelings';
import { formatCalendarDate, imageUrl, releaseYear } from '../../utils/display';
import { personHue } from '../../utils/person';

/** The films two people both responded to: one poster, then each person's feelings and words under their own colour. */
export function SharedFilms({ username }: { username: string }) {
  const { user } = useUser();
  const { revision } = useDiary();
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await discoveryService.sharedFilms(username, offset, signal);
    return { items: result.films, next: result.nextOffset };
  }, [username]);
  const page = usePagedResource(`${user?.id}:shared:${username}`, load, revision);
  const date = (value: string) => formatCalendarDate(value, { month: 'short', day: 'numeric', year: 'numeric' });
  return <section aria-label={`Films you share with @${username}`}>
    {page.error && <p className="notice notice--error" role="alert">{page.error} <button className="link" onClick={page.refresh} type="button">Retry shared films</button></p>}
    <div className="pairs">{page.items.map(({ ownEntry, personEntry }) => {
      const poster = imageUrl(personEntry.poster_path, 'w342');
      const film = `/movie/${personEntry.movie_id}`;
      return <article className="pair" key={personEntry.movie_id}>
        <Link className="poster poster--lg" tabIndex={-1} to={film}>{poster && <img alt={`Poster for ${personEntry.title}`} loading="lazy" src={poster} />}</Link>
        <div className="pair__main">
          <header className="pair__head">
            <h2><Link to={film}>{personEntry.title}</Link></h2>
            {personEntry.release_date && <span className="year">{releaseYear(personEntry.release_date)}</span>}
          </header>
          <div className="pair__sides">
            <div className="pair__side" data-hue={user?.username ? personHue(user.username) : undefined}>
              <p className="pair__who">{user?.username && <Avatar size="sm" to={null} username={user.username} />}<span className="who">You</span></p>
              <Feelings entry={ownEntry} />
              {ownEntry.note && <p className="note">{ownEntry.note}</p>}
              <p className="meta"><Link aria-label={`Your response, ${date(ownEntry.watched_on)}`} to={`/response/${ownEntry.id}`}>{date(ownEntry.watched_on)}</Link>{ownEntry.visibility === 'private' && <span>Only you can see this</span>}</p>
            </div>
            <div className="pair__side" data-hue={personHue(username)}>
              <p className="pair__who"><Avatar size="sm" to={null} username={username} /><span className="who">{username}</span></p>
              <Feelings entry={personEntry} />
              {personEntry.note && <p className="note">{personEntry.note}</p>}
              <p className="meta"><Link aria-label={`Their response, ${date(personEntry.watched_on)}`} to={`/response/${personEntry.id}`}>{date(personEntry.watched_on)}</Link></p>
            </div>
          </div>
        </div>
      </article>;
    })}</div>
    {page.loading && <p className="status" role="status">Loading shared films</p>}
    {page.loaded && !page.loading && !page.error && !page.items.length && <div className="empty"><p>No films in common.</p></div>}
    {page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore} type="button">More shared films</button></div>}
  </section>;
}
