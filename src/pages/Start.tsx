import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import BrandMark from '../components/brand/BrandMark';
import { StarterFilms } from '../components/paths/StarterFilms';
import { useUser } from '../contexts/UserContext';
import { usePageTitle } from '../hooks/usePageTitle';

/** Second page after joining: a few films the person has seen, so there is something to go on. It can be skipped. */
export default function Start() {
  const { user } = useUser();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const destination = from?.startsWith('/') && !from.startsWith('//') && !['/welcome', '/start'].includes(from) ? from : '/feed';
  const [count, setCount] = useState(0);
  usePageTitle('Films you have seen');
  if (user && user.ai_mode == null) return <Navigate replace to="/welcome" />;
  return <div className="page page--narrow stack stack--loose" style={{ paddingTop: 'var(--m-space-8)' }}>
    <p className="wordmark"><BrandMark />Moodie</p>
    <div className="stack stack--tight">
      <h1>Seen any of these?</h1>
      <p className="secondary">Tap a film and say how it was.</p>
    </div>
    <StarterFilms limit={18} onAnswered={setCount} />
    <div className="actions">
      <Link className={`btn ${count ? 'btn--primary' : 'btn--secondary'}`} replace to={destination}>{count ? 'Continue' : 'Skip'}</Link>
      {count > 0 && <span className="hint">{count === 1 ? '1 film' : `${count} films`} in your diary.</span>}
    </div>
  </div>;
}
