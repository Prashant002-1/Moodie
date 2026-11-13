import { useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePagedResource } from '../../hooks/usePagedResource';
import { suggestionService } from '../../services/suggestionService';
import { FilmSuggestion } from '../../types/suggestion';

export function AttributionPicker({ ownerId, movieId, value, name, onChange }: {
  ownerId: number; movieId: number; value?: number; name?: string;
  onChange: (suggestion: FilmSuggestion | null) => void;
}) {
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await suggestionService.list({ movieId, box: 'received', limit: 30, offset }, signal);
    return { items: result.suggestions, next: result.nextOffset };
  }, [movieId]);
  const page = usePagedResource(`${ownerId}:attribution:${movieId}`, load);
  // Render the current attribution even if it is archived or its source is gone.
  const choices = page.items.filter(item => item.reply == null || item.id === value);
  const selected = choices.find(item => item.id === value);
  useEffect(() => {
    if (selected && name !== selected.sender_username) onChange(selected);
  }, [selected, name, onChange]);
  if (!value && page.loaded && !choices.length && !page.error) return null;
  return <section className="composer-attribution">
    <label htmlFor="viewing-attribution">Who put this on your radar?</label>
    <select id="viewing-attribution" value={value ?? ''} onChange={event => onChange(choices.find(item => item.id === Number(event.target.value)) ?? null)}>
      <option value="">No recommendation attached</option>
      {value && !selected && <option value={value}>Through {name || 'a recommendation'}</option>}
      {choices.map(item => <option key={item.id} value={item.id}>{item.origin === 'sent' ? 'From' : 'Through'} {item.sender_username}</option>)}
    </select>
    {value && <Link className="text-link" to={`/suggestions/${value}`}>Read the recommendation</Link>}
    {page.error && <p className="metadata" role="alert">Recommendations could not be loaded. You can save without one and link it later. <button className="text-link" type="button" onClick={page.refresh}>Retry</button></p>}
    {page.next != null && <button type="button" className="text-link" disabled={page.loading} onClick={page.loadMore}>More recommendations</button>}
  </section>;
}
