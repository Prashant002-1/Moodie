import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import AiModeChoice from '../components/account/AiModeChoice';
import BrandMark from '../components/brand/BrandMark';
import { useUser } from '../contexts/UserContext';
import { apiError } from '../services/apiClient';
import type { AiMode } from '../services/authService';
import './Welcome.css';

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
  // Someone who has already chosen changes it in Account, not here.
  if (user && user.ai_mode != null && !busy) return <Navigate replace to={destination} />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!choice || busy) return;
    setBusy(true); setError('');
    try { await setAiMode(choice); navigate(destination, { replace: true }); }
    catch (caught) { setError(apiError(caught, 'Your choice could not be saved. Try again.')); setBusy(false); }
  };
  return <form className="welcome" onSubmit={submit}>
    <header className="welcome__mark"><BrandMark /><span>Moodie</span></header>
    <div className="welcome__intro">
      <p className="welcome__label">Before the first film</p>
      <h1>How should Moodie work for you?</h1>
      <p>Moodie runs on people: what someone recommends to you and why, and what others felt about the films you have both seen. That is the same either way. The one thing to decide is whether AI is part of it.</p>
    </div>
    <AiModeChoice disabled={busy} legend="Choose how Moodie works" onChange={setChoice} value={choice} />
    {error && <p className="error-text" role="alert">{error}</p>}
    <footer className="welcome__actions">
      <button className="welcome__continue" disabled={!choice || busy} type="submit">{busy ? 'Saving' : 'Continue'}</button>
      <p>You can change this at any time in Account.</p>
    </footer>
  </form>;
}
