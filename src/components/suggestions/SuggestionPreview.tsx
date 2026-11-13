import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { usePagedResource } from '../../hooks/usePagedResource';
import { suggestionService } from '../../services/suggestionService';
import { SuggestionRow } from './SuggestionRow';

export function SuggestionPreview({ movieId }: { movieId?: number }) {
  const { user } = useUser();
  const load = useCallback(async (_offset: number | undefined, signal: AbortSignal) => {
    const page = await suggestionService.list({ box: 'received', movieId, limit: 2 }, signal);
    return { items: page.suggestions, next: page.nextOffset };
  }, [movieId]);
  const page = usePagedResource(`${user?.id}:suggestion-preview:${movieId ?? 'home'}`, load);
  if (!page.items.length && !page.error) return null;
  return <section className="suggestion-preview-list" aria-label="Personal recommendations"><header className="suggestion-section-heading"><h2>{movieId ? 'Recommended to you' : 'From people you know'}</h2><Link className="text-link" to={movieId ? `/suggestions?movieId=${movieId}` : '/suggestions'}>See all</Link></header>
    {page.error && <p role="alert">Recommendations could not be loaded. <button className="text-link" onClick={page.refresh}>Retry</button></p>}
    {page.items.map(item => <SuggestionRow key={item.id} item={item} viewerId={user!.id} />)}
  </section>;
}
