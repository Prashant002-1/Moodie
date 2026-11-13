import { SafetyActions } from '../components/discovery/SafetyActions';
import React, { useCallback, useRef, useState } from 'react';
import { Heart, UserMinus, UserPlus, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ResponseComments } from '../components/discovery/ResponseComments';
import { ResponseFeelingTrace } from '../components/discovery/ResponseFeelingTrace';
import { ResponseDetails } from '../components/diary/ResponseDetails';
import { KeepRecommendation } from '../components/suggestions/KeepRecommendation';
import { SharedFilms } from '../components/discovery/SharedFilms';
import { usePagedResource } from '../hooks/usePagedResource';
import { useDiary } from '../contexts/DiaryContext';
import { apiError } from '../services/apiClient';
import { useUser } from '../contexts/UserContext';
import { CommunityEntry, discoveryService, MemberProfile as MemberProfileData } from '../services/discoveryService';
import { formatCalendarDate, imageUrl, releaseYear } from '../utils/display';

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

  const toggleLike = async (entry: CommunityEntry) => {
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

  if (loading && !person) return <div className="loading-state page-loading"><div className="loading-spinner" /><span>Opening profile</span></div>;
  if (!person) return <div className="page-shell"><div className="error-state"><h1>{error || 'Member not found'}</h1><button className="button button--secondary" onClick={page.refresh}>Retry profile</button></div></div>;

  return (
    <div className="member-page">
      <header className="member-hero">
        <div className="member-hero__content">
          <div aria-hidden="true" className="member-avatar">{person.username.charAt(0).toUpperCase()}</div>
          <div className="member-profile__identity">
            <h1>@{person.username}</h1>
            <p className="member-bio">{person.bio || `${person.entries} public responses.`}</p>
            {person.shared_film_title && <p className="member-shared-film">You both responded to <strong>{person.shared_film_title}</strong>.</p>}
            <div className="member-facts">
              <span><strong>{person.entries}</strong> {person.entries === 1 ? 'response' : 'responses'}</span>
              <button aria-expanded={connectionView === 'followers'} onClick={() => setConnectionView(current => current === 'followers' ? null : 'followers')} type="button"><strong>{person.followers}</strong> {person.followers === 1 ? 'follower' : 'followers'}</button>
              <button aria-expanded={connectionView === 'following'} onClick={() => setConnectionView(current => current === 'following' ? null : 'following')} type="button"><strong>{person.following_count}</strong> following</button>
              {person.follows_you && <span>Follows you</span>}
            </div>
          </div>
          {user && user.id !== person.id && <button aria-label={`${person.following ? 'Unfollow' : 'Follow'} @${person.username}`} aria-pressed={person.following} disabled={followingBusy} className="button button--primary" onClick={() => void toggleFollow()} type="button">{person.following ? <UserMinus size={18} /> : <UserPlus size={18} />}{person.following ? 'Following' : 'Follow'}</button>}
        </div>
      </header>

      <div className="page-shell member-content">
        <SafetyActions kind="person" targetId={person.id} personId={person.id} username={person.username} />
        {user && user.id !== person.id && <section className="suggestion-actions" aria-label="Between you"><Link className="text-link" to={`/suggestions?personId=${person.id}`}>Recommendations between you</Link>{person.follows_you && <Link className="text-link" to={`/suggestions/new?recipientId=${person.id}&recipient=${encodeURIComponent(person.username)}`}>Recommend a film</Link>}</section>}
        {actionError && <p role="alert">{actionError}</p>}
        {error && <p role="alert">{error} <button onClick={page.refresh}>Retry profile</button></p>}
        {connectionView && <Connections key={connectionView} username={username} kind={connectionView} close={() => setConnectionView(null)} />}


        <div aria-label="Choose profile view" className="product-section-tabs member-content__tabs" role="group">
          <button aria-pressed={view === 'responses'} onClick={() => setView('responses')} type="button">Responses {person.entries}</button>
          {person.id !== user?.id && <button aria-pressed={view === 'shared'} onClick={() => setView('shared')} type="button">Shared films</button>}
          <button aria-pressed={view === 'films'} onClick={() => setView('films')} type="button">Films {person.films}</button>
        </div>

        {view === 'responses' && (entries.length ? <section aria-label={`Responses from @${person.username}`} className="member-entries">
          {entries.map(entry => {
            return (
              <article className="public-entry" key={entry.id}>
                <Link className="public-entry__art" to={`/movie/${entry.movie_id}`}>{entry.poster_path ? <img alt={`Poster for ${entry.title}`} loading="lazy" src={imageUrl(entry.poster_path, 'w342') || ''} /> : <div />}</Link>
                <div className="public-entry__body">{entry.expression_image_path && <img alt={entry.expression_image_alt || `Expression photo shared by ${entry.username}`} className="public-entry__expression" loading="lazy" src={entry.expression_image_path} />}<p className="public-entry__meta">{formatCalendarDate(entry.watched_on, { month: 'long', day: 'numeric', year: 'numeric' })}</p><Link to={`/movie/${entry.movie_id}`}><h3>{entry.title}</h3></Link><blockquote>{entry.note || 'No words added.'}</blockquote><ResponseFeelingTrace entry={entry} /><ResponseDetails enjoyment={entry.enjoyment} highlights={entry.highlights} /><div className="suggestion-actions"><Link className="text-link" to={`/response/${entry.id}`}>Read response</Link><KeepRecommendation entryId={entry.id} authorId={entry.user_id} movieId={entry.movie_id} /></div><div className="public-entry__actions"><button aria-label={`${entry.liked ? 'Unlike' : 'Like'} this response`} aria-pressed={entry.liked} className={`like-button${entry.liked ? ' like-button--active' : ''}`} disabled={!user} onClick={() => void toggleLike(entry)} type="button"><Heart fill={entry.liked ? 'currentColor' : 'none'} size={17} />{entry.like_count || 0} {(entry.like_count || 0) === 1 ? 'like' : 'likes'}</button><ResponseComments entryId={entry.id} initialCount={entry.comment_count} /></div></div>
              </article>
            );
          })}
        </section> : <div className="product-empty"><p>No public responses yet.</p></div>)}

        {view === 'shared' && <SharedFilms username={person.username} />}

        {view === 'films' && (films.length ? <section aria-label={`Films from @${person.username}'s responses`} className="member-film-grid">
          {films.map(entry => <Link className="member-film" key={entry.movie_id} to={`/movie/${entry.movie_id}`}>{entry.poster_path ? <img alt={`Poster for ${entry.title}`} loading="lazy" src={imageUrl(entry.poster_path, 'w342') || ''} /> : <span className="member-film__fallback" />}<strong>{entry.title}</strong><span>{releaseYear(entry.release_date)}</span></Link>)}
        </section> : <div className="product-empty"><p>No public films yet.</p></div>)}
        {view !== 'shared' && page.next !== null && <button className="button button--secondary" disabled={loading} onClick={page.loadMore}>{loading ? 'Loading responses' : 'Load more'}</button>}
      </div>
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
  return <section aria-labelledby="member-connections-title" className="member-connections">
    <header><h2 id="member-connections-title">{kind === 'followers' ? 'Followers' : 'Following'}</h2><button aria-label="Close people list" onClick={close}><X aria-hidden="true" size={18} /></button></header>
    <div className="member-connections__list">{page.items.map(connection => <article key={connection.id}>
      <Link className="member-connections__avatar" to={`/member/${connection.username}`}>{connection.username.charAt(0).toUpperCase()}</Link>
      <div><Link to={`/member/${connection.username}`}><strong>@{connection.username}</strong></Link><p>{connection.bio || 'No bio added.'}</p></div>
      {connection.id !== user?.id && <button disabled={busy !== null} aria-label={`${connection.following ? 'Unfollow' : 'Follow'} @${connection.username}`} aria-pressed={connection.following} onClick={() => void follow(connection.id, connection.following)}>{connection.following ? 'Following' : 'Follow'}</button>}
    </article>)}</div>
    {page.loaded && !page.items.length && <p>No one here yet.</p>}
    {page.loading && <p role="status">Loading people</p>}
    {page.error && <p role="alert">{page.error} <button onClick={page.refresh}>Retry people</button></p>}
    {error && <p role="alert">{error}</p>}
    {page.next !== null && <button disabled={page.loading} onClick={page.loadMore}>Load more people</button>}
  </section>;
}

export default function ScopedMemberProfile() {
  const { username } = useParams();
  const { user } = useUser();
  return <MemberProfile key={`${user?.id}:${username}`} />;
}
