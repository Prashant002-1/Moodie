import { useCallback, useMemo, useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDiary } from '../contexts/DiaryContext';
import { useUser } from '../contexts/UserContext';
import { usePagedResource } from '../hooks/usePagedResource';
import { diaryService } from '../services/diaryService';
import { apiError } from '../services/apiClient';
import { ResponseDetails } from '../components/diary/ResponseDetails';
import { EmotionScores } from '../types/emotion';
import { dominantEmotion, emotionColors, emotionLabels, formatCalendarDate, imageUrl, releaseYear } from '../utils/display';

export default function Diary() {
  const { summary, error, refresh } = useDiary();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'saved' ? 'saved' : 'entries';
  const movieId = Number(params.get('movieId')) > 0 ? Number(params.get('movieId')) : undefined;
  const recent = summary?.recent;
  const feelings = (Object.keys(emotionLabels) as (keyof EmotionScores)[])
    .map(key => ({ key, value: Number(recent?.feelings[key] ?? 0) }))
    .filter(item => item.value > 0).sort((a, b) => b.value - a.value).slice(0, 4);
  return <div className="page-shell diary-page">
    {error && <p role="alert" className="error-text">{error} <button className="text-link" onClick={() => void refresh()}>Retry summary</button></p>}
    <header className="page-header diary-header">
      <h1 className="sr-only">Diary</h1>
      <div aria-label="Choose diary view" className="product-section-tabs" role="group">
        <button aria-pressed={view === 'entries'} onClick={() => setParams({})}>Entries</button>
        <button aria-pressed={view === 'saved'} onClick={() => setParams({ view: 'saved' })}>Saved</button>
      </div>
      <div className="suggestion-actions"><Link className="text-link" to="/suggestions">Recommendations</Link><Link className="text-link" to="/account">Account</Link><Link aria-label="Add a response" className="diary-add" to="/log"><Plus size={19} /></Link></div>
    </header>
    {view === 'entries' && <>
      {summary && !movieId && <section className="diary-overview" aria-label="Recent diary summary">
        <div className="diary-overview__feelings"><span>Last 30 viewing days · {recent?.entries ?? 0} viewings</span>
          <strong>{feelings.length ? feelings.map(item => emotionLabels[item.key]).join(' · ') : 'No feelings recorded in the last 30 days'}</strong>
          {!!feelings.length && <><div aria-label={`Recent feelings: ${feelings.map(item => emotionLabels[item.key]).join(', ')}`} className="diary-overview__trace" role="img">{feelings.map(item => <i key={item.key} style={{ background: emotionColors[item.key], flexGrow: item.value }} />)}</div>
            <ul aria-label="Feeling color key" className="diary-overview__legend">{feelings.map(item => <li key={item.key}><i aria-hidden="true" style={{ background: emotionColors[item.key] }} />{emotionLabels[item.key]}</li>)}</ul></>}
        </div>
        <dl><div><dt>Responses</dt><dd>{summary.entries}</dd></div><div><dt>Public</dt><dd>{summary.public_entries}</dd></div><div><dt>Rewatches</dt><dd>{summary.rewatches}</dd></div><div><dt>Saved</dt><dd>{summary.saved}</dd></div></dl>
      </section>}
      <ViewingHistory key={movieId ?? 'all'} movieId={movieId} />
    </>}
    {view === 'saved' && <SavedHistory />}
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
  return <section aria-label="Your viewings">
    {movieId && <header className="suggestions-heading"><h2>{page.items[0]?.title ?? 'Film history'}</h2><Link className="text-link" to="/diary">All viewings</Link></header>}
    <div className="diary-tools">
      <form role="search" onSubmit={event => { event.preventDefault(); setTerm(query.trim()); }}><label><Search aria-hidden="true" size={17} /><input aria-label="Search your diary" maxLength={200} onChange={event => setQuery(event.target.value)} placeholder="Search films or your words" type="search" value={query} /></label><button className="text-link" type="submit">Search diary</button></form>
      <div aria-label="Filter diary visibility" className="product-section-tabs" role="group">{(['all', 'public', 'private'] as const).map(option => <button key={option} aria-pressed={visibility === option} onClick={() => setVisibility(option)}>{option.charAt(0).toUpperCase() + option.slice(1)}</button>)}</div>
    </div>
    {(error || page.error) && <p role="alert" className="error-text">{error || page.error} <button className="text-link" onClick={page.refresh}>Refresh viewings</button></p>}
    {months.map(([month, entries]) => <section className="diary-year" key={month} aria-labelledby={`month-${month}`}><h2 id={`month-${month}`}>{formatCalendarDate(`${month}-01`, { month: 'long', year: 'numeric' })}</h2><div className="diary-list">{entries.map(entry => {
      const emotion = dominantEmotion(entry);
      return <article className="diary-entry" key={entry.id}>
        <Link className="diary-entry__poster" to={`/movie/${entry.movie_id}`}>{imageUrl(entry.poster_path, 'w342') ? <img alt={`Poster for ${entry.title}`} loading="lazy" src={imageUrl(entry.poster_path, 'w342')!} /> : <div />}</Link>
        <div className="diary-entry__body">
          <div className="diary-entry__topline"><p>{formatCalendarDate(entry.watched_on, { month: 'long', day: 'numeric', year: 'numeric' })}</p></div>
          <Link to={`/response/${entry.id}`}><h3>{entry.title}</h3></Link>
          <div className="diary-entry__facts"><span>{releaseYear(entry.release_date)}</span>{emotion && <span><i style={{ background: emotionColors[emotion.emotion] }} />{emotionLabels[emotion.emotion]}</span>}
            {!!entry.viewing_count && entry.viewing_count > 1 && <Link to={`/diary?movieId=${entry.movie_id}`}>{entry.viewing_count} viewings</Link>}
            <span className="diary-entry__visibility">{entry.visibility === 'public' ? <Eye size={14} /> : <EyeOff size={14} />}{entry.visibility === 'public' ? 'Public response' : 'Private response'}</span>
          </div>
          {entry.expression_image_path && <img alt={entry.expression_image_alt || 'Expression photo attached to this response'} className="diary-entry__expression" loading="lazy" src={entry.expression_image_path} />}
          {entry.note ? <blockquote>{entry.note}</blockquote> : <p className="diary-entry__empty-note">No note on this viewing.</p>}
          <ResponseDetails enjoyment={entry.enjoyment} highlights={entry.highlights} />
          <div className="suggestion-actions"><Link className="text-link" to={`/response/${entry.id}`}>Read response</Link><Link className="text-link" to={`/suggestions?entryId=${entry.id}`}>Recommendations for this viewing</Link></div>
        </div>
        <div className="diary-entry__actions"><Link aria-label={`Edit diary entry for ${entry.title}`} className="icon-button" to={`/log?entryId=${entry.id}`}><Pencil size={18} /></Link><button disabled={busy !== null} aria-label={`Delete diary entry for ${entry.title}`} className="icon-button" onClick={() => void remove(entry.id)}><Trash2 size={18} /></button></div>
      </article>;
    })}</div></section>)}
    {page.loading && <p role="status">Loading your viewings</p>}
    {page.loaded && !page.loading && !page.error && !page.items.length && <div className="product-empty"><p>{term || visibility !== 'all' ? 'No responses match these filters.' : movieId ? 'No viewings of this film yet.' : 'Your diary is empty.'}</p>{term || visibility !== 'all' ? <button className="text-link" onClick={() => { setQuery(''); setTerm(''); setVisibility('all'); }}>Clear filters</button> : <Link className="button button--primary" to={movieId ? `/log?movieId=${movieId}` : '/log'}>Add a response</Link>}</div>}
    {page.next !== null && <button className="button button--secondary" disabled={page.loading} onClick={page.loadMore}>Older viewings</button>}
  </section>;
}

