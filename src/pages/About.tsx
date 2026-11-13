import { Link, useParams } from 'react-router-dom';

export default function About() {
  const { topic } = useParams();
  const support = import.meta.env.VITE_SUPPORT_URL;
  const supportURL = typeof support === 'string' && /^(https:\/\/|mailto:)/.test(support) ? support : null;
  return <article className="page-shell account-page policy-page"><Link className="text-link" to="/account">Account</Link>
    {topic === 'privacy' ? <><h1>Privacy</h1><h2>Your diary belongs to you.</h2>
      <p>Moodie stores your account email, username, profile, film responses, selected feelings, saved films, and social activity to provide the service.</p>
      <p>New responses default to private. Private notes and photos are not shown to other people. Your selected feelings can help find connections with public responses to films you’ve both seen.</p>
      <p>Photos are optional and are not used for recommendations. A recommendation reply is separate from your diary: you choose the words and whether to share your feelings.</p>
      <p>Your browser session uses an HTTP-only cookie. Unsaved drafts stay in this browser, scoped to your account, until you save or discard them. Signing out leaves your draft available when you return to the same account. Clearing site data removes local drafts. Deleting your account also attempts to remove its draft from this browser.</p>
      <p>You can edit or delete a response in Diary. Delete your account in Account to remove your account and associated content.</p>
    </> : topic === 'community' ? <><h1>Community guidelines</h1><h2>Make room for a different response.</h2>
      <p>Speak from your own experience. A film can mean something different to someone else.</p>
      <p>Harassment, threats, hate speech, sexual exploitation, graphic violence, spam, and sharing someone’s private information are not allowed. Only upload images you have the right to share.</p>
      <p>Report a response, comment, or person from their options menu. Reports are sent for review. Blocking removes content and prevents interaction in both directions. Unblocking does not restore follows.</p>
      <p>Content that breaks these guidelines may be removed. Accounts that repeatedly violate them may be restricted.</p>
    </> : topic === 'credits' ? <><h1>Credits</h1><h2>Film information</h2><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p><a className="text-link" href="https://www.themoviedb.org">The Movie Database</a></> : <h1>Page not found</h1>}
    {supportURL && <p><a className="text-link" href={supportURL}>Contact support</a></p>}
  </article>;
}
