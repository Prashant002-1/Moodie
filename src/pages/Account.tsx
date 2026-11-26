import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { authService } from '../services/authService';
import { apiError } from '../services/apiClient';
import { ThemeChoice, readTheme, saveTheme } from '../utils/theme';
import AiModeChoice from '../components/account/AiModeChoice';
import { Avatar } from '../components/common/Avatar';
import { personHue } from '../utils/person';
import { usePageTitle } from '../hooks/usePageTitle';

type AccountView = 'profile' | 'appearance' | 'notifications' | 'ai' | 'account' | 'password';
const views: [AccountView, string][] = [['profile', 'Profile'], ['appearance', 'Appearance'], ['notifications', 'Notifications'], ['ai', 'AI'], ['account', 'Account'], ['password', 'Password']];
// Dark is Moodie's identity and the default, so it comes first.
const themes: [ThemeChoice, string][] = [['dark', 'Dark'], ['light', 'Light'], ['system', 'System']];
const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

export default function Account() {
  const { user, updateProfile, setAiMode, setEmailNotifications, signOut, deleteAccount } = useUser();
  const { summary } = useDiary();
  usePageTitle('Account');
  const navigate = useNavigate();
  // An email's "turn these off" link opens Account on its tab: /account?view=notifications.
  const [params] = useSearchParams();
  const [view, setView] = useState<AccountView>(() => views.find(([tab]) => tab === params.get('view'))?.[0] ?? 'profile');
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
      {user && <div className="account__who" data-hue={personHue(user.username)}>
        <Avatar size="lg" to={null} username={user.username} />
        <div className="row__main">
          <p className="who">@{user.username}</p>
          <p className="meta"><span>{count(summary?.entries ?? 0, 'response', 'responses')}</span><span>{summary?.public_entries ?? 0} public</span><span>{count(summary?.saved ?? 0, 'saved film', 'saved films')}</span></p>
        </div>
        <Link className="btn btn--secondary btn--small" to={`/member/${user.username}`}>Public profile</Link>
      </div>}
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
    {view === 'notifications' && <div className="stack stack--tight">
      <label className="check"><input checked={user?.email_notifications ?? true} disabled={busy} type="checkbox"
        onChange={event => { const on = event.target.checked; void run(() => setEmailNotifications(on), on ? 'Email notifications are on.' : 'Email notifications are off.'); }} />Email me when someone recommends a film, replies, or a reminder comes due</label>
      <p className="hint">Moodie is not sending emails yet. Your choice is kept for when it does.</p>
    </div>}
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
