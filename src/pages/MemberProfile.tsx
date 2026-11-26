import { SafetyActions } from '../components/discovery/SafetyActions';
import React, { useCallback, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ResponseCard } from '../components/response/ResponseCard';
import { SharedFilms } from '../components/discovery/SharedFilms';
import { Avatar } from '../components/common/Avatar';
import { usePagedResource } from '../hooks/usePagedResource';
import { useDiary } from '../contexts/DiaryContext';
import { apiError } from '../services/apiClient';
import { useUser } from '../contexts/UserContext';
import { imageUrl, releaseYear } from '../utils/display';
import { personHue } from '../utils/person';
import { CommunityEntry, ResponseEntry, discoveryService, MemberProfile as MemberProfileData } from '../services/discoveryService';
import { usePageTitle } from '../hooks/usePageTitle';

const MemberProfile: React.FC = () => {
  const { username = '' } = useParams();
  usePageTitle(`@${username}`);
  const { user } = useUser();
  const actionLocks = useRef(new Set<string>());
  const { revision, refresh } = useDiary();
  const [view, setView] = useState<'responses' | 'shared' | 'films'>('responses');
  const [connectionView, setConnectionView] = useState<'followers' | 'following' | null>(null);
  const [actionError, setActionError] = useState('');
  const [followingBusy, setFollowingBusy] = useState(false);
  const responseView = view === 'films' ? 'films' : 'responses';
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await discoveryService.profile(username, { offset, view: responseView }, signal);
    return { items: result.entries, next: result.nextOffset, metadata: result.person };
  }, [username, responseView]);
  const page = usePagedResource<CommunityEntry, number, MemberProfileData>(`${user?.id}:${revision}:${username}:${responseView}`, load);
  const { items: entries, metadata: person, error, loading } = page;
  const films = entries;
  const setEntries = page.updateItems;

  const toggleFollow = async () => {
    if (!user || !person || followingBusy) return;
    setFollowingBusy(true); setActionError('');
    try {
      if (person.following) await discoveryService.unfollow(person.id);
      else await discoveryService.follow(person.id);
      refresh();
    } catch (error) { setActionError(apiError(error, 'Your follow could not be updated.')); }
    finally { setFollowingBusy(false); }
  };

  const toggleLike = async (entry: ResponseEntry) => {
    if (!user) return;
    const actionKey = 'toggleLike-' + entry.id;
    if (actionLocks.current.has(actionKey)) return;
    actionLocks.current.add(actionKey);
    const next = !entry.liked;
    setEntries(current => current.map(item => item.id === entry.id ? { ...item, liked: next, like_count: Math.max(0, item.like_count + (next ? 1 : -1)) } : item));
    try {
      if (next) await discoveryService.like(entry.id);
      else await discoveryService.unlike(entry.id);
    } catch {
      setActionError('Your like could not be updated. Try again.');
      setEntries(current => current.map(item => item.id === entry.id ? { ...item, liked: !next, like_count: Math.max(0, item.like_count + (next ? -1 : 1)) } : item));
    } finally { actionLocks.current.delete(actionKey); }
  };

  if (loading && !person) return <div className="loading" role="status">Loading profile</div>;
  if (!person) return <div className="page page--narrow"><div className="empty"><h1>{error || 'Member not found'}</h1><div className="actions"><button className="btn btn--secondary" onClick={page.refresh} type="button">Retry profile</button><Link className="link" to="/people">Find people</Link></div></div></div>;
  const own = user?.id === person.id;

  const hue = personHue(person.username);
  const recommend = `/suggestions/new?recipientId=${person.id}&recipient=${encodeURIComponent(person.username)}`;
  const toggleConnections = (kind: 'followers' | 'following') => setConnectionView(current => current === kind ? null : kind);

  return <>
    <section aria-label={`@${person.username}`} className="band" data-hue={hue}>
      <div className="box profile">
        <Avatar size="xl" to={null} username={person.username} />
        <div className="profile__main">
          <div className="profile__name">
            <h1>{person.username}</h1>
            {person.follows_you && <span className="badge badge--hue">Follows you</span>}
          </div>
          {person.bio && <p className="note note--lead profile__bio">{person.bio}</p>}
          <div aria-label="Profile counts" className="stats" role="group">
            <p className="stat"><span className="stat__n">{person.entries}</span> <span className="stat__l">{person.entries === 1 ? 'response' : 'responses'}</span></p>
            <p className="stat"><span className="stat__n">{person.films}</span> <span className="stat__l">{person.films === 1 ? 'film' : 'films'}</span></p>
            <button aria-expanded={connectionView === 'followers'} className="stat" onClick={() => toggleConnections('followers')} type="button"><span className="stat__n">{person.followers}</span> <span className="stat__l">{person.followers === 1 ? 'follower' : 'followers'}</span></button>
            <button aria-expanded={connectionView === 'following'} className="stat" onClick={() => toggleConnections('following')} type="button"><span className="stat__n">{person.following_count}</span> <span className="stat__l">following</span></button>
          </div>
          {!own && person.shared_film_title && <p className="byline profile__common">You both responded to <button onClick={() => setView('shared')} type="button">{person.shared_film_title}</button></p>}
          {user && !own && <div aria-label="Between you" className="actions" role="group">
            <button aria-label={`${person.following ? 'Unfollow' : 'Follow'} @${person.username}`} aria-pressed={person.following} disabled={followingBusy} className={`btn ${person.following ? 'btn--secondary' : 'btn--primary'}`} onClick={() => void toggleFollow()} type="button">{person.following ? 'Following' : 'Follow'}</button>
            {person.follows_you && <Link className={`btn ${person.following ? 'btn--primary' : 'btn--secondary'}`} to={recommend}>Recommend a film</Link>}
            <Link className="link t-callout" to={`/suggestions?personId=${person.id}`}>Recommendations between you</Link>
          </div>}
          <SafetyActions kind="person" targetId={person.id} personId={person.id} username={person.username} />
        </div>
      </div>
    </section>

    <div className="page">
      {(actionError || error || connectionView) && <div className="stack" style={{ marginBottom: 'var(--m-space-5)' }}>
        {actionError && <p className="notice notice--error" role="alert">{actionError}</p>}
        {error && <p className="notice notice--error" role="alert">{error} <button className="link" onClick={page.refresh} type="button">Retry profile</button></p>}
        {connectionView && <Connections key={connectionView} username={username} kind={connectionView} close={() => setConnectionView(null)} />}
      </div>}

      <div aria-label="Choose profile view" className="tabs" role="group" style={{ marginBottom: 'var(--m-space-5)' }}>
        <button aria-pressed={view === 'responses'} onClick={() => setView('responses')} type="button">Responses</button>
        {!own && <button aria-pressed={view === 'shared'} onClick={() => setView('shared')} type="button">Shared films</button>}
        <button aria-pressed={view === 'films'} onClick={() => setView('films')} type="button">Films</button>
      </div>

      {view === 'responses' && (entries.length ? <section aria-label={`Responses from @${person.username}`} className="columns by-person">
        {entries.map(entry => <ResponseCard entry={entry} key={entry.id} onLike={entry => void toggleLike(entry)} ownUserId={user?.id} />)}
      </section> : !loading && <p className="status">No public responses.</p>)}

      {view === 'shared' && <SharedFilms username={person.username} />}

      {view === 'films' && (films.length ? <section aria-label={`Films from @${person.username}'s responses`} className="wall">
        {films.map(entry => <article className="tile" key={entry.movie_id}>
          <Link aria-label={`View film: ${entry.title}`} className="tile__art" to={`/movie/${entry.movie_id}`}>
            <span className="poster">{imageUrl(entry.poster_path, 'w342') && <img alt="" loading="lazy" src={imageUrl(entry.poster_path, 'w342')!} />}</span>
          </Link>
          <p className="tile__title">{entry.title}</p>
          <p className="tile__sub">{releaseYear(entry.release_date)}</p>
        </article>)}
      </section> : !loading && <p className="status">No public films.</p>)}
      {view !== 'shared' && loading && <p className="status" role="status">Loading</p>}
      {view !== 'shared' && page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={loading} onClick={page.loadMore} type="button">Load more</button></div>}
    </div>
  </>;
};

