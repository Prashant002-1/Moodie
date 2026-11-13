import { Bookmark, Search as SearchIcon } from 'lucide-react';
import { FormEvent, useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CommunityFilmCard } from '../components/discovery/CommunityFilmCard';
import FilmRail from '../components/features/movie/FilmRail';
import { DiscoveryPathCard } from '../components/recommendations/DiscoveryPathCard';
import { RecommendationSpotlight } from '../components/recommendations/RecommendationSpotlight';
import { useDiary } from '../contexts/DiaryContext';
import { useUser } from '../contexts/UserContext';
import { catalogService } from '../services/catalogService';
import { discoveryService } from '../services/discoveryService';
import { recommendationService } from '../services/recommendationService';
import { EmotionScores } from '../types/emotion';
import { savedFilmMovie } from '../types/diary';
import { emotionLabels, imageUrl, releaseYear } from '../utils/display';
import { useLibraryState } from '../hooks/useLibraryState';
import { usePagedResource } from '../hooks/usePagedResource';
import { useResource } from '../hooks/useResource';

type SearchView = 'films' | 'feelings' | 'people';
const feelingKeys = Object.keys(emotionLabels) as (keyof EmotionScores)[];

export default function Search() {
  const { user } = useUser();
  const [view, setView] = useState<SearchView>('films');
  return <div className="page-shell search-page">
    <div className="search-controls"><div className="search-switcher product-section-tabs" role="group" aria-label="Choose search type">
      {(['films', 'feelings', 'people'] as const).map(item => <button key={item} aria-pressed={view === item} onClick={() => setView(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
    </div></div>
    {view === 'feelings' ? <FeelingSearch key={user?.id} /> : <TextSearch key={`${user?.id}:${view}`} view={view} />}
  </div>;
}

function TextSearch({ view }: { view: 'films' | 'people' }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(query.trim()); };
  return <>
    <form className="global-search" onSubmit={submit} role="search">
      <SearchIcon aria-hidden="true" size={18} /><input aria-label={`Search ${view}`} onChange={event => setQuery(event.target.value)} placeholder={view === 'films' ? 'Film title' : 'Name or username'} type="search" value={query} />
      <button type="submit">Search</button>
    </form>
    {view === 'people' ? <PeopleResults query={submitted} /> : submitted ? <FilmResults query={submitted} /> : <SearchStart />}
  </>;
}

function SearchStart() {
  const { savedFilms, revision } = useDiary();
  const { user } = useUser();
  const load = useCallback((signal: AbortSignal) => discoveryService.pulse(signal), []);
  const pulse = useResource(`${user?.id}:${revision}`, load);
  return <div className="search-start">
    {pulse.loading && <p role="status">Loading recent responses</p>}
    {pulse.error && <p role="alert">{pulse.error} <button onClick={pulse.refresh}>Retry recent responses</button></p>}
    {!!pulse.data?.length && <section className="search-start__pulse" aria-label="Films with recent responses"><h1>Recent responses</h1>
      <div className="search-response-layout"><CommunityFilmCard film={pulse.data[0]} variant="feature" /><div className="search-response-index">{pulse.data.slice(1, 5).map(film => <CommunityFilmCard film={film} key={film.movie_id} variant="compact" />)}</div></div>
    </section>}
    {!!savedFilms.length && <><FilmRail description="Films you kept for later." movies={savedFilms.map(savedFilmMovie).slice(0, 10)} title="Saved films" /><Link className="text-link" to="/diary?view=saved">All saved films</Link></>}
  </div>;
}

function FilmResults({ query }: { query: string }) {
  const { user } = useUser();
  const { saveFilm, unsaveFilm } = useDiary();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async (cursor: number | undefined, signal: AbortSignal) => {
    const result = await catalogService.search(query, cursor ?? 1, signal);
    return { items: result.results, next: result.page < Math.min(100, result.total_pages) ? result.page + 1 : null };
  }, [query]);
  const page = usePagedResource(`${user?.id}:${query}`, load);
  const library = useLibraryState(page.items.map(film => film.id));
  const save = async (id: number, saved: boolean) => {
    if (busy !== null) return;
    setBusy(id); setError('');
    try { if (saved) await unsaveFilm(id); else await saveFilm(id); }
    catch { setError('Your saved films could not be updated. Try again.'); }
    finally { setBusy(null); }
  };
  return <>
    {page.loading && <p role="status">Searching films</p>}
    {page.error && <p role="alert">{page.error} <button onClick={page.refresh}>Retry films</button></p>}
    {error && <p role="alert">{error}</p>}
    {library.error && <p role="alert">{library.error} <button onClick={library.refresh}>Retry library status</button></p>}
    <section aria-label={`Film results for ${query}`} className="search-film-list">{page.items.map(movie => {
      const poster = imageUrl(movie.poster_path, 'w342');
      const saved = library.get(movie.id)?.saved;
      return <article className="search-film" key={movie.id}>
        <Link to={`/movie/${movie.id}`}>{poster ? <img alt={`Poster for ${movie.title}`} loading="lazy" src={poster} /> : <span />}</Link>
        <div><Link to={`/movie/${movie.id}`}><h2>{movie.title}</h2></Link><p className="metadata">{releaseYear(movie.release_date)}</p><p>{movie.overview || 'No synopsis is available.'}</p><div className="search-film__actions"><Link className="text-link" to={`/movie/${movie.id}`}>Open film</Link><button disabled={saved === undefined || busy !== null} aria-pressed={saved} onClick={() => void save(movie.id, !!saved)}><Bookmark fill={saved ? 'currentColor' : 'none'} size={15} />{saved === undefined ? 'Checking saved films' : saved ? 'Saved' : 'Save'}</button><Link to={`/log?movieId=${movie.id}`}>Add response</Link></div></div>
      </article>;
    })}</section>
    {page.loaded && !page.items.length && <div className="product-empty"><p>No films found.</p></div>}
    {page.next !== null && <button className="button button--secondary" disabled={page.loading} onClick={page.loadMore}>Load more films</button>}
  </>;
}

function PeopleResults({ query }: { query: string }) {
  const { user } = useUser();
  const { revision, refresh } = useDiary();
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await discoveryService.peoplePage({ q: query, offset }, signal);
    return { items: result.people, next: result.nextOffset };
  }, [query]);
  const page = usePagedResource(`${user?.id}:${revision}:${query}`, load);
  const follow = async (id: number, following: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { if (following) await discoveryService.unfollow(id); else await discoveryService.follow(id); void refresh(); }
    catch { setError('Your follow could not be updated. Try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <>
    {page.loading && <p role="status">Searching people</p>}
    {page.error && <p role="alert">{page.error} <button onClick={page.refresh}>Retry people</button></p>}
    {error && <p role="alert">{error}</p>}
    <section aria-label="People results" className="search-people-grid">{page.items.map(person => <article className="search-person" key={person.id}>
      <Link className="search-person__avatar" to={`/member/${person.username}`}>{person.username.charAt(0).toUpperCase()}</Link>
      <div><Link to={`/member/${person.username}`}><h2>@{person.username}</h2></Link><p>{person.bio || `${person.entries} responses.`}</p>{person.shared_film_title && <span>You both responded to <strong>{person.shared_film_title}</strong>.</span>}<div className="search-person__actions"><Link className="text-link" to={`/member/${person.username}`}>Open profile</Link><button disabled={busy} aria-label={`${person.following ? 'Unfollow' : 'Follow'} @${person.username}`} aria-pressed={person.following} onClick={() => void follow(person.id, person.following)}>{person.following ? 'Following' : 'Follow'}</button></div></div>
    </article>)}</section>
    {page.loaded && !page.items.length && <div className="product-empty"><p>No people found.</p></div>}
    {page.next !== null && <button className="button button--secondary" disabled={page.loading} onClick={page.loadMore}>Load more people</button>}
  </>;
}

function FeelingSearch() {
  const [wanted, setWanted] = useState<(keyof EmotionScores)[]>([]);
  const [submitted, setSubmitted] = useState<(keyof EmotionScores)[] | null>(null);
  return <section className="feeling-search" aria-labelledby="feeling-search-title">
    <form onSubmit={event => { event.preventDefault(); setSubmitted([...wanted]); }}>
      <div><h1 id="feeling-search-title">How do you want to feel?</h1><p>Choose one or more feelings. Results come from how connected people described their own viewings, not from genre.</p></div>
      <div aria-label="Choose feelings" className="feeling-search__options" role="group">{feelingKeys.map(feeling => <button aria-pressed={wanted.includes(feeling)} data-feeling={feeling} key={feeling} onClick={() => setWanted(current => current.includes(feeling) ? current.filter(item => item !== feeling) : [...current, feeling])} type="button">{emotionLabels[feeling]}</button>)}</div>
      <button className="button button--primary" disabled={!wanted.length} type="submit">Find films</button>
    </form>
    {submitted && <FeelingResults feelings={submitted} />}
  </section>;
}

function FeelingResults({ feelings }: { feelings: (keyof EmotionScores)[] }) {
  const { user } = useUser();
  const { revision } = useDiary();
  const key = [...feelings].sort().join(',');
  const load = useCallback(async (abort: AbortSignal) => {
    const signal = Object.fromEntries(feelingKeys.map(feeling => [feeling, key.split(',').includes(feeling) ? 1 : 0])) as unknown as EmotionScores;
    const result = await recommendationService.get(signal, abort);
    return [...new Map([...result.forYou, ...result.adjacent].filter(movie => movie.recommended_by?.length).map(movie => [movie.id, movie])).values()];
  }, [key]);
  const resource = useResource(`${user?.id}:${revision}:${key}`, load);
  const films = resource.data ?? [];
  return <>
    {resource.loading && <p role="status">Finding films</p>}
    {resource.error && <p role="alert">{resource.error} <button onClick={resource.refresh}>Retry feelings</button></p>}
    {!!films.length && <div className="feeling-search__results"><RecommendationSpotlight movie={films[0]} requestedFeelings={feelings} showAllLink={false} />{films.length > 1 && <section className="home-section" aria-labelledby="feeling-results-title"><header><h2 id="feeling-results-title">Recommended films</h2></header><div className="path-grid">{films.slice(1).map(movie => <DiscoveryPathCard key={movie.id} movie={movie} requestedFeelings={feelings} />)}</div></section>}</div>}
    {resource.loaded && !films.length && <div className="product-empty"><p>No connected response matches those feelings yet.</p></div>}
  </>;
}
