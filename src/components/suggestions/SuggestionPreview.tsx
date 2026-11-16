import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { usePagedResource } from '../../hooks/usePagedResource';
import { suggestionService } from '../../services/suggestionService';
import { RecommendationNote } from './RecommendationNote';

/** The newest recommendations a person received. With `movieId`, the ones for that film, on its own page. */
export function SuggestionPreview({ movieId }: { movieId?: number }) {
  const { user } = useUser();
  const load = useCallback(async (_offset: number | undefined, signal: AbortSignal) => {
    const page = await suggestionService.list({ box: 'received', movieId, limit: 2 }, signal);
    return { items: page.suggestions, next: page.nextOffset };
  }, [movieId]);
  const page = usePagedResource(`${user?.id}:suggestion-preview:${movieId ?? 'home'}`, load);
  if (!page.items.length && !page.error) return null;
  return <section aria-label="Personal recommendations">
    <header className="section__head"><h2>Recommended to you</h2><Link to={movieId ? `/suggestions?movieId=${movieId}` : '/suggestions'}>See all</Link></header>
    {page.error && <p className="status" role="alert">Recommendations could not be loaded. <button className="link" onClick={page.refresh}>Retry</button></p>}
    {page.items.length > 0 && <div className={page.items.length > 1 ? 'two-up' : undefined}>{page.items.map(item =>
      <RecommendationNote compact hideFilm={movieId != null} item={item} key={item.id} viewerId={user!.id} />)}</div>}
  </section>;
}
