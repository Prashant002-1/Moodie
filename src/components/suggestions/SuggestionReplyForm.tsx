import { useState } from 'react';
import { FilmSuggestion, Enjoyment, ResponseHighlight } from '../../types/suggestion';
import { ResponseEntry } from '../../services/discoveryService';
import { suggestionService } from '../../services/suggestionService';
import { apiError } from '../../services/apiClient';
import { ResponseDetailInputs, ResponseDetails } from '../diary/ResponseDetails';
import { Feelings } from '../response/Feelings';

export function SuggestionReplyForm({ item, viewing, onSaved, onCancel }: {
  item: FilmSuggestion; viewing: ResponseEntry; onSaved: (item: FilmSuggestion) => void; onCancel: () => void;
}) {
  const [enjoyment, setEnjoyment] = useState<Enjoyment | null>(item.reply?.enjoyment ?? viewing.enjoyment ?? null);
  const [highlights, setHighlights] = useState<ResponseHighlight[]>(item.reply?.highlights ?? viewing.highlights ?? []);
  // The person's diary text and photo are deliberately never used as defaults.
  const [note, setNote] = useState(item.reply?.note ?? '');
  const [shareFeelings, setShareFeelings] = useState(item.reply?.feelings != null);
  const [spoilers, setSpoilers] = useState(item.reply?.contains_spoilers ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    if (!enjoyment || busy) return;
    setBusy(true); setError('');
    try { onSaved(await suggestionService.reply(item.id, { entryId: viewing.id, enjoyment, highlights, note: note.trim(), shareFeelings, containsSpoilers: spoilers })); }
    catch (error) { setError(apiError(error)); }
    finally { setBusy(false); }
  };
  const dirty = note !== (item.reply?.note ?? '') || enjoyment !== (item.reply?.enjoyment ?? viewing.enjoyment ?? null)
    || JSON.stringify(highlights) !== JSON.stringify(item.reply?.highlights ?? viewing.highlights ?? [])
    || shareFeelings !== (item.reply?.feelings != null) || spoilers !== (item.reply?.contains_spoilers ?? false);
  return <form className="composer" onSubmit={event => { event.preventDefault(); void send(); }}>
    <header className="section__head"><h2>For {item.sender_username}</h2></header>
    <fieldset disabled={busy} style={{ gap: 'var(--m-space-5)' }}><legend className="sr-only">Your reply</legend>
      <ResponseDetailInputs enjoyment={enjoyment} highlights={highlights} onEnjoyment={setEnjoyment} onHighlights={setHighlights} required />
      <div className="field"><label htmlFor="reply-note">Tell them what you thought</label><textarea autoFocus className="textarea" id="reply-note" maxLength={1000} rows={5} value={note} onChange={event => setNote(event.target.value)} /><p className="field__hint">This is separate from your diary note.</p></div>
      <div className="actions">
        <label className="check"><input type="checkbox" checked={shareFeelings} onChange={event => setShareFeelings(event.target.checked)} />Include my feelings</label>
        <label className="check"><input type="checkbox" checked={spoilers} onChange={event => setSpoilers(event.target.checked)} />Contains spoilers</label>
      </div>
      <details className="disclosure"><summary>Preview reply</summary><div className="stack stack--tight"><ResponseDetails enjoyment={enjoyment} highlights={highlights} />{note && <p className="note">{note}</p>}{shareFeelings && <Feelings entry={viewing} />}{spoilers && <p className="t-caption muted">Marked as spoilers</p>}</div></details>
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      <div className="actions"><button className="btn btn--primary" disabled={!enjoyment || busy}>{busy ? 'Sending' : item.reply ? 'Update reply' : 'Send reply'}</button><button type="button" className="btn btn--quiet" onClick={() => { if (!dirty || window.confirm('Discard changes to this reply?')) onCancel(); }}>Cancel</button></div>
    </fieldset>
  </form>;
}
