import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { catalogService } from '../services/catalogService';
import { suggestionService } from '../services/suggestionService';
import { apiError } from '../services/apiClient';
import type { FilmSuggestion, SuggestionRecipient } from '../types/suggestion';
import type { Movie } from '../types/movie';
import { imageUrl, releaseYear } from '../utils/display';
import { personHue } from '../utils/person';
import { Avatar } from '../components/common/Avatar';
import { RecommendationNote } from '../components/suggestions/RecommendationNote';
import { usePageTitle } from '../hooks/usePageTitle';

/** Writing a recommendation: a film, a person, and why, with the note they will receive beside it. */
export default function SendSuggestion() {
  const { user } = useUser();
  usePageTitle('Recommend a film');
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
  const [loadingFilm, setLoadingFilm] = useState(Boolean(movieId));

  useEffect(() => {
    if (!movieId) return;
    let active = true;
    setLoadingFilm(true);
    catalogService.movie(movieId).then(next => { if (active) setFilm(next); })
      .catch(error => { if (active) setError(apiError(error, 'This film could not be loaded. Try again.')); })
      .finally(() => { if (active) setLoadingFilm(false); });
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
  // The note exactly as the other person will open it: from you, in your colour, with these words.
  const draft: FilmSuggestion | null = film && user ? {
    id: 0, origin: 'sent', reason, sender_id: user.id, sender_username: user.username, recipient_id: recipient?.id ?? 0, recipient_username: recipient?.username ?? '',
    movie_id: film.id, title: film.title, poster_path: film.poster_path, backdrop_path: film.backdrop_path ?? null, release_date: film.release_date || null,
    created_at: '', updated_at: '', archived: false, status: 'suggested', progress: 'sent', linked_entry_id: null, remind_at: null,
    source_entry_id: null, source_note: null, source_feelings: null, reply: null, message_count: 0, conversation_open: true,
  } : null;
  return <div className="page">
    <header className="page__head"><h1>Recommend a film</h1></header>
    {error && <p className="notice notice--error" role="alert" style={{ marginBottom: 'var(--m-space-5)' }}>{error} <button className="link" onClick={() => setRevision(value => value + 1)}>Retry loading</button></p>}
    {!film ? loadingFilm ? <p className="status" role="status">Loading film</p> : <section aria-label="Choose a film" className="stack">
      <form className="search page--narrow" role="search" onSubmit={event => { event.preventDefault(); void findFilm(); }}><input aria-label="Find a film to recommend" autoFocus className="input" placeholder="Film title" type="search" value={filmQuery} onChange={event => setFilmQuery(event.target.value)} /><button className="btn btn--secondary" disabled={finding || !filmQuery.trim()}>Find film</button></form>
      {finding && <p className="status" role="status">Searching films</p>}
      {films.length > 0 && <ul className="poster-grid">{films.map(item => <li key={item.id}><button className="poster-grid__item tile pick" onClick={() => setFilm(item)} type="button">
        <span className="poster">{imageUrl(item.poster_path, 'w342') && <img alt="" loading="lazy" src={imageUrl(item.poster_path, 'w342')!} />}</span>
        <span className="tile__title">{item.title}</span>
        {item.release_date && <span className="tile__sub">{releaseYear(item.release_date)}</span>}
      </button></li>)}</ul>}
      {searchedQuery && !films.length && !finding && <p className="status">No films found.</p>}
      {filmPage < filmPages && <div className="actions"><button className="btn btn--secondary" disabled={finding} onClick={() => void findFilm(filmPage + 1)}>More films</button></div>}
    </section> : <form className="recommend" onSubmit={event => { event.preventDefault(); void send(); }}>
      <fieldset className="recommend__fields" disabled={busy}>
        <legend className="sr-only">Personal recommendation</legend>
        <div className="row row--center">
          <Link className="poster poster--sm" tabIndex={-1} to={`/movie/${film.id}`}>{poster && <img alt={`Poster for ${film.title}`} src={poster} />}</Link>
          <div className="row__main"><h2 className="row__title"><Link to={`/movie/${film.id}`}>{film.title}</Link>{film.release_date && <> <span className="year">{releaseYear(film.release_date)}</span></>}</h2><p className="t-caption"><button className="link" onClick={() => setFilm(null)} type="button">Choose another film</button></p></div>
        </div>
        <div className="stack">
          {recipient ? <div className="field"><span className="legend">Who is this for?</span>
            <p className="row row--center" data-hue={personHue(recipient.username)}><Avatar to={null} username={recipient.username} /><span className="row__main"><strong className="who">{recipient.username}</strong></span><button className="link t-caption" onClick={() => setRecipient(null)} type="button">Change<span className="sr-only"> person</span></button></p>
          </div> : <>
            <div className="field"><label htmlFor="recipient-search">Who is this for?</label><input className="input" id="recipient-search" type="search" maxLength={100} value={personQuery} onChange={event => setPersonQuery(event.target.value)} placeholder="Someone who follows you" /></div>
            {recipientError && <p className="notice notice--error" role="alert">{recipientError} <button type="button" className="link" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
            {loadingPeople ? <p className="status" role="status">Finding people</p> : <>
              {people.length > 0 && <ul className="people-pick">{people.map(person => <li key={person.id}><button className="person-pick" data-hue={personHue(person.username)} type="button" onClick={() => setRecipient(person)}>
                <Avatar to={null} username={person.username} />
                <span><strong className="who truncate">{person.username}</strong>{person.bio && <span className="t-caption muted truncate"> {person.bio}</span>}</span>
              </button></li>)}</ul>}
              {!people.length && !recipientError && <p className="status">No one found. Recommendations go to people who follow you.</p>}
            </>}
          </>}
        </div>
        <div className="field"><label htmlFor="suggestion-reason">Why this film for them?</label><textarea className="textarea" id="suggestion-reason" required maxLength={1000} rows={5} value={reason} onChange={event => setReason(event.target.value)} /></div>
      </fieldset>
      {draft && <section aria-label="Preview" className="recommend__preview">
        <p className="label">{recipient ? `What ${recipient.username} will receive` : 'What they will receive'}</p>
        <RecommendationNote item={draft} preview viewerId={draft.recipient_id} />
      </section>}
      <div className="recommend__send actions"><button className="btn btn--primary" disabled={!film || !recipient || !reason.trim() || busy}>{busy ? 'Sending' : 'Send recommendation'}</button><Link className="btn btn--quiet" to={movieId ? `/movie/${movieId}` : '/suggestions'}>Cancel</Link></div>
    </form>}
  </div>;
}
