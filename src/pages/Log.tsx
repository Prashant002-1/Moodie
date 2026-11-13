import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { catalogService } from '../services/catalogService';
import { discoveryService } from '../services/discoveryService';
import { suggestionService } from '../services/suggestionService';
import { recommendationService } from '../services/recommendationService';
import { apiError } from '../services/apiClient';
import { DraftUnreadable, ResponseDraftSession, responseDraftStore, StoredResponseDraft } from '../services/responseDraftStore';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { DraftFilm, ResponseDraft, draftFromResponse, localDay, newResponseDraft, responseDraftInput } from '../types/responseDraft';
import { DiaryEntry } from '../types/diary';
import { FilmSuggestion } from '../types/suggestion';
import { Movie } from '../types/movie';
import { imageUrl, releaseYear } from '../utils/display';
import { prepareExpressionPhoto } from '../utils/expressionPhoto';
import { FilmPicker } from '../components/diary/FilmPicker';
import { FeelingChoices } from '../components/diary/FeelingChoices';
import { AttributionPicker } from '../components/diary/AttributionPicker';
import { ResponseDetailInputs, ResponseDetails } from '../components/diary/ResponseDetails';
import { RecommendationSpotlight } from '../components/recommendations/RecommendationSpotlight';

interface ComposerRequest { movieId?: number; entryId?: number; suggestionId?: number }
interface DraftChoice { stored: StoredResponseDraft; incoming: ResponseDraft | null }

export default function Log() {
  const { user } = useUser();
  const [params] = useSearchParams();
  const location = useLocation();
  if (!user) return null;
  return <ResponseComposer key={`${user.id}:${location.key}`} ownerId={user.id} request={{
    movieId: Number(params.get('movieId')) || undefined,
    entryId: Number(params.get('entryId')) || undefined,
    suggestionId: Number(params.get('suggestionId')) || undefined,
  }} />;
}

