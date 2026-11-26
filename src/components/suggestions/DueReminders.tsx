import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { usePagedResource } from '../../hooks/usePagedResource';
import { suggestionService } from '../../services/suggestionService';
import { FilmSuggestion, formatReminder, reminderDue } from '../../types/suggestion';
import { RecommendationNote } from './RecommendationNote';

/** Recommendations whose reminder has come due, shown at the top of Home. Nothing is rendered when none are. */
export function DueReminders() {
  const { user } = useUser();
  // The reminders box is soonest first, so everything due is at the front of one page.
  const load = useCallback(async (_offset: number | undefined, signal: AbortSignal) => {
    const page = await suggestionService.list({ box: 'reminders', limit: 12 }, signal);
    return { items: page.suggestions, next: null };
  }, []);
  const page = usePagedResource(`${user?.id}:due-reminders`, load);
  const [moved, setMoved] = useState('');
  const { updateItems } = page;
  const change = (next: FilmSuggestion) => {
    updateItems(items => items.map(item => item.id === next.id ? next : item));
    setMoved(next.remind_at ? `Reminder moved to ${formatReminder(next.remind_at)}.` : 'Reminder cleared.');
  };
  const due = page.items.filter(item => reminderDue(item));
  if (!user || (!due.length && !moved)) return null;
  return <section aria-label="Reminders">
    {due.length > 0 && <>
      <header className="section__head"><h2>Reminders</h2><Link to="/suggestions?box=reminders">All reminders</Link></header>
      <div className="notes">{due.map(item => <RecommendationNote compact item={item} key={item.id} later onChange={change} primary={false} viewerId={user.id} />)}</div>
    </>}
    {moved && <p className="t-caption muted" role="status" style={{ marginTop: due.length ? 'var(--m-space-3)' : 0 }}>{moved}</p>}
  </section>;
}
