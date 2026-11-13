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
    <form className="diary-editor" onSubmit={submit}>
      <div className="diary-editor__fields">
        <div className="field"><label htmlFor={`edit-date-${entry.id}`}>Watched on</label><input id={`edit-date-${entry.id}`} onChange={event => setWatchedOn(event.target.value)} required max={new Date().toLocaleDateString('en-CA')} type="date" value={watchedOn} /></div>
        <div className="field field--full"><label htmlFor={`edit-note-${entry.id}`}>What did it mean to you?</label><textarea id={`edit-note-${entry.id}`} maxLength={2000} onChange={event => setNote(event.target.value)} value={note} /></div>
        <fieldset className="visibility-control field--full"><legend>Visibility</legend><label><input checked={visibility === 'private'} name={`visibility-${entry.id}`} onChange={() => setVisibility('private')} type="radio" />Private</label><label><input checked={visibility === 'public'} name={`visibility-${entry.id}`} onChange={() => setVisibility('public')} type="radio" />Public</label></fieldset>
      </div>
      {entry.expression_image_path && <label className="auth-check"><input checked={removePhoto} onChange={event => setRemovePhoto(event.target.checked)} type="checkbox" />Remove attached photo</label>}
      <div className="diary-editor__emotions"><FeelingChoices value={emotions} onChange={setEmotions} disabled={saving} /></div>
      <ResponseDetailInputs enjoyment={enjoyment} highlights={highlights} onEnjoyment={setEnjoyment} onHighlights={setHighlights} />
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="diary-editor__actions"><button className="button button--primary" disabled={saving || Object.values(emotions).every(value => value === 0)} type="submit">{saving ? 'Saving changes' : 'Save changes'}</button><button className="button button--quiet" disabled={saving} onClick={onCancel} type="button">Cancel</button></div>
    </form>
  );
};

export default DiaryEntryEditor;
