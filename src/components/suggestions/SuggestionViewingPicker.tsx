import { useCallback } from 'react';
import { usePagedResource } from '../../hooks/usePagedResource';
import { diaryService } from '../../services/diaryService';
import { FilmSuggestion } from '../../types/suggestion';
import { formatCalendarDate } from '../../utils/display';

export function SuggestionViewingPicker({ item, onChoose, onCancel, busy }: {
  item: FilmSuggestion; onChoose: (id: number) => void; onCancel: () => void; busy: boolean;
}) {
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const page = await diaryService.page({ movieId: item.movie_id, offset, limit: 30 }, signal);
    return { items: page.entries, next: page.nextOffset };
  }, [item.movie_id]);
  const page = usePagedResource(`${item.recipient_id}:viewings:${item.movie_id}`, load);
  return <section aria-label="Choose your viewing" className="stack">
    <header className="section__head"><h2>Your viewings of {item.title}</h2><button disabled={busy} onClick={onCancel}>Cancel</button></header>
    {page.error && <p className="notice notice--error" role="alert">{page.error} <button className="link" onClick={page.refresh}>Retry</button></p>}
    {page.items.length > 0 && <ul className="list list--flush">{page.items.map(entry => <li key={entry.id}><button className="row pick" disabled={busy} onClick={() => onChoose(entry.id)}>
      <span className="row__main"><span className="meta"><strong className="secondary">{formatCalendarDate(entry.watched_on, { dateStyle: 'medium' })}</strong><span>{entry.visibility === 'private' ? 'Private response' : 'Public response'}</span></span><span className="note clamp">{entry.note || 'No note.'}</span></span>
    </button></li>)}</ul>}
    {page.loading && <p className="status" role="status">Loading viewings</p>}
    {page.loaded && !page.items.length && <p className="status">No viewings of this film.</p>}
    {page.next != null && <div className="actions"><button className="btn btn--quiet btn--small" disabled={page.loading || busy} onClick={page.loadMore}>Earlier viewings</button></div>}
  </section>;
}
