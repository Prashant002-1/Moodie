import { ArrowUpRight, Heart } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CommunityFilmCard } from '../components/discovery/CommunityFilmCard';
import { ResponseComments } from '../components/discovery/ResponseComments';
import { ResponseFeelingTrace } from '../components/discovery/ResponseFeelingTrace';
import { ResponseDetails } from '../components/diary/ResponseDetails';
import { KeepRecommendation } from '../components/suggestions/KeepRecommendation';
import { SuggestionPreview } from '../components/suggestions/SuggestionPreview';
import FilmRail from '../components/features/movie/FilmRail';
import { DiscoveryPathCard } from '../components/recommendations/DiscoveryPathCard';
import { RecommendationSpotlight } from '../components/recommendations/RecommendationSpotlight';
import { useDiary } from '../contexts/DiaryContext';
import { useUser } from '../contexts/UserContext';
import { CommunityPerson, ResponseEntry, discoveryService } from '../services/discoveryService';
import { usePagedResource } from '../hooks/usePagedResource';
import { useResource } from '../hooks/useResource';
import { apiError } from '../services/apiClient';
import { recommendationService } from '../services/recommendationService';
import { savedFilmMovie } from '../types/diary';
import { formatCalendarDate, imageUrl, releaseYear } from '../utils/display';

type FeedView = 'for-you' | 'following' | 'everyone';

interface ResponseCardProps {
  compact?: boolean;
  entry: ResponseEntry;
  ownUserId?: number;
  onFollow: (entry: ResponseEntry) => void;
  onLike: (entry: ResponseEntry) => void;
}

