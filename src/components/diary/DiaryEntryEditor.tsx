import React, { useState } from 'react';
import { FeelingChoices } from './FeelingChoices';
import { DiaryEntry, DiaryEntryChanges, DiaryVisibility } from '../../types/diary';
import { EmotionScores } from '../../types/emotion';
import { Enjoyment, ResponseHighlight } from '../../types/suggestion';
import { ResponseDetailInputs } from './ResponseDetails';

interface DiaryEntryEditorProps {
  entry: Pick<DiaryEntry, 'id' | 'watched_on' | 'note' | 'visibility' | 'expression_image_path' | 'enjoyment' | 'highlights' | keyof EmotionScores>;
  onCancel: () => void;
  onSave: (changes: DiaryEntryChanges) => Promise<void>;
}

const DiaryEntryEditor: React.FC<DiaryEntryEditorProps> = ({ entry, onCancel, onSave }) => {
  const [watchedOn, setWatchedOn] = useState(entry.watched_on.slice(0, 10));
  const [note, setNote] = useState(entry.note);
  const [visibility, setVisibility] = useState<DiaryVisibility>(entry.visibility);
  const [emotions, setEmotions] = useState<EmotionScores>({
    neutral: entry.neutral,
    happy: entry.happy,
    sad: entry.sad,
    angry: entry.angry,
    fearful: entry.fearful,
    disgusted: entry.disgusted,
    surprised: entry.surprised,
  });
  const [removePhoto, setRemovePhoto] = useState(false);
  const [enjoyment, setEnjoyment] = useState<Enjoyment | null>(entry.enjoyment ?? null);
  const [highlights, setHighlights] = useState<ResponseHighlight[]>(entry.highlights ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSave({ watchedOn, note, visibility, emotions, enjoyment, highlights, ...(removePhoto ? { expressionImage: null } : {}) });
    } catch {
      setError('The diary entry could not be updated.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="composer" onSubmit={submit}>
      <FeelingChoices value={emotions} onChange={setEmotions} disabled={saving} />
      <ResponseDetailInputs enjoyment={enjoyment} highlights={highlights} onEnjoyment={setEnjoyment} onHighlights={setHighlights} />
      <div className="field"><label htmlFor={`edit-note-${entry.id}`}>Note</label><textarea className="textarea" id={`edit-note-${entry.id}`} maxLength={2000} onChange={event => setNote(event.target.value)} rows={6} value={note} /></div>
      <div className="composer__row">
        <div className="field"><label htmlFor={`edit-date-${entry.id}`}>Watched on</label><input className="input" id={`edit-date-${entry.id}`} onChange={event => setWatchedOn(event.target.value)} required max={new Date().toLocaleDateString('en-CA')} type="date" value={watchedOn} /></div>
        <fieldset><legend className="legend">Who can see this?</legend><div className="options options--inline">
          <label className="option option--compact"><input checked={visibility === 'private'} name={`visibility-${entry.id}`} onChange={() => setVisibility('private')} type="radio" /><span className="option__title">Only me</span></label>
          <label className="option option--compact"><input checked={visibility === 'public'} name={`visibility-${entry.id}`} onChange={() => setVisibility('public')} type="radio" /><span className="option__title">Everyone</span></label>
        </div></fieldset>
      </div>
      {entry.expression_image_path && <label className="check"><input checked={removePhoto} onChange={event => setRemovePhoto(event.target.checked)} type="checkbox" />Remove attached photo</label>}
      {error && <p className="notice notice--error" role="alert">{error}</p>}
      <div className="composer__save">
        <button className="btn btn--quiet" disabled={saving} onClick={onCancel} type="button">Cancel</button>
        <button className="btn btn--primary" disabled={saving || Object.values(emotions).every(value => value === 0)} type="submit">{saving ? 'Saving changes' : 'Save changes'}</button>
      </div>
    </form>
  );
};

export default DiaryEntryEditor;
