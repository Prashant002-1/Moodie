import React, { useEffect, useState } from 'react';
import { Bell, BookOpen, Bookmark, House, Plus, Search } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';

// One navigation on every platform: the same destinations in the same order,
// as a top bar on wide screens and a bottom bar on a phone.
const destinations = [
  { path: '/feed', label: 'Home', icon: House },
  { path: '/suggestions', label: 'Watchlist', icon: Bookmark },
  { path: '/search', label: 'Search', icon: Search },
  { path: '/diary', label: 'Diary', icon: BookOpen },
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
  useEffect(() => { setActionError(''); }, [location.pathname]);
  // Onboarding is one decision: nothing competes with it.
  const onboarding = Boolean(user) && location.pathname === '/welcome';

  return (
    <div className={`app${user ? ' app--signed-in' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>

      {!onboarding && <header className="topbar">
        <div className="topbar__inner">
          <Link aria-label="Moodie home" className="wordmark" to={user ? '/feed' : '/'}>Moodie</Link>
          {user ? <>
            <nav aria-label="Main navigation" className="nav">
              {destinations.map(item => <NavLink className="nav__link" key={item.path} to={item.path}>{item.label}</NavLink>)}
              <NavLink className="nav__link" to="/people">People</NavLink>
            </nav>
            <div className="topbar__actions">
              <NavLink aria-label="Activity" className="btn btn--icon" to="/activity"><Bell aria-hidden="true" size={19} strokeWidth={1.75} /></NavLink>
              <Link className="btn btn--primary btn--small topbar__log" to="/log"><Plus aria-hidden="true" size={16} />Add a response</Link>
              <NavLink aria-label="Account" className="avatar" to="/account">{user.username.charAt(0)}</NavLink>
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
        {destinations.slice(0, 2).map(item => <NavLink className="tabbar__link" key={item.path} to={item.path}><item.icon aria-hidden="true" size={21} strokeWidth={1.75} />{item.label}</NavLink>)}
        <Link aria-label="Add a response" className="tabbar__add" to="/log"><Plus aria-hidden="true" size={22} /></Link>
        {destinations.slice(2).map(item => <NavLink className="tabbar__link" key={item.path} to={item.path}><item.icon aria-hidden="true" size={21} strokeWidth={1.75} />{item.label}</NavLink>)}
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
