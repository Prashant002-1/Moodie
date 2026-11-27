import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Introductions } from '../components/paths/Introductions';
import { PathCard } from '../components/paths/PathCard';
import { StarterFilms } from '../components/paths/StarterFilms';
import { useDiary } from '../contexts/DiaryContext';
import { useUser } from '../contexts/UserContext';
import { usePagedResource } from '../hooks/usePagedResource';
import { usePageTitle } from '../hooks/usePageTitle';
import { pathService } from '../services/pathService';
import { Mark } from '../components/common/Mark';

/** Films that reach the viewer through people: those they follow, those whose picks landed, those who felt alike. */
const Recommendations = () => {
  const { user } = useUser();
  const { revision } = useDiary();
  usePageTitle('Through people');
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await pathService.films({ limit: 12, offset }, signal);
    return { items: result.films.map(item => ({ ...item, id: item.film.id })), next: result.nextOffset, metadata: { connected: result.connected, diary: result.diary } };
  }, []);
  // Identity is the account alone. Saving a film or setting one aside changes the card in place, not the list under it.
  // While it is empty, a new answer in the diary reads it again.
  const [version, setVersion] = useState(0);
  const page = usePagedResource(`${user?.id}:paths`, load, version);
  const empty = page.loaded && !page.loading && !page.error && !page.items.length;
  useEffect(() => { if (empty) setVersion(revision); }, [empty, revision]);

  return <div className="page page--narrow">
    <header className="page__head"><h1>Through people</h1></header>
    {page.error && <p className="notice notice--error" role="alert">Films could not be loaded. <button className="link" onClick={page.refresh} type="button">Try again</button></p>}
    {page.items.length > 0 && <div className="paths">{page.items.map(item => <PathCard headingLevel={2} item={item} key={item.id} />)}</div>}
    {page.loading && <p className="status" role="status">Loading films</p>}
    {empty && <div className="stack stack--loose">
      <Mark name={page.metadata?.connected ? 'reel' : 'seats'} />
      <p className="status" style={{ textAlign: 'left', padding: 0 }}>{page.metadata?.connected ? 'Nothing new through the people you know.' : 'Films reach you here through people: the ones you follow, and the ones who felt the way you did about a film.'}</p>
      <section aria-label="Films you may have seen"><header className="section__head"><h2>Seen any of these?</h2><Link to="/log">Log another film</Link></header><StarterFilms limit={12} /></section>
      <Introductions limit={6} more />
    </div>}
    {page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-6)' }}><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore} type="button">More films</button></div>}
  </div>;
};

export default Recommendations;
