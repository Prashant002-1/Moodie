import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import AiModeChoice from '../components/account/AiModeChoice';
import BrandMark from '../components/brand/BrandMark';
import { useUser } from '../contexts/UserContext';
import { apiError } from '../services/apiClient';
import type { AiMode } from '../services/authService';
import { usePageTitle } from '../hooks/usePageTitle';

/** First page after joining: one decision, made before anything else is shown. */
export default function Welcome() {
  const { user, setAiMode } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const destination = from?.startsWith('/') && !from.startsWith('//') && from !== '/welcome' ? from : '/feed';
  const [choice, setChoice] = useState<AiMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  usePageTitle('Welcome');
  // Someone who has already chosen changes it in Account, not here.
  if (user && user.ai_mode != null && !busy) return <Navigate replace to={destination} />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!choice || busy) return;
    setBusy(true); setError('');
    try { await setAiMode(choice); navigate(destination, { replace: true }); }
    catch (caught) { setError(apiError(caught, 'Your choice could not be saved. Try again.')); setBusy(false); }
  };
  return <form className="page page--narrow stack stack--loose" onSubmit={submit} style={{ paddingTop: 'var(--m-space-8)' }}>
    <p className="wordmark"><BrandMark />Moodie</p>
    <h1>With or without AI?</h1>
    <AiModeChoice disabled={busy} legend="Choose how Moodie works" onChange={setChoice} value={choice} />
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    <div className="actions">
      <button className="btn btn--primary" disabled={!choice || busy} type="submit">{busy ? 'Saving' : 'Continue'}</button>
      <span className="hint">You can change this in Account.</span>
    </div>
  </form>;
}
