import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ResponseCard } from '../components/response/ResponseCard';
import { SuggestionPreview } from '../components/suggestions/SuggestionPreview';
import { DiscoveryPathCard } from '../components/recommendations/DiscoveryPathCard';
import { useDiary } from '../contexts/DiaryContext';
import { useUser } from '../contexts/UserContext';
import { ResponseEntry, discoveryService } from '../services/discoveryService';
import { usePagedResource } from '../hooks/usePagedResource';
import { useResource } from '../hooks/useResource';
import { apiError } from '../services/apiClient';
import { recommendationService } from '../services/recommendationService';

type FeedView = 'for-you' | 'following' | 'everyone';

const Feed = () => {
  const { user } = useUser();
  const { summary, revision: diaryRevision, currentSignal, refresh: refreshDiary } = useDiary();
  const [params, setParams] = useSearchParams();
  const view: FeedView = params.get('view') === 'following' ? 'following' : params.get('view') === 'everyone' ? 'everyone' : 'for-you';
  const setView = (next: FeedView) => setParams(next === 'for-you' ? {} : { view: next });
  const [focusRevision, setFocusRevision] = useState(0);
  const [actionError, setActionError] = useState('');
  const actionLocks = useRef(new Set<string>());
  const key = `${user?.id}:home:${diaryRevision}:${focusRevision}`;
  const forYou = view === 'for-you';
  const scope = view === 'following' ? 'following' : 'everyone';
  const limit = forYou ? 12 : 30;
  const loadFeed = useCallback(async (cursor: string | undefined, signal: AbortSignal) => {
    const result = await discoveryService.feedPage({ scope, limit, cursor }, signal);
    return { items: result.entries, next: result.nextCursor };
  }, [scope, limit]);
  const page = usePagedResource(`${key}:${scope}:${limit}`, loadFeed);
  const loadCircle = useCallback(async (_cursor: string | undefined, signal: AbortSignal) => {
    const result = forYou ? await discoveryService.feedPage({ scope: 'following', limit: 4 }, signal) : { entries: [] };
    return { items: result.entries, next: null };
  }, [forYou]);
  const circle = usePagedResource(`${key}:circle:${forYou}`, loadCircle);
  const loadRecommendations = useCallback((signal: AbortSignal) => forYou ? recommendationService.get(currentSignal || undefined, signal) : Promise.resolve(null), [forYou, currentSignal]);
  const recommendations = useResource(`${key}:recommendations:${forYou}:${JSON.stringify(currentSignal)}`, loadRecommendations);
  const films = recommendations.data?.forYou.filter(movie => movie.recommended_by?.length) ?? [];
  const recent = circle.items.length ? circle.items : page.items;

  useEffect(() => {
    const refresh = () => setFocusRevision(value => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const toggleLike = async (entry: ResponseEntry) => {
    const lock = `like:${entry.id}`;
    if (actionLocks.current.has(lock)) return;
    actionLocks.current.add(lock); setActionError('');
    try {
      if (entry.liked) await discoveryService.unlike(entry.id); else await discoveryService.like(entry.id);
      const update = <T extends ResponseEntry,>(items: T[]) => items.map(item => item.id === entry.id ? { ...item, liked: !entry.liked, like_count: Math.max(0, item.like_count + (entry.liked ? -1 : 1)) } : item);
      page.updateItems(update); circle.updateItems(update);
    } catch (error) { setActionError(apiError(error)); }
    finally { actionLocks.current.delete(lock); }
  };
  const follow = async (id: number, following: boolean) => {
    const lock = `follow:${id}`;
    if (actionLocks.current.has(lock)) return;
    actionLocks.current.add(lock); setActionError('');
    try {
      if (following) await discoveryService.unfollow(id); else await discoveryService.follow(id);
      void refreshDiary();
    } catch (error) { setActionError(apiError(error)); }
    finally { actionLocks.current.delete(lock); }
  };
  const toggleFollow = (entry: ResponseEntry) => { if (entry.following !== undefined) void follow(entry.user_id, entry.following); };
  const card = (entry: ResponseEntry) => <ResponseCard key={entry.id} entry={entry} onFollow={toggleFollow} onLike={entry => void toggleLike(entry)} ownUserId={user?.id} />;
  return <div className="page page--narrow">
    <h1 className="sr-only">Home</h1>
    <div aria-label="Choose home view" className="tabs" role="group"><button aria-pressed={forYou} onClick={() => setView('for-you')}>For you</button><button aria-pressed={view === 'following'} onClick={() => setView('following')}>Following</button><button aria-pressed={view === 'everyone'} onClick={() => setView('everyone')}>Everyone</button></div>
    {actionError && <p className="notice notice--error" role="alert">{actionError}</p>}
    {forYou ? <div className="stack stack--loose" style={{ marginTop: 'var(--m-space-5)' }}>
      <SuggestionPreview />
      {recommendations.loading && !recommendations.data && <p className="status" role="status">Loading</p>}
      {recommendations.error && <p className="status" role="alert">Recommendations could not be loaded. <button className="link" onClick={recommendations.refresh}>Try again</button></p>}
      {summary?.entries === 0 && <div className="empty"><p>Your diary is empty.</p><Link className="btn btn--primary" to="/log">Add a response</Link></div>}
      {films.length > 0 && <section aria-labelledby="recommendations-title"><header className="section__head"><h2 id="recommendations-title">Through films you share</h2><Link to="/recommendations">See all</Link></header><div className="list">{films.slice(0, 3).map(movie => <DiscoveryPathCard key={movie.id} movie={movie} />)}</div></section>}
      <section aria-label="Recent responses"><header className="section__head"><h2>{circle.items.length ? 'From people you follow' : 'Recent responses'}</h2><Link to="/people">Find people</Link></header>
        {circle.error && <p className="status" role="alert">Responses could not be loaded. <button className="link" onClick={circle.refresh}>Retry</button></p>}
        {page.error && <p className="status" role="alert">{page.error} <button className="link" onClick={page.refresh}>Retry</button></p>}
        {recent.slice(0, 6).map(card)}
        {!recent.length && !page.loading && !circle.loading && !page.error && !circle.error && <p className="status">No public responses yet.</p>}
      </section>
    </div> : <>
      {page.error && <p className="status" role="alert">{page.error} <button className="link" onClick={page.refresh}>Retry responses</button></p>}
      <section aria-label={view === 'following' ? 'Responses from people you follow' : 'Public responses'}>{page.items.map(card)}</section>
      {page.loading && <p className="status" role="status">Loading responses</p>}
      {page.loaded && !page.loading && !page.error && !page.items.length && <div className="empty"><p>No responses here yet.</p><div className="actions"><Link className="link" to="/people">Find people</Link><Link className="link" to="/log">Add a response</Link></div></div>}
      {page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore}>Older responses</button></div>}
    </>}
  </div>;
};
export default Feed;