function SavedHistory() {
  const { user } = useUser();
  const { revision, unsaveFilm } = useDiary();
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await diaryService.savedPage({ q: term || undefined, limit: 30, offset }, signal);
    return { items: result.films, next: result.nextOffset };
  }, [term]);
  const page = usePagedResource(`${user?.id}:saved:${revision}:${term}`, load);
  const remove = async (id: number) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await unsaveFilm(id); }
    catch (error) { setError(apiError(error, 'Film could not be removed. Try again.')); }
    finally { setBusy(false); }
  };
  return <section aria-label="Saved films" className="diary-saved">
    <form className="search-bar" role="search" onSubmit={event => { event.preventDefault(); setTerm(query.trim()); }}><input type="search" maxLength={200} aria-label="Search saved films" value={query} onChange={event => setQuery(event.target.value)} /><button className="button button--quiet">Search saved</button></form>
    {(error || page.error) && <p role="alert">{error || page.error} <button className="text-link" onClick={page.refresh}>Refresh saved films</button></p>}
    <div className="search-film-list">{page.items.map(film => <article className="search-film" key={film.id}><Link to={`/movie/${film.movie_id}`}>{imageUrl(film.poster_path, 'w154') ? <img alt={`Poster for ${film.title}`} loading="lazy" src={imageUrl(film.poster_path, 'w154')!} /> : <span />}</Link><div><Link to={`/movie/${film.movie_id}`}><h2>{film.title}</h2></Link><div className="search-film__actions"><Link to={`/log?movieId=${film.movie_id}`}>Add response</Link><Link to={`/suggestions?movieId=${film.movie_id}`}>Who recommended it</Link><button disabled={busy} onClick={() => void remove(film.movie_id)}>Remove from saved</button></div></div></article>)}</div>
    {page.loading && <p role="status">Loading saved films</p>}
    {page.loaded && !page.loading && !page.error && !page.items.length && <div className="product-empty"><p>{term ? 'No saved films match this search.' : 'No saved films yet.'}</p>{term ? <button className="text-link" onClick={() => { setTerm(''); setQuery(''); }}>Clear search</button> : <Link className="text-link" to="/search">Find a film</Link>}</div>}
    {page.next !== null && <button className="button button--secondary" disabled={page.loading} onClick={page.loadMore}>More saved films</button>}
  </section>;
}
