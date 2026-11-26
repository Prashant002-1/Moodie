import { FormEvent, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useDiary } from '../contexts/DiaryContext';
import { useUser } from '../contexts/UserContext';
import { apiError } from '../services/apiClient';
import { ReportInput, reportReasons, safetyService } from '../services/safetyService';
import { usePageTitle } from '../hooks/usePageTitle';

export default function Report() {
  const { kind, id } = useParams();
  const [params] = useSearchParams();
  const { user } = useUser();
  usePageTitle('Report');
  const personId = Number(params.get('personId'));
  if (!['response', 'comment', 'person'].includes(kind ?? '') || !Number.isSafeInteger(Number(id)) || Number(id) <= 0 || !Number.isSafeInteger(personId) || personId <= 0 || personId === user?.id) {
    return <section className="page page--narrow"><div className="empty"><h1>Report unavailable</h1><Link className="link" to="/feed">Home</Link></div></section>;
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
  return <section className="page page--form stack"><h1>{sent ? 'Report received' : `Report ${kind}`}</h1>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {sent ? <>
      <p role="status">Your report has been added to the moderation queue.</p>
      {blocked && <p>{username} is blocked. Follows between you have been removed.</p>}
      <div className="actions">
        {alsoBlock && !blocked && <button className="btn btn--secondary" disabled={busy} onClick={() => {
          if (busy) return; setBusy(true); setError('');
          void block().catch(caught => setError(apiError(caught, 'The block could not be saved. Try again.'))).finally(() => setBusy(false));
        }}>{busy ? 'Blocking' : 'Retry block'}</button>}
        <Link className="link" to={blocked ? '/account/blocked' : '/feed'}>Done</Link>
      </div>
    </> : <form className="stack" onSubmit={event => void submit(event)}>
      <div className="field"><label htmlFor="report-reason">Reason</label><select className="select" id="report-reason" value={reason} disabled={busy} onChange={event => setReason(event.target.value as ReportInput['reason'])}>{reportReasons.map(item => <option key={item}>{item}</option>)}</select></div>
      <div className="field"><label htmlFor="report-details">Details</label><textarea aria-describedby="report-details-hint" className="textarea" id="report-details" maxLength={1000} disabled={busy} value={details} onChange={event => setDetails(event.target.value)} rows={5} /><span className="field__hint" id="report-details-hint">Your report is private. Please avoid sensitive personal information.</span></div>
      <label className="check"><input type="checkbox" checked={alsoBlock} disabled={busy} onChange={event => setAlsoBlock(event.target.checked)} />Also block {username}</label>
      {alsoBlock && <p className="hint">Blocking removes follows between you and prevents further interaction.</p>}
      <div className="actions"><button className="btn btn--primary" disabled={busy}>{busy ? 'Sending' : 'Send report'}</button><Link className="link" to="/feed">Cancel</Link></div>
    </form>}
  </section>;
}
