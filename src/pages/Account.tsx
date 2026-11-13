import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { authService } from '../services/authService';
import { apiError } from '../services/apiClient';
import AiModeChoice from '../components/account/AiModeChoice';
import './Auth.css';

export default function Account() {
  const { user, updateProfile, setAiMode, signOut, deleteAccount } = useUser();
  const { summary } = useDiary();
  const navigate = useNavigate();
  const [view, setView] = useState<'profile' | 'ai' | 'account' | 'password'>('profile');
  const [bio, setBio] = useState(user?.bio || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const run = async (work: () => Promise<void>, success: string) => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await work(); setNotice(success); }
    catch (caught) { setError(apiError(caught)); }
    finally { setBusy(false); }
  };
  const savePassword = (event: FormEvent) => {
    event.preventDefault();
    if (password !== confirmation) { setError('Passwords do not match.'); return; }
    void run(async () => { await authService.password(currentPassword, password); setPassword(''); setConfirmation(''); setCurrentPassword(''); }, 'Password changed. Other sessions have been signed out.');
  };
  return <section className="page-shell account-page">
    <h1>Account</h1>
    <div className="product-section-tabs" role="group" aria-label="Account views">{(['profile', 'ai', 'account', 'password'] as const).map(tab => <button key={tab} aria-pressed={view === tab} onClick={() => { setView(tab); setError(''); setNotice(''); }} type="button">{tab === 'ai' ? 'AI' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>)}</div>
    {error && <p className="error-text" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {view === 'profile' && <form className="account-form" onSubmit={event => { event.preventDefault(); void run(() => updateProfile(bio), 'Profile saved.'); }}>
      <p>@{user?.username} · <Link className="text-link" to={`/member/${user?.username}`}>View public profile</Link></p>
      <dl className="account-facts"><div><dt>Responses</dt><dd>{summary?.entries ?? 0}</dd></div><div><dt>Public</dt><dd>{summary?.public_entries ?? 0}</dd></div><div><dt>Saved films</dt><dd>{summary?.saved ?? 0}</dd></div></dl>
      <label className="field">Public bio<textarea maxLength={240} value={bio} onChange={event => setBio(event.target.value)} /><span className="field__hint">{bio.length} / 240</span></label>
      <button className="button button--primary" disabled={busy} type="submit">{busy ? 'Saving' : 'Save profile'}</button>
      <button className="button button--quiet" disabled={busy} type="button" onClick={() => void run(async () => { await signOut(); navigate('/signin', { replace: true }); }, '')}>Sign out</button>
    </form>}
    {view === 'ai' && <div className="account-form account-form--wide">
      <p>Moodie runs on people either way. This decides whether AI is part of your account. The change applies immediately.</p>
      <AiModeChoice disabled={busy} legend="Choose how Moodie works" value={user?.ai_mode ?? null}
        onChange={mode => { if (mode !== user?.ai_mode) void run(() => setAiMode(mode), mode === 'on' ? 'AI is on for your account.' : 'AI is off for your account.'); }} />
    </div>}
    {view === 'password' && <form className="account-form" onSubmit={savePassword}>
      <label className="field">Current password<input required type="password" autoComplete="current-password" maxLength={128} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></label>
      <label className="field">New password<input required type="password" autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /></label>
      <label className="field">Confirm password<input required type="password" autoComplete="new-password" maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label>
      <button className="button button--primary" disabled={busy} type="submit">Change password</button>
    </form>}
    {view === 'account' && <div className="account-form">
      <Link className="text-link" to="/account/blocked">Blocked people</Link>
      <nav aria-label="About Moodie" className="suggestion-actions"><Link className="text-link" to="/about/privacy">Privacy</Link><Link className="text-link" to="/about/community">Community guidelines</Link><Link className="text-link" to="/about/credits">Credits</Link></nav>
      <p>Email: {user?.email}</p><p>Username: @{user?.username}</p>
      <form className="account-form" onSubmit={event => { event.preventDefault(); if (window.confirm('Permanently delete your account, diary, photos, saved films, follows, likes, and comments? This cannot be undone.')) void run(async () => { await deleteAccount(deletePassword); navigate('/account-deleted', { replace: true }); }, ''); }}>
        <h2>Delete account</h2><p>This permanently removes your diary, photos, saved films, and social activity.</p>
        <label className="field">Confirm with your password<input type="password" autoComplete="current-password" required maxLength={128} value={deletePassword} onChange={event => setDeletePassword(event.target.value)} /></label>
        <button className="button button--secondary" disabled={busy} type="submit">Delete my account</button>
      </form>
    </div>}
  </section>;
}
