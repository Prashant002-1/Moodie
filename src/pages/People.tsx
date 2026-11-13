import React, { useCallback, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { usePagedResource } from '../hooks/usePagedResource';
import { apiError } from '../services/apiClient';
import { CommunityPerson, discoveryService } from '../services/discoveryService';
import { imageUrl } from '../utils/display';

type PeopleView = 'following' | 'discover';

const People: React.FC = () => {
  const { user } = useUser();
  const { revision, refresh } = useDiary();
  const [view, setView] = useState<PeopleView>('following');
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await discoveryService.peoplePage({ scope: view, q: term || undefined, limit: 30, offset }, signal);
    return { items: result.people, next: result.nextOffset };
  }, [view, term]);
  const page = usePagedResource(`${user?.id}:people:${revision}:${view}:${term}`, load);
  const toggleFollow = async (person: CommunityPerson) => {
    if (busy !== null) return;
    setBusy(person.id); setActionError('');
    try {
      if (person.following) await discoveryService.unfollow(person.id); else await discoveryService.follow(person.id);
      void refresh();
    } catch (error) { setActionError(apiError(error, 'This connection could not be updated. Try again.')); }
    finally { setBusy(null); }
  };

  return (
    <div className="page-shell people-page">
      <header className="people-header">
        <form onSubmit={event => { event.preventDefault(); setTerm(query.trim()); }}><label className="people-search"><Search aria-hidden="true" size={17} /><input aria-label="Search people" onChange={event => setQuery(event.target.value)} placeholder="Search people or films" type="search" value={query} maxLength={200} /></label><button className="text-link">Search people</button></form>
        <div aria-label="Choose people view" className="product-section-tabs" role="group">
          <button aria-pressed={view === 'following'} onClick={() => setView('following')} type="button">Following</button>
          <button aria-pressed={view === 'discover'} onClick={() => setView('discover')} type="button">Discover</button>
        </div>
      </header>

      {(page.error || actionError) && <p role="alert">{page.error || actionError} <button className="text-link" onClick={page.refresh}>Refresh people</button></p>}
      {page.items.length > 0 && (
        <section aria-label={view === 'following' ? 'People you follow' : 'People to discover'} className="people-list">
          {page.items.map(person => (
            <article className="people-row" key={person.id}>
              <Link aria-label={`Open ${person.latest_title || '@' + person.username}`} className="people-row__film" to={person.latest_movie_id ? `/movie/${person.latest_movie_id}` : `/member/${person.username}`}>
                {imageUrl(person.latest_poster_path, 'w342') ? <img alt={`Poster for ${person.latest_title}`} loading="lazy" src={imageUrl(person.latest_poster_path, 'w342')!} /> : <span />}
              </Link>
              <div className="people-row__body">
                <div className="people-row__person">
                  <Link aria-label={`Open @${person.username}'s profile`} className="people-row__avatar" to={`/member/${person.username}`}>{person.username.charAt(0).toUpperCase()}</Link>
                  <div><Link to={`/member/${person.username}`}><h2>@{person.username}</h2></Link><p>{person.bio || `${person.entries} public ${person.entries === 1 ? 'response' : 'responses'}.`}</p>{person.follows_you && <span className="people-row__follows-you">Follows you</span>}</div>
                </div>
                {person.shared_film_title && <p className="people-row__connection">You both responded to <strong>{person.shared_film_title}</strong>.</p>}
                <Link aria-label={`Open ${person.latest_title || '@' + person.username}`} className="people-row__latest" to={person.latest_movie_id ? `/movie/${person.latest_movie_id}` : `/member/${person.username}`}><strong>{person.latest_title || 'No public responses yet'}</strong>{person.latest_note && <q>{person.latest_note}</q>}</Link>
                <div className="people-row__bottom">
                  <span>{person.entries} responses · {person.followers} followers</span>
                  <button aria-label={`${person.following ? 'Unfollow' : 'Follow'} @${person.username}`} disabled={busy !== null} aria-pressed={person.following} className={`people-row__follow${person.following ? ' people-row__follow--active' : ''}`} onClick={() => void toggleFollow(person)} type="button">{person.following ? 'Following' : 'Follow'}</button>
                  <Link aria-label={`Open @${person.username}'s profile`} className="people-row__open" to={`/member/${person.username}`}><ArrowUpRight size={16} /></Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
      {page.loading && <p role="status">Loading people</p>}
      {page.loaded && !page.loading && !page.error && !page.items.length && <div className="product-empty"><p>{term ? 'No people match this search.' : view === 'following' ? 'You are not following anyone yet.' : 'No new people to discover yet.'}</p>{view === 'following' && <button className="text-link" onClick={() => { setView('discover'); setQuery(''); setTerm(''); }}>Find people</button>}</div>}
      {page.next !== null && <button className="button button--secondary" disabled={page.loading} onClick={page.loadMore}>More people</button>}

    </div>
  );
};

export default People;
