import { useEffect, useRef, useState } from 'react';
import { catalogService } from '../../services/catalogService';
import { discoveryService } from '../../services/discoveryService';
import { useDiary } from '../../contexts/DiaryContext';
import { DraftFilm } from '../../types/responseDraft';
import { imageUrl, releaseYear } from '../../utils/display';

export function FilmPicker({ onChoose }: { onChoose: (film: DraftFilm) => void }) {
  const { savedFilms } = useDiary();
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<DraftFilm[]>([]);
  const [recent, setRecent] = useState<DraftFilm[]>([]);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  useEffect(() => {
    let active = true;
    const pending = request;
    discoveryService.pulse().then(films => {
      if (active) setRecent(films.slice(0, 6).map(film => ({ id: film.movie_id, title: film.title, poster_path: film.poster_path, release_date: film.release_date })));
    }).catch(() => undefined);
    return () => { active = false; ++pending.current; };
  }, []);

  const search = async (nextPage = 1) => {
    const searchTerm = nextPage === 1 ? query.trim() : term;
    if (!searchTerm || busy) return;
    const version = ++request.current;
    setBusy(true); setError('');
    if (nextPage === 1) { setTerm(searchTerm); setResults([]); setPages(0); }
    try {
      const response = await catalogService.search(searchTerm, nextPage);
      if (version !== request.current) return;
      setResults(current => nextPage === 1 ? response.results : [...new Map([...current, ...response.results].map(film => [film.id, film])).values()]);
      setPage(response.page); setPages(response.total_pages);
    } catch { if (version === request.current) setError('Film search could not be loaded. Try again.'); }
    finally { if (version === request.current) setBusy(false); }
  };
  const row = (film: DraftFilm) => <li key={film.id}><button className="row row--center" style={{ width: '100%', textAlign: 'left' }} type="button" onClick={() => onChoose(film)}>
    <span className="poster poster--xs">{imageUrl(film.poster_path, 'w154') && <img alt="" src={imageUrl(film.poster_path, 'w154')!} />}</span>
    <span className="row__main"><span className="row__title">{film.title}</span><span className="t-caption muted">{releaseYear(film.release_date)}</span></span>
    <span className="sr-only">Choose film</span>
  </button></li>;
  return <section aria-label="Choose a film" className="stack">
    <form className="search" role="search" onSubmit={event => { event.preventDefault(); void search(); }}>
      <input aria-label="Search for a film to log" autoFocus className="input" type="search" placeholder="Film title" value={query} onChange={event => setQuery(event.target.value)} />
      <button className="btn btn--primary" disabled={busy || !query.trim()}>Search</button>
    </form>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {busy && <p className="status" role="status">Searching films</p>}
    {term ? <><ul className="list list--flush">{results.map(row)}</ul>
      {!busy && !results.length && !error && <p className="status">No films found.</p>}
      <div className="actions">{page < pages && <button className="btn btn--secondary" disabled={busy} onClick={() => void search(page + 1)}>Load more films</button>}
        <button className="btn btn--quiet" disabled={busy} onClick={() => { setTerm(''); setQuery(''); setResults([]); }}>Clear search</button></div>
    </> : <>
      {!!savedFilms.length && <section className="section"><header className="section__head"><h2>From your watchlist</h2></header><ul className="list">{savedFilms.slice(0, 6).map(film => row({ ...film, id: film.movie_id, release_date: film.release_date ?? '' }))}</ul></section>}
      {!!recent.length && <section className="section"><header className="section__head"><h2>Recent responses</h2></header><ul className="list">{recent.map(row)}</ul></section>}
    </>}
  </section>;
}
