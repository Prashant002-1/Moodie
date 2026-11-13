import { Link, Navigate } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';

/** The signed-out front door. It says what Moodie is, once, and gets out of the way. */
export default function Home() {
  const { user, loading } = useUser();
  if (loading) return null;
  if (user) return <Navigate replace to="/feed" />;
  return <div className="page">
    <section className="front">
      <h1 className="t-display">Films and shows, found through people.</h1>
      <p>Keep who recommended it and why. Say how it landed. Find the people who felt what you felt.</p>
      <div className="actions"><Link className="btn btn--primary" to="/signup">Sign up</Link><Link className="btn btn--secondary" to="/signin">Sign in</Link></div>
    </section>
  </div>;
}
