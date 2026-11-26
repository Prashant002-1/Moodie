import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/common/Avatar';
import { RecommendationNote } from '../components/suggestions/RecommendationNote';
import { ActivityEvent, ActivityFilter, discoveryService } from '../services/discoveryService';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { usePagedResource } from '../hooks/usePagedResource';
import type { FilmSuggestion } from '../types/suggestion';
import { imageUrl } from '../utils/display';
import { personHue } from '../utils/person';
import { usePageTitle } from '../hooks/usePageTitle';

const filters: [ActivityFilter, string][] = [['all', 'All'], ['response', 'Responses'], ['recommendations', 'Recommendations'], ['like', 'Likes'], ['comment', 'Comments'], ['follow', 'Follows']];
// What happened, as the words before and after the film title. Follows have no film.
const phrases: Record<ActivityEvent['kind'], [string, string] | string> = {
  follow: 'followed you',
  like: ['liked your response to ', ''],
  comment: ['commented on your response to ', ''],
  response: ['responded to ', ''],
  suggestion: ['recommended ', ' to you'],
  suggestion_reply: ['told you how ', ' landed'],
  suggestion_message: ['continued your conversation about ', ''],
};
function description(event: ActivityEvent) {
  const phrase = phrases[event.kind];
  if (typeof phrase === 'string') return phrase;
  return <>{phrase[0]}<span className="film-inline">{event.title || 'a film'}</span>{phrase[1]}</>;
}
const when = (event: ActivityEvent) => <time className="event__when" dateTime={event.created_at}>{new Date(event.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>;

/**
 * A recommendation sent to you, as the note it is. The activity event carries
 * who sent it, the film and their reason. It does not carry the film's year,
 * a reminder, or what has happened to the recommendation since, so those
 * fields take the values that make the compact note show nothing for them.
 */
function receivedNote(event: ActivityEvent, viewer: { id: number; username?: string }): FilmSuggestion | null {
  if (event.kind !== 'suggestion' || !event.suggestion_id || !event.movie_id || !event.title || !event.comment_body) return null;
  return {
    id: event.suggestion_id, origin: 'sent', reason: event.comment_body,
    sender_id: event.actor_id, sender_username: event.username, recipient_id: viewer.id, recipient_username: viewer.username ?? '',
    movie_id: event.movie_id, title: event.title, poster_path: event.poster_path, backdrop_path: null, release_date: null,
    created_at: event.created_at, updated_at: event.created_at, archived: false, status: 'suggested', progress: 'sent', remind_at: null,
    linked_entry_id: null, source_entry_id: null, source_note: null, source_feelings: null, reply: null, message_count: 0, conversation_open: true,
  };
}

export default function Activity() {
  const { user } = useUser();
  usePageTitle('Activity');
  const { revision } = useDiary();
  const [kind, setKind] = useState<ActivityFilter>('all');
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await discoveryService.activityPage({ limit: 40, offset, kind }, signal);
    return { items: result.activity.map(event => ({ ...event, id: event.event_id })), next: result.nextOffset };
  }, [kind]);
  const page = usePagedResource(`${user?.id}:activity:${revision}:${kind}`, load);
  return <div className="page page--narrow">
    <header className="page__head"><h1>Activity</h1></header>
    <div aria-label="Filter activity" className="tabs" role="group">{filters.map(([value, label]) => <button aria-pressed={kind === value} key={value} onClick={() => setKind(value)} type="button">{label}</button>)}</div>
    {page.error && <p className="notice notice--error" role="alert" style={{ marginTop: 'var(--m-space-4)' }}>{page.error} <button className="link" onClick={page.refresh}>Retry activity</button></p>}
    <ul aria-label="Your activity" className="list">{page.items.map(event => {
      const note = user ? receivedNote(event, user) : null;
      if (note && user) return <li className="event--rec" key={event.id}><RecommendationNote compact item={note} viewerId={user.id} />{when(event)}</li>;
      const profile = `/member/${encodeURIComponent(event.username)}`;
      const destination = event.suggestion_id ? `/suggestions/${event.suggestion_id}` : event.entry_id ? `/response/${event.entry_id}` : null;
      const poster = imageUrl(event.poster_path, 'w154');
      // A comment, a reply, a message and a reason are words said to you. A response is what they wrote about the film.
      const said = event.kind === 'response' ? null : event.comment_body;
      return <li className="row" data-hue={personHue(event.username)} key={event.id}>
        <Avatar to={null} username={event.username} />
        <div className="row__main">
          <p className="byline event__line"><Link to={profile}>@{event.username}</Link> {destination ? <Link className="event__what" to={destination}>{description(event)}</Link> : description(event)}</p>
          {said && <blockquote className="quote quote--small clamp">{said}</blockquote>}
          {event.kind === 'response' && event.note && <p className="note clamp">{event.note}</p>}
          {when(event)}
        </div>
        {event.movie_id && destination && <Link className="poster poster--xs" tabIndex={-1} to={destination}>{poster && <img alt={`Poster for ${event.title}`} loading="lazy" src={poster} />}</Link>}
      </li>;
    })}</ul>
    {page.loading && <p className="status" role="status">Loading activity</p>}
    {page.loaded && !page.loading && !page.error && !page.items.length && <p className="status">No activity.</p>}
    {page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore}>Earlier activity</button></div>}
  </div>;
}
