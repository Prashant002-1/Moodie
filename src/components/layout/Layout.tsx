import React, { useEffect, useState } from 'react';
import { Bell, BookOpen, House, Plus, Search, Send, UsersRound } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { personHue } from '../../utils/person';
import BrandMark from '../brand/BrandMark';

// One navigation on every platform: the same destinations in the same order,
// as a top bar on wide screens and Moodie's own bottom bar on a phone.
const destinations = [
  { path: '/feed', label: 'Home', short: 'Home', icon: House },
  { path: '/suggestions', label: 'Recommendations', short: 'Recs', icon: Send },
  { path: '/people', label: 'People', short: 'People', icon: UsersRound },
  { path: '/diary', label: 'Diary', short: 'Diary', icon: BookOpen },
];

const Layout: React.FC = () => {
  const location = useLocation();
  const { user, loading: authLoading } = useUser();
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    const failed = (event: Event) => setActionError((event as CustomEvent<string>).detail);
    window.addEventListener('moodie:action-error', failed);
    return () => window.removeEventListener('moodie:action-error', failed);
  }, []);
  const [adding, setAdding] = useState(false);
  useEffect(() => { setActionError(''); setAdding(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!adding) return;
    const close = (event: Event) => { if (event instanceof KeyboardEvent ? event.key === 'Escape' : !(event.target as Element).closest('.tabbar .menu')) setAdding(false); };
    document.addEventListener('keydown', close); document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close); };
  }, [adding]);
  // Onboarding is one decision: nothing competes with it.
  const onboarding = Boolean(user) && location.pathname === '/welcome';

  return (
    <div className={`app${user ? ' app--signed-in' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>

      {!onboarding && <header className="topbar">
        <div className="topbar__inner">
          <Link aria-label="Moodie home" className="wordmark" to={user ? '/feed' : '/'}><BrandMark />Moodie</Link>
          {user ? <>
            <nav aria-label="Main navigation" className="nav">
              {destinations.map(item => <NavLink className="nav__link" key={item.path} to={item.path}>{item.label}</NavLink>)}
            </nav>
            <div className="topbar__actions">
              <NavLink aria-label="Search" className="btn btn--icon" to="/search"><Search aria-hidden="true" size={19} strokeWidth={2} /></NavLink>
              <NavLink aria-label="Activity" className="btn btn--icon" to="/activity"><Bell aria-hidden="true" size={19} strokeWidth={2} /></NavLink>
              <Link className="btn btn--secondary btn--small btn--caps topbar__wide" to="/suggestions/new">Recommend</Link>
              <Link aria-label="Add a response" className="btn btn--primary btn--small btn--caps topbar__wide" to="/log"><Plus aria-hidden="true" size={15} strokeWidth={3} />Log</Link>
              <NavLink aria-label="Account" className="avatar" data-hue={personHue(user.username)} to="/account">{user.username.charAt(0)}</NavLink>
            </div>
          </> : <div className="topbar__actions">
            {/* The front page carries its own two buttons: do not show them twice. */}
            {!authLoading && location.pathname !== '/' && <><Link className="btn btn--quiet btn--small" to="/signin">Sign in</Link><Link className="btn btn--primary btn--small" to="/signup">Sign up</Link></>}
          </div>}
        </div>
      </header>}

      <main id="main-content">
        {actionError && <div className="notice notice--error notice--float" role="alert">{actionError} <button className="link" onClick={() => setActionError('')} type="button">Dismiss</button></div>}
        <Outlet />
      </main>

      {user && !onboarding && <nav aria-label="Phone navigation" className="tabbar">
        {destinations.slice(0, 2).map(item => <NavLink className="tabbar__link" key={item.path} to={item.path}><item.icon aria-hidden="true" size={21} strokeWidth={1.75} />{item.short}</NavLink>)}
        {/* The phone's one add button offers both things a person adds: a response, or a recommendation for someone. */}
        <div className="menu menu--up">
          <button aria-expanded={adding} aria-haspopup="menu" aria-label="Add" className="tabbar__add" onClick={() => setAdding(open => !open)} type="button"><Plus aria-hidden="true" size={22} strokeWidth={2.5} /></button>
          {adding && <div className="menu__list" role="menu">
            <Link role="menuitem" to="/log"><Plus aria-hidden="true" size={16} />Log a film</Link>
            <Link role="menuitem" to="/suggestions/new"><Send aria-hidden="true" size={16} />Recommend a film</Link>
          </div>}
        </div>
        {destinations.slice(2).map(item => <NavLink className="tabbar__link" key={item.path} to={item.path}><item.icon aria-hidden="true" size={21} strokeWidth={1.75} />{item.short}</NavLink>)}
      </nav>}

      {!user && (
        <footer className="footer">
          <div className="footer__inner">
            <a aria-label="Visit TMDB" href="https://www.themoviedb.org" rel="noreferrer" target="_blank">
              <img alt="TMDB" src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_1-5bdc75aaebeb75dc7ae79426ddd9be3b2be1e342510f8202baf6bffa71d7f5c4.svg" />
            </a>
            <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;
