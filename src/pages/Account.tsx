import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { authService } from '../services/authService';
import { apiError } from '../services/apiClient';
import { ThemeChoice, readTheme, saveTheme } from '../utils/theme';
import AiModeChoice from '../components/account/AiModeChoice';

type AccountView = 'profile' | 'appearance' | 'ai' | 'account' | 'password';
const views: [AccountView, string][] = [['profile', 'Profile'], ['appearance', 'Appearance'], ['ai', 'AI'], ['account', 'Account'], ['password', 'Password']];
const themes: [ThemeChoice, string][] = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];
const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

export default function Account() {
  const { user, updateProfile, setAiMode, signOut, deleteAccount } = useUser();
  const { summary } = useDiary();
  const navigate = useNavigate();
  const [view, setView] = useState<AccountView>('profile');
  const [bio, setBio] = useState(user?.bio || '');
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
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
  const chooseTheme = (choice: ThemeChoice) => { saveTheme(choice); setTheme(choice); };
  return <section className="page page--narrow stack">
    <h1>Account</h1>
    <div className="tabs" role="group" aria-label="Account views">{views.map(([tab, label]) => <button key={tab} aria-pressed={view === tab} onClick={() => { setView(tab); setError(''); setNotice(''); }} type="button">{label}</button>)}</div>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {view === 'profile' && <form className="stack" onSubmit={event => { event.preventDefault(); void run(() => updateProfile(bio), 'Profile saved.'); }}>
      <div className="row row--center">
        <span aria-hidden="true" className="avatar avatar--lg">{user?.username.charAt(0)}</span>
        <div className="row__main">
          <p className="strong">@{user?.username}</p>
          <p className="meta"><span>{count(summary?.entries ?? 0, 'response', 'responses')}</span><span>{summary?.public_entries ?? 0} public</span><span>{count(summary?.saved ?? 0, 'saved film', 'saved films')}</span></p>
          <p className="t-caption"><Link className="link" to={`/member/${user?.username}`}>Public profile</Link></p>
        </div>
      </div>
      <div className="field"><label htmlFor="account-bio">Public bio</label><textarea className="textarea" id="account-bio" maxLength={240} value={bio} onChange={event => setBio(event.target.value)} />{bio.length > 200 && <span className="field__hint">{bio.length} / 240</span>}</div>
      <div className="actions actions--spread">
        <button className="btn btn--primary" disabled={busy} type="submit">{busy ? 'Saving' : 'Save profile'}</button>
        <button className="btn btn--quiet" disabled={busy} type="button" onClick={() => void run(async () => { await signOut(); navigate('/signin', { replace: true }); }, '')}>Sign out</button>
      </div>
    </form>}
    {view === 'appearance' && <fieldset>
      <legend className="sr-only">Appearance</legend>
      <div className="options options--inline">{themes.map(([choice, label]) => <label className="option option--compact" key={choice}>
        <input checked={theme === choice} name="theme" onChange={() => chooseTheme(choice)} type="radio" value={choice} /><span className="option__title">{label}</span>
      </label>)}</div>
    </fieldset>}
    {view === 'ai' && <AiModeChoice disabled={busy} legend="Choose how Moodie works" value={user?.ai_mode ?? null}
      onChange={mode => { if (mode !== user?.ai_mode) void run(() => setAiMode(mode), mode === 'on' ? 'AI is on for your account.' : 'AI is off for your account.'); }} />}
    {view === 'password' && <form className="stack" onSubmit={savePassword}>
      <div className="field"><label htmlFor="account-current-password">Current password</label><input className="input" id="account-current-password" required type="password" autoComplete="current-password" maxLength={128} value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} /></div>
      <div className="field"><label htmlFor="account-new-password">New password</label><input aria-describedby="account-new-password-hint" className="input" id="account-new-password" required type="password" autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={event => setPassword(event.target.value)} /><span className="field__hint" id="account-new-password-hint">At least 10 characters.</span></div>
      <div className="field"><label htmlFor="account-confirm-password">Confirm password</label><input className="input" id="account-confirm-password" required type="password" autoComplete="new-password" maxLength={128} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></div>
      <div className="actions"><button className="btn btn--primary" disabled={busy} type="submit">Change password</button></div>
    </form>}
    {view === 'account' && <>
      <ul className="list list--flush">
        <li className="row__main"><span className="t-caption muted">Email</span><span className="truncate">{user?.email}</span></li>
        <li className="row__main"><span className="t-caption muted">Username</span><span className="truncate">@{user?.username}</span></li>
        <li><Link className="link" to="/account/blocked">Blocked people</Link></li>
        <li><nav aria-label="About Moodie" className="actions"><Link className="link" to="/about/privacy">Privacy</Link><Link className="link" to="/about/community">Community guidelines</Link><Link className="link" to="/about/credits">Credits</Link></nav></li>
      </ul>
      <form className="section stack" onSubmit={event => { event.preventDefault(); if (window.confirm('Permanently delete your account, diary, photos, saved films, follows, likes, and comments? This cannot be undone.')) void run(async () => { await deleteAccount(deletePassword); navigate('/account-deleted', { replace: true }); }, ''); }}>
        <header className="section__head"><h2>Delete account</h2></header>
        <p className="secondary t-callout">This permanently removes your diary, photos, saved films, and social activity.</p>
        <div className="field"><label htmlFor="account-delete-password">Confirm with your password</label><input className="input" id="account-delete-password" type="password" autoComplete="current-password" required maxLength={128} value={deletePassword} onChange={event => setDeletePassword(event.target.value)} /></div>
        <div className="actions"><button className="btn btn--secondary" disabled={busy} type="submit">Delete my account</button></div>
      </form>
    </>}
    <p className="t-caption muted" style={{ marginTop: 'var(--m-space-6)' }}>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
  </section>;
}
