import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { catalogService } from '../services/catalogService';
import { suggestionService } from '../services/suggestionService';
import { apiError } from '../services/apiClient';
import type { SuggestionRecipient } from '../types/suggestion';
import type { Movie } from '../types/movie';
import { imageUrl } from '../utils/display';
import '../components/suggestions/Suggestions.css';

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

  return <div className="page-shell suggestions-page suggestion-writing">
    <Link className="text-link" to={movieId ? `/movie/${movieId}` : '/suggestions'}>Back</Link>
    <h1>Recommend a film</h1>
    {error && <p className="notice notice--error" role="alert">{error} <button className="text-link" onClick={() => setRevision(value => value + 1)}>Retry loading</button></p>}
    {!film ? <section>
      <form className="search-bar" role="search" onSubmit={event => { event.preventDefault(); void findFilm(); }}><input aria-label="Find a film to recommend" type="search" value={filmQuery} onChange={event => setFilmQuery(event.target.value)} /><button className="button button--secondary" disabled={finding || !filmQuery.trim()}>Find film</button></form>
      <div className="film-picker">{films.map(item => <button className="film-picker__row" key={item.id} onClick={() => setFilm(item)}><span><strong>{item.title}</strong></span><span>Choose</span></button>)}</div>
      {searchedQuery && !films.length && !finding && <p>No films found.</p>}
      {filmPage < filmPages && <button className="button button--quiet" disabled={finding} onClick={() => void findFilm(filmPage + 1)}>More films</button>}
    </section> : <div className="suggestion-film"><div><Link to={`/movie/${film.id}`}><h2>{film.title}</h2></Link><button className="text-link" disabled={busy} onClick={() => setFilm(null)}>Choose another film</button></div>{imageUrl(film.poster_path, 'w154') && <img alt="" src={imageUrl(film.poster_path, 'w154')!} />}</div>}
    <form onSubmit={event => { event.preventDefault(); void send(); }}>
      <fieldset disabled={busy} className="suggestion-form-fields">
        <legend className="sr-only">Personal recommendation</legend>
        <div className="field"><label htmlFor="recipient-search">Who is this for?</label><input id="recipient-search" type="search" maxLength={100} value={personQuery} onChange={event => setPersonQuery(event.target.value)} placeholder="Find someone who follows you" /></div>
        {recipient && <p className="suggestion-selected-person">For <strong>{recipient.username}</strong> <button type="button" className="text-link" onClick={() => setRecipient(null)}>Change</button></p>}
        {recipientError && <p role="alert">{recipientError} <button type="button" className="text-link" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
        {loadingPeople ? <p role="status">Finding people</p> : !recipient && <div className="recipient-list">{people.map(person => <button key={person.id} type="button" onClick={() => setRecipient(person)}><strong>{person.username}</strong>{person.bio && <span>{person.bio}</span>}</button>)}{!people.length && !recipientError && <p>No eligible people found. Recommendations can go to people who follow you.</p>}</div>}
        <div className="field"><label htmlFor="suggestion-reason">Why this film for them?</label><textarea id="suggestion-reason" required maxLength={1000} rows={5} value={reason} onChange={event => setReason(event.target.value)} placeholder="Something I think you’ll connect with…" /></div>
        <button className="button button--primary" disabled={!film || !recipient || !reason.trim() || busy}>{busy ? 'Sending' : 'Send recommendation'}</button>
      </fieldset>
    </form>
  </div>;
}
