import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDiary } from '../../contexts/DiaryContext';
import { useUser } from '../../contexts/UserContext';
import { apiError } from '../../services/apiClient';
import { ReportInput, safetyService } from '../../services/safetyService';

export function SafetyActions({ kind, targetId, personId, username }: { kind: ReportInput['targetKind']; targetId: number; personId: number; username: string }) {
  const { user } = useUser();
  const { refresh } = useDiary();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!user || user.id === personId) return null;
  const block = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await safetyService.block(personId);
      void refresh();
      navigate('/account/blocked', { replace: true });
    } catch (caught) { setError(apiError(caught, 'This person could not be blocked. Try again.')); }
    finally { setBusy(false); }
  };
  return <details className="disclosure">
    <summary>{kind === 'person' ? 'Person options' : kind === 'comment' ? 'Comment options' : 'Response options'}</summary>
    <div className="stack stack--tight t-callout">
      <div className="actions">
        <Link className="link" to={`/report/${kind}/${targetId}?personId=${personId}&username=${encodeURIComponent(username)}`}>Report {kind}</Link>
        {!confirm && <button className="link" type="button" onClick={() => setConfirm(true)}>Block @{username}</button>}
      </div>
      {confirm && <>
        <p>Block @{username}? You will no longer see each other’s content or interact. This also removes follows between you.</p>
        <div className="actions"><button className="btn btn--secondary btn--small" disabled={busy} onClick={() => void block()} type="button">Confirm block</button><button className="btn btn--quiet btn--small" disabled={busy} onClick={() => setConfirm(false)} type="button">Cancel</button></div>
      </>}
      {error && <p className="notice notice--error" role="alert">{error}</p>}
    </div>
  </details>;
}