function ResponseComposer({ ownerId, request }: { ownerId: number; request: ComposerRequest }) {
  const navigate = useNavigate();
  const { createEntry, updateEntry } = useDiary();
  const [draft, setDraft] = useState<ResponseDraft | null>(null);
  const [session, setSession] = useState<ResponseDraftSession | null>(null);
  const [choice, setChoice] = useState<DraftChoice | null>(null);
  const [revision, setRevision] = useState(0);
  const [opening, setOpening] = useState(true);
  const [choosingFilm, setChoosingFilm] = useState(false);
  const [closeChoice, setCloseChoice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoPreparing, setPhotoPreparing] = useState(false);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [unreadable, setUnreadable] = useState<DraftUnreadable | null>(null);
  const [savedEntry, setSavedEntry] = useState<DiaryEntry | null>(null);
  const [nextFilm, setNextFilm] = useState<Movie | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState('');
  const closed = useRef(false);
  const resumed = useRef(false);
  const mounted = useRef(true);
  const auto = useDraftAutosave(session, draft, !savedEntry && !closed.current);
  const { movieId, entryId, suggestionId } = request;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setOpening(true); setError(''); setUnreadable(null); resumed.current = false;
    const incoming = async () => {
      if (entryId) {
        const entry = await discoveryService.response(entryId, controller.signal);
        if (entry.user_id !== ownerId) throw new Error('Only your own responses can be edited.');
        return draftFromResponse(entry);
      }
      const film = movieId ? await catalogService.movie(movieId) : null;
      const value = newResponseDraft(film ? { id: film.id, title: film.title, poster_path: film.poster_path ?? null, release_date: film.release_date ?? '' } : null);
      if (suggestionId) {
        const suggestion = await suggestionService.get(suggestionId, controller.signal);
        if (suggestion.recipient_id !== ownerId || suggestion.movie_id !== film?.id) throw new Error('This recommendation does not match your viewing.');
        value.suggestionId = suggestion.id;
        value.suggestionName = suggestion.sender_username;
      }
      return value;
    };
    const open = async () => {
      const stored = await responseDraftStore.read(ownerId);
      if (!active) return;
      if (stored && (movieId || entryId || suggestionId)) {
        // Recovery stays available even if the newly requested film is offline.
        setChoice({ stored, incoming: null }); setOpening(false);
        const value = await incoming();
        if (active) setChoice(current => current ? { stored, incoming: value } : null);
      } else {
        const value = stored?.draft ?? await incoming();
        if (!active) return;
        setDraft(value);
        setSession(new ResponseDraftSession(ownerId, stored?.revision ?? null, stored?.draft ?? null));
      }
    };
    open().catch(error => {
      if (active && !resumed.current) {
        setError(apiError(error, error instanceof Error ? error.message : 'Your response could not be opened.'));
        if (error instanceof DraftUnreadable) setUnreadable(error);
      }
    }).finally(() => { if (active) setOpening(false); });
    return () => { active = false; controller.abort(); };
  }, [ownerId, movieId, entryId, suggestionId, revision]);

  const update = useCallback((changes: Partial<ResponseDraft>) => setDraft(current => current ? { ...current, ...changes } : current), []);
  const chooseAttribution = useCallback((item: FilmSuggestion | null) => update({ suggestionId: item?.id, suggestionName: item?.sender_username }), [update]);
  const chooseFilm = (film: DraftFilm) => {
    update({ film: { ...film, poster_path: film.poster_path ?? null, release_date: film.release_date ?? '' }, suggestionId: undefined, suggestionName: undefined });
    setChoosingFilm(false);
  };

  const resume = () => {
    if (!choice) return;
    resumed.current = true; setError('');
    setSession(new ResponseDraftSession(ownerId, choice.stored.revision, choice.stored.draft));
    setDraft(choice.stored.draft); setChoice(null);
  };
  const discardUnreadable = async () => {
    if (!unreadable || saving) return;
    if (!window.confirm('Discard the unreadable response draft on this browser? This cannot be undone.')) return;
    setSaving(true);
    try { await responseDraftStore.replace(ownerId, unreadable.revision, null); setRevision(value => value + 1); }
    catch (error) { setError(error instanceof Error ? error.message : 'The draft could not be cleared.'); }
    finally { setSaving(false); }
  };
  const replaceDraft = async () => {
    if (!choice?.incoming || saving) return;
    setSaving(true); setError('');
    try {
      const nextSession = new ResponseDraftSession(ownerId, choice.stored.revision, choice.stored.draft);
      await nextSession.save(choice.incoming);
      setSession(nextSession); setDraft(choice.incoming); setChoice(null);
    } catch (error) { setError(error instanceof Error ? error.message : 'Your draft could not be replaced.'); }
    finally { setSaving(false); }
  };
  const close = async (keep: boolean) => {
    if (!session || !draft || saving) return;
    setSaving(true); setError('');
    try {
      if (keep) await session.save(draft); else await session.finish();
      closed.current = true;
      navigate('/diary');
    } catch (error) { setError(error instanceof Error ? error.message : 'Your draft could not be updated.'); }
    finally { setSaving(false); }
  };

  const choosePhoto = async (file?: File) => {
    if (!file) return;
    setPhotoPreparing(true); setError('');
    try {
      const prepared = await prepareExpressionPhoto(file);
      if (prepared.length > 2_800_000) throw new Error('Choose a smaller photo.');
      if (mounted.current) update({ expressionImage: prepared });
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : 'The image could not be prepared.'); }
    finally { if (mounted.current) setPhotoPreparing(false); }
  };

  const findNextFilm = async () => {
    setDiscoveryLoading(true); setDiscoveryError('');
    try {
      const result = await recommendationService.get();
      if (mounted.current) setNextFilm(result.forYou.find(movie => movie.recommended_by?.length) ?? null);
    } catch { if (mounted.current) setDiscoveryError('Your response is saved. Recommendations could not be loaded.'); }
    finally { if (mounted.current) setDiscoveryLoading(false); }
  };
  const clearSavedDraft = async () => {
    try { await session?.finish(); setStorageError(''); }
    catch { setStorageError('Your response is saved, but the local draft could not be cleared.'); }
  };
  const save = async () => {
    const input = draft && responseDraftInput(draft);
    if (!draft || !session || !input || saving || photoPreparing) return;
    setSaving(true); setError('');
    try {
      // Durably record the same request ID and payload before sending a create.
      await session.save(draft);
      const { watchedOn, note, visibility, emotions, enjoyment, highlights, expressionImage } = input;
      const entry = draft.editingId
        ? await updateEntry(draft.editingId, { watchedOn, note, visibility, emotions, enjoyment, highlights, expressionImage })
        : await createEntry(input);
      closed.current = true;
      if (!mounted.current) { await session.finish().catch(() => undefined); return; }
      setSavedEntry(entry);
      await clearSavedDraft();
      if (!draft.editingId && !draft.suggestionId) void findNextFilm();
    } catch (error) {
      if (mounted.current) setError(apiError(error, error instanceof Error && /draft|tab|storage/i.test(error.message) ? error.message : 'The diary entry could not be saved. Try again.'));
    } finally { if (mounted.current) setSaving(false); }
  };

  if (opening) return <div className="page-shell loading-state" role="status">Opening your response</div>;
  if (choice) return <section className="page-shell draft-choice" aria-labelledby="draft-choice-title">
    <h1 id="draft-choice-title">Continue your saved response?</h1>
    <p>You have an unfinished response{choice.stored.draft.film ? ` for ${choice.stored.draft.film.title}` : ''}.</p>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    <div className="suggestion-actions">
      <button className="button button--primary" disabled={saving} onClick={resume}>Continue draft</button>
      <button className="button button--secondary" disabled={saving || !choice.incoming} onClick={() => void replaceDraft()}>Discard draft and start new</button>
      <Link className="text-link" to="/diary">Cancel</Link>
    </div>
  </section>;
  if (!draft) return <div className="page-shell product-empty"><p role="alert">{error || 'Your response could not be opened.'}</p><button className="button button--secondary" disabled={saving} onClick={() => setRevision(value => value + 1)}>Try again</button>{unreadable && <button className="button button--quiet" disabled={saving} onClick={() => void discardUnreadable()}>Discard unreadable draft</button>}<Link className="text-link" to="/diary">Open Diary</Link></div>;

  if (savedEntry) return <div className="page-shell completion-journey">
    <section className="completion-journey__saved">
      <p><strong>{savedEntry.title ?? draft.film?.title}</strong> is in your diary.</p>
      <p className="metadata">{savedEntry.visibility === 'public' ? 'Shared with everyone' : 'Only you can see this response'}</p>
      <ResponseDetails enjoyment={savedEntry.enjoyment} highlights={savedEntry.highlights} />
      <div className="suggestion-actions">
        {draft.suggestionId && <Link className="button button--primary" to={`/suggestions/${draft.suggestionId}`}>Tell {draft.suggestionName || 'them'} how it landed</Link>}
        <Link className="button button--secondary" to={`/response/${savedEntry.id}`}>Read your response</Link>
        <Link className="text-link" to="/diary">Open Diary</Link>
      </div>
      {draft.suggestionId && <p className="metadata">Your diary note has not been sent. Choose what to share in a separate reply.</p>}
    </section>
    {storageError && <p className="notice notice--error" role="alert">{storageError} <button className="text-link" onClick={() => void clearSavedDraft()}>Clear saved draft</button></p>}
    {discoveryLoading && <p role="status">Finding a film through your response</p>}
    {discoveryError && <p role="alert">{discoveryError} <button className="text-link" onClick={() => void findNextFilm()}>Retry recommendations</button></p>}
    {nextFilm && <RecommendationSpotlight movie={nextFilm} />}
    <div className="completion-state__actions"><Link className="button button--secondary" to="/feed">Return home</Link><button className="button button--quiet" onClick={() => navigate('/log', { replace: true, state: { newDraft: crypto.randomUUID() } })}>Add another film</button></div>
  </div>;

  return <div className="page-shell log-page">
    <header className="composer-toolbar">
      <div><h1>{draft.editingId ? 'Edit response' : 'Add a response'}</h1><p className="metadata" role="status">{auto.error ? 'Draft not saved on this browser' : auto.saved ? 'Draft saved on this browser' : 'Saving draft'}</p></div>
      <button className="button button--quiet" disabled={saving || photoPreparing} onClick={() => setCloseChoice(true)}>Close</button>
    </header>
    {(error || auto.error) && <p className="notice notice--error" role="alert">{error || auto.error}{auto.error && <button className="text-link" onClick={() => void auto.persist().catch(() => undefined)}>Retry draft save</button>}</p>}
    {closeChoice && <section className="draft-choice" aria-label="Close your response">
      <h2>Keep writing later?</h2><div className="suggestion-actions">
        <button className="button button--primary" disabled={saving} onClick={() => void close(true)}>Keep draft</button>
        <button className="button button--quiet" disabled={saving} onClick={() => void close(false)}>Discard changes</button>
        <button className="button button--quiet" disabled={saving} onClick={() => setCloseChoice(false)}>Keep writing</button>
      </div>
    </section>}
    {!draft.film || choosingFilm ? <>
      {draft.film && <button className="text-link" onClick={() => setChoosingFilm(false)}>Keep {draft.film.title}</button>}
      <FilmPicker onChoose={chooseFilm} />
    </> : <form className="entry-composer" onSubmit={event => { event.preventDefault(); void save(); }}>
      <aside className="entry-composer__film">
        {imageUrl(draft.film.poster_path, 'w342') && <img alt={`Poster for ${draft.film.title}`} src={imageUrl(draft.film.poster_path, 'w342')!} />}
        <div><h2>{draft.film.title}</h2><p>{releaseYear(draft.film.release_date)}</p></div>
        {!draft.editingId && <button className="button button--quiet" disabled={saving || photoPreparing} onClick={() => setChoosingFilm(true)} type="button">Choose another film</button>}
      </aside>
      <fieldset className="entry-composer__record composer-record" disabled={saving || photoPreparing}>
        <legend className="sr-only">Your response to {draft.film.title}</legend>
        {!draft.editingId && <AttributionPicker ownerId={ownerId} movieId={draft.film.id} value={draft.suggestionId} name={draft.suggestionName} onChange={chooseAttribution} />}
        <div className="field"><label htmlFor="entry-note">What did it mean to you?</label><textarea id="entry-note" maxLength={2000} rows={6} value={draft.note} placeholder="What will you remember?" onChange={event => update({ note: event.target.value })} /><span className="field__hint">{draft.note.length} / 2000</span></div>
        <FeelingChoices value={draft.emotions} onChange={emotions => update({ emotions })} />
        <ResponseDetailInputs enjoyment={draft.enjoyment} highlights={draft.highlights} onEnjoyment={enjoyment => update({ enjoyment })} onHighlights={highlights => update({ highlights })} />
        <div className="entry-fields">
          <div className="field"><label htmlFor="watched-on">Watched on</label><input id="watched-on" required max={localDay()} type="date" value={draft.watchedOn} onChange={event => update({ watchedOn: event.target.value })} /></div>
          <fieldset className="visibility-control field--full"><legend>Who can see this?</legend>
            <label><input type="radio" name="visibility" checked={draft.visibility === 'private'} onChange={() => update({ visibility: 'private' })} />Only me</label>
            <label><input type="radio" name="visibility" checked={draft.visibility === 'public'} onChange={() => update({ visibility: 'public' })} />Everyone</label>
          </fieldset>
          <details className="field--full"><summary>Add a photo <small>Optional</small></summary>
            {draft.expressionImage ? <figure className="expression-photo-preview"><img alt="Optional expression photo preview" src={draft.expressionImage} /><button aria-label="Remove attached photo" className="icon-button" type="button" onClick={() => update({ expressionImage: null })}><X size={18} /></button></figure>
              : <label className="expression-photo-picker"><ImagePlus aria-hidden="true" size={22} /><span>Choose a photo</span><input accept="image/jpeg,image/png,image/webp" className="sr-only" type="file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void choosePhoto(file); }} /></label>}
          </details>
        </div>
        {draft.suggestionId && <p className="metadata">After saving, you can choose a separate reply for {draft.suggestionName || 'the person who recommended it'}.</p>}
        <button className="button button--primary" disabled={!responseDraftInput(draft) || saving || photoPreparing}>{saving ? 'Saving response' : draft.editingId ? 'Save changes' : 'Save response'}</button>
      </fieldset>
    </form>}
  </div>;
}
