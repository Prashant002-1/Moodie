import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ActivityEvent, ActivityFilter, discoveryService } from '../services/discoveryService';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { usePagedResource } from '../hooks/usePagedResource';

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
export default function Activity() {
  const { user } = useUser();
  const { revision } = useDiary();
  const [kind, setKind] = useState<ActivityFilter>('all');
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await discoveryService.activityPage({ limit: 40, offset, kind }, signal);
    return { items: result.activity.map(event => ({ ...event, id: event.event_id })), next: result.nextOffset };
  }, [kind]);
  const page = usePagedResource(`${user?.id}:activity:${revision}:${kind}`, load);
  return <div className="page page--narrow">
    <h1 className="sr-only">Activity</h1>
    <div aria-label="Filter activity" className="tabs" role="group">{filters.map(([value, label]) => <button aria-pressed={kind === value} key={value} onClick={() => setKind(value)} type="button">{label}</button>)}</div>
    {page.error && <p className="notice notice--error" role="alert" style={{ marginTop: 'var(--m-space-4)' }}>{page.error} <button className="link" onClick={page.refresh}>Retry activity</button></p>}
    <ul aria-label="Your activity" className="list">{page.items.map(event => {
      const profile = `/member/${encodeURIComponent(event.username)}`;
      const destination = event.suggestion_id ? `/suggestions/${event.suggestion_id}` : event.entry_id ? `/response/${event.entry_id}` : null;
      return <li className="row" key={event.id}>
        <span aria-hidden="true" className="avatar">{event.username.charAt(0)}</span>
        <div className="row__main">
          <p className="byline"><Link to={profile}>@{event.username}</Link> {destination ? <Link className="byline__rest" to={destination}>{description(event)}</Link> : description(event)}</p>
          {event.comment_body && <p className="note clamp">{event.comment_body}</p>}
          {event.kind === 'response' && event.note && <p className="note clamp">{event.note}</p>}
        </div>
        <time className="row__aside t-caption muted" dateTime={event.created_at}>{new Date(event.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
      </li>;
    })}</ul>
    {page.loading && <p className="status" role="status">Loading activity</p>}
    {page.loaded && !page.loading && !page.error && !page.items.length && <p className="status">No activity.</p>}
    {page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore}>Earlier activity</button></div>}
  </div>;
}
