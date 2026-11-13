import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { usePagedResource } from '../hooks/usePagedResource';
import { suggestionService } from '../services/suggestionService';
import { SuggestionRow } from '../components/suggestions/SuggestionRow';
import { SavedFilms } from '../components/watchlist/SavedFilms';
import type { SuggestionQuery } from '../types/suggestion';

type InboxBox = NonNullable<SuggestionQuery['box']>;
// "saved" is a tab on this page only. It is never sent to the recommendations API.
type WatchlistBox = InboxBox | 'saved';
const tabs: [WatchlistBox, string][] = [['received', 'From people'], ['saved', 'Saved'], ['sent', 'Sent'], ['archived', 'Archived']];

export default function Suggestions() {
  const [params, setParams] = useSearchParams();
  const box = tabs.find(([value]) => value === params.get('box'))?.[0] ?? 'received';
  const changeBox = (value: WatchlistBox) => setParams(previous => { const next = new URLSearchParams(previous); next.set('box', value); return next; });
  return <div className="page page--narrow">
    <header className="page__head"><h1>Watchlist</h1></header>
    <div aria-label="Choose watchlist view" className="tabs" role="group">{tabs.map(([value, label]) => <button aria-pressed={box === value} key={value} onClick={() => changeBox(value)}>{label}</button>)}</div>
    <div style={{ marginTop: 'var(--m-space-5)' }}>{box === 'saved' ? <SavedFilms /> : <SuggestionInbox box={box} />}</div>
  </div>;
}

function SuggestionInbox({ box }: { box: InboxBox }) {
  const { user } = useUser();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const q = params.get('q') || undefined;
  const personId = Number(params.get('personId')) || undefined;
  const movieId = Number(params.get('movieId')) || undefined;
  const entryId = Number(params.get('entryId')) || undefined;
  const filtered = Boolean(q || personId || movieId || entryId);
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const page = await suggestionService.list({ box, q, personId, movieId, entryId, offset, limit: 30 }, signal);
    return { items: page.suggestions, next: page.nextOffset };
  }, [box, q, personId, movieId, entryId]);
  const page = usePagedResource(`${user?.id}:${params}`, load);
  return <section aria-label="Recommendations" className="stack">
    <form className="search" role="search" onSubmit={event => { event.preventDefault(); setParams(previous => { const next = new URLSearchParams(previous); if (query.trim()) next.set('q', query.trim()); else next.delete('q'); return next; }); }}>
      <input aria-label="Search recommendations" className="input" maxLength={200} onChange={event => setQuery(event.target.value)} placeholder="Person, film or words" type="search" value={query} />
      <button className="btn btn--secondary">Search</button>
    </form>
    {(personId || movieId || entryId) && <p className="t-caption muted">Showing this {personId ? 'connection' : movieId ? 'film' : 'viewing'}. <Link className="link" to="/suggestions">All recommendations</Link></p>}
    {page.error && <p className="notice notice--error" role="alert">{page.error} <button className="link" onClick={page.refresh}>Retry</button></p>}
    {page.items.length > 0 && <div className="list list--flush">{page.items.map(item => <SuggestionRow item={item} key={item.id} viewerId={user!.id} />)}</div>}
    {page.loading && <p className="status" role="status">Loading recommendations</p>}
    {page.loaded && !page.loading && !page.items.length && <div className="empty">
      <p>{filtered ? 'No recommendations match.' : box === 'sent' ? 'No sent recommendations.' : box === 'archived' ? 'No archived recommendations.' : 'No recommendations.'}</p>
      {!filtered && box === 'sent' && <Link className="link" to="/suggestions/new">Recommend a film</Link>}
      {!filtered && box === 'received' && <Link className="link" to="/people">Find people</Link>}
    </div>}
    {page.next != null && <div className="actions"><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore}>More recommendations</button></div>}
  </section>;
}
