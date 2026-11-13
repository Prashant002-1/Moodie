import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { catalogService } from '../services/catalogService';
import { suggestionService } from '../services/suggestionService';
import { apiError } from '../services/apiClient';
import type { SuggestionRecipient } from '../types/suggestion';
import type { Movie } from '../types/movie';
import { imageUrl, releaseYear } from '../utils/display';

export default function SendSuggestion() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const movieId = Number(params.get('movieId')) || undefined;
  const sourceEntryId = Number(params.get('sourceEntryId')) || undefined;
  const [film, setFilm] = useState<Movie | null>(null);
  const [films, setFilms] = useState<Movie[]>([]);
  const [filmQuery, setFilmQuery] = useState('');
  const [searchedQuery, setSearchedQuery] = useState('');
  const [filmPage, setFilmPage] = useState(0);
  const [filmPages, setFilmPages] = useState(0);
  const [people, setPeople] = useState<SuggestionRecipient[]>([]);
  const [personQuery, setPersonQuery] = useState(params.get('recipient') ?? '');
  const [recipient, setRecipient] = useState<SuggestionRecipient | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [recipientError, setRecipientError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [finding, setFinding] = useState(false);
  const [loadingPeople, setLoadingPeople] = useState(true);

  useEffect(() => {
    if (!movieId) return;
    let active = true;
    catalogService.movie(movieId).then(next => { if (active) setFilm(next); })
      .catch(error => { if (active) setError(apiError(error, 'This film could not be loaded. Try again.')); });
    return () => { active = false; };
  }, [movieId, revision]);
  useEffect(() => {
    const controller = new AbortController();
    setLoadingPeople(true); setRecipientError('');
    const timer = window.setTimeout(() => {
      suggestionService.recipients(personQuery, controller.signal).then(next => {
        if (controller.signal.aborted) return;
        setPeople(next);
        if (params.get('recipientId')) setRecipient(previous => previous ?? next.find(person => person.id === Number(params.get('recipientId'))) ?? null);
      }).catch(error => { if (!controller.signal.aborted) { setPeople([]); setRecipientError(apiError(error, 'People could not be loaded. Try again.')); } })
        .finally(() => { if (!controller.signal.aborted) setLoadingPeople(false); });
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [personQuery, params, revision]);

  const findFilm = async (page = 1) => {
    const query = page === 1 ? filmQuery.trim() : searchedQuery;
    if (!query || finding) return;
    setFinding(true); setError('');
    try {
      const result = await catalogService.search(query, page);
      setFilms(previous => page === 1 ? result.results : [...new Map([...previous, ...result.results].map(item => [item.id, item])).values()]);
      setFilmPage(result.page); setFilmPages(result.total_pages); setSearchedQuery(query);
    } catch (error) { setError(apiError(error, 'Film search could not be loaded.')); }
    finally { setFinding(false); }
  };
  const send = async () => {
    if (!film || !recipient || !reason.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const result = await suggestionService.create({ origin: 'sent', movieId: film.id, recipientId: recipient.id, reason: reason.trim(),
        ...(sourceEntryId && film.id === movieId ? { sourceEntryId } : {}) });
      navigate(`/suggestions/${result.id}`, { replace: true });
    } catch (error) { setError(apiError(error)); }
    finally { setBusy(false); }
  };

  const poster = imageUrl(film?.poster_path, 'w154');
  return <div className="page page--narrow">
    <header className="page__head"><h1>Recommend a film</h1></header>
    <div className="stack stack--loose">
      {error && <p className="notice notice--error" role="alert">{error} <button className="link" onClick={() => setRevision(value => value + 1)}>Retry loading</button></p>}
      {!film ? <section aria-label="Choose a film" className="stack">
        <form className="search" role="search" onSubmit={event => { event.preventDefault(); void findFilm(); }}><input aria-label="Find a film to recommend" className="input" placeholder="Film title" type="search" value={filmQuery} onChange={event => setFilmQuery(event.target.value)} /><button className="btn btn--secondary" disabled={finding || !filmQuery.trim()}>Find film</button></form>
        {finding && <p className="status" role="status">Searching films</p>}
        {films.length > 0 && <ul className="list list--flush">{films.map(item => <li key={item.id}><button className="row row--center pick" onClick={() => setFilm(item)} type="button">
          <span className="poster poster--xs">{imageUrl(item.poster_path, 'w154') && <img alt="" src={imageUrl(item.poster_path, 'w154')!} />}</span>
          <span className="row__main"><span className="row__title">{item.title}</span>{item.release_date && <span className="t-caption muted">{releaseYear(item.release_date)}</span>}</span>
          <span className="sr-only">Choose</span>
        </button></li>)}</ul>}
        {searchedQuery && !films.length && !finding && <p className="status">No films found.</p>}
        {filmPage < filmPages && <div className="actions"><button className="btn btn--secondary" disabled={finding} onClick={() => void findFilm(filmPage + 1)}>More films</button></div>}
      </section> : <div className="row row--center">
        <Link className="poster poster--sm" tabIndex={-1} to={`/movie/${film.id}`}>{poster && <img alt={`Poster for ${film.title}`} src={poster} />}</Link>
        <div className="row__main"><h2 className="row__title"><Link to={`/movie/${film.id}`}>{film.title}</Link></h2>{film.release_date && <p className="t-caption muted">{releaseYear(film.release_date)}</p>}<p className="t-caption"><button className="link" disabled={busy} onClick={() => setFilm(null)}>Choose another film</button></p></div>
      </div>}
      <form onSubmit={event => { event.preventDefault(); void send(); }}>
        <fieldset className="stack" disabled={busy}>
          <legend className="sr-only">Personal recommendation</legend>
          <div className="field"><label htmlFor="recipient-search">Who is this for?</label><input className="input" id="recipient-search" type="search" maxLength={100} value={personQuery} onChange={event => setPersonQuery(event.target.value)} placeholder="Someone who follows you" /></div>
          {recipient && <p className="byline">For <strong>{recipient.username}</strong> <button type="button" className="link" onClick={() => setRecipient(null)}>Change</button></p>}
          {recipientError && <p className="notice notice--error" role="alert">{recipientError} <button type="button" className="link" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
          {loadingPeople ? <p className="status" role="status">Finding people</p> : !recipient && <>
            {people.length > 0 && <ul className="list list--flush">{people.map(person => <li key={person.id}><button className="row row--center pick" type="button" onClick={() => setRecipient(person)}>
              <span aria-hidden="true" className="avatar">{person.username.charAt(0)}</span>
              <span className="row__main"><strong>{person.username}</strong>{person.bio && <span className="t-caption muted">{person.bio}</span>}</span>
            </button></li>)}</ul>}
            {!people.length && !recipientError && <p className="status">No one found. Recommendations go to people who follow you.</p>}
          </>}
          <div className="field"><label htmlFor="suggestion-reason">Why this film for them?</label><textarea className="textarea" id="suggestion-reason" required maxLength={1000} rows={5} value={reason} onChange={event => setReason(event.target.value)} /></div>
          <div className="actions"><button className="btn btn--primary" disabled={!film || !recipient || !reason.trim() || busy}>{busy ? 'Sending' : 'Send recommendation'}</button><Link className="btn btn--quiet" to={movieId ? `/movie/${movieId}` : '/suggestions'}>Cancel</Link></div>
        </fieldset>
      </form>
    </div>
  </div>;
}
