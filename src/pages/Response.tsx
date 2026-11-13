import { SafetyActions } from '../components/discovery/SafetyActions';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Heart } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { discoveryService, ResponseEntry } from '../services/discoveryService';
import { apiError } from '../services/apiClient';
import { Feelings } from '../components/response/Feelings';
import { ResponseComments } from '../components/discovery/ResponseComments';
import { ResponseDetails } from '../components/diary/ResponseDetails';
import { KeepRecommendation } from '../components/suggestions/KeepRecommendation';
import { formatCalendarDate, imageUrl, releaseYear } from '../utils/display';

export default function Response() {
  const { id } = useParams();
  const { user } = useUser();
  return <ResponseReader key={`${user?.id}:${id}`} id={Number(id)} viewerId={user!.id} />;
}
function ResponseReader({ id, viewerId }: { id: number; viewerId: number }) {
  const navigate = useNavigate();
  const { removeEntry } = useDiary();
  const [entry, setEntry] = useState<ResponseEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    discoveryService.response(id, controller.signal).then(next => { if (!controller.signal.aborted) setEntry(next); })
      .catch(error => {
        if (controller.signal.aborted) return;
        setError(apiError(error, 'This response could not be loaded. Try again.'));
        if (axios.isAxiosError(error) && [401, 403, 404, 410].includes(error.response?.status ?? 0)) setEntry(null);
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);
  const toggleLike = async () => {
    if (!entry || busy) return;
    setBusy(true); setError('');
    try {
      if (entry.liked) await discoveryService.unlike(id); else await discoveryService.like(id);
      setEntry({ ...entry, liked: !entry.liked, like_count: Math.max(0, entry.like_count + (entry.liked ? -1 : 1)) });
    } catch (error) { setError(apiError(error)); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (busy || !window.confirm('Delete this viewing? Any reply linked to it will also be removed.')) return;
    setBusy(true); setError('');
    try { await removeEntry(id); navigate('/diary', { replace: true }); }
    catch (error) { setError(apiError(error)); }
    finally { setBusy(false); }
  };
  const poster = imageUrl(entry?.poster_path, 'w342');
  const likes = entry?.like_count || 0;
  return <article className="page page--narrow stack">
    {error && <p role="alert" className="notice notice--error">{error} <button className="link" onClick={() => setRevision(value => value + 1)} type="button">Retry</button></p>}
    {loading && !entry && <p className="status" role="status">Loading response</p>}
    {entry && <>
      <header className="response__head">
        <span aria-hidden="true" className="avatar">{entry.username.charAt(0)}</span>
        <p className="byline"><Link to={`/member/${encodeURIComponent(entry.username)}`}>@{entry.username}</Link></p>
      </header>
      <div className="response__body">
        <div className="response__text">
          <h1><Link to={`/movie/${entry.movie_id}`}>{entry.title}</Link><span className="title-year">{releaseYear(entry.release_date)}</span></h1>
          <p className="meta"><span>Watched {formatCalendarDate(entry.watched_on, { dateStyle: 'long' })}</span>{entry.visibility === 'private' && <span>Private</span>}</p>
          <Feelings entry={entry} />
          {entry.note && <p className="note note--lead">{entry.note}</p>}
          <ResponseDetails enjoyment={entry.enjoyment} highlights={entry.highlights} />
          {entry.expression_image_path && <img className="response__photo" src={entry.expression_image_path} alt={entry.expression_image_alt || 'Photo attached to this viewing'} />}
        </div>
        <Link className="poster" tabIndex={-1} to={`/movie/${entry.movie_id}`}>{poster && <img alt={`Poster for ${entry.title}`} src={poster} />}</Link>
      </div>
      {viewerId === entry.user_id && <div className="actions">
        <Link className="btn btn--secondary btn--small" to={`/log?entryId=${entry.id}`}>Edit response</Link>
        <button className="btn btn--quiet btn--small" disabled={busy} onClick={() => void remove()} type="button">Delete viewing</button>
        <Link className="link t-callout" to={`/suggestions?entryId=${entry.id}`}>Recommendations for this viewing</Link>
      </div>}
      {entry.visibility === 'public' && <footer className="response__foot">
        <button aria-label={`${entry.liked ? 'Unlike' : 'Like'} ${entry.username}'s response`} aria-pressed={entry.liked} disabled={busy} onClick={() => void toggleLike()} type="button"><Heart aria-hidden="true" fill={entry.liked ? 'currentColor' : 'none'} size={16} />{likes > 0 && <span>{likes}<span className="sr-only"> {likes === 1 ? 'like' : 'likes'}</span></span>}</button>
        <ResponseComments entryId={entry.id} initialCount={entry.comment_count} />
        <span className="push"><KeepRecommendation entryId={entry.id} authorId={entry.user_id} movieId={entry.movie_id} /></span>
      </footer>}
      <SafetyActions kind="response" targetId={entry.id} personId={entry.user_id} username={entry.username} />
    </>}
  </article>;
}
