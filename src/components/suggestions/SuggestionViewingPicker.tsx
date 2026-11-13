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
  return <section className="suggestion-viewings" aria-label="Choose your viewing"><h2>Your viewings of {item.title}</h2>
    {page.error && <p role="alert">{page.error} <button className="text-link" onClick={page.refresh}>Retry</button></p>}
    {page.items.map(entry => <button className="suggestion-viewing" key={entry.id} disabled={busy} onClick={() => onChoose(entry.id)}><strong>{formatCalendarDate(entry.watched_on, { dateStyle: 'medium' })}</strong><span>{entry.note || 'No note on this viewing.'}</span><small>{entry.visibility === 'private' ? 'Private response' : 'Public response'}</small></button>)}
    {page.loading && <p role="status">Loading viewings</p>}
    {page.loaded && !page.items.length && <p>No viewings recorded yet.</p>}
    {page.next != null && <button className="button button--quiet" disabled={page.loading || busy} onClick={page.loadMore}>Earlier viewings</button>}
    <button className="button button--quiet" disabled={busy} onClick={onCancel}>Cancel</button>
  </section>;
}
