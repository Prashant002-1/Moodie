import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { apiError } from '../services/apiClient';

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
  if (loading) return <div className="loading" role="status">Checking your session</div>;
  if (user && !submitting && !recoveryCode) return <Navigate to={destination} replace />;
  if (recoveryCode) return <section className="page page--form stack">
    <h1>Keep your recovery code</h1>
    <p className="secondary">Save this in your password manager. You will need it if you forget your password. It is shown only once, and there is no email reset.</p>
    {recovery && <p className="secondary">This replaces your previous recovery code.</p>}
    <code className="recovery-code">{recoveryCode}</code>
    <label className="check"><input type="checkbox" checked={savedCode} onChange={event => setSavedCode(event.target.checked)} />I saved my recovery code</label>
    <button className="btn btn--primary btn--block" disabled={!savedCode} onClick={() => navigate(destination, { replace: true })}>Continue to Moodie</button>
  </section>;
  return <form className="page page--form stack" onSubmit={submit}>
    <h1>{title}</h1>
    {sessionError && <p className="notice notice--error" role="alert">{sessionError} <button className="link" type="button" onClick={() => void refreshSession()}>Retry</button></p>}
    {signup ? <>
      <div className="field"><label htmlFor="auth-email">Email</label><input className="input" id="auth-email" type="email" autoComplete="email" maxLength={255} required value={email} onChange={event => setEmail(event.target.value)} /></div>
      <div className="field"><label htmlFor="auth-username">Username</label><input aria-describedby="auth-username-hint" className="input" id="auth-username" autoComplete="username" minLength={3} maxLength={30} pattern="[A-Za-z0-9_]+" required value={username} onChange={event => setUsername(event.target.value)} /><span className="field__hint" id="auth-username-hint">3 to 30 letters, numbers, or underscores. This is public.</span></div>
    </> : <div className="field"><label htmlFor="auth-identifier">Email or username</label><input className="input" id="auth-identifier" autoComplete="username" maxLength={255} required value={identifier} onChange={event => setIdentifier(event.target.value)} /></div>}
    {recovery && <div className="field"><label htmlFor="auth-recovery-code">Recovery code</label><input className="input" id="auth-recovery-code" autoComplete="off" required maxLength={128} value={recoveryInput} onChange={event => setRecoveryInput(event.target.value)} /></div>}
    <div className="field"><label htmlFor="auth-password">{recovery ? 'New password' : 'Password'}</label><input aria-describedby={signup || recovery ? 'auth-password-hint' : undefined} className="input" id="auth-password" type="password" autoComplete={signup || recovery ? 'new-password' : 'current-password'} minLength={signup || recovery ? 10 : 1} maxLength={128} required value={password} onChange={event => setPassword(event.target.value)} />{(signup || recovery) && <span className="field__hint" id="auth-password-hint">At least 10 characters.</span>}</div>
    {(signup || recovery) && <div className="field"><label htmlFor="auth-confirmation">Confirm password</label><input className="input" id="auth-confirmation" type="password" autoComplete="new-password" maxLength={128} required value={confirmation} onChange={event => setConfirmation(event.target.value)} /></div>}
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    <button className="btn btn--primary btn--block" disabled={submitting} type="submit">{submitting ? 'Please wait' : title}</button>
    <p className="actions actions--spread t-callout">
      {signup ? <Link className="link" to="/signin" state={location.state}>Sign in</Link> : <Link className="link" to="/signup" state={location.state}>Sign up</Link>}
      {mode === 'signin' ? <Link className="link" to="/recover" state={location.state}>Forgot password?</Link> : recovery && <Link className="link" to="/signin" state={location.state}>Sign in</Link>}
    </p>
  </form>;
}