function Connections({ username, kind, close }: { username: string; kind: 'followers' | 'following'; close: () => void }) {
  const { user } = useUser();
  const { revision, refresh } = useDiary();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await discoveryService.connections(username, kind, offset, signal);
    return { items: result.people, next: result.nextOffset };
  }, [username, kind]);
  const page = usePagedResource(`${user?.id}:${revision}:${username}:${kind}`, load);
  const follow = async (id: number, following: boolean) => {
    if (busy !== null) return;
    setBusy(id); setError('');
    try { if (following) await discoveryService.unfollow(id); else await discoveryService.follow(id); refresh(); }
    catch (error) { setError(apiError(error, 'Your follow could not be updated.')); }
    finally { setBusy(null); }
  };
  return <section aria-labelledby="member-connections-title" className="panel">
    <header className="section__head"><h2 id="member-connections-title">{kind === 'followers' ? 'Followers' : 'Following'}</h2><button aria-label="Close people list" onClick={close} type="button"><X aria-hidden="true" size={18} /></button></header>
    <div className="list">{page.items.map(connection => <article className="row row--center" data-hue={personHue(connection.username)} key={connection.id}>
      <Avatar to={null} username={connection.username} />
      <div className="row__main"><p className="byline"><Link to={`/member/${connection.username}`}>@{connection.username}</Link></p>{connection.bio && <p className="t-caption muted clamp">{connection.bio}</p>}</div>
      {connection.id !== user?.id && <div className="row__aside"><button disabled={busy !== null} aria-label={`${connection.following ? 'Unfollow' : 'Follow'} @${connection.username}`} aria-pressed={connection.following} className="btn btn--secondary btn--small" onClick={() => void follow(connection.id, connection.following)} type="button">{connection.following ? 'Following' : 'Follow'}</button></div>}
    </article>)}</div>
    {page.loaded && !page.items.length && <p className="status">{kind === 'followers' ? 'No followers.' : 'Not following anyone.'}</p>}
    {page.loading && <p className="status" role="status">Loading people</p>}
    {page.error && <p className="status" role="alert">{page.error} <button className="link" onClick={page.refresh} type="button">Retry people</button></p>}
    {error && <p className="notice notice--error" role="alert">{error}</p>}
    {page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-4)' }}><button className="btn btn--secondary btn--small" disabled={page.loading} onClick={page.loadMore} type="button">Load more people</button></div>}
  </section>;
}

export default function ScopedMemberProfile() {
  const { username } = useParams();
  const { user } = useUser();
  return <MemberProfile key={`${user?.id}:${username}`} />;
}
