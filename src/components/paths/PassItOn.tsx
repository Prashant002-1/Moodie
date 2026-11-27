import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useResource } from '../../hooks/useResource';
import { pathService } from '../../services/pathService';
import { Avatar } from '../common/Avatar';
import { RecipientWhy } from './Reason';

/** After a film someone enjoyed: the followers it might suit, each one tap from a note to them. Nothing when there is no one. */
export function PassItOn({ movieId, sourceEntryId }: { movieId: number; sourceEntryId?: number }) {
  const { user } = useUser();
  const load = useCallback((signal: AbortSignal) => pathService.recipients(movieId, '', signal), [movieId]);
  const found = useResource(`${user?.id}:pass:${movieId}`, load);
  // Only people there is a reason to think of. Everyone else is one step away, on the recommend page.
  const people = (found.data?.people ?? []).filter(person => person.reason).slice(0, 3);
  if (!people.length) return null;
  const to = (personId?: number) => `/suggestions/new?movieId=${movieId}${personId ? `&recipientId=${personId}` : ''}${sourceEntryId ? `&sourceEntryId=${sourceEntryId}` : ''}`;
  return <section aria-label="Who might like it">
    <header className="section__head"><h2>Who might like it?</h2><Link to={to()}>Someone else</Link></header>
    <ul className="intros">{people.map(person => <li className="intro" key={person.id}>
      <Avatar to={null} username={person.username} />
      <div className="intro__main">
        <p><span className="who">{person.username}</span></p>
        <p className="intro__why"><RecipientWhy reason={person.reason!} /></p>
      </div>
      <Link aria-label={`Recommend it to ${person.username}`} className="btn btn--secondary btn--small" to={to(person.id)}>Recommend</Link>
    </li>)}</ul>
  </section>;
}
