import React, { useEffect, useState } from 'react';
import { Bell, History, House, Settings, Menu, Plus, Search, UsersRound, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import BrandMark from '../brand/BrandMark';
import './ProductShell.css';
import './JourneyShell.css';
import '../suggestions/Suggestions.css';

const Layout: React.FC = () => {
  const location = useLocation();
  const { user, loading: authLoading } = useUser();
  const [actionError, setActionError] = useState('');
  useEffect(() => {
    const failed = (event: Event) => setActionError((event as CustomEvent<string>).detail);
    window.addEventListener('moodie:action-error', failed);
    return () => window.removeEventListener('moodie:action-error', failed);
  }, []);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Onboarding is one focused decision: no navigation competes with it.
  const onboarding = Boolean(user) && location.pathname === '/welcome';

  const productLinks = [
    { path: '/feed', label: 'Home', icon: House },
    { path: '/search', label: 'Search', icon: Search },
    { path: '/people', label: 'People', icon: UsersRound },
    { path: '/activity', label: 'Activity', icon: Bell },
    { path: '/diary', label: 'Diary', icon: History },
    { path: '/log', label: 'Add a response', icon: Plus },
    { path: '/account', label: 'Account', icon: Settings },
  ];

  useEffect(() => {
    setMobileOpen(false);
    setActionError('');
  }, [location.pathname]);

  return (
    <div className={`app-shell${user ? ' app-shell--product' : ' app-shell--public'}${onboarding ? ' app-shell--onboarding' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>

      {onboarding ? null : user ? (
        <aside className="product-rail">
          <Link aria-label="Moodie home" className="product-rail__mark" to="/feed">
            <BrandMark />
          </Link>
          <nav aria-label="Main navigation" className="product-rail__nav">
            {productLinks.map(link => {
              const Icon = link.icon;
              return (
                <NavLink
                  aria-label={link.label}
                  className={({ isActive }) => `product-rail__link${isActive ? ' product-rail__link--active' : ''}`}
                  key={link.path}
                  to={link.path}
                >
                  <span className="product-rail__icon"><Icon aria-hidden="true" size={20} strokeWidth={1.8} /></span>
                  <span className="product-rail__label">{link.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>
      ) : (
        <header className="nav-shell nav-shell--public nav-shell--steady">
          <div className="nav-inner">
            <Link aria-label="Moodie home" className="brand-lockup" to="/">
              <BrandMark className="brand-lockup__mark" />
              <span className="wordmark">Moodie</span>
            </Link>
            <div className="nav-actions">
              {!authLoading ? <><Link className="text-link" to="/signin">Sign in</Link><Link className="button button--secondary nav-demo" to="/signup">Sign up</Link></> : <span aria-label="Checking session" className="nav-auth-loading" />}
              <button aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} className="icon-button mobile-menu-button" onClick={() => setMobileOpen(open => !open)} type="button">
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
          {mobileOpen && (
            <nav aria-label="Mobile" className="mobile-sheet">
              <Link className="button button--secondary" to="/signup">Sign up</Link><Link to="/signin">Sign in</Link>
            </nav>
          )}
        </header>
      )}

      <main id="main-content">
        {actionError && <div className="notice notice--error action-notice" role="alert">{actionError} <button className="text-link" onClick={() => setActionError('')} type="button">Dismiss</button></div>}
        <Outlet />
      </main>

      {!user && (
        <footer className="footer">
          <div className="footer__inner">
            <div className="footer__credits">
              <a aria-label="Visit TMDB" className="tmdb-credit" href="https://www.themoviedb.org" rel="noreferrer" target="_blank">
                <img alt="TMDB" src="https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_1-5bdc75aaebeb75dc7ae79426ddd9be3b2be1e342510f8202baf6bffa71d7f5c4.svg" />
              </a>
              <p>Non-commercial project. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;
