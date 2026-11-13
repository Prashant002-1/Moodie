import React, { useCallback, useState } from 'react';
import { PersonRow } from '../components/discovery/PersonRow';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { usePagedResource } from '../hooks/usePagedResource';
import { apiError } from '../services/apiClient';
import { CommunityPerson, discoveryService } from '../services/discoveryService';

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
    <div className="page page--narrow">
      <h1 className="sr-only">People</h1>
      <div aria-label="Choose people view" className="tabs" role="group">
        <button aria-pressed={view === 'following'} onClick={() => setView('following')} type="button">Following</button>
        <button aria-pressed={view === 'discover'} onClick={() => setView('discover')} type="button">Discover</button>
      </div>
      <form className="search" onSubmit={event => { event.preventDefault(); setTerm(query.trim()); }} role="search" style={{ marginTop: 'var(--m-space-5)' }}>
        <input aria-label="Search people" className="input" maxLength={200} onChange={event => setQuery(event.target.value)} placeholder="Username or film" type="search" value={query} />
        <button className="btn btn--secondary">Search</button>
      </form>

      {(page.error || actionError) && <p className="notice notice--error" role="alert" style={{ marginTop: 'var(--m-space-4)' }}>{page.error || actionError} <button className="link" onClick={page.refresh}>Refresh people</button></p>}
      {page.items.length > 0 && <ul aria-label={view === 'following' ? 'People you follow' : 'People to discover'} className="list">
        {page.items.map(person => <PersonRow disabled={busy !== null} key={person.id} onFollow={person => void toggleFollow(person)} person={person} />)}
      </ul>}
      {page.loading && <p className="status" role="status">Loading people</p>}
      {page.loaded && !page.loading && !page.error && !page.items.length && <p className="status">{term ? 'No people match this search.' : view === 'following' ? 'You are not following anyone.' : 'No one new to discover.'}</p>}
      {page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore}>More people</button></div>}
    </div>
  );
};

export default People;
