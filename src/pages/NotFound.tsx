import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { usePageTitle } from '../hooks/usePageTitle';

/** An address that leads nowhere: say so, and offer the way back. */
export default function NotFound() {
  const { user } = useUser();
  usePageTitle('Page not found');
  return <div className="page page--narrow"><div className="empty">
    <h1>Page not found</h1>
    <p>This address does not lead anywhere in Moodie.</p>
    <Link className="btn btn--secondary" to={user ? '/feed' : '/'}>Return home</Link>
  </div></div>;
}
