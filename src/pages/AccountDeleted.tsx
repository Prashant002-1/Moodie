import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

export default function AccountDeleted() {
  const { deletionReceipt, retryDraftCleanup } = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <section className="page page--form stack"><h1>{deletionReceipt ? 'Account deleted' : 'Account'}</h1>
    {deletionReceipt && <p className="secondary">Your account and its content have been removed from Moodie.</p>}
    {deletionReceipt?.cleanupOwner != null && <>
      <p className="notice notice--error" role="alert">Your account was deleted, but this browser’s local draft could not be removed. Retry below, or clear Moodie’s site data in your browser settings.</p>
      <div className="actions"><button className="btn btn--secondary" disabled={busy} onClick={() => {
        if (busy) return; setBusy(true); setError('');
        void retryDraftCleanup().catch(() => setError('The local draft could not be removed. Please clear Moodie’s site data in your browser settings.')).finally(() => setBusy(false));
      }}>Remove local draft</button></div>
      {error && <p className="notice notice--error" role="alert">{error}</p>}
    </>}
    {deletionReceipt?.cleanupOwner === null && <p className="notice" role="status">The local draft in this browser has been removed.</p>}
    <p><Link className="link" to="/">Return home</Link></p>
  </section>;
}
