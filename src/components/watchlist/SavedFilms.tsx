import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDiary } from '../../contexts/DiaryContext';
import { useUser } from '../../contexts/UserContext';
import { usePagedResource } from '../../hooks/usePagedResource';
import { apiError } from '../../services/apiClient';
import { diaryService } from '../../services/diaryService';
import { imageUrl, releaseYear } from '../../utils/display';

/** The films a person saved, one page at a time. */
export function SavedFilms() {
  const { user } = useUser();
  const { revision, unsaveFilm } = useDiary();
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await diaryService.savedPage({ q: term || undefined, limit: 30, offset }, signal);
    return { items: result.films, next: result.nextOffset };
  }, [term]);
  const page = usePagedResource(`${user?.id}:saved:${term}`, load, revision);
  const remove = async (id: number) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await unsaveFilm(id); }
    catch (error) { setError(apiError(error, 'Film could not be removed. Try again.')); }
    finally { setBusy(false); }
  };
  return <section aria-label="Saved films" className="stack">
    <form className="search" role="search" onSubmit={event => { event.preventDefault(); setTerm(query.trim()); }}>
      <input aria-label="Search saved films" className="input" maxLength={200} onChange={event => setQuery(event.target.value)} placeholder="Film title" type="search" value={query} />
      <button className="btn btn--secondary">Search saved</button>
    </form>
    {(error || page.error) && <p className="notice notice--error" role="alert">{error || page.error} <button className="link" onClick={page.refresh}>Refresh saved films</button></p>}
    {page.items.length > 0 && <div className="list list--flush">{page.items.map(film => {
      const poster = imageUrl(film.poster_path, 'w154');
      return <article className="row" key={film.id}>
        <Link className="poster poster--sm" tabIndex={-1} to={`/movie/${film.movie_id}`}>{poster && <img alt={`Poster for ${film.title}`} loading="lazy" src={poster} />}</Link>
        <div className="row__main">
          <h2 className="row__title"><Link to={`/movie/${film.movie_id}`}>{film.title}</Link></h2>
          {film.release_date && <p className="t-caption muted">{releaseYear(film.release_date)}</p>}
          <div className="actions t-caption" style={{ marginTop: 'var(--m-space-1)' }}>
            <Link className="link" to={`/log?movieId=${film.movie_id}`}>Add response</Link>
            <Link className="link" to={`/suggestions?movieId=${film.movie_id}`}>Who recommended it</Link>
            <button className="link" disabled={busy} onClick={() => void remove(film.movie_id)}>Remove from saved</button>
          </div>
        </div>
      </article>;
    })}</div>}
    {page.loading && <p className="status" role="status">Loading saved films</p>}
    {page.loaded && !page.loading && !page.error && !page.items.length && <div className="empty"><p>{term ? 'No saved films match.' : 'No saved films.'}</p>{term ? <button className="link" onClick={() => { setTerm(''); setQuery(''); }}>Clear search</button> : <Link className="link" to="/search">Find a film</Link>}</div>}
    {page.next !== null && <div className="actions"><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore}>More saved films</button></div>}
  </section>;
}
