import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useResource } from '../../hooks/useResource';
import { pathService } from '../../services/pathService';
import { listed } from '../../utils/paths';
import { SharedSentence } from './Reason';

const enjoyed = (verdict: string) => verdict === 'loved' ? 'loved' : 'liked';

/**
 * On a person's page: what connects you to them, most concrete first. A pick of theirs that landed, a film you both
 * felt the same about, a pick of yours that landed with them, and friends in common.
 */
export function TieLine({ username, onShared, fallback }: { username: string; onShared?: () => void; fallback?: string | null }) {
  const { user } = useUser();
  const load = useCallback((signal: AbortSignal) => pathService.tie(username, signal), [username]);
  const found = useResource(`${user?.id}:tie:${username}`, load);
  const tie = found.data;
  if (!tie) return fallback ? <p className="byline profile__common">You both responded to <button onClick={onShared} type="button">{fallback}</button></p> : null;
  const friends = tie.mutuals.map(friend => friend.username);
  if (!tie.shared && !tie.landed && !tie.returned && !friends.length) return null;
  return <p className="tie">
    {tie.landed && <span>You {enjoyed(tie.landed.enjoyment)} <Link className="film-inline" to={`/movie/${tie.landed.film.id}`}>{tie.landed.film.title}</Link>, which came from {username}. </span>}
    {tie.shared && <span><SharedSentence shared={tie.shared} /> </span>}
    {tie.returned && <span>{username} {enjoyed(tie.returned.enjoyment)} <Link className="film-inline" to={`/movie/${tie.returned.film.id}`}>{tie.returned.film.title}</Link> when you sent it. </span>}
    {friends.length > 0 && <span>{listed(friends.slice(0, 2))}{friends.length > 2 ? ` and ${friends.length - 2} more` : ''} {friends.length === 1 ? 'follows' : 'follow'} them. </span>}
    {tie.shared && tie.shared.count > 1 && onShared && <button className="link" onClick={onShared} type="button">{tie.shared.count} films in common</button>}
  </p>;
}
