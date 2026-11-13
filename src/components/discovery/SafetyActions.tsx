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
  return <details className="safety-actions">
    <summary>{kind === 'person' ? 'Person options' : kind === 'comment' ? 'Comment options' : 'Response options'}</summary>
    <div className="safety-actions__body">
      <Link className="text-link" to={`/report/${kind}/${targetId}?personId=${personId}&username=${encodeURIComponent(username)}`}>Report {kind}</Link>
      {!confirm ? <button className="text-link" type="button" onClick={() => setConfirm(true)}>Block @{username}</button> : <div>
        <p>Block @{username}? You will no longer see each other’s content or interact. This also removes follows between you.</p>
        <div className="suggestion-actions"><button className="button button--secondary" disabled={busy} onClick={() => void block()}>Confirm block</button><button className="text-link" disabled={busy} onClick={() => setConfirm(false)}>Cancel</button></div>
      </div>}
      {error && <p role="alert">{error}</p>}
    </div>
  </details>;
}
