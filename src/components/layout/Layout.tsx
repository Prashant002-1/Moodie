import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bell, BookOpen, House, Plus, Search, Send, UsersRound } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigationType } from 'react-router-dom';
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
    // A failed change is said once. Most screens say it themselves, beside the
    // control; the banner is for the ones that do not.
    let timer = 0;
    const failed = (event: Event) => {
      const message = (event as CustomEvent<string>).detail;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        // Said already only if the person can see it: an alert at the top of a long page they have scrolled down does not count.
        const said = [...document.querySelectorAll('main [role="alert"]')].some(alert => {
          const box = alert.getBoundingClientRect();
          return alert.textContent?.includes(message) && box.height > 0 && box.bottom > 0 && box.top < window.innerHeight;
        });
        if (!said) setActionError(message);
      }, 200);
    };
    window.addEventListener('moodie:action-error', failed);
    return () => { window.clearTimeout(timer); window.removeEventListener('moodie:action-error', failed); };
  }, []);
  // The banner belongs to the page it was raised on.
  useEffect(() => setActionError(''), [location.pathname]);
  const [adding, setAdding] = useState(false);
  // Moving between pages is silent to a screen reader unless the new page is named aloud.
  const [announced, setAnnounced] = useState('');
  useEffect(() => {
    const named = (event: Event) => setAnnounced((event as CustomEvent<string>).detail);
    window.addEventListener('moodie:page', named);
    return () => window.removeEventListener('moodie:page', named);
  }, []);
  useEffect(() => { setActionError(''); setAdding(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!adding) return;
    const close = (event: Event) => { if (event instanceof KeyboardEvent ? event.key === 'Escape' : !(event.target as Element).closest('.tabbar .menu')) setAdding(false); };
    document.addEventListener('keydown', close); document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close); };
  }, [adding]);
  // A new page opens at its top. Going back returns to where the person was:
  // pages load their content after they open, so the browser's own restoration
  // arrives too early and the position is kept and restored here. A link to a
  // place inside a page (a response on a film) is left to that page.
  const navigationType = useNavigationType();
  const positions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const key = location.key;
    const remember = () => positions.current.set(key, window.scrollY);
    window.addEventListener('scroll', remember, { passive: true });
    return () => window.removeEventListener('scroll', remember);
  }, [location.key]);
  useLayoutEffect(() => {
    if (navigationType !== 'POP') return;
    const target = positions.current.get(location.key);
    if (!target) return;
    let timer = 0, tries = 0;
    const stop = () => window.clearTimeout(timer);
    const restore = () => {
      // Wait until the page is tall enough again, but not for ever.
      if (document.documentElement.scrollHeight - window.innerHeight >= target || ++tries > 40) window.scrollTo?.(0, target);
      else timer = window.setTimeout(restore, 50);
    };
    restore();
    // The person's own scrolling always wins.
    window.addEventListener('wheel', stop, { passive: true, once: true });
    window.addEventListener('touchstart', stop, { passive: true, once: true });
    return () => { stop(); window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop); };
  }, [location.key, navigationType]);
  useEffect(() => {
    if (navigationType !== 'POP' && !location.hash) window.scrollTo?.(0, 0);
  }, [location.pathname, location.hash, navigationType]);
  // Artwork that fails to load leaves its placeholder, never a broken-image mark.
  useEffect(() => {
    const failed = (event: Event) => { if (event.target instanceof HTMLImageElement) event.target.dataset.failed = ''; };
    document.addEventListener('error', failed, true);
    return () => document.removeEventListener('error', failed, true);
  }, []);
  // Onboarding is one decision at a time: nothing competes with keeping the
  // recovery code (still on the sign-up or recovery page) or the first choice.
  const onboarding = Boolean(user) && ['/welcome', '/start', '/signup', '/recover'].includes(location.pathname);

  return (
    <div className={`app${user ? ' app--signed-in' : ''}`}>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <p aria-atomic="true" aria-live="polite" className="sr-only">{announced}</p>

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
              <Link aria-label="Log a film" className="btn btn--primary btn--small btn--caps topbar__wide" to="/log"><Plus aria-hidden="true" size={15} strokeWidth={3} />Log</Link>
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
            <nav aria-label="About Moodie" className="footer__links"><Link to="/about/privacy">Privacy</Link><Link to="/about/community">Community guidelines</Link></nav>
          </div>
        </footer>
      )}
    </div>
  );
};

export default Layout;
