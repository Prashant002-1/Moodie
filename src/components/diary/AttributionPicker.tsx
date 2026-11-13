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
  return <div className="field">
    <label htmlFor="viewing-attribution">Recommended by</label>
    <select className="select" id="viewing-attribution" value={value ?? ''} onChange={event => onChange(choices.find(item => item.id === Number(event.target.value)) ?? null)}>
      <option value="">Nobody</option>
      {value && !selected && <option value={value}>{name || 'A recommendation'}</option>}
      {choices.map(item => <option key={item.id} value={item.id}>{item.sender_username}</option>)}
    </select>
    {value && <Link className="link t-caption" to={`/suggestions/${value}`}>Read the recommendation</Link>}
    {page.error && <p className="hint" role="alert">Recommendations could not be loaded. <button className="link" type="button" onClick={page.refresh}>Retry</button></p>}
    {page.next != null && <button type="button" className="link t-caption" disabled={page.loading} onClick={page.loadMore}>More recommendations</button>}
  </div>;
}
