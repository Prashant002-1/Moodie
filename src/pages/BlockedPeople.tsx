import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { usePagedResource } from '../hooks/usePagedResource';
import { safetyService } from '../services/safetyService';
import { apiError } from '../services/apiClient';
import { Avatar } from '../components/common/Avatar';
import { personHue } from '../utils/person';
import { usePageTitle } from '../hooks/usePageTitle';

export default function BlockedPeople() {
  const { user } = useUser();
  usePageTitle('Blocked people');
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
  return <section className="page page--narrow">
    <header className="page__head"><h1>Blocked people</h1><Link className="link t-callout" to="/account">Account</Link></header>
    {page.items.length > 0 && <p className="hint">Unblocking allows interaction again. It does not restore follows.</p>}
    {notice && <p className="notice" role="status" style={{ marginTop: 'var(--m-space-4)' }}>{notice}</p>}
    {(error || page.error) && <p className="notice notice--error" role="alert" style={{ marginTop: 'var(--m-space-4)' }}>{error || page.error} <button className="link" onClick={page.refresh}>Refresh list</button></p>}
    <ul className="list">{page.items.map(person => <li className="row row--center" data-hue={personHue(person.username)} key={person.id}>
      <Avatar to={null} username={person.username} />
      <span className="row__main"><span className="strong truncate">@{person.username}</span></span>
      <button aria-label={`Unblock @${person.username}`} className="btn btn--secondary btn--small" disabled={busy !== null} onClick={() => void unblock(person.id, person.username)}>Unblock</button>
    </li>)}</ul>
    {page.loading && <p className="status" role="status">Loading blocked people</p>}
    {page.loaded && !page.items.length && !page.error && <p className="status">No blocked people.</p>}
    {page.next !== null && page.next !== undefined && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore}>More people</button></div>}
  </section>;
}
