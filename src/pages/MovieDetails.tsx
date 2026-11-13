import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bookmark, Clock, Heart } from 'lucide-react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import BrandMark from '../components/brand/BrandMark';
import { ResponseComments } from '../components/discovery/ResponseComments';
import { ResponseFeelingTrace } from '../components/discovery/ResponseFeelingTrace';
import { ResponseDetails } from '../components/diary/ResponseDetails';
import { KeepRecommendation } from '../components/suggestions/KeepRecommendation';
import { SuggestionPreview } from '../components/suggestions/SuggestionPreview';
import FilmRail from '../components/features/movie/FilmRail';
import { useDiary } from '../contexts/DiaryContext';
import { useLibraryState } from '../hooks/useLibraryState';
import { useUser } from '../contexts/UserContext';
import { catalogService } from '../services/catalogService';
import { CommunityEntry, discoveryService } from '../services/discoveryService';
import { EmotionScores } from '../types/emotion';
import { usePagedResource } from '../hooks/usePagedResource';
import { useResource } from '../hooks/useResource';
import { Movie } from '../types/movie';
import { emotionColors, emotionLabels, formatCalendarDate, formatRuntime, imageUrl, releaseYear } from '../utils/display';

const feelingKeys = Object.keys(emotionLabels) as (keyof EmotionScores)[];

type FilmSummary = Awaited<ReturnType<typeof discoveryService.filmEntriesPage>>['summary'];

