import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { useLibraryState } from '../hooks/useLibraryState';
import { suggestionService } from '../services/suggestionService';
import { discoveryService, ResponseEntry } from '../services/discoveryService';
import { apiError } from '../services/apiClient';
import { FilmSuggestion, SuggestionAction, suggestionByline, suggestionContext, suggestionPerson, suggestionStatus } from '../types/suggestion';
import { imageUrl, releaseYear } from '../utils/display';
import { ResponseDetails } from '../components/diary/ResponseDetails';
import { ResponseFeelingTrace } from '../components/discovery/ResponseFeelingTrace';
import { SuggestionReplyForm } from '../components/suggestions/SuggestionReplyForm';
import { SuggestionViewingPicker } from '../components/suggestions/SuggestionViewingPicker';
import { SuggestionMessages } from '../components/suggestions/SuggestionMessages';
import { Spoiler } from '../components/suggestions/Spoiler';
import '../components/suggestions/Suggestions.css';

export default function SuggestionDetail() {
  const { id } = useParams();
  const { user } = useUser();
  return <SuggestionConversation key={`${user?.id}:${id}`} id={Number(id)} viewerId={user!.id} />;
}

function SuggestionConversation({ id, viewerId }: { id: number; viewerId: number }) {
  const { refresh: refreshDiary } = useDiary();
  const [item, setItem] = useState<FilmSuggestion | null>(null);
  const library = useLibraryState(item ? [item.movie_id] : []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [choosing, setChoosing] = useState(false);
  const [replyViewing, setReplyViewing] = useState<ResponseEntry | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    suggestionService.get(id, controller.signal).then(result => { if (!controller.signal.aborted) setItem(result); })
      .catch(error => {
        if (controller.signal.aborted) return;
        setError(apiError(error, 'This recommendation could not be loaded. Try again.'));
        if (axios.isAxiosError(error) && [401, 403, 404, 410].includes(error.response?.status ?? 0)) { setItem(null); setReplyViewing(null); setChoosing(false); }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);
  const refresh = () => setRevision(value => value + 1);
  const update = async (action: SuggestionAction) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      setItem(await suggestionService.update(id, action)); setChoosing(false);
      if (action.action === 'save') void refreshDiary();
    } catch (error) { setError(apiError(error)); }
    finally { setBusy(false); }
  };
  const openReply = async () => {
    if (!item?.linked_entry_id || busy) return;
    setBusy(true); setError('');
    try { setReplyViewing(await discoveryService.response(item.linked_entry_id)); }
    catch (error) { setError(apiError(error, 'Your viewing could not be loaded. Try again.')); }
    finally { setBusy(false); }
  };
  const retract = async () => {
    if (busy || !window.confirm('Remove your reply? Your diary stays as it is. Conversation messages stay until their author deletes them.')) return;
    setBusy(true); setError('');
    try { await suggestionService.removeReply(id); setItem(previous => previous ? { ...previous, reply: null } : null); refresh(); }
    catch (error) { setError(apiError(error)); }
    finally { setBusy(false); }
  };
  const received = item?.recipient_id === viewerId;
  return <div className="page-shell suggestions-page suggestion-detail">
    <div className="suggestions-heading"><Link className="text-link" to="/suggestions">Recommendations</Link><button className="text-link" onClick={refresh} disabled={loading || busy}>Refresh</button></div>
    {error && <p className="notice notice--error" role="alert">{error} <button className="text-link" onClick={refresh}>Retry</button></p>}
    {loading && !item && <p role="status">Loading recommendation</p>}
    {item && <>
      <header className="suggestion-detail__heading"><Link className="suggestion-byline" to={`/member/${encodeURIComponent(suggestionPerson(item, viewerId))}`}>{suggestionByline(item, viewerId)}</Link>
        <div className="suggestion-film"><div><Link to={`/movie/${item.movie_id}`}><h1>{item.title}</h1></Link><p className="metadata">{releaseYear(item.release_date ?? '')}</p></div>{imageUrl(item.poster_path, 'w154') && <img alt="" src={imageUrl(item.poster_path, 'w154')!} />}</div>
        <blockquote>{suggestionContext(item)}</blockquote>
        {item.origin === 'discovered' && !item.conversation_open && <p className="metadata">Kept from their response. Only you can see this.</p>}
        <div className="suggestion-actions"><span className="metadata">{item.archived ? 'Archived' : suggestionStatus[item.status]}</span>{item.source_entry_id && <Link className="text-link" to={`/response/${item.source_entry_id}`}>Their response</Link>}</div>
      </header>
      {received && library.error && <p role="alert">{library.error} <button className="text-link" onClick={library.refresh}>Retry library status</button></p>}
      {received && <section className="suggestion-next" aria-label="Your viewing">
        {replyViewing ? <SuggestionReplyForm item={item} viewing={replyViewing} onCancel={() => setReplyViewing(null)} onSaved={next => { setItem(next); setReplyViewing(null); }} /> : choosing ? <SuggestionViewingPicker item={item} busy={busy} onChoose={entryId => void update({ action: 'link', entryId })} onCancel={() => setChoosing(false)} /> : <>
          {item.linked_entry_id ? <><Link className="text-link" to={`/response/${item.linked_entry_id}`}>Read your viewing</Link><div className="suggestion-actions"><button className="button button--primary" disabled={busy} onClick={() => void openReply()}>{item.reply ? 'Edit your reply' : `Tell ${item.sender_username} how it landed`}</button>{!item.reply && <button className="button button--quiet" disabled={busy} onClick={() => setChoosing(true)}>Change linked viewing</button>}</div>{!item.reply && <p className="metadata">Your viewing stays private here until you choose what to send.</p>}</>
            : <><div className="suggestion-actions"><Link className="button button--primary" to={`/log?movieId=${item.movie_id}&suggestionId=${item.id}`}>I watched it</Link><button className="button button--secondary" disabled={busy || !library.get(item.movie_id) || library.get(item.movie_id)?.saved} onClick={() => void update({ action: 'save' })}>{library.get(item.movie_id)?.saved ? 'Saved for later' : 'Save for later'}</button></div><button className="text-link" disabled={busy} onClick={() => setChoosing(true)}>Link an existing viewing</button></>}
          <details className="suggestion-options"><summary>Recommendation options</summary><div className="suggestion-actions"><button className="button button--quiet" disabled={busy} onClick={() => void update({ action: item.archived ? 'restore' : 'archive' })}>{item.archived ? 'Restore recommendation' : 'Archive recommendation'}</button>{item.reply && <button className="button button--quiet" disabled={busy} onClick={() => void retract()}>Remove my reply</button>}</div></details>
        </>}
      </section>}
      {item.reply && <section className="suggestion-shared-reply"><h2>{received ? 'Your reply' : `${item.recipient_username}’s reply`}</h2>
        <Spoiler key={`${item.id}:${item.reply.updated_at}`} hidden={item.reply.contains_spoilers && !received}>
          <ResponseDetails enjoyment={item.reply.enjoyment} highlights={item.reply.highlights} /><p>{item.reply.note}</p>{item.reply.feelings && <ResponseFeelingTrace entry={item.reply.feelings} />}
          {item.source_feelings && item.reply.feelings && <details><summary>Two ways this film felt</summary><p>{item.sender_username}</p><ResponseFeelingTrace entry={item.source_feelings} /><p>{item.recipient_username}</p><ResponseFeelingTrace entry={item.reply.feelings} /></details>}
        </Spoiler>
      </section>}
      {item.conversation_open && <SuggestionMessages id={item.id} viewerId={viewerId} onRevoked={refresh} />}
      <Link className="text-link" to={`/suggestions/new?movieId=${item.movie_id}`}>Recommend this to someone</Link>
    </>}
  </div>;
}