const ResponseCard = ({ compact = false, entry, ownUserId, onFollow, onLike }: ResponseCardProps) => {
  const poster = imageUrl(entry.poster_path, 'w342');
  const published = new Date(entry.created_at);

  return (
    <article className={`feed-response${compact ? ' feed-response--compact' : ''}`}>
      <header className="feed-response__byline">
        <Link aria-label={`Open @${entry.username}'s profile`} className="feed-response__avatar" to={`/member/${entry.username}`}>{entry.username.charAt(0).toUpperCase()}</Link>
        <div><Link to={`/member/${entry.username}`}><strong>@{entry.username}</strong></Link><time dateTime={entry.created_at}>{published.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></div>
        {entry.user_id !== ownUserId && entry.following !== undefined && <button aria-label={`${entry.following ? 'Unfollow' : 'Follow'} @${entry.username}`} aria-pressed={entry.following} className={`feed-response__follow${entry.following ? ' feed-response__follow--active' : ''}`} onClick={() => onFollow(entry)} type="button">{entry.following ? 'Following' : 'Follow'}</button>}
      </header>

      <div className={`feed-response__content${entry.expression_image_path ? ' feed-response__content--with-photo' : ''}`}>
        <Link className="feed-response__poster" to={`/movie/${entry.movie_id}`}>{poster ? <img alt={`Poster for ${entry.title}`} loading="lazy" src={poster} /> : <span />}</Link>
        <div className="feed-response__copy">
          <Link to={`/movie/${entry.movie_id}`}><h2>{entry.title} <span>{releaseYear(entry.release_date)}</span></h2></Link>
          <p className="feed-response__watched">Watched {formatCalendarDate(entry.watched_on, { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          <blockquote>{entry.note || 'No note added.'}</blockquote>
          <ResponseFeelingTrace entry={entry} />
          <ResponseDetails enjoyment={entry.enjoyment} highlights={entry.highlights} />
        </div>
        {entry.expression_image_path && <img alt={entry.expression_image_alt || `Photo shared by ${entry.username}`} className="feed-response__photo" loading="lazy" src={entry.expression_image_path} />}
      </div>

      <footer className="feed-response__footer">
        <button aria-label={`${entry.liked ? 'Unlike' : 'Like'} ${entry.username}'s response`} aria-pressed={entry.liked} className={`feed-response__like${entry.liked ? ' feed-response__like--active' : ''}`} onClick={() => onLike(entry)} type="button"><Heart fill={entry.liked ? 'currentColor' : 'none'} size={16} /><span>{entry.like_count || 0} {(entry.like_count || 0) === 1 ? 'like' : 'likes'}</span></button>
        <ResponseComments entryId={entry.id} initialCount={entry.comment_count} />
        <KeepRecommendation entryId={entry.id} authorId={entry.user_id} movieId={entry.movie_id} />
        <Link className="feed-response__film-link" to={`/response/${entry.id}`}>Read response <ArrowUpRight aria-hidden="true" size={15} /></Link>
      </footer>
    </article>
  );
};

const Feed = () => {
  const { user } = useUser();
  const { savedFilms, summary, revision: diaryRevision, currentSignal, refresh: refreshDiary } = useDiary();
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
  const loadPeople = useCallback(async (_cursor: number | undefined, signal: AbortSignal) => {
    const result = forYou ? await discoveryService.peoplePage({ limit: 6 }, signal) : { people: [] };
    return { items: result.people, next: null };
  }, [forYou]);
  const people = usePagedResource(`${key}:people:${forYou}`, loadPeople);
  const loadRecommendations = useCallback((signal: AbortSignal) => forYou ? recommendationService.get(currentSignal || undefined, signal) : Promise.resolve(null), [forYou, currentSignal]);
  const recommendations = useResource(`${key}:recommendations:${forYou}:${JSON.stringify(currentSignal)}`, loadRecommendations);
  const loadPulse = useCallback((signal: AbortSignal) => forYou ? discoveryService.pulse(signal) : Promise.resolve([]), [forYou]);
  const pulse = useResource(`${key}:pulse:${forYou}`, loadPulse);
  const films = recommendations.data?.forYou.filter(movie => movie.recommended_by?.length) ?? [];
  const lead = films[0];
  const evidenceIDs = useMemo(() => {
    const people = new Set<number>();
    const ids: number[] = [];
    for (const movie of recommendations.data?.forYou ?? []) {
      const person = movie.recommended_by?.find(person => !people.has(person.id));
      if (person) { people.add(person.id); ids.push(person.response_id); }
      if (ids.length === 4) break;
    }
    return ids.join(',');
  }, [recommendations.data]);
  const loadEvidence = useCallback(async (_cursor: number | undefined, signal: AbortSignal) => ({
    items: evidenceIDs ? await Promise.all(evidenceIDs.split(',').map(id => discoveryService.response(Number(id), signal))) : [], next: null,
  }), [evidenceIDs]);
  const evidence = usePagedResource(`${key}:evidence:${evidenceIDs}`, loadEvidence);
  const preview = evidence.items.length ? evidence.items : circle.items.length ? circle.items : page.items;

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
      page.updateItems(update); circle.updateItems(update); evidence.updateItems(update);
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
  const togglePerson = (person: CommunityPerson) => void follow(person.id, person.following);
  const card = (entry: ResponseEntry, compact = false) => <ResponseCard key={entry.id} entry={entry} compact={compact} onFollow={toggleFollow} onLike={entry => void toggleLike(entry)} ownUserId={user?.id} />;
  return <div className="page-shell feed-page">
    <header className="feed-page__header"><Link className="text-link" to="/suggestions">Recommendations</Link>
      <div aria-label="Choose home view" className="feed-tabs" role="group"><button aria-pressed={forYou} onClick={() => setView('for-you')}>For you</button><button aria-pressed={view === 'following'} onClick={() => setView('following')}>Following</button><button aria-pressed={view === 'everyone'} onClick={() => setView('everyone')}>Everyone</button></div>
    </header>
    {actionError && <p role="alert">{actionError}</p>}
    {forYou ? <div className="home-journey">
      <SuggestionPreview />
      {recommendations.loading && !recommendations.data && <p role="status">Finding recommendations</p>}
      {recommendations.error && <div className="product-empty" role="alert"><p>Recommendations could not be loaded.</p><button className="button button--secondary" onClick={recommendations.refresh}>Try again</button></div>}
      {recommendations.loaded && !recommendations.error && (summary?.entries ?? 0) > 0 && !lead && <section className="product-empty"><h1>No connected films yet.</h1><p>Keep recording how films felt. A shared film with another person opens a path to their other responses.</p><Link className="text-link" to="/people">Find people</Link></section>}
      {summary?.entries === 0 && <section className="product-empty"><h1>Start with a film that stayed with you.</h1><p>Add your first response to begin finding films through people.</p><Link className="button button--primary" to="/log">Add first response</Link></section>}
      {lead && <RecommendationSpotlight compact movie={lead} />}
      {films.length > 1 && <section className="home-section" aria-labelledby="recommendations-title"><header><h2 id="recommendations-title">Recommended films</h2><Link to="/recommendations">See all</Link></header><div className="path-grid">{films.slice(1, 5).map(movie => <DiscoveryPathCard key={movie.id} movie={movie} />)}</div></section>}
      <div className="home-social-grid">
        <section className="home-section home-section--responses" aria-label={evidence.items.length ? 'Responses connected to your diary' : 'Recent responses'}><header><h2>{evidence.items.length ? 'Through your shared films' : circle.items.length ? 'From your circle' : 'From the community'}</h2><Link to={evidence.items.length ? '/recommendations' : '/people'}>{evidence.items.length ? 'See recommendations' : 'Find people'}</Link></header>
          {evidence.error && <p role="alert">Connected responses could not be loaded. <button className="text-link" onClick={evidence.refresh}>Retry responses</button></p>}
          {circle.error && <p role="alert">Your circle could not be loaded. <button className="text-link" onClick={circle.refresh}>Retry circle</button></p>}
          {page.error && <p role="alert">{page.error} <button className="text-link" onClick={page.refresh}>Retry community</button></p>}
          <div className="home-response-stack">{preview.slice(0, 4).map(entry => card(entry, true))}</div>
          {!preview.length && !page.loading && !circle.loading && !page.error && !circle.error && <p>No public responses yet. Your first response can start the conversation.</p>}
        </section>
        <section className="home-section home-section--people" aria-labelledby="people-title"><header><h2 id="people-title">People</h2><Link to="/people">See all</Link></header>
          {people.error && <p role="alert">People could not be loaded. <button className="text-link" onClick={people.refresh}>Retry people</button></p>}
          <div className="home-people-list">{people.loaded && !people.error && !people.items.length && <p>No other people have joined yet.</p>}{people.items.map(person => <article className="home-person" key={person.id}><Link className="home-person__avatar" to={`/member/${person.username}`}>{person.username.charAt(0).toUpperCase()}</Link><div><Link to={`/member/${person.username}`}><strong>@{person.username}</strong></Link>{person.shared_film_title ? <p>Shared film: {person.shared_film_title}</p> : <p>{person.latest_title}</p>}</div><button aria-pressed={person.following} onClick={() => togglePerson(person)}>{person.following ? 'Following' : 'Follow'}</button></article>)}</div>
        </section>
      </div>
      {pulse.error && <p role="alert">Recent films could not be loaded. <button className="text-link" onClick={pulse.refresh}>Retry recent films</button></p>}
      {!!pulse.data?.length && <section className="home-section" aria-labelledby="pulse-title"><header><h2 id="pulse-title">Recent responses</h2><Link to="/search">Search films</Link></header><div className="community-film-grid">{pulse.data.slice(0, 6).map(film => <CommunityFilmCard film={film} key={film.movie_id} />)}</div></section>}
      {!!savedFilms.length && <FilmRail description="Films you kept for later." movies={savedFilms.map(savedFilmMovie)} title="Saved films" linkLabel="Open saved films" linkTo="/diary?view=saved" />}
    </div> : <>
      {page.error && <p role="alert">{page.error} <button className="text-link" onClick={page.refresh}>Retry responses</button></p>}
      <section aria-label={view === 'following' ? 'Responses from people you follow' : 'Public responses'} className="response-feed">{page.items.map(entry => card(entry))}</section>
      {page.loading && <p role="status">Loading responses</p>}
      {page.loaded && !page.loading && !page.error && !page.items.length && <div className="product-empty"><p>No responses here yet.</p><div className="product-empty__actions"><Link className="text-link" to="/people">Find people</Link><Link className="text-link" to="/log">Add a response</Link></div></div>}
      {page.next !== null && <button className="button button--secondary" disabled={page.loading} onClick={page.loadMore}>Older responses</button>}
    </>}
  </div>;
};
export default Feed;
