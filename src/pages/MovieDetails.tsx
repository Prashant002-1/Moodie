import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ResponseCard } from '../components/response/ResponseCard';
import { SuggestionPreview } from '../components/suggestions/SuggestionPreview';
import FilmPoster from '../components/features/movie/FilmPoster';
import { useDiary } from '../contexts/DiaryContext';
import { useLibraryState } from '../hooks/useLibraryState';
import { useUser } from '../contexts/UserContext';
import { catalogService } from '../services/catalogService';
import { ResponseEntry, discoveryService } from '../services/discoveryService';
import { usePagedResource } from '../hooks/usePagedResource';
import { useResource } from '../hooks/useResource';
import { Movie } from '../types/movie';
import { formatRuntime, imageUrl, releaseYear } from '../utils/display';
import { personHue } from '../utils/person';
import { usePageTitle } from '../hooks/usePageTitle';

const MovieDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const actionLocks = useRef(new Set<string>());
  const [searchParams] = useSearchParams();
  const { hash } = useLocation();
  const { user } = useUser();
  const { saveFilm, unsaveFilm, revision } = useDiary();
  const library = useLibraryState([Number(id)]);
  const libraryState = library.get(Number(id));
  const [view, setView] = useState<'responses' | 'related'>('responses');
  const [responseScope, setResponseScope] = useState<'following' | 'everyone'>('everyone');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const loadMovie = useCallback((signal: AbortSignal) => catalogService.movie(Number(id), signal), [id]);
  const catalog = useResource(`${user?.id}:${id}`, loadMovie);
  const loadResponses = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await discoveryService.filmEntriesPage(Number(id), { offset, scope: responseScope }, signal);
    return { items: result.entries, next: result.nextOffset, metadata: { summary: result.summary, film: result.film } };
  }, [id, responseScope]);
  const responses = usePagedResource(`${user?.id}:responses:${id}:${responseScope}`, loadResponses, revision);
  const publicEntries = responses.items;
  const summary = responses.metadata?.summary;
  const cached = responses.metadata?.film;
  const movie: Movie | null = catalog.data ?? (cached ? { ...cached, overview: cached.overview ?? '', release_date: cached.release_date ?? '', genre_ids: [], popularity: 0, vote_average: 0, vote_count: 0 } : null);
  const setPublicEntries = responses.updateItems;
  usePageTitle(movie?.title ?? 'Film');

  useEffect(() => {
    if (!publicEntries.length || !hash) return;
    const target = document.getElementById(hash.slice(1));
    if (!target) return;
    const frame = window.requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }));
    return () => window.cancelAnimationFrame(frame);
  }, [publicEntries, hash]);

  const toggleSaved = async () => {
    if (!movie || !user || !libraryState || saving) return;
    const wasSaved = libraryState.saved;
    setSaving(true);
    setNotice('');
    try {
      if (wasSaved) await unsaveFilm(movie.id);
      else await saveFilm(movie.id);
      setNotice(wasSaved ? 'Removed from saved films.' : 'Saved for later.');
    } catch {
      setNotice('That change could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleLike = async (entry: ResponseEntry) => {
    if (!user) return;
    const actionKey = 'toggleLike-' + entry.id;
    if (actionLocks.current.has(actionKey)) return;
    actionLocks.current.add(actionKey);
    const next = !entry.liked;
    setPublicEntries(current => current.map(item => item.id === entry.id
      ? { ...item, liked: next, like_count: Math.max(0, item.like_count + (next ? 1 : -1)) }
      : item));
    try {
      if (next) await discoveryService.like(entry.id);
      else await discoveryService.unlike(entry.id);
    } catch {
      setNotice('Your like could not be updated. Try again.');
      setPublicEntries(current => current.map(item => item.id === entry.id
        ? { ...item, liked: !next, like_count: Math.max(0, item.like_count + (next ? -1 : 1)) }
        : item));
    } finally { actionLocks.current.delete(actionKey); }
  };

  if (!movie && (catalog.loading || responses.loading)) return <div className="loading" role="status">Loading film</div>;
  if (!movie) return <div className="page page--narrow"><div className="empty"><h1>Film could not be loaded</h1><div className="actions"><button className="btn btn--secondary" onClick={() => { catalog.refresh(); responses.refresh(); }} type="button">Retry film</button><Link className="link" to="/search">Search films</Link></div></div></div>;

  const poster = imageUrl(movie.poster_path, 'w500');
  const backdrop = imageUrl(movie.backdrop_path, 'w1280');
  const runtime = formatRuntime(movie.runtime);
  const fromPerson = searchParams.get('from');
  const throughFilm = searchParams.get('through');
  const viewings = libraryState?.viewing_count ?? 0;
  // People you follow come first; within each group the order is the server's.
  const ordered = [...publicEntries.filter(entry => entry.following), ...publicEntries.filter(entry => !entry.following)];

  return <>
    <section className={`band${backdrop ? ' band--art' : ''}`}>
      {backdrop && <img alt="" className="band__art" src={backdrop} />}
      <div className="box hero">
        <span className="poster poster--xl">{poster && <img alt={`Poster for ${movie.title}`} src={poster} />}</span>
        <div className="hero__main">
          <div className="hero__head">
            {fromPerson && throughFilm && <p className="byline" data-hue={personHue(fromPerson)}>From <Link to={`/member/${fromPerson}`}>@{fromPerson}</Link>, through {throughFilm}</p>}
            <h1 className="t-display">{movie.title}{movie.release_date && <> <span className="year">{releaseYear(movie.release_date)}</span></>}</h1>
            {(runtime || !!summary?.total) && <p className="meta">
              {runtime && <span>{runtime}</span>}
              {!!summary?.total && <span>{summary.total} {summary.total === 1 ? 'response' : 'responses'}</span>}
            </p>}
          </div>
          {user ? <div className="actions hero__actions">
            <Link aria-label={viewings ? `Log ${movie.title} again` : `Log ${movie.title}`} className="btn btn--primary" to={`/log?movieId=${movie.id}`}>Log</Link>
            <Link className="btn btn--secondary" to={`/suggestions/new?movieId=${movie.id}`}>Recommend</Link>
            <button aria-pressed={Boolean(libraryState?.saved)} className="btn btn--secondary" disabled={saving || !libraryState} onClick={() => void toggleSaved()} type="button">{libraryState?.saved ? 'Saved' : 'Save'}</button>
            {viewings > 0 && <Link className="link t-callout" to={`/diary?movieId=${movie.id}`}>Your {viewings === 1 ? 'viewing' : `${viewings} viewings`}</Link>}
          </div> : <p className="hint hero__actions">Sign in to save this film or add a response.</p>}
        </div>
      </div>
    </section>

    <div className="page stack stack--loose">
      {(notice || library.error || catalog.error || movie.overview) && <div className="stack">
        {notice && <p className="t-callout secondary" role="status">{notice}</p>}
        {library.error && <p className="notice notice--error" role="alert">{library.error} <button className="link" onClick={library.refresh} type="button">Retry library status</button></p>}
        {catalog.error && <p className="notice" role="alert">Film catalog details are unavailable. <button className="link" onClick={catalog.refresh} type="button">Retry catalog</button></p>}
        {movie.overview && <p className="note measure">{movie.overview}</p>}
      </div>}
      <SuggestionPreview movieId={movie.id} />

      <div>
        <div aria-label="Choose film view" className="tabs" role="group">
          <button aria-pressed={view === 'responses'} onClick={() => setView('responses')} type="button">Responses</button>
          <button aria-pressed={view === 'related'} onClick={() => setView('related')} type="button">More films</button>
        </div>

        {view === 'responses' && <>
          <div aria-label="Filter film responses" className="chips" role="group" style={{ marginTop: 'var(--m-space-4)' }}>
            <button aria-pressed={responseScope === 'everyone'} className="chip" onClick={() => setResponseScope('everyone')} type="button">Everyone</button>
            <button aria-pressed={responseScope === 'following'} className="chip" onClick={() => setResponseScope('following')} type="button">Following</button>
          </div>
          {responses.error && <p className="status" role="alert">{responses.error} <button className="link" onClick={responses.refresh} type="button">Retry responses</button></p>}
          {ordered.length > 0 && <section aria-label={`Public responses to ${movie.title}`} className="columns responses--film">
            {ordered.map(entry => <div id={`response-${entry.id}`} key={entry.id}><ResponseCard entry={entry} onLike={entry => void toggleLike(entry)} ownUserId={user?.id} /></div>)}
          </section>}
          {responses.loading && <p className="status" role="status">Loading responses</p>}
          {!publicEntries.length && responses.loaded && !responses.loading && <p className="status">{responseScope === 'following' ? 'No responses from people you follow.' : 'No public responses.'}</p>}
          {responses.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={responses.loading} onClick={responses.loadMore} type="button">Load more responses</button></div>}
        </>}

        {view === 'related' && <RelatedFilms movieId={movie.id} />}
      </div>
    </div>
  </>;
};

function RelatedFilms({ movieId }: { movieId: number }) {
  const load = useCallback((signal: AbortSignal) => catalogService.related(movieId, signal), [movieId]);
  const related = useResource(String(movieId), load);
  return <>{related.loading && <p className="status" role="status">Loading related films</p>}
    {related.error && <p className="status" role="alert">{related.error} <button className="link" onClick={related.refresh} type="button">Retry related films</button></p>}
    {!!related.data?.length && <div className="wall" style={{ marginTop: 'var(--m-space-5)' }}>{related.data.map(movie => <FilmPoster key={movie.id} movie={movie} />)}</div>}
    {related.loaded && !related.data?.length && <p className="status">No related films found.</p>}
  </>;
}

export default function ScopedMovieDetails() {
  const { id } = useParams();
  const { user } = useUser();
  return <MovieDetails key={`${user?.id}:${id}`} />;
}
