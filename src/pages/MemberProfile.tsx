import { SafetyActions } from '../components/discovery/SafetyActions';
import React, { useCallback, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ResponseCard } from '../components/response/ResponseCard';
import { SharedFilms } from '../components/discovery/SharedFilms';
import FilmPoster from '../components/features/movie/FilmPoster';
import { usePagedResource } from '../hooks/usePagedResource';
import { useDiary } from '../contexts/DiaryContext';
import { apiError } from '../services/apiClient';
import { useUser } from '../contexts/UserContext';
import { CommunityEntry, ResponseEntry, discoveryService, MemberProfile as MemberProfileData } from '../services/discoveryService';

const MemberProfile: React.FC = () => {
  const { username = '' } = useParams();
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
  if (!person) return <div className="page page--narrow"><div className="empty"><h1>{error || 'Member not found'}</h1><button className="btn btn--secondary" onClick={page.refresh} type="button">Retry profile</button></div></div>;
  const own = user?.id === person.id;

  return (
    <div className="page page--narrow">
      <header className="masthead masthead--person">
        <span aria-hidden="true" className="avatar avatar--lg">{person.username.charAt(0)}</span>
        <div className="masthead__main">
          <h1>@{person.username}</h1>
          {person.bio && <p className="note">{person.bio}</p>}
          <p className="meta">
            <span><button aria-expanded={connectionView === 'followers'} className="link" onClick={() => setConnectionView(current => current === 'followers' ? null : 'followers')} type="button">{person.followers} {person.followers === 1 ? 'follower' : 'followers'}</button></span>
            <span><button aria-expanded={connectionView === 'following'} className="link" onClick={() => setConnectionView(current => current === 'following' ? null : 'following')} type="button">{person.following_count} following</button></span>
            {person.follows_you && <span>Follows you</span>}
          </p>
          {user && !own && <div className="actions" style={{ marginTop: 'var(--m-space-2)' }}><button aria-label={`${person.following ? 'Unfollow' : 'Follow'} @${person.username}`} aria-pressed={person.following} disabled={followingBusy} className={`btn btn--small ${person.following ? 'btn--secondary' : 'btn--primary'}`} onClick={() => void toggleFollow()} type="button">{person.following ? 'Following' : 'Follow'}</button></div>}
        </div>
      </header>

      <div className="stack" style={{ marginTop: 'var(--m-space-4)' }}>
        {person.shared_film_title && <p className="t-callout secondary">You both responded to <span className="serif">{person.shared_film_title}</span>.</p>}
        {user && !own && <section aria-label="Between you" className="actions t-callout">
          <Link className="link" to={`/suggestions?personId=${person.id}`}>Recommendations between you</Link>
          {person.follows_you && <Link className="link" to={`/suggestions/new?recipientId=${person.id}&recipient=${encodeURIComponent(person.username)}`}>Recommend a film</Link>}
        </section>}
        <SafetyActions kind="person" targetId={person.id} personId={person.id} username={person.username} />
        {actionError && <p className="notice notice--error" role="alert">{actionError}</p>}
        {error && <p className="notice notice--error" role="alert">{error} <button className="link" onClick={page.refresh} type="button">Retry profile</button></p>}
        {connectionView && <Connections key={connectionView} username={username} kind={connectionView} close={() => setConnectionView(null)} />}
      </div>

      <div aria-label="Choose profile view" className="tabs" role="group" style={{ marginTop: 'var(--m-space-5)' }}>
        <button aria-pressed={view === 'responses'} onClick={() => setView('responses')} type="button">Responses {person.entries}</button>
        {!own && <button aria-pressed={view === 'shared'} onClick={() => setView('shared')} type="button">Shared films</button>}
        <button aria-pressed={view === 'films'} onClick={() => setView('films')} type="button">Films {person.films}</button>
      </div>

      {view === 'responses' && (entries.length ? <section aria-label={`Responses from @${person.username}`} className="responses--person">
        {entries.map(entry => <ResponseCard entry={entry} key={entry.id} onLike={entry => void toggleLike(entry)} ownUserId={user?.id} />)}
      </section> : !loading && <p className="status">No public responses.</p>)}

      {view === 'shared' && <SharedFilms username={person.username} />}

      {view === 'films' && (films.length ? <section aria-label={`Films from @${person.username}'s responses`} className="poster-grid" style={{ marginTop: 'var(--m-space-5)' }}>
        {films.map(entry => <FilmPoster key={entry.movie_id} movie={{ id: entry.movie_id, title: entry.title, poster_path: entry.poster_path, release_date: entry.release_date }} />)}
      </section> : !loading && <p className="status">No public films.</p>)}
      {view !== 'shared' && loading && <p className="status" role="status">Loading</p>}
      {view !== 'shared' && page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={loading} onClick={page.loadMore} type="button">Load more</button></div>}
    </div>
  );
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
  return <section aria-labelledby="member-connections-title">
    <header className="section__head"><h2 id="member-connections-title">{kind === 'followers' ? 'Followers' : 'Following'}</h2><button aria-label="Close people list" onClick={close} type="button"><X aria-hidden="true" size={18} /></button></header>
    <div className="list">{page.items.map(connection => <article className="row row--center" key={connection.id}>
      <span aria-hidden="true" className="avatar">{connection.username.charAt(0)}</span>
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
