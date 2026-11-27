import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ResponseCard } from '../components/response/ResponseCard';
import { RecommendationNote } from '../components/suggestions/RecommendationNote';
import { DueReminders } from '../components/suggestions/DueReminders';
import { Avatar } from '../components/common/Avatar';
import { suggestionService } from '../services/suggestionService';
import { feelingWords } from '../utils/feelings';
import { imageUrl } from '../utils/display';
import { personHue } from '../utils/person';
import { PathCard } from '../components/paths/PathCard';
import { Introductions } from '../components/paths/Introductions';
import { StarterFilms } from '../components/paths/StarterFilms';
import { useDiary } from '../contexts/DiaryContext';
import { useUser } from '../contexts/UserContext';
import { ResponseEntry, discoveryService } from '../services/discoveryService';
import { usePagedResource } from '../hooks/usePagedResource';
import { useResource } from '../hooks/useResource';
import { apiError } from '../services/apiClient';
import { pathService } from '../services/pathService';
import { usePageTitle } from '../hooks/usePageTitle';
import { Mark } from '../components/common/Mark';

type FeedView = 'for-you' | 'following' | 'everyone';

const Feed = () => {
  const { user } = useUser();
  usePageTitle('Home');
  const { summary, revision: diaryRevision, refresh: refreshDiary } = useDiary();
  const [params, setParams] = useSearchParams();
  const view: FeedView = params.get('view') === 'following' ? 'following' : params.get('view') === 'everyone' ? 'everyone' : 'for-you';
  const setView = (next: FeedView) => setParams(next === 'for-you' ? {} : { view: next });
  const [focusRevision, setFocusRevision] = useState(0);
  const [actionError, setActionError] = useState('');
  const actionLocks = useRef(new Set<string>());
  // The account is the identity. A diary change or a return to the window reads the same lists again, in place.
  const key = `${user?.id}:home`;
  const version = `${diaryRevision}:${focusRevision}`;
  const forYou = view === 'for-you';
  const scope = view === 'following' ? 'following' : 'everyone';
  const limit = forYou ? 12 : 30;
  const loadFeed = useCallback(async (cursor: string | undefined, signal: AbortSignal) => {
    // A stream is for words: a verdict nobody wrote anything under stays on the film and the person.
    const result = await discoveryService.feedPage({ scope, limit, cursor, kind: 'written' }, signal);
    return { items: result.entries, next: result.nextCursor };
  }, [scope, limit]);
  const page = usePagedResource(`${key}:${scope}:${limit}`, loadFeed, version);
  const loadCircle = useCallback(async (_cursor: string | undefined, signal: AbortSignal) => {
    const result = forYou ? await discoveryService.feedPage({ scope: 'following', limit: 18 }, signal) : { entries: [] };
    return { items: result.entries, next: null };
  }, [forYou]);
  const circle = usePagedResource(`${key}:circle:${forYou}`, loadCircle, version);
  const loadNotes = useCallback(async (_cursor: number | undefined, signal: AbortSignal) => {
    const result = forYou ? await suggestionService.list({ box: 'received', limit: 3 }, signal) : { suggestions: [] };
    return { items: result.suggestions, next: null };
  }, [forYou]);
  const notes = usePagedResource(`${key}:notes:${forYou}`, loadNotes, version);
  // A recommendation whose reminder is due is shown once, under Reminders.
  const fresh = notes.items.filter(item => !item.remind_at || new Date(item.remind_at).getTime() > Date.now());
  const loadPaths = useCallback((signal: AbortSignal) => forYou ? pathService.films({ limit: 3 }, signal) : Promise.resolve(null), [forYou]);
  const recommendations = useResource(`${key}:paths:${forYou}`, loadPaths, version);
  // The three first shown stay until the page is left: setting one aside or saving it does not shuffle the others.
  const [films, setFilms] = useState<NonNullable<typeof recommendations.data>['films']>([]);
  useEffect(() => { if (recommendations.data) setFilms(previous => previous.length ? previous : recommendations.data!.films); }, [recommendations.data]);
  // Someone with almost nothing in their diary is asked about films they have probably seen.
  const starting = Boolean(recommendations.data && recommendations.data.diary < 4);
  const [asked, setAsked] = useState(false);
  useEffect(() => { if (starting) setAsked(true); }, [starting]);
  // Nothing is shown twice. Friends lead as a wall of posters, with the wider
  // community's words under them. When everything recent is from friends, their
  // words are shown once, in full, and the wall is left out.
  // One poster per friend: their latest.
  const friends = circle.items.filter((entry, index, all) => all.findIndex(other => other.user_id === entry.user_id) === index).slice(0, 6);
  // Both lists are needed before deciding what goes where, so nothing moves once it is shown.
  const settled = !forYou || circle.loaded || Boolean(circle.error);
  const others = settled ? page.items.filter(entry => !friends.some(friend => friend.id === entry.id)) : [];
  const wall = others.length ? friends : [];
  const recent = !settled ? [] : others.length ? others : circle.items.length ? circle.items : page.items;

  // Coming back to the window brings in what is new, but never under someone
  // who is partway down the page, and not more than once a minute.
  const lastRefresh = useRef(Date.now());
  useEffect(() => {
    const refresh = () => {
      if (window.scrollY > 400 || Date.now() - lastRefresh.current < 60_000) return;
      lastRefresh.current = Date.now();
      setFocusRevision(value => value + 1);
    };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  const toggleLike = async (entry: ResponseEntry) => {
    const lock = `like:${entry.id}`;
    if (actionLocks.current.has(lock)) return;
    actionLocks.current.add(lock); setActionError('');
    // The heart answers the tap at once, and is taken back if the like could not be saved.
    const set = (liked: boolean) => {
      const update = <T extends ResponseEntry,>(items: T[]) => items.map(item => item.id === entry.id ? { ...item, liked, like_count: Math.max(0, item.like_count + (liked ? 1 : -1)) } : item);
      page.updateItems(update); circle.updateItems(update);
    };
    set(!entry.liked);
    try {
      if (entry.liked) await discoveryService.unlike(entry.id); else await discoveryService.like(entry.id);
    } catch (error) { set(Boolean(entry.liked)); setActionError(apiError(error)); }
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
  // When nothing could be read, say it once.
  const homeFailed = forYou && Boolean(page.error && circle.error && notes.error && recommendations.error);
  const retryHome = () => { page.refresh(); circle.refresh(); notes.refresh(); recommendations.refresh(); };
  const hour = new Date().getHours();
  const senders = [...new Set(notes.items.filter(item => item.origin === 'sent').map(item => item.sender_username))];
  // Home is one column: the same width and the same left edge from the greeting to the last response.
  return <div className="page page--narrow">
    <h1 className="sr-only">Home</h1>
    <div aria-label="Choose home view" className="tabs" role="group" style={{ marginBottom: 'var(--m-space-6)' }}><button aria-pressed={forYou} onClick={() => setView('for-you')}>For you</button><button aria-pressed={view === 'following'} onClick={() => setView('following')}>Following</button><button aria-pressed={view === 'everyone'} onClick={() => setView('everyone')}>Everyone</button></div>
    {actionError && <p className="notice notice--error" role="alert">{actionError}</p>}
    {homeFailed ? <p className="notice notice--error" role="alert">Home could not be loaded. <button className="link" onClick={retryHome}>Retry</button></p>
    : forYou ? <div className="stack stack--loose">
      {user && <p className="greeting">Good {hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, <strong>{user.username}</strong>.
        {senders.length > 0 && <span className="greeting__more"> {senders.slice(0, 2).map((name, index) => <span key={name}>{index > 0 && ' and '}<Link className="who" to={`/member/${encodeURIComponent(name)}`}>{name}</Link></span>)}{senders.length > 2 && ' and others'} thought of you.</span>}
      </p>}
      <DueReminders />
      {notes.error && <p className="status" role="alert">Recommendations could not be loaded. <button className="link" onClick={notes.refresh}>Retry</button></p>}
      {user && fresh.length > 0 && <section aria-label="Personal recommendations">
        <header className="section__head"><h2>Recommended to you</h2><Link to="/suggestions">See all<span className="sr-only"> recommendations</span></Link></header>
        <div className="notes">{fresh.slice(0, 3).map(item => <RecommendationNote act compact item={item} key={item.id} primary={false} viewerId={user.id} />)}</div>
      </section>}
      {asked ? <section aria-label="Films you may have seen"><header className="section__head"><h2>Seen any of these?</h2><Link to="/log">Log another film</Link></header><StarterFilms limit={12} /></section>
        : summary?.entries === 0 && <div className="empty" style={{ padding: 0 }}><Mark name="ticket" /><p>Your diary is empty.</p><Link className="btn btn--primary" to="/log">Log a film</Link></div>}
      {wall.length > 0 && <section aria-label="New from people you follow"><header className="section__head"><h2>New from friends</h2><button onClick={() => setView('following')}>See all</button></header>
        <div className="wall wall--fit">{wall.map(entry => <article className="tile" data-hue={personHue(entry.username)} key={entry.id}>
          <Link aria-label={`${entry.username} on ${entry.title}`} className="tile__art" to={`/response/${entry.id}`}>
            <span className="poster">{imageUrl(entry.poster_path, 'w342') && <img alt="" loading="lazy" src={imageUrl(entry.poster_path, 'w342')!} />}</span>
            <Avatar className="tile__who" size="sm" to={null} username={entry.username} />
          </Link>
          <Link className="tile__name who" to={`/member/${entry.username}`}>{entry.username}</Link>
          <p className="tile__sub">{feelingWords(entry).slice(0, 2).join(' · ') || entry.title}</p>
        </article>)}</div>
      </section>}
      {recommendations.loading && !recommendations.data && <p className="status" role="status">Loading</p>}
      {recommendations.error && <p className="status" role="alert">Recommendations could not be loaded. <button className="link" onClick={recommendations.refresh}>Try again</button></p>}
      {films.length > 0 && <section aria-labelledby="recommendations-title"><header className="section__head"><h2 id="recommendations-title">Through people</h2><Link to="/recommendations">See all<span className="sr-only"> films through people</span></Link></header><div className="paths">{films.map(item => <PathCard item={item} key={item.film.id} />)}</div></section>}
      <Introductions limit={3} more />
      <section aria-label="Recent responses"><header className="section__head"><h2>{!others.length && circle.items.length ? 'From people you follow' : 'Recent responses'}</h2><Link to="/people">Find people</Link></header>
        {circle.error && <p className="status" role="alert">Responses could not be loaded. <button className="link" onClick={circle.refresh}>Retry</button></p>}
        {page.error && <p className="status" role="alert">{page.error} <button className="link" onClick={page.refresh}>Retry</button></p>}
        <div className="responses">{recent.slice(0, 6).map(card)}</div>
        {!recent.length && !page.loading && !circle.loading && !page.error && !circle.error && <p className="status">No public responses yet.</p>}
      </section>
    </div> : <>
      {page.error && <p className="status" role="alert">{page.error} <button className="link" onClick={page.refresh}>Retry responses</button></p>}
      <section aria-label={view === 'following' ? 'Responses from people you follow' : 'Public responses'} className="responses">{page.items.map(card)}</section>
      {page.loading && <p className="status" role="status">Loading responses</p>}
      {page.loaded && !page.loading && !page.error && !page.items.length && <div className="empty"><Mark name="seats" /><p>No responses here yet.</p><div className="actions"><Link className="link" to="/people">Find people</Link><Link className="link" to="/log">Log a film</Link></div></div>}
      {page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore}>Older responses</button></div>}
    </>}
  </div>;
};
export default Feed;
