import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useDiary } from '../../contexts/DiaryContext';
import { useResource } from '../../hooks/useResource';
import { apiError } from '../../services/apiClient';
import { discoveryService } from '../../services/discoveryService';
import { Introduction, pathService } from '../../services/pathService';
import { listed } from '../../utils/paths';
import { Avatar } from '../common/Avatar';
import { SharedSentence } from './Reason';

/** Why you might follow this person: a film you both felt the same about, friends in common, or that they follow you. */
function Why({ person }: { person: Introduction }) {
  const friends = person.mutuals.map(friend => friend.username);
  return <p className="intro__why">
    {person.shared && <span><SharedSentence shared={person.shared} /> </span>}
    {friends.length > 0 && <span>{listed(friends.slice(0, 2))}{friends.length > 2 ? ` and ${friends.length - 2} more` : ''} {friends.length === 1 ? 'follows' : 'follow'} them. </span>}
    {person.follows_you && <span>Follows you.</span>}
  </p>;
}

/** People to meet: each with the reason, and Follow in place. Renders nothing when there is nobody to introduce. */
export function Introductions({ limit = 3, heading = 'People to meet', more, onShown }: { limit?: number; heading?: string; more?: boolean; onShown?: (ids: number[]) => void }) {
  const { user } = useUser();
  const { revision, refresh } = useDiary();
  const load = useCallback((signal: AbortSignal) => pathService.introductions(limit, signal), [limit]);
  const found = useResource(`${user?.id}:introductions:${limit}`, load, revision);
  // A person stays where they are after Follow, so the change can be seen and undone.
  const [followed, setFollowed] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [shown, setShown] = useState<Introduction[] | null>(null);
  // The first list read is the one shown: following someone does not pull them out from under the pointer.
  useEffect(() => { if (found.data?.length) setShown(previous => previous ?? found.data); }, [found.data]);
  const people = shown ?? found.data ?? [];
  useEffect(() => { if (shown) onShown?.(shown.map(person => person.id)); }, [shown, onShown]);
  const toggle = async (person: Introduction) => {
    if (busy !== null) return;
    const now = Boolean(followed[person.id]);
    setBusy(person.id); setError('');
    try {
      if (now) await discoveryService.unfollow(person.id); else await discoveryService.follow(person.id);
      setFollowed(state => ({ ...state, [person.id]: !now }));
      void refresh();
    } catch (caught) { setError(apiError(caught, 'This connection could not be updated. Try again.')); }
    finally { setBusy(null); }
  };
  if (!people.length) return null;
  return <section aria-label={heading}>
    <header className="section__head"><h2>{heading}</h2>{more && <Link to="/people?view=discover">See all<span className="sr-only"> people</span></Link>}</header>
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    <ul className="intros">{people.map(person => <li className="intro" key={person.id}>
      <Avatar username={person.username} />
      <div className="intro__main">
        <p><Link className="who" to={`/member/${person.username}`}>{person.username}</Link></p>
        <Why person={person} />
      </div>
      <button aria-label={`${followed[person.id] ? 'Unfollow' : 'Follow'} @${person.username}`} aria-pressed={Boolean(followed[person.id])} className="btn btn--secondary btn--small" disabled={busy !== null} onClick={() => void toggle(person)} type="button">{followed[person.id] ? 'Following' : 'Follow'}</button>
    </li>)}</ul>
  </section>;
}
