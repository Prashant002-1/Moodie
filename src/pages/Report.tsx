import { FormEvent, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useDiary } from '../contexts/DiaryContext';
import { useUser } from '../contexts/UserContext';
import { apiError } from '../services/apiClient';
import { ReportInput, reportReasons, safetyService } from '../services/safetyService';
import './Auth.css';

export default function Report() {
  const { kind, id } = useParams();
  const [params] = useSearchParams();
  const { user } = useUser();
  const personId = Number(params.get('personId'));
  if (!['response', 'comment', 'person'].includes(kind ?? '') || !Number.isSafeInteger(Number(id)) || Number(id) <= 0 || !Number.isSafeInteger(personId) || personId <= 0 || personId === user?.id) {
    return <section className="page-shell"><h1>Report unavailable</h1><Link to="/feed">Return to Home</Link></section>;
  }
  return <ReportForm key={`${user?.id}:${kind}:${id}:${personId}`} kind={kind as ReportInput['targetKind']} targetId={Number(id)} personId={personId} username={params.get('username') || 'this person'} />;
}

function ReportForm({ kind, targetId, personId, username }: { kind: ReportInput['targetKind']; targetId: number; personId: number; username: string }) {
  const { refresh } = useDiary();
  const [reason, setReason] = useState<ReportInput['reason']>('Harassment');
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [sent, setSent] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const block = async () => {
    await safetyService.block(personId);
    setBlocked(true); void refresh();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      await safetyService.report({ targetKind: kind, targetId, reason, details });
      setSent(true);
      if (alsoBlock) {
        try { await block(); }
        catch (caught) { setError(apiError(caught, 'Your report was received, but the block could not be saved.')); }
      }
    } catch (caught) { setError(apiError(caught, 'Your report could not be sent. Try again.')); }
    finally { setBusy(false); }
  };
  return <section className="page-shell account-page"><h1>{sent ? 'Report received' : `Report ${kind}`}</h1>
    {sent ? <div className="account-form">
      <p role="status">Your report has been added to the moderation queue.</p>
      {blocked && <p>{username} is blocked. Follows between you have been removed.</p>}
      {alsoBlock && !blocked && <button className="button button--secondary" disabled={busy} onClick={() => {
        if (busy) return; setBusy(true); setError('');
        void block().catch(caught => setError(apiError(caught, 'The block could not be saved. Try again.'))).finally(() => setBusy(false));
      }}>{busy ? 'Blocking' : 'Retry block'}</button>}
      <Link className="text-link" to={blocked ? '/account/blocked' : '/feed'}>Done</Link>
    </div> : <form className="account-form" onSubmit={event => void submit(event)}>
      <p>Your report is private. Please avoid sensitive personal information.</p>
      <label className="field">Reason<select value={reason} disabled={busy} onChange={event => setReason(event.target.value as ReportInput['reason'])}>{reportReasons.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="field">Anything else we should know?<textarea maxLength={1000} disabled={busy} value={details} onChange={event => setDetails(event.target.value)} rows={5} /></label>
      <label className="auth-check"><input type="checkbox" checked={alsoBlock} disabled={busy} onChange={event => setAlsoBlock(event.target.checked)} />Also block {username}</label>
      {alsoBlock && <p>Blocking removes follows between you and prevents further interaction.</p>}
      <button className="button button--primary" disabled={busy}>{busy ? 'Sending' : 'Send report'}</button>
      <Link className="text-link" to="/feed">Cancel</Link>
    </form>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
