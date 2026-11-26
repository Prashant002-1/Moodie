import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { usePagedResource } from '../hooks/usePagedResource';
import { useResource } from '../hooks/useResource';
import { suggestionService } from '../services/suggestionService';
import { RecommendationNote } from '../components/suggestions/RecommendationNote';
import { SavedFilms } from '../components/watchlist/SavedFilms';
import type { FilmSuggestion, SuggestionQuery, SuggestionSummary } from '../types/suggestion';
import { usePageTitle } from '../hooks/usePageTitle';

type InboxBox = NonNullable<SuggestionQuery['box']>;
// "saved" is a tab on this page only. It is never sent to the recommendations API.
type HubBox = InboxBox | 'saved';
const tabs: [HubBox, string, (summary: SuggestionSummary) => number | null][] = [
  ['received', 'For you', summary => summary.received_total],
  ['reminders', 'Reminders', summary => summary.reminders],
  ['sent', 'From you', summary => summary.sent_total],
  ['saved', 'Saved', () => null],
  ['archived', 'Archived', () => null],
];
// The tabs carry the totals. These are the states inside them: yours to act on, then what came of what you sent.
const stats: [string, HubBox, (summary: SuggestionSummary) => number][] = [
  ['To watch', 'received', summary => summary.received_new + summary.received_saved],
  ['To reply', 'received', summary => summary.received_to_reply],
  ['Reminders due', 'reminders', summary => summary.reminders_due],
  ['Sent', 'sent', summary => summary.sent_total],
  ['Watched by them', 'sent', summary => summary.sent_watched],
  ['Replies', 'sent', summary => summary.sent_replied],
];

/** The recommendations hub: what people thought of you for, what you asked to be reminded of, and what came of what you sent. */
export default function Suggestions() {
  const { user } = useUser();
  usePageTitle('Recommendations');
  const [params, setParams] = useSearchParams();
  const box = tabs.find(([value]) => value === params.get('box'))?.[0] ?? 'received';
  const changeBox = (value: HubBox) => setParams(previous => { const next = new URLSearchParams(previous); next.set('box', value); return next; });
  const loadSummary = useCallback((signal: AbortSignal) => suggestionService.summary(signal), []);
  const summary = useResource(`${user?.id}:recommendation-summary`, loadSummary);
  return <>
    <section className="band band--tight"><div className="box stack" style={{ gap: 'var(--m-space-5)' }}>
      <div className="hub__head"><h1>Recommendations</h1><Link className="btn btn--primary" to="/suggestions/new">Recommend a film</Link></div>
      {summary.data && summary.data.received_total + summary.data.sent_total + summary.data.reminders > 0 && <div aria-label="Recommendations in numbers" className="stats stats--hub" role="group">{stats.map(([label, target, count]) =>
        <Link className="stat" key={label} to={`/suggestions?box=${target}`}><span className="stat__n">{count(summary.data!)}</span><span className="stat__l">{label}</span></Link>)}</div>}
      {summary.error && <p className="status" role="alert" style={{ padding: 0 }}>Counts could not be loaded. <button className="link" onClick={summary.refresh}>Retry counts</button></p>}
    </div></section>
    <div className="page">
      <div aria-label="Choose recommendations view" className="tabs" role="group">{tabs.map(([value, label, count]) => {
        const total = summary.data ? count(summary.data) : null;
        return <button aria-pressed={box === value} key={value} onClick={() => changeBox(value)}>{label}{total != null && total > 0 && <span className="tabs__count">{total}</span>}</button>;
      })}</div>
      <div style={{ marginTop: 'var(--m-space-5)' }}>{box === 'saved' ? <div className="page--narrow"><SavedFilms /></div> : <SuggestionInbox box={box} onChanged={summary.refresh} />}</div>
    </div>
  </>;
}

const empty: Record<InboxBox, string> = {
  received: 'No recommendations yet.', reminders: 'No reminders.', sent: 'Nothing sent yet.', archived: 'No archived recommendations.',
};

function SuggestionInbox({ box, onChanged }: { box: InboxBox; onChanged: () => void }) {
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
  const { updateItems } = page;
  // A reminder changed on a note: keep the list true to its tab, and the counts true to the list.
  const change = (next: FilmSuggestion) => {
    updateItems(items => items.map(item => item.id === next.id ? next : item).filter(item => box !== 'reminders' || item.remind_at != null));
    onChanged();
  };
  return <section aria-label="Recommendations" className="stack">
    <form className="search" role="search" onSubmit={event => { event.preventDefault(); setParams(previous => { const next = new URLSearchParams(previous); if (query.trim()) next.set('q', query.trim()); else next.delete('q'); return next; }); }}>
      <input aria-label="Search recommendations" className="input" maxLength={200} onChange={event => setQuery(event.target.value)} placeholder="Person, film or words" type="search" value={query} />
      <button className="btn btn--secondary">Search</button>
    </form>
    {(personId || movieId || entryId) && <p className="t-caption muted">Showing this {personId ? 'connection' : movieId ? 'film' : 'viewing'}. <Link className="link" to="/suggestions">All recommendations</Link></p>}
    {page.error && <p className="notice notice--error" role="alert">{page.error} <button className="link" onClick={page.refresh}>Retry</button></p>}
    {page.items.length > 0 && <div className={box === 'archived' ? 'two-up' : 'notes'}>{page.items.map(item =>
      <RecommendationNote compact={box === 'archived'} headingLevel={2} item={item} key={item.id} onChange={change} primary={false} tracker={box === 'sent'} viewerId={user!.id} />)}</div>}
    {page.loading && <p className="status" role="status">Loading recommendations</p>}
    {page.loaded && !page.loading && !page.items.length && <div className="empty">
      <p>{filtered ? 'No recommendations match.' : empty[box]}</p>
      {!filtered && box === 'received' && <Link className="link" to="/people">Find people</Link>}
    </div>}
    {page.next != null && <div className="actions"><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore}>More recommendations</button></div>}
  </section>;
}
