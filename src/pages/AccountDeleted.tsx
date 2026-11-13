import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

export default function AccountDeleted() {
  const { deletionReceipt, retryDraftCleanup } = useUser();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <section className="page-shell account-page"><h1>{deletionReceipt ? 'Account deleted' : 'Account'}</h1>
    {deletionReceipt && <p>Your account and its content have been removed from Moodie.</p>}
    {deletionReceipt?.cleanupOwner != null && <div className="account-form">
      <p role="alert">Your account was deleted, but this browser’s local draft could not be removed. Retry below, or clear Moodie’s site data in your browser settings.</p>
      <button className="button button--secondary" disabled={busy} onClick={() => {
        if (busy) return; setBusy(true); setError('');
        void retryDraftCleanup().catch(() => setError('The local draft could not be removed. Please clear Moodie’s site data in your browser settings.')).finally(() => setBusy(false));
      }}>Remove local draft</button>
      {error && <p role="alert">{error}</p>}
    </div>}
    {deletionReceipt?.cleanupOwner === null && <p role="status">The local draft in this browser has been removed.</p>}
    <Link className="text-link" to="/">Return home</Link>
  </section>;
}
