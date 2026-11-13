import { FormEvent, useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PersonRow } from '../components/discovery/PersonRow';
import { useDiary } from '../contexts/DiaryContext';
import { useUser } from '../contexts/UserContext';
import { catalogService } from '../services/catalogService';
import { CommunityPerson, discoveryService } from '../services/discoveryService';
import { imageUrl, releaseYear } from '../utils/display';
import { useLibraryState } from '../hooks/useLibraryState';
import { usePagedResource } from '../hooks/usePagedResource';
import { useResource } from '../hooks/useResource';

type SearchView = 'films' | 'people';

export default function Search() {
  const { user } = useUser();
  const [view, setView] = useState<SearchView>('films');
  return <div className="page page--narrow">
    <h1 className="sr-only">Search</h1>
    <div className="tabs" role="group" aria-label="Choose search type">
      <button aria-pressed={view === 'films'} onClick={() => setView('films')} type="button">Films</button>
      <button aria-pressed={view === 'people'} onClick={() => setView('people')} type="button">People</button>
    </div>
    <TextSearch key={`${user?.id}:${view}`} view={view} />
  </div>;
}

function TextSearch({ view }: { view: SearchView }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(query.trim()); };
  return <>
    <form className="search" onSubmit={submit} role="search" style={{ marginTop: 'var(--m-space-5)' }}>
      <input aria-label={`Search ${view}`} className="input" onChange={event => setQuery(event.target.value)} placeholder={view === 'films' ? 'Film title' : 'Name or username'} type="search" value={query} />
      <button className="btn btn--primary" type="submit">Search</button>
    </form>
    {view === 'people' ? <PeopleResults query={submitted} /> : submitted ? <FilmResults query={submitted} /> : <SearchStart />}
  </>;
}

function SearchStart() {
  const { savedFilms, revision } = useDiary();
  const { user } = useUser();
  const load = useCallback((signal: AbortSignal) => discoveryService.pulse(signal), []);
  const pulse = useResource(`${user?.id}:${revision}`, load);
  return <>
    {!!savedFilms.length && <p className="t-callout" style={{ marginTop: 'var(--m-space-4)' }}><Link className="link" to="/suggestions?box=saved">Saved films</Link></p>}
    {pulse.loading && <p className="status" role="status">Loading recent responses</p>}
    {pulse.error && <p className="status" role="alert">{pulse.error} <button className="link" onClick={pulse.refresh}>Retry recent responses</button></p>}
    {!!pulse.data?.length && <section aria-labelledby="search-recent-title" className="section">
      <header className="section__head"><h2 id="search-recent-title">Recent responses</h2></header>
      <div className="poster-grid" style={{ marginTop: 'var(--m-space-4)' }}>{pulse.data.slice(0, 12).map(film => {
        const poster = imageUrl(film.poster_path, 'w342');
        return <Link className="poster-grid__item" key={film.movie_id} to={`/movie/${film.movie_id}`}>
          <span className="poster">{poster && <img alt="" loading="lazy" src={poster} />}</span>
          <span className="serif">{film.title}</span>
          <span className="t-caption muted">{releaseYear(film.release_date)}</span>
        </Link>;
      })}</div>
    </section>}
  </>;
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
    {page.error && <p className="notice notice--error" role="alert" style={{ marginTop: 'var(--m-space-4)' }}>{page.error} <button className="link" onClick={page.refresh}>Retry films</button></p>}
    {error && <p className="notice notice--error" role="alert" style={{ marginTop: 'var(--m-space-4)' }}>{error}</p>}
    {library.error && <p className="notice notice--error" role="alert" style={{ marginTop: 'var(--m-space-4)' }}>{library.error} <button className="link" onClick={library.refresh}>Retry library status</button></p>}
    <section aria-label={`Film results for ${query}`} className="list">{page.items.map(movie => {
      const poster = imageUrl(movie.poster_path, 'w342');
      const saved = library.get(movie.id)?.saved;
      return <article className="row" key={movie.id}>
        <Link aria-hidden="true" className="poster poster--sm" tabIndex={-1} to={`/movie/${movie.id}`}>{poster && <img alt="" loading="lazy" src={poster} />}</Link>
        <div className="row__main">
          <h2 className="row__title"><Link to={`/movie/${movie.id}`}>{movie.title}</Link></h2>
          <p className="t-caption muted">{releaseYear(movie.release_date)}</p>
          {movie.overview && <p className="t-callout secondary clamp clamp--2">{movie.overview}</p>}
          <div className="actions" style={{ marginTop: 'var(--m-space-2)' }}>
            <button aria-pressed={saved} className="btn btn--secondary btn--small" disabled={saved === undefined || busy !== null} onClick={() => void save(movie.id, !!saved)} type="button">{saved ? 'Saved' : 'Save'}</button>
            <Link className="btn btn--quiet btn--small" to={`/log?movieId=${movie.id}`}>Add a response</Link>
          </div>
        </div>
      </article>;
    })}</section>
    {page.loading && <p className="status" role="status">Searching films</p>}
    {page.loaded && !page.loading && !page.items.length && <p className="status">No films found.</p>}
    {page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore}>Load more films</button></div>}
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
  const follow = async (person: CommunityPerson) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { if (person.following) await discoveryService.unfollow(person.id); else await discoveryService.follow(person.id); void refresh(); }
    catch { setError('Your follow could not be updated. Try again.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <>
    {page.error && <p className="notice notice--error" role="alert" style={{ marginTop: 'var(--m-space-4)' }}>{page.error} <button className="link" onClick={page.refresh}>Retry people</button></p>}
    {error && <p className="notice notice--error" role="alert" style={{ marginTop: 'var(--m-space-4)' }}>{error}</p>}
    <ul aria-label="People results" className="list">{page.items.map(person => <PersonRow disabled={busy} key={person.id} onFollow={person => void follow(person)} person={person} />)}</ul>
    {page.loading && <p className="status" role="status">Searching people</p>}
    {page.loaded && !page.loading && !page.items.length && <p className="status">No people found.</p>}
    {page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore}>Load more people</button></div>}
  </>;
}
