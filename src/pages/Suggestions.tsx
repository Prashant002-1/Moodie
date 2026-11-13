import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { usePagedResource } from '../hooks/usePagedResource';
import { suggestionService } from '../services/suggestionService';
import { SuggestionRow } from '../components/suggestions/SuggestionRow';
import type { SuggestionQuery } from '../types/suggestion';
import '../components/suggestions/Suggestions.css';

export default function Suggestions() {
  const { user } = useUser();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const box: SuggestionQuery['box'] = params.get('box') === 'sent' ? 'sent' : params.get('box') === 'archived' ? 'archived' : 'received';
  const q = params.get('q') || undefined;
  const personId = Number(params.get('personId')) || undefined;
  const movieId = Number(params.get('movieId')) || undefined;
  const entryId = Number(params.get('entryId')) || undefined;
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const page = await suggestionService.list({ box, q, personId, movieId, entryId, offset, limit: 30 }, signal);
    return { items: page.suggestions, next: page.nextOffset };
  }, [box, q, personId, movieId, entryId]);
  const page = usePagedResource(`${user?.id}:${params}`, load);
  const changeBox = (value: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set('box', value); return next; });
  return <div className="page-shell suggestions-page">
    <header className="suggestions-heading"><div><Link className="text-link" to="/feed">Home</Link><h1>Recommendations</h1></div><button className="button button--quiet" onClick={page.refresh} disabled={page.loading}>Refresh</button></header>
    <div className="product-section-tabs" role="group" aria-label="Recommendation inbox">{(['received', 'sent', 'archived'] as const).map(value => <button key={value} aria-pressed={box === value} onClick={() => changeBox(value)}>{value === 'received' ? 'For you' : value === 'sent' ? 'Sent' : 'Archived'}</button>)}</div>
    <form className="search-bar" role="search" onSubmit={event => { event.preventDefault(); setParams(previous => { const next = new URLSearchParams(previous); if (query.trim()) next.set('q', query.trim()); else next.delete('q'); return next; }); }}>
      <input aria-label="Search recommendations" placeholder="A person, film, or their words" type="search" value={query} maxLength={200} onChange={event => setQuery(event.target.value)} /><button className="button button--secondary">Search</button>
    </form>
    {(personId || movieId || entryId) && <p className="metadata">Showing this {personId ? 'connection' : movieId ? 'film' : 'viewing'}. <Link to="/suggestions">All recommendations</Link></p>}
    {page.error && <p role="alert" className="notice notice--error">{page.error} <button className="text-link" onClick={page.refresh}>Retry</button></p>}
    <div className="suggestion-list">{page.items.map(item => <SuggestionRow key={item.id} item={item} viewerId={user!.id} />)}</div>
    {page.loading && <p role="status">Loading recommendations</p>}
    {page.loaded && !page.loading && !page.items.length && <div className="product-empty"><p>{q || personId || movieId || entryId ? 'No recommendations match this view.' : box === 'sent' ? 'Recommend a film to someone who follows you.' : box === 'archived' ? 'No archived recommendations.' : 'Films people send you, and films you keep through their responses, will be here.'}</p><Link className="text-link" to="/people">Find people</Link></div>}
    {page.next != null && <button className="button button--secondary" onClick={page.loadMore} disabled={page.loading}>More recommendations</button>}
  </div>;
}
