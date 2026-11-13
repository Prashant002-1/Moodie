import { Heart, MessageCircle, UserPlus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { ActivityEvent, ActivityFilter, discoveryService } from '../services/discoveryService';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { usePagedResource } from '../hooks/usePagedResource';
import { imageUrl } from '../utils/display';

const filters: [ActivityFilter, string][] = [['all', 'All activity'], ['response', 'Responses'], ['recommendations', 'Recommendations'], ['like', 'Likes'], ['comment', 'Comments'], ['follow', 'Follows']];
function description(event: ActivityEvent) {
  const film = event.title || 'a film';
  switch (event.kind) {
    case 'follow': return 'followed you';
    case 'like': return `liked your response to ${film}`;
    case 'comment': return `commented on your response to ${film}`;
    case 'response': return `responded to ${film}`;
    case 'suggestion': return `recommended ${film} to you`;
    case 'suggestion_reply': return `told you how ${film} landed`;
    case 'suggestion_message': return `continued your conversation about ${film}`;
  }
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
  const loadCircle = useCallback(async (_cursor: string | undefined, signal: AbortSignal) => {
    const result = await discoveryService.feedPage({ scope: 'following', limit: 6 }, signal);
    return { items: result.entries, next: null };
  }, []);
  const circle = usePagedResource(`${user?.id}:activity-circle:${revision}`, loadCircle);
  return <div className="page-shell activity-page">
    <header className="activity-toolbar"><h1 className="sr-only">Activity</h1>
      <label className="field">Show<select aria-label="Filter activity" value={kind} onChange={event => setKind(event.target.value as ActivityFilter)}>{filters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <button className="text-link" disabled={page.loading} onClick={page.refresh}>Refresh activity</button>
    </header>
    <div className="activity-layout"><section aria-label="Your activity" className="activity-list">
      {page.error && <p role="alert">{page.error} <button className="text-link" onClick={page.refresh}>Retry activity</button></p>}
      {page.items.map(event => {
        const destination = event.suggestion_id ? `/suggestions/${event.suggestion_id}` : event.entry_id ? `/response/${event.entry_id}` : `/member/${encodeURIComponent(event.username)}`;
        return <article className="activity-event" key={event.id}>
          <Link className="activity-event__avatar" to={`/member/${encodeURIComponent(event.username)}`}>{event.username.charAt(0).toUpperCase()}</Link>
          <div className="activity-event__body"><p><Link to={`/member/${encodeURIComponent(event.username)}`}><strong>@{event.username}</strong></Link> <Link to={destination}>{description(event)}</Link></p>
            {event.comment_body && <blockquote>{event.comment_body}</blockquote>}
            {event.kind === 'response' && event.note && <blockquote>{event.note}</blockquote>}
            <time dateTime={event.created_at}>{new Date(event.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
          </div>
          <div className="activity-event__mark">{event.kind === 'like' ? <Heart aria-hidden="true" size={17} /> : event.kind === 'follow' ? <UserPlus aria-hidden="true" size={17} /> : <MessageCircle aria-hidden="true" size={17} />}</div>
        </article>;
      })}
      {page.loading && <p role="status">Loading activity</p>}
      {page.loaded && !page.loading && !page.error && !page.items.length && <div className="product-empty"><p>No activity here yet.</p></div>}
      {page.next !== null && <button className="button button--secondary" disabled={page.loading} onClick={page.loadMore}>Earlier activity</button>}
    </section>
    <aside className="activity-circle"><h2>From people you follow</h2>
      {circle.error && <p role="alert">{circle.error} <button className="text-link" onClick={circle.refresh}>Retry circle</button></p>}
      {circle.items.map(entry => <article className="activity-circle__entry" key={entry.id}>
        <Link to={`/movie/${entry.movie_id}`}>{imageUrl(entry.poster_path, 'w154') ? <img alt={`Poster for ${entry.title}`} loading="lazy" src={imageUrl(entry.poster_path, 'w154')!} /> : <span />}</Link>
        <div><Link to={`/member/${encodeURIComponent(entry.username)}`}>@{entry.username}</Link><Link to={`/response/${entry.id}`}><strong>{entry.title}</strong></Link><p>{entry.note || 'No note added.'}</p></div>
      </article>)}
      {circle.loaded && !circle.error && !circle.items.length && <p className="metadata">Follow people to see their latest responses here.</p>}
      <Link className="text-link" to="/feed?view=following">Open Following</Link>
    </aside></div>
  </div>;
}
