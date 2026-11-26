import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfirm } from '../hooks/useConfirm';
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
import { DraftFilm, ResponseDraft, draftFromResponse, localDay, newResponseDraft, responseDraftInput, untouchedDraft } from '../types/responseDraft';
import { DiaryEntry } from '../types/diary';
import { FilmSuggestion } from '../types/suggestion';
import { Movie } from '../types/movie';
import { imageUrl, releaseYear } from '../utils/display';
import { prepareExpressionPhoto } from '../utils/expressionPhoto';
import { FilmPicker } from '../components/diary/FilmPicker';
import { FeelingChoices } from '../components/diary/FeelingChoices';
import { AttributionPicker } from '../components/diary/AttributionPicker';
import { ResponseDetailInputs } from '../components/diary/ResponseDetails';
import { RecommendationSpotlight } from '../components/recommendations/RecommendationSpotlight';
import { usePageTitle } from '../hooks/usePageTitle';

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
  const confirm = useConfirm();
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
  // The response exactly as it was opened. Until the person changes it there is nothing to keep.
  const pristine = useRef<ResponseDraft | null>(null);
  const keepable = Boolean(draft) && ((session?.saved != null && !untouchedDraft(session.saved))
    || (draft !== pristine.current && !untouchedDraft(draft!)));
  const auto = useDraftAutosave(session, draft, !savedEntry && !closed.current && keepable);
  const location = useLocation();
  const { movieId, entryId, suggestionId } = request;
  usePageTitle(draft?.editingId ? 'Edit response' : draft?.film ? `Log ${draft.film.title}` : 'Log a film');

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
      // A stored draft with nothing felt or written in it is never resumed or asked about: it is simply replaced.
      const kept = stored && !untouchedDraft(stored.draft) ? stored : null;
      if (kept && (movieId || entryId || suggestionId)) {
        // Recovery stays available even if the newly requested film is offline.
        setChoice({ stored: kept, incoming: null }); setOpening(false);
        const value = await incoming();
        if (active) setChoice(current => current ? { stored: kept, incoming: value } : null);
      } else {
        const value = kept?.draft ?? await incoming();
        if (!active) return;
        if (!kept) pristine.current = value;
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
    if (!(await confirm({ title: 'Discard this draft?', body: 'The response draft on this browser cannot be read. Discarding it cannot be undone.', action: 'Discard' }))) return;
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
      // Back to where the composer was opened from; the diary when it was opened directly.
      if (location.key === 'default') navigate('/diary'); else navigate(-1);
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

  if (opening) return <div className="loading" role="status">Opening your response</div>;
  if (choice) return <section className="page page--narrow stack" aria-labelledby="draft-choice-title">
    <h1 id="draft-choice-title">Continue your draft?</h1>
    <p className="secondary">You have an unfinished response{choice.stored.draft.film ? ` for ${choice.stored.draft.film.title}` : ''}.</p>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    <div className="actions">
      <button className="btn btn--primary" disabled={saving} onClick={resume}>Continue draft</button>
      <button className="btn btn--secondary" disabled={saving || !choice.incoming} onClick={() => void replaceDraft()}>Discard draft and start new</button>
      <Link className="link" to="/diary">Cancel</Link>
    </div>
  </section>;
  if (!draft) return <div className="page page--narrow"><div className="empty"><p role="alert">{error || 'Your response could not be opened.'}</p><div className="actions"><button className="btn btn--secondary" disabled={saving} onClick={() => setRevision(value => value + 1)}>Try again</button>{unreadable && <button className="btn btn--quiet" disabled={saving} onClick={() => void discardUnreadable()}>Discard unreadable draft</button>}<Link className="link" to="/diary">Open Diary</Link></div></div></div>;

  const chosenPoster = imageUrl(draft.film?.poster_path, 'w500');
  if (savedEntry) return <div className="page page--narrow stack stack--loose">
    <section className="row">
      {draft.film && <span className="poster poster--lg">{chosenPoster && <img alt={`Poster for ${draft.film.title}`} src={chosenPoster} />}</span>}
      <div className="row__main stack">
        <h1>{savedEntry.title ?? draft.film?.title}</h1>
        <p className="secondary">In your diary. {savedEntry.visibility === 'public' ? 'Everyone can see it.' : 'Only you can see it.'}</p>
        <div className="actions">
          {draft.suggestionId && <Link className="btn btn--primary" to={`/suggestions/${draft.suggestionId}`}>Reply to {draft.suggestionName || 'them'}</Link>}
          <Link className={`btn ${draft.suggestionId ? 'btn--secondary' : 'btn--primary'}`} to={`/response/${savedEntry.id}`}>Read your response</Link>
          <Link className="btn btn--quiet" to="/diary">Open Diary</Link>
          <button className="btn btn--quiet" onClick={() => navigate('/log', { replace: true, state: { newDraft: crypto.randomUUID() } })}>Add another film</button>
        </div>
        {draft.suggestionId && <p className="hint">Your diary note has not been sent. Your reply is written separately.</p>}
      </div>
    </section>
    {storageError && <p className="notice notice--error" role="alert">{storageError} <button className="link" onClick={() => void clearSavedDraft()}>Clear saved draft</button></p>}
    {discoveryLoading && <p className="status" role="status">Loading</p>}
    {discoveryError && <p className="status" role="alert">{discoveryError} <button className="link" onClick={() => void findNextFilm()}>Retry recommendations</button></p>}
    {nextFilm && <section><header className="section__head"><h2>Through this film</h2></header><div className="list"><RecommendationSpotlight movie={nextFilm} /></div></section>}
  </div>;

  return <div className="page">
    <header className="page__head page__head--bar">
      <div><h1>{draft.editingId ? 'Edit response' : 'Log a film'}</h1>
        <p className="t-caption muted" role="status">{!keepable ? '' : auto.error ? 'Draft not saved' : auto.saved ? 'Draft saved' : 'Saving draft'}</p></div>
      {/* With nothing written there is nothing to ask about: Close just closes. */}
      <button className="btn btn--quiet btn--small" disabled={saving || photoPreparing} onClick={() => { if (keepable) setCloseChoice(true); else void close(false); }}>Close</button>
    </header>
    {(error || auto.error) && <p className="notice notice--error" role="alert" style={{ marginBottom: 'var(--m-space-5)' }}>{error || auto.error}{auto.error && <> <button className="link" onClick={() => void auto.persist().catch(() => undefined)}>Retry draft save</button></>}</p>}
    {closeChoice && <section className="well stack" aria-label="Close your response" style={{ marginBottom: 'var(--m-space-5)' }}>
      <p className="strong">Keep this draft?</p><div className="actions">
        <button className="btn btn--primary btn--small" disabled={saving} onClick={() => void close(true)}>Keep draft</button>
        <button className="btn btn--secondary btn--small" disabled={saving} onClick={() => void close(false)}>Discard changes</button>
        <button className="btn btn--quiet btn--small" disabled={saving} onClick={() => setCloseChoice(false)}>Keep writing</button>
      </div>
    </section>}
    {!draft.film || choosingFilm ? <>
      {draft.film && <p style={{ marginBottom: 'var(--m-space-4)' }}><button className="link" onClick={() => setChoosingFilm(false)}>Keep {draft.film.title}</button></p>}
      <FilmPicker onChoose={chooseFilm} />
    </> : <form className="compose" onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="compose__film">
        <span className="poster poster--xl">{chosenPoster && <img alt={`Poster for ${draft.film.title}`} src={chosenPoster} />}</span>
        <div className="stack stack--tight">
          <div className="compose__name"><h2>{draft.film.title}</h2>{draft.film.release_date && <> <span className="year">{releaseYear(draft.film.release_date)}</span></>}</div>
          {!draft.editingId && <p><button className="link t-callout" disabled={saving || photoPreparing} onClick={() => setChoosingFilm(true)} type="button">Choose another film</button></p>}
        </div>
      </div>
      <fieldset className="composer" disabled={saving || photoPreparing}>
        <legend className="sr-only">Your response to {draft.film.title}</legend>
        {!draft.editingId && <AttributionPicker ownerId={ownerId} movieId={draft.film.id} value={draft.suggestionId} name={draft.suggestionName} onChange={chooseAttribution} />}
        <FeelingChoices value={draft.emotions} onChange={emotions => update({ emotions })} />
        <ResponseDetailInputs enjoyment={draft.enjoyment} highlights={draft.highlights} onEnjoyment={enjoyment => update({ enjoyment })} onHighlights={highlights => update({ highlights })} />
        <div className="field"><label htmlFor="entry-note">Note</label><textarea className="textarea" id="entry-note" maxLength={2000} rows={6} value={draft.note} onChange={event => update({ note: event.target.value })} />{draft.note.length > 1800 && <span className="field__hint">{draft.note.length} / 2000</span>}</div>
        <div className="composer__row">
          <div className="field"><label htmlFor="watched-on">Watched on</label><input className="input" id="watched-on" required max={localDay()} type="date" value={draft.watchedOn} onChange={event => update({ watchedOn: event.target.value })} /></div>
          <fieldset><legend className="legend">Who can see this?</legend><div className="options options--inline">
            <label className="option option--compact"><input type="radio" name="visibility" checked={draft.visibility === 'private'} onChange={() => update({ visibility: 'private' })} /><span className="option__title">Only me</span></label>
            <label className="option option--compact"><input type="radio" name="visibility" checked={draft.visibility === 'public'} onChange={() => update({ visibility: 'public' })} /><span className="option__title">Everyone</span></label>
          </div></fieldset>
        </div>
        <details className="disclosure"><summary>Add a photo</summary>
          {draft.expressionImage ? <figure className="photo-preview"><img alt="Photo preview" src={draft.expressionImage} /><button aria-label="Remove attached photo" className="btn btn--icon" type="button" onClick={() => update({ expressionImage: null })}><X size={18} /></button></figure>
            : <label className="btn btn--secondary btn--small"><ImagePlus aria-hidden="true" size={16} /><span>Choose a photo</span><input accept="image/jpeg,image/png,image/webp" className="sr-only" type="file" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void choosePhoto(file); }} /></label>}
        </details>
        <div className="composer__save">
          <span className="hint">{!Object.values(draft.emotions).some(value => value > 0) ? 'Choose at least one feeling to save.'
            : !draft.watchedOn || draft.watchedOn > localDay() ? 'Choose a date that is not in the future.'
            : draft.suggestionId ? `Your reply to ${draft.suggestionName || 'them'} is written separately, after saving.` : ''}</span>
          <button className="btn btn--primary" disabled={!responseDraftInput(draft) || saving || photoPreparing}>{saving ? 'Saving response' : draft.editingId ? 'Save changes' : 'Save response'}</button>
        </div>
      </fieldset>
    </form>}
  </div>;
}
