import { SafetyActions } from '../components/discovery/SafetyActions';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { discoveryService, ResponseEntry } from '../services/discoveryService';
import { apiError } from '../services/apiClient';
import { ResponseFeelingTrace } from '../components/discovery/ResponseFeelingTrace';
import { ResponseComments } from '../components/discovery/ResponseComments';
import { ResponseDetails } from '../components/diary/ResponseDetails';
import { KeepRecommendation } from '../components/suggestions/KeepRecommendation';
import { formatCalendarDate } from '../utils/display';

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
  return <article className="page-shell response-reader">
    {error && <p role="alert" className="notice notice--error">{error} <button className="text-link" onClick={() => setRevision(value => value + 1)}>Retry</button></p>}
    {loading && !entry && <p role="status">Loading response</p>}
    {entry && <><Link className="text-link" to={`/member/${encodeURIComponent(entry.username)}`}>{entry.username}</Link><Link to={`/movie/${entry.movie_id}`}><h1>{entry.title}</h1></Link>
      <p className="metadata">Watched {formatCalendarDate(entry.watched_on, { dateStyle: 'long' })}{entry.visibility === 'private' && ' · Private response'}</p>
      <blockquote>{entry.note || 'No note on this viewing.'}</blockquote><ResponseDetails enjoyment={entry.enjoyment} highlights={entry.highlights} /><ResponseFeelingTrace entry={entry} />
        {entry.expression_image_path && <img className="response-reader__photo" src={entry.expression_image_path} alt={entry.expression_image_alt || 'Expression photo attached to this viewing'} />}
        {entry.visibility === 'public' && <div className="suggestion-actions"><button className="button button--quiet" disabled={busy} aria-pressed={entry.liked} onClick={() => void toggleLike()}>{entry.liked ? 'Unlike' : 'Like'} · {entry.like_count}</button><KeepRecommendation entryId={entry.id} authorId={entry.user_id} movieId={entry.movie_id} /></div>}
        {viewerId === entry.user_id && <div className="suggestion-actions"><Link className="button button--quiet" to={`/log?entryId=${entry.id}`}>Edit response</Link><button className="button button--quiet" disabled={busy} onClick={() => void remove()}>Delete viewing</button><Link className="text-link" to={`/suggestions?entryId=${entry.id}`}>Recommendations for this viewing</Link></div>}
        <SafetyActions kind="response" targetId={entry.id} personId={entry.user_id} username={entry.username} />
        {entry.visibility === 'public' && <ResponseComments entryId={entry.id} initialCount={entry.comment_count} />}
    </>}
  </article>;
}
