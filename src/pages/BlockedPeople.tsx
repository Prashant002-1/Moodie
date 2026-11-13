import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { usePagedResource } from '../hooks/usePagedResource';
import { safetyService } from '../services/safetyService';
import { apiError } from '../services/apiClient';

export default function BlockedPeople() {
  const { user } = useUser();
  const { refresh } = useDiary();
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await safetyService.blocked(offset, signal);
    return { items: result.people, next: result.nextOffset };
  }, []);
  const page = usePagedResource(`${user?.id}:blocks`, load);
  const unblock = async (id: number, username: string) => {
    if (busy !== null) return;
    setBusy(id); setError(''); setNotice('');
    try {
      await safetyService.unblock(id);
      page.updateItems(people => people.filter(person => person.id !== id));
      setNotice(`${username} is unblocked. Follows have not been restored.`);
      page.refresh(); void refresh();
    } catch (caught) { setError(apiError(caught, 'This person could not be unblocked. Try again.')); }
    finally { setBusy(null); }
  };
  return <section className="page-shell account-page"><Link className="text-link" to="/account">Account</Link><h1>Blocked people</h1>
    <p>Unblocking allows interaction again. It does not restore follows.</p>
    {notice && <p role="status">{notice}</p>}
    {(error || page.error) && <p role="alert">{error || page.error} <button className="text-link" onClick={page.refresh}>Refresh list</button></p>}
    <div className="blocked-people">{page.items.map(person => <article key={person.id}><span>@{person.username}</span><button className="button button--quiet" disabled={busy !== null} onClick={() => void unblock(person.id, person.username)}>Unblock @{person.username}</button></article>)}</div>
    {page.loading && <p role="status">Loading blocked people</p>}
    {page.loaded && !page.items.length && !page.error && <p>No blocked people.</p>}
    {page.next !== null && page.next !== undefined && <button className="button button--quiet" disabled={page.loading} onClick={page.loadMore}>More people</button>}
  </section>;
}
