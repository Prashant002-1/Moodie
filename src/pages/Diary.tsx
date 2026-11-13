import { useCallback, useMemo, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useDiary } from '../contexts/DiaryContext';
import { useUser } from '../contexts/UserContext';
import { usePagedResource } from '../hooks/usePagedResource';
import { diaryService } from '../services/diaryService';
import { apiError } from '../services/apiClient';
import { ResponseDetails } from '../components/diary/ResponseDetails';
import { Feelings } from '../components/response/Feelings';
import { formatCalendarDate, imageUrl, releaseYear } from '../utils/display';

export default function Diary() {
  const { error, refresh } = useDiary();
  const [params] = useSearchParams();
  const movieId = Number(params.get('movieId')) > 0 ? Number(params.get('movieId')) : undefined;
  // Saved films live on the Watchlist page.
  if (params.get('view') === 'saved') return <Navigate replace to="/suggestions?box=saved" />;
  return <div className="page page--narrow">
    <header className="page__head"><h1>Diary</h1></header>
    {error && <p className="notice notice--error" role="alert">{error} <button className="link" onClick={() => void refresh()} type="button">Retry</button></p>}
    <ViewingHistory key={movieId ?? 'all'} movieId={movieId} />
  </div>;
}

function ViewingHistory({ movieId }: { movieId?: number }) {
  const { user } = useUser();
  const { revision, removeEntry } = useDiary();
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await diaryService.page({ movieId, q: term || undefined, visibility: visibility === 'all' ? undefined : visibility, limit: 30, offset }, signal);
    return { items: result.entries, next: result.nextOffset };
  }, [movieId, term, visibility]);
  const page = usePagedResource(`${user?.id}:diary:${revision}:${movieId}:${term}:${visibility}`, load);
  const items = page.items;
  const months = useMemo(() => {
    const groups = new Map<string, typeof items>();
    for (const entry of items) {
      const month = entry.watched_on.slice(0, 7);
      groups.set(month, [...(groups.get(month) ?? []), entry]);
    }
    return [...groups];
  }, [items]);
  const remove = async (id: number) => {
    if (busy || !window.confirm('Delete this viewing? Any reply linked to it will also be removed.')) return;
    setBusy(id); setError('');
    try { await removeEntry(id); }
    catch (error) { setError(apiError(error, 'This viewing could not be deleted. Try again.')); }
    finally { setBusy(null); }
  };
  const filtered = Boolean(term) || visibility !== 'all';
  return <section aria-label="Your viewings">
    {movieId && <header className="actions actions--spread" style={{ marginBottom: 'var(--m-space-5)' }}><h2>{page.items[0]?.title ?? 'Film history'}</h2><Link className="link" to="/diary">All viewings</Link></header>}
    <form className="search" role="search" onSubmit={event => { event.preventDefault(); setTerm(query.trim()); }}>
      <input aria-label="Search your diary" className="input" maxLength={200} onChange={event => setQuery(event.target.value)} placeholder="Film or words" type="search" value={query} />
      <button className="btn btn--secondary" type="submit">Search</button>
    </form>
    <div aria-label="Filter diary visibility" className="tabs" role="group" style={{ marginTop: 'var(--m-space-4)' }}>{(['all', 'public', 'private'] as const).map(option => <button key={option} aria-pressed={visibility === option} onClick={() => setVisibility(option)} type="button">{option.charAt(0).toUpperCase() + option.slice(1)}</button>)}</div>
    {(error || page.error) && <p className="notice notice--error" role="alert" style={{ marginTop: 'var(--m-space-4)' }}>{error || page.error} <button className="link" onClick={page.refresh} type="button">Retry</button></p>}
    {months.map(([month, entries]) => <section className="section" key={month} aria-labelledby={`month-${month}`}>
      <header className="section__head"><h2 id={`month-${month}`}>{formatCalendarDate(`${month}-01`, { month: 'long', year: 'numeric' })}</h2></header>
      <div className="list">{entries.map(entry => {
        const poster = imageUrl(entry.poster_path, 'w342');
        return <article className="row" key={entry.id}>
          <Link className="poster poster--sm" tabIndex={-1} to={`/movie/${entry.movie_id}`}>{poster && <img alt={`Poster for ${entry.title}`} loading="lazy" src={poster} />}</Link>
          <div className="row__main">
            <p className="t-caption muted">{formatCalendarDate(entry.watched_on, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            <h3 className="row__title"><Link to={`/response/${entry.id}`}>{entry.title}</Link><span className="title-year">{releaseYear(entry.release_date)}</span></h3>
            <Feelings entry={entry} />
            {entry.note && <p className="note">{entry.note}</p>}
            {entry.expression_image_path && <img alt={entry.expression_image_alt || 'Photo attached to this response'} className="response__photo" loading="lazy" src={entry.expression_image_path} />}
            <ResponseDetails enjoyment={entry.enjoyment} highlights={entry.highlights} />
            <footer className="response__foot">
              <span>{entry.visibility === 'public' ? 'Public' : 'Private'}</span>
              {!!entry.viewing_count && entry.viewing_count > 1 && !movieId && <Link to={`/diary?movieId=${entry.movie_id}`}>{entry.viewing_count} viewings</Link>}
              <Link aria-label={`Edit diary entry for ${entry.title}`} className="push" to={`/log?entryId=${entry.id}`}>Edit</Link>
              <button aria-label={`Delete diary entry for ${entry.title}`} disabled={busy !== null} onClick={() => void remove(entry.id)} type="button">Delete</button>
            </footer>
          </div>
        </article>;
      })}</div>
    </section>)}
    {page.loading && <p className="status" role="status">Loading viewings</p>}
    {page.loaded && !page.loading && !page.error && !page.items.length && <div className="empty">
      <p>{filtered ? 'No responses match these filters.' : movieId ? 'No viewings of this film.' : 'Your diary is empty.'}</p>
      {filtered ? <button className="link" onClick={() => { setQuery(''); setTerm(''); setVisibility('all'); }} type="button">Clear filters</button>
        : <Link className="btn btn--primary" to={movieId ? `/log?movieId=${movieId}` : '/log'}>Add a response</Link>}
    </div>}
    {page.next !== null && <div className="actions" style={{ marginTop: 'var(--m-space-5)' }}><button className="btn btn--secondary" disabled={page.loading} onClick={page.loadMore} type="button">Older viewings</button></div>}
  </section>;
}