const FilmFeelingDistribution = ({ summary, title }: { summary?: FilmSummary; title: string }) => {
  if (!summary?.total) return null;
  const totals = feelingKeys.map(key => ({
    key,
    label: emotionLabels[key],
    value: Number(summary[key]) || 0,
  }));
  const total = totals.reduce((sum, feeling) => sum + feeling.value, 0) || 1;
  const distribution = totals
    .map(feeling => ({ ...feeling, percent: Math.round((feeling.value / total) * 100) }))
    .filter(feeling => feeling.percent > 0)
    .sort((first, second) => second.percent - first.percent);

  return (
    <section className="film-feeling-distribution" aria-label={`Feelings recorded for ${title}`}>
      <header><h2>What people felt</h2><p>{summary.total} {summary.total === 1 ? 'response' : 'responses'}</p></header>
      <div aria-hidden="true" className="film-feeling-distribution__trace">
        {distribution.map(feeling => <i key={feeling.key} style={{ backgroundColor: emotionColors[feeling.key], flexGrow: feeling.percent }} />)}
      </div>
      <dl>
        {distribution.map(feeling => <div key={feeling.key}><dt><i style={{ backgroundColor: emotionColors[feeling.key] }} />{feeling.label}</dt><dd>{feeling.percent}%</dd></div>)}
      </dl>
    </section>
  );
};

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
  const responses = usePagedResource(`${user?.id}:${revision}:${id}:${responseScope}`, loadResponses);
  const publicEntries = responses.items;
  const summary = responses.metadata?.summary;
  const cached = responses.metadata?.film;
  const movie: Movie | null = catalog.data ?? (cached ? { ...cached, overview: cached.overview ?? '', release_date: cached.release_date ?? '', genre_ids: [], popularity: 0, vote_average: 0, vote_count: 0 } : null);
  const setPublicEntries = responses.updateItems;

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

  const toggleLike = async (entry: CommunityEntry) => {
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

  if (!movie && (catalog.loading || responses.loading)) return <div className="loading-state page-loading"><div className="loading-spinner" /><span>Loading film</span></div>;
  if (!movie) return <div className="error-state page-loading"><BrandMark /><h1>Film could not be loaded</h1><button onClick={() => { catalog.refresh(); responses.refresh(); }}>Retry film</button></div>;

  const backdrop = imageUrl(movie.backdrop_path, 'w1280');
  const poster = imageUrl(movie.poster_path, 'w500');
  const runtime = formatRuntime(movie.runtime);
  const fromPerson = searchParams.get('from');
  const throughFilm = searchParams.get('through');

  return (
    <>
      <section className={`details-hero${publicEntries.length === 0 ? ' details-hero--without-responses' : ''}`}>
        {backdrop && <img alt="" aria-hidden="true" className="details-hero__backdrop" src={backdrop} />}
        <div className="details-hero__scrim" />
        <div className="details-hero__content">
          {poster ? <img alt={`Poster for ${movie.title}`} className="details-hero__poster" src={poster} /> : <div className="film-poster__fallback"><BrandMark /></div>}
          <div className="details-hero__copy">
            {fromPerson && throughFilm && <p className="details-connection"><Link to={`/member/${fromPerson}`}>@{fromPerson}</Link> reached you through <strong>{throughFilm}</strong>.</p>}
            <h1 className="details-hero__title">{movie.title}</h1>
            {movie.tagline && <p className="details-hero__tagline">{movie.tagline}</p>}
            <div className="details-meta">
              <span>{releaseYear(movie.release_date)}</span>
              {runtime && <span className="runtime-badge"><Clock size={15} />{runtime}</span>}
              {!!summary?.total && <span>{summary.total} {summary.total === 1 ? 'response' : 'responses'}</span>}
            </div>
            <p className="details-overview">{movie.overview || 'No synopsis is available for this film.'}</p>
            {user ? (
              <div className="details-actions">
                <button className="button button--secondary" disabled={saving || !libraryState} onClick={() => void toggleSaved()} type="button">
                  <Bookmark fill={libraryState?.saved ? 'currentColor' : 'none'} size={17} />{saving ? 'Saving' : !libraryState ? 'Checking your library' : libraryState.saved ? 'Saved' : 'Save for later'}
                </button>
                <Link className="button button--primary" to={`/log?movieId=${movie.id}`}>{libraryState?.viewing_count ? 'Add another response' : 'Add response'}</Link>
                <Link className="button button--quiet" to={`/suggestions/new?movieId=${movie.id}`}>Recommend</Link>
                {!!libraryState?.viewing_count && <Link className="text-link" to={`/diary?movieId=${movie.id}`}>Your {libraryState.viewing_count === 1 ? 'viewing' : `${libraryState.viewing_count} viewings`}</Link>}
              </div>
            ) : (
              <p className="metadata details-auth-note">Sign in to save this film or add a response.</p>
            )}
            {notice && <p className="metadata details-status" role="status">{notice}</p>}
            {library.error && <p role="alert">{library.error} <button className="text-link" onClick={library.refresh}>Retry library status</button></p>}
          </div>
          <FilmFeelingDistribution summary={summary} title={movie.title} />
        </div>
      </section>

      <section className="page-shell details-content">
        {catalog.error && <p role="alert">Film catalog details are unavailable. <button onClick={catalog.refresh}>Retry catalog</button></p>}
        <SuggestionPreview movieId={movie.id} />
        <div aria-label="Choose film view" className="product-section-tabs details-content__tabs" role="group">
          <button aria-pressed={view === 'responses'} onClick={() => setView('responses')} type="button">Responses</button>
          <button aria-pressed={view === 'related'} onClick={() => setView('related')} type="button">More films</button>
        </div>

        {view === 'responses' && <>
          <div className="film-response-scope product-section-tabs" aria-label="Filter film responses" role="group"><button aria-pressed={responseScope === 'everyone'} onClick={() => setResponseScope('everyone')}>Everyone</button><button aria-pressed={responseScope === 'following'} onClick={() => setResponseScope('following')}>Following</button></div>
          {responses.error && <p role="alert">{responses.error} <button onClick={responses.refresh}>Retry responses</button></p>}
          {responses.loading && <p role="status">Loading responses</p>}
          {publicEntries.length > 0 ? (
          <section className="film-responses" aria-label={`Public responses to ${movie.title}`}>
          <div className="film-response-list">
            {publicEntries.map(entry => {
              return (
                <article className="film-response" id={`response-${entry.id}`} key={entry.id}>
                  <div className="public-entry__byline"><Link className="person-avatar person-avatar--small" to={`/member/${entry.username}`}>{entry.username.charAt(0).toUpperCase()}</Link><p><Link to={`/member/${entry.username}`}><strong>@{entry.username}</strong></Link><span>{formatCalendarDate(entry.watched_on, { month: 'short', day: 'numeric', year: 'numeric' })}</span></p></div>
                  <div className="film-response__body">
                    <blockquote>{entry.note || 'No note on this viewing.'}</blockquote>
                    <ResponseFeelingTrace entry={entry} />
                    <ResponseDetails enjoyment={entry.enjoyment} highlights={entry.highlights} />
                    <div className="suggestion-actions"><Link className="text-link" to={`/response/${entry.id}`}>Read response</Link><KeepRecommendation entryId={entry.id} authorId={entry.user_id} movieId={entry.movie_id} /></div>
                    <div className="film-response__actions"><button aria-label={`${entry.liked ? 'Unlike' : 'Like'} @${entry.username}'s response`} aria-pressed={entry.liked} className={`like-button${entry.liked ? ' like-button--active' : ''}`} disabled={!user} onClick={() => void toggleLike(entry)} type="button"><Heart fill={entry.liked ? 'currentColor' : 'none'} size={16} />{entry.like_count || 0} {(entry.like_count || 0) === 1 ? 'like' : 'likes'}</button><ResponseComments entryId={entry.id} initialCount={entry.comment_count} /></div>
                  </div>
                  {entry.expression_image_path && <img alt={entry.expression_image_alt || `Expression photo shared by ${entry.username}`} className="film-response__expression" loading="lazy" src={entry.expression_image_path} />}
                </article>
              );
            })}
          </div>

          </section>
        ) : responses.loaded ? <div className="product-empty"><p>{responseScope === 'following' ? 'No one you follow has responded to this film yet.' : 'No public responses yet.'}</p>{user && <Link className="text-link" to={`/log?movieId=${movie.id}`}>Add a response</Link>}</div> : null}
          {responses.next !== null && <button className="button button--secondary" disabled={responses.loading} onClick={responses.loadMore}>Load more responses</button>}
        </>}

        {view === 'related' && <RelatedFilms movieId={movie.id} />}
      </section>
    </>
  );
};

function RelatedFilms({ movieId }: { movieId: number }) {
  const load = useCallback((signal: AbortSignal) => catalogService.related(movieId, signal), [movieId]);
  const related = useResource(String(movieId), load);
  return <>{related.loading && <p role="status">Loading related films</p>}
    {related.error && <p role="alert">{related.error} <button onClick={related.refresh}>Retry related films</button></p>}
    {!!related.data?.length && <FilmRail movies={related.data} title="" />}
    {related.loaded && !related.data?.length && <div className="product-empty"><p>No related films found.</p></div>}
  </>;
}

export default function ScopedMovieDetails() {
  const { id } = useParams();
  const { user } = useUser();
  return <MovieDetails key={`${user?.id}:${id}`} />;
}
