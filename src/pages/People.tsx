import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PersonRow } from '../components/discovery/PersonRow';
import { Introductions } from '../components/paths/Introductions';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { usePagedResource } from '../hooks/usePagedResource';
import { apiError } from '../services/apiClient';
import { CommunityPerson, discoveryService } from '../services/discoveryService';
import { usePageTitle } from '../hooks/usePageTitle';

type PeopleView = 'following' | 'discover';

const People: React.FC = () => {
  const { user } = useUser();
  usePageTitle('People');
  const { refresh } = useDiary();
  // The tab and the search live in the address, so Back from a profile returns to the same list.
  const [params, setParams] = useSearchParams();
  const view: PeopleView = params.get('view') === 'discover' ? 'discover' : 'following';
  const term = params.get('q') ?? '';
  const [query, setQuery] = useState(term);
  useEffect(() => setQuery(term), [term]);
  const show = (next: { view?: PeopleView; q?: string }) => setParams(previous => {
    const updated = new URLSearchParams(previous);
    if ((next.view ?? view) === 'discover') updated.set('view', 'discover'); else updated.delete('view');
    const q = next.q ?? term;
    if (q) updated.set('q', q); else updated.delete('q');
    return updated;
  });
  const setView = (next: PeopleView) => show({ view: next });
  // People introduced at the top are not listed a second time under Everyone.
  const [introduced, setIntroduced] = useState<number[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await discoveryService.peoplePage({ scope: view, q: term || undefined, limit: 30, offset }, signal);
    return { items: result.people, next: result.nextOffset };
  }, [view, term]);
  const page = usePagedResource(`${user?.id}:people:${view}:${term}`, load);
  const { updateItems } = page;
  const toggleFollow = async (person: CommunityPerson) => {
    if (busy !== null) return;
    setBusy(person.id); setActionError('');
    try {
      if (person.following) await discoveryService.unfollow(person.id); else await discoveryService.follow(person.id);
      // The card stays where it is with its new state, so the change can be seen and undone.
      updateItems(items => items.map(item => item.id === person.id ? { ...item, following: !person.following } : item));
      void refresh();
    } catch (error) { setActionError(apiError(error, 'This connection could not be updated. Try again.')); }
    finally { setBusy(null); }
  };

  return (
    <div className="page">
      <header className="page__head people__head">
        <h1>People</h1>
        <form className="search" onSubmit={event => { event.preventDefault(); show({ q: query.trim() }); }} role="search">
          <input aria-label="Search people" className="input" maxLength={200} onChange={event => setQuery(event.target.value)} placeholder="Username or film" type="search" value={query} />
          <button className="btn btn--secondary">Search</button>
        </form>
      </header>
      <div aria-label="Choose people view" className="tabs" role="group" style={{ marginBottom: 'var(--m-space-5)' }}>
        <button aria-pressed={view === 'following'} onClick={() => setView('following')} type="button">Following</button>
        <button aria-pressed={view === 'discover'} onClick={() => setView('discover')} type="button">Discover</button>
      </div>

      {(page.error || actionError) && <p className="notice notice--error" role="alert" style={{ marginBottom: 'var(--m-space-4)' }}>{page.error || actionError} <button className="link" onClick={page.refresh}>Refresh people</button></p>}
      {/* People with a reason come first. A search looks through everyone. */}
      {view === 'discover' && !term && <div style={{ marginBottom: 'var(--m-space-7)' }} className="page--narrow people__intros"><Introductions heading="People to meet" limit={6} onShown={setIntroduced} /></div>}
      {view === 'discover' && !term && introduced.length > 0 && page.items.some(person => !introduced.includes(person.id)) && <header className="section__head"><h2>Everyone</h2></header>}
      {page.items.length > 0 && <ul aria-label={view === 'following' ? 'People you follow' : 'People to discover'} className="people">
        {page.items.filter(person => view !== 'discover' || term || !introduced.includes(person.id)).map(person => <PersonRow disabled={busy !== null} key={person.id} onFollow={person => void toggleFollow(person)} person={person} />)}
      </ul>}
      {page.loading && <p className="status" role="status">Loading people</p>}
      {page.loaded && !page.loading && !page.error && !page.items.length && (term || view === 'discover'
        ? <p className="status">{term ? <>No people match this search. <button className="link" onClick={() => show({ q: '' })} type="button">Clear search</button></> : 'No one new to discover.'}</p>
        : <div className="empty"><p>You are not following anyone.</p><button className="btn btn--primary" onClick={() => setView('discover')} type="button">Discover people</button></div>)}
      {page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore}>More people</button></div>}
    </div>
  );
};

export default People;
