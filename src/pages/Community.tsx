import React, { useEffect, useState } from 'react';
import { Heart, Plus, UserMinus, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { CommunityEntry, CommunityPerson, discoveryService } from '../services/discoveryService';
import { EmotionScores } from '../types/emotion';
import { emotionColors, emotionLabels, imageUrl, releaseYear } from '../utils/display';

const emotionKeys = Object.keys(emotionColors) as (keyof EmotionScores)[];

const Feed: React.FC = () => {
  const { user } = useUser();
  const [entries, setEntries] = useState<CommunityEntry[]>([]);
  const [people, setPeople] = useState<CommunityPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([discoveryService.feed(36), discoveryService.people()])
      .then(([nextEntries, nextPeople]) => {
        if (!active) return;
        setEntries(nextEntries);
        setPeople(nextPeople);
      })
      .catch(() => active && setError('The feed could not be loaded.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user?.id]);

  const toggleFollow = async (person: CommunityPerson) => {
    if (!user) return;
    const next = !person.following;
    setPeople(current => current.map(item => item.id === person.id ? { ...item, following: next } : item));
    setEntries(current => current.map(item => item.user_id === person.id ? { ...item, following: next } : item));
    try {
      if (next) await discoveryService.follow(person.id);
      else await discoveryService.unfollow(person.id);
    } catch {
      setPeople(current => current.map(item => item.id === person.id ? { ...item, following: !next } : item));
      setEntries(current => current.map(item => item.user_id === person.id ? { ...item, following: !next } : item));
    }
  };

  const toggleEntryFollow = async (entry: CommunityEntry) => {
    const person = people.find(item => item.id === entry.user_id);
    if (person) await toggleFollow(person);
  };

  const toggleReaction = async (entry: CommunityEntry) => {
    if (!user) return;
    const next = !entry.reacted;
    setEntries(current => current.map(item => item.id === entry.id ? { ...item, reacted: next, reaction_count: Math.max(0, item.reaction_count + (next ? 1 : -1)) } : item));
    try {
      if (next) await discoveryService.react(entry.id);
      else await discoveryService.unreact(entry.id);
    } catch {
      setEntries(current => current.map(item => item.id === entry.id ? { ...item, reacted: !next, reaction_count: Math.max(0, item.reaction_count + (next ? -1 : 1)) } : item));
    }
  };

  return (
    <div className="page-shell feed-page">
      <header className="feed-header">
        <h1 className="page-title">Feed</h1>
        <Link className="button button--primary" to="/log"><Plus size={18} />Share a film</Link>
      </header>

      {loading ? <div className="loading-state"><div className="loading-spinner" /><span>Loading feed</span></div> : error ? <div className="error-state"><p>{error}</p></div> : (
        <div className="feed-layout">
          <section aria-label="Film responses" className="feed-stream">
            {entries.length ? entries.map((entry, index) => {
              const poster = imageUrl(entry.poster_path, 'w342');
              const strongFeelings = emotionKeys
                .map(key => ({ key, value: Number(entry[key]) || 0 }))
                .filter(item => item.value >= 0.18)
                .sort((a, b) => b.value - a.value)
                .slice(0, 3);
              return (
                <article className={`feed-post${entry.expression_image_path ? ' feed-post--with-photo' : ''}`} data-reveal key={entry.id} style={{ '--reveal-order': index % 4 } as React.CSSProperties}>
                  <header className="feed-post__header">
                    <Link className="person-avatar" to={`/member/${entry.username}`}>{entry.username.charAt(0).toUpperCase()}</Link>
                    <p><Link to={`/member/${entry.username}`}><strong>@{entry.username}</strong></Link><span>{new Date(entry.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></p>
                    {!entry.following && entry.user_id !== user?.id && <button className="feed-post__follow" onClick={() => void toggleEntryFollow(entry)} type="button">Follow</button>}
                  </header>

                  {entry.expression_image_path && (
                    <figure className="feed-post__expression">
                      <img alt={entry.expression_image_alt || `Expression photo shared by ${entry.username}`} loading="lazy" src={entry.expression_image_path} />
                      <figcaption>Expression photo</figcaption>
                    </figure>
                  )}

                  <div className="feed-post__response">
                    <blockquote>{entry.note}</blockquote>
                    <div className="feed-post__feelings" aria-label="Feelings shared with this post">
                      {strongFeelings.map(({ key, value }) => (
                        <span key={key}><i style={{ '--feeling-color': emotionColors[key], '--feeling-value': value } as React.CSSProperties} /><b>{emotionLabels[key]}</b></span>
                      ))}
                    </div>
                    <div className="feeling-trace" aria-hidden="true">
                      {emotionKeys.map(key => {
                        const value = Number(entry[key]) || 0;
                        return value > 0.01 ? <span key={key} style={{ backgroundColor: emotionColors[key], flexGrow: value }} /> : null;
                      })}
                    </div>
                  </div>

                  <footer className="feed-post__footer">
                    <Link className="feed-post__film" to={`/movie/${entry.movie_id}`}>
                      {poster ? <img alt="" aria-hidden="true" loading="lazy" src={poster} /> : <span />}
                      <p><strong>{entry.title}</strong><span>{releaseYear(entry.release_date)}</span></p>
                    </Link>
                    <button aria-label={`${entry.reacted ? 'Remove reaction from' : 'React to'} ${entry.username}'s post`} aria-pressed={entry.reacted} className={`reaction-button${entry.reacted ? ' reaction-button--active' : ''}`} onClick={() => void toggleReaction(entry)} type="button"><Heart fill={entry.reacted ? 'currentColor' : 'none'} size={18} /><span>{entry.reaction_count || 0}</span></button>
                  </footer>
                </article>
              );
            }) : <div className="community-empty"><h2>No posts yet.</h2><Link className="button button--primary" to="/log">Share a film</Link></div>}
          </section>

          <aside className="feed-people" aria-labelledby="feed-people-title">
            <div className="feed-people__heading"><h2 id="feed-people-title">People</h2><Link to="/recommendations">Discover films</Link></div>
            {people.slice(0, 8).map(person => {
              return (
                <article className="feed-person" key={person.id}>
                  <Link className="person-avatar" to={`/member/${person.username}`}>{person.username.charAt(0).toUpperCase()}</Link>
                  <div><Link to={`/member/${person.username}`}><h3>@{person.username}</h3></Link><p>{person.entries} public {person.entries === 1 ? 'response' : 'responses'}</p></div>
                  <button aria-label={`${person.following ? 'Unfollow' : 'Follow'} ${person.username}`} className="icon-button" onClick={() => void toggleFollow(person)} type="button">{person.following ? <UserMinus size={18} /> : <UserPlus size={18} />}</button>
                </article>
              );
            })}
          </aside>
        </div>
      )}
    </div>
  );
};

export default Feed;
