import { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiError } from '../../services/apiClient';
import { pathService, StarterFilm } from '../../services/pathService';
import { releaseYear } from '../../utils/display';

/** Films the person said were not for them, so a slip can be taken back. Read only when opened. */
export function SetAside() {
  const [films, setFilms] = useState<StarterFilm[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    if (films || busy) return;
    setBusy(true); setError('');
    try { setFilms(await pathService.hidden()); }
    catch (caught) { setError(apiError(caught, 'These films could not be loaded.')); }
    finally { setBusy(false); }
  };
  const restore = async (film: StarterFilm) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await pathService.unhide(film.id); setFilms(current => current?.filter(item => item.id !== film.id) ?? null); }
    catch (caught) { setError(apiError(caught, 'That could not be saved. Try again.')); }
    finally { setBusy(false); }
  };
  return <details className="disclosure" onToggle={event => { if (event.currentTarget.open) void load(); }}>
    <summary>Films you set aside</summary>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {busy && !films && <p className="status" role="status">Loading</p>}
    {films && !films.length && <p className="status" style={{ textAlign: 'left', padding: 0 }}>None.</p>}
    {films && films.length > 0 && <ul className="intros" style={{ marginTop: 'var(--m-space-3)' }}>{films.map(film => <li className="intro" key={film.id}>
      <p className="intro__main"><Link className="film-inline" to={`/movie/${film.id}`}>{film.title}</Link>{film.release_date && <span className="t-caption muted">{releaseYear(film.release_date)}</span>}</p>
      <button aria-label={`Offer ${film.title} again`} className="btn btn--quiet btn--small" disabled={busy} onClick={() => void restore(film)} type="button">Offer again</button>
    </li>)}</ul>}
  </details>;
}
