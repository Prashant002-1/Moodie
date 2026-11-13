import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { apiError } from '../services/apiClient';
import './Auth.css';

export default function Auth({ mode }: { mode: 'signup' | 'signin' | 'recover' }) {
  const { user, loading, sessionError, refreshSession, signUp, signIn, recover } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { from?: string } | null)?.from;
  const destination = returnTo?.startsWith('/') && !returnTo.startsWith('//') && !/^\/(signin|signup|recover)/.test(returnTo) ? returnTo : '/feed';
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [savedCode, setSavedCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const signup = mode === 'signup';
  const recovery = mode === 'recover';
  const title = signup ? 'Sign up' : recovery ? 'Recover your account' : 'Sign in';
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if ((signup || recovery) && password !== confirmation) { setError('Passwords do not match.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const response = signup ? await signUp({ email, username, password }) : recovery ? await recover({ identifier, password, recoveryCode: recoveryInput }) : await signIn({ identifier, password });
      setPassword(''); setConfirmation(''); setRecoveryInput('');
      if (response.recoveryCode) setRecoveryCode(response.recoveryCode);
      else navigate(destination, { replace: true });
    } catch (caught) { setError(apiError(caught, 'Could not connect to Moodie. Try again.')); }
    finally { setSubmitting(false); }
  };
  if (loading) return <div className="loading-state page-loading">Checking your session</div>;
  if (user && !submitting && !recoveryCode) return <Navigate to={destination} replace />;
  return <section className="auth-page">
    {recoveryCode ? <div className="auth-card">
      <h1>Keep your recovery code</h1>
      <p>Save this in your password manager. You will need it if you forget your password. It is shown only once, and there is no email reset.</p>
      {recovery && <p>This replaces your previous recovery code.</p>}
      <code className="recovery-code">{recoveryCode}</code>
      <label className="auth-check"><input type="checkbox" checked={savedCode} onChange={event => setSavedCode(event.target.checked)} />I saved my recovery code</label>
      <button className="button button--primary" disabled={!savedCode} onClick={() => navigate(destination, { replace: true })}>Continue to Moodie</button>
    </div> : <form className="auth-card" onSubmit={submit}>
      <h1>{title}</h1>
      <p>{signup ? 'Keep the films, words, and feelings that stayed with you.' : recovery ? 'Use the recovery code you saved when you joined.' : 'Return to your films and people.'}</p>
      {sessionError && <p role="alert">{sessionError} <button className="text-link" type="button" onClick={() => void refreshSession()}>Retry</button></p>}
      {signup ? <>
        <label className="field">Email<input type="email" autoComplete="email" maxLength={255} required value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label className="field">Username<input autoComplete="username" minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" required value={username} onChange={event => setUsername(event.target.value)} /><span className="field__hint">3 to 30 letters, numbers, or underscores. This is public.</span></label>
      </> : <label className="field">Email or username<input autoComplete="username" maxLength={255} required value={identifier} onChange={event => setIdentifier(event.target.value)} /></label>}
      {recovery && <label className="field">Recovery code<input autoComplete="off" required maxLength={128} value={recoveryInput} onChange={event => setRecoveryInput(event.target.value)} /></label>}
      <label className="field">{recovery ? 'New password' : 'Password'}<input type="password" autoComplete={signup || recovery ? 'new-password' : 'current-password'} minLength={signup || recovery ? 10 : 1} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} />{(signup || recovery) && <span className="field__hint">At least 10 characters.</span>}</label>
      {(signup || recovery) && <label className="field">Confirm password<input type="password" autoComplete="new-password" maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>}
      {error && <p className="error-text" role="alert">{error}</p>}
      <button className="button button--primary" disabled={submitting} type="submit">{submitting ? 'Please wait' : title}</button>
      <div className="auth-links">{signup ? <span>Already here? <Link to="/signin" state={location.state}>Sign in</Link></span> : <Link to="/signup" state={location.state}>Create an account</Link>}{mode === 'signin' ? <Link to="/recover" state={location.state}>Forgot password?</Link> : recovery && <Link to="/signin" state={location.state}>Back to sign in</Link>}</div>
    </form>}
  </section>;
}
