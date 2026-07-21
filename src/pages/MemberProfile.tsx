import React, { useEffect, useMemo, useState } from 'react';
import { Heart, UserMinus, UserPlus, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ResponseComments } from '../components/discovery/ResponseComments';
import { ResponseFeelingTrace } from '../components/discovery/ResponseFeelingTrace';
import { useDiary } from '../contexts/DiaryContext';
import { useUser } from '../contexts/UserContext';
import { CommunityEntry, discoveryService, MemberConnection, MemberProfile as MemberProfileData } from '../services/discoveryService';
import { formatCalendarDate, imageUrl, releaseYear } from '../utils/display';

const MemberProfile: React.FC = () => {
  const { username = '' } = useParams();
  const { user } = useUser();
  const { entries: ownEntries } = useDiary();
  const [person, setPerson] = useState<MemberProfileData | null>(null);
  const [entries, setEntries] = useState<CommunityEntry[]>([]);
  const [followers, setFollowers] = useState<MemberConnection[]>([]);
  const [following, setFollowing] = useState<MemberConnection[]>([]);
  const [view, setView] = useState<'responses' | 'shared' | 'films'>('responses');
  const [connectionView, setConnectionView] = useState<'followers' | 'following' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    discoveryService.profile(username)
      .then(result => {
        if (active) {
          setPerson(result.person);
          setEntries(result.entries);
          setFollowers(result.followers);
          setFollowing(result.following);
        }
      })
      .catch(() => active && setError('This profile could not be loaded.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [username, user?.id]);

  const films = useMemo(() => {
    const unique = new Map<number, CommunityEntry>();
    entries.forEach(entry => {
      if (!unique.has(entry.movie_id)) unique.set(entry.movie_id, entry);
    });
    return [...unique.values()];
  }, [entries]);
  const sharedPairs = useMemo(() => {
    const ownByMovie = new Map<number, (typeof ownEntries)[number]>();
    ownEntries.forEach(entry => {
      if (!ownByMovie.has(entry.movie_id)) ownByMovie.set(entry.movie_id, entry);
    });
    const seen = new Set<number>();
    return entries.flatMap(entry => {
      const ownEntry = ownByMovie.get(entry.movie_id);
      if (!ownEntry || seen.has(entry.movie_id)) return [];
      seen.add(entry.movie_id);
      return [{ ownEntry, personEntry: entry }];
    });
  }, [entries, ownEntries]);

  const toggleFollow = async () => {
    if (!user || !person) return;
    const previous = person;
    const next = !person.following;
    setPerson({ ...person, following: next, followers: Math.max(0, person.followers + (next ? 1 : -1)) });
    try {
      if (next) await discoveryService.follow(person.id);
      else await discoveryService.unfollow(person.id);
    } catch {
      setPerson(previous);
      return;
    }
    discoveryService.profile(username).then(result => {
      setPerson(result.person);
      setFollowers(result.followers);
      setFollowing(result.following);
    }).catch(() => undefined);
  };

  const toggleLike = async (entry: CommunityEntry) => {
    if (!user) return;
    const next = !entry.liked;
    setEntries(current => current.map(item => item.id === entry.id ? { ...item, liked: next, like_count: Math.max(0, item.like_count + (next ? 1 : -1)) } : item));
    try {
      if (next) await discoveryService.like(entry.id);
      else await discoveryService.unlike(entry.id);
    } catch {
      setEntries(current => current.map(item => item.id === entry.id ? { ...item, liked: !next, like_count: Math.max(0, item.like_count + (next ? -1 : 1)) } : item));
    }
  };

  if (loading) return <div className="loading-state page-loading"><div className="loading-spinner" /><span>Opening profile</span></div>;
  if (error || !person) return <div className="page-shell"><div className="error-state"><h1>{error || 'Member not found'}</h1><Link className="button button--secondary" to="/feed">Return to feed</Link></div></div>;

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
          {user && user.id !== person.id && <button aria-label={`${person.following ? 'Unfollow' : 'Follow'} @${person.username}`} aria-pressed={person.following} className="button button--primary" onClick={() => void toggleFollow()} type="button">{person.following ? <UserMinus size={18} /> : <UserPlus size={18} />}{person.following ? 'Following' : 'Follow'}</button>}
        </div>
      </header>

      <div className="page-shell member-content">
        {connectionView && <section aria-labelledby="member-connections-title" className="member-connections">
          <header><h2 id="member-connections-title">{connectionView === 'followers' ? 'Followers' : 'Following'}</h2><button aria-label="Close people list" onClick={() => setConnectionView(null)} type="button"><X aria-hidden="true" size={18} /></button></header>
          {(connectionView === 'followers' ? followers : following).length ? <div className="member-connections__list">{(connectionView === 'followers' ? followers : following).map(connection => <article key={connection.id}><Link aria-label={`Open @${connection.username}'s profile`} className="member-connections__avatar" to={`/member/${connection.username}`}>{connection.username.charAt(0).toUpperCase()}</Link><div><Link to={`/member/${connection.username}`}><strong>@{connection.username}</strong></Link><p>{connection.bio || 'No bio added.'}</p></div></article>)}</div> : <p className="member-connections__empty">No one here yet.</p>}
        </section>}

        <div aria-label="Choose profile view" className="product-section-tabs member-content__tabs" role="group">
          <button aria-pressed={view === 'responses'} onClick={() => setView('responses')} type="button">Responses {entries.length}</button>
          <button aria-pressed={view === 'shared'} onClick={() => setView('shared')} type="button">Shared films {sharedPairs.length}</button>
          <button aria-pressed={view === 'films'} onClick={() => setView('films')} type="button">Films {films.length}</button>
        </div>

        {view === 'responses' && (entries.length ? <section aria-label={`Responses from @${person.username}`} className="member-entries">
          {entries.map(entry => {
            return (
              <article className="public-entry" key={entry.id}>
                <Link className="public-entry__art" to={`/movie/${entry.movie_id}`}>{entry.poster_path ? <img alt={`Poster for ${entry.title}`} loading="lazy" src={imageUrl(entry.poster_path, 'w342') || ''} /> : <div />}</Link>
                <div className="public-entry__body">{entry.expression_image_path && <img alt={entry.expression_image_alt || `Expression photo shared by ${entry.username}`} className="public-entry__expression" loading="lazy" src={entry.expression_image_path} />}<p className="public-entry__meta">{formatCalendarDate(entry.watched_on, { month: 'long', day: 'numeric', year: 'numeric' })}</p><Link to={`/movie/${entry.movie_id}`}><h3>{entry.title}</h3></Link><blockquote>{entry.note || 'No words added.'}</blockquote><ResponseFeelingTrace entry={entry} /><div className="public-entry__actions"><button aria-label={`${entry.liked ? 'Unlike' : 'Like'} this response`} aria-pressed={entry.liked} className={`like-button${entry.liked ? ' like-button--active' : ''}`} disabled={!user} onClick={() => void toggleLike(entry)} type="button"><Heart fill={entry.liked ? 'currentColor' : 'none'} size={17} />{entry.like_count || 0} {(entry.like_count || 0) === 1 ? 'like' : 'likes'}</button><ResponseComments entryId={entry.id} initialCount={entry.comment_count} /></div></div>
              </article>
            );
          })}
        </section> : <div className="product-empty"><p>No public responses yet.</p></div>)}

        {view === 'shared' && (sharedPairs.length ? <section aria-label={`Films you share with @${person.username}`} className="member-shared-list">
          {sharedPairs.map(({ ownEntry, personEntry }) => <article className="member-shared-card" key={personEntry.movie_id}>
            <Link className="member-shared-card__poster" to={`/movie/${personEntry.movie_id}`}>{personEntry.poster_path ? <img alt={`Poster for ${personEntry.title}`} loading="lazy" src={imageUrl(personEntry.poster_path, 'w342') || ''} /> : <span />}</Link>
            <div className="member-shared-card__body"><Link to={`/movie/${personEntry.movie_id}`}><h2>{personEntry.title}</h2></Link><div className="member-shared-card__responses"><article><span>You</span><blockquote>{ownEntry.note || 'No words added.'}</blockquote><ResponseFeelingTrace entry={ownEntry} /></article><article><span>@{person.username}</span><blockquote>{personEntry.note || 'No words added.'}</blockquote><ResponseFeelingTrace entry={personEntry} /></article></div></div>
          </article>)}
        </section> : <div className="product-empty"><p>You have not responded to the same film yet.</p><Link className="text-link" to="/log">Add a response</Link></div>)}

        {view === 'films' && (films.length ? <section aria-label={`Films from @${person.username}'s responses`} className="member-film-grid">
          {films.map(entry => <Link className="member-film" key={entry.movie_id} to={`/movie/${entry.movie_id}`}>{entry.poster_path ? <img alt={`Poster for ${entry.title}`} loading="lazy" src={imageUrl(entry.poster_path, 'w342') || ''} /> : <span className="member-film__fallback" />}<strong>{entry.title}</strong><span>{releaseYear(entry.release_date)}</span></Link>)}
        </section> : <div className="product-empty"><p>No public films yet.</p></div>)}
      </div>
    </div>
  );
};

export default MemberProfile;
