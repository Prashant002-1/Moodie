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
  const row = (film: DraftFilm) => <button className="film-picker__row" key={film.id} type="button" onClick={() => onChoose(film)}>
    {imageUrl(film.poster_path, 'w154') ? <img alt="" src={imageUrl(film.poster_path, 'w154')!} /> : <div className="film-picker__placeholder" />}
    <span><strong>{film.title}</strong><small>{releaseYear(film.release_date)}</small></span><span className="text-link">Choose film</span>
  </button>;
  return <section aria-label="Choose a film">
    <form className="search-bar" role="search" onSubmit={event => { event.preventDefault(); void search(); }}>
      <input aria-label="Search for a film to log" type="search" placeholder="Search by film title" value={query} onChange={event => setQuery(event.target.value)} />
      <button className="button button--primary" disabled={busy || !query.trim()}>Search films</button>
    </form>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {busy && <p role="status">Searching films</p>}
    {term ? <><div className="film-picker">{results.map(row)}</div>
      {!busy && !results.length && !error && <p>No films found. Try another title.</p>}
      {page < pages && <button className="button button--secondary" disabled={busy} onClick={() => void search(page + 1)}>Load more films</button>}
      <button className="button button--quiet" disabled={busy} onClick={() => { setTerm(''); setQuery(''); setResults([]); }}>Clear search</button>
    </> : <div className="log-start-grid">
      {!!savedFilms.length && <section><h2>Saved films</h2><div className="film-picker">{savedFilms.slice(0, 6).map(film => row({ ...film, id: film.movie_id, release_date: film.release_date ?? '' }))}</div></section>}
      {!!recent.length && <section><h2>Recent responses</h2><div className="film-picker">{recent.map(row)}</div></section>}
    </div>}
  </section>;
}
