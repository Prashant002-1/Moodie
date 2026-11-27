import { useEffect, useState } from 'react';
import { useConfirm } from '../hooks/useConfirm';
import axios from 'axios';
import { Link, useLocation, useParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import { useDiary } from '../contexts/DiaryContext';
import { useLibraryState } from '../hooks/useLibraryState';
import { suggestionService } from '../services/suggestionService';
import { discoveryService, ResponseEntry } from '../services/discoveryService';
import { apiError } from '../services/apiClient';
import { FilmSuggestion, SuggestionAction } from '../types/suggestion';
import { personHue } from '../utils/person';
import { Avatar } from '../components/common/Avatar';
import { ResponseDetails } from '../components/diary/ResponseDetails';
import { Feelings } from '../components/response/Feelings';
import { RecommendationNote } from '../components/suggestions/RecommendationNote';
import { RemindMe } from '../components/suggestions/RemindMe';
import { SuggestionReplyForm } from '../components/suggestions/SuggestionReplyForm';
import { SuggestionViewingPicker } from '../components/suggestions/SuggestionViewingPicker';
import { SuggestionMessages } from '../components/suggestions/SuggestionMessages';
import { Spoiler } from '../components/suggestions/Spoiler';
import { usePageTitle } from '../hooks/usePageTitle';
import { Mark } from '../components/common/Mark';

export default function SuggestionDetail() {
  const { id } = useParams();
  const { user } = useUser();
  return <SuggestionConversation key={`${user?.id}:${id}`} id={Number(id)} viewerId={user!.id} />;
}

/** One recommendation as a page: the note, the next step, the reply, the conversation. */
function SuggestionConversation({ id, viewerId }: { id: number; viewerId: number }) {
  const confirm = useConfirm();
  const { refresh: refreshDiary } = useDiary();
  const [item, setItem] = useState<FilmSuggestion | null>(null);
  const library = useLibraryState(item ? [item.movie_id] : []);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [choosing, setChoosing] = useState(false);
  const [replyViewing, setReplyViewing] = useState<ResponseEntry | null>(null);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setGone(false);
    suggestionService.get(id, controller.signal).then(result => { if (!controller.signal.aborted) setItem(result); })
      .catch(error => {
        if (controller.signal.aborted) return;
        setError(apiError(error, 'This recommendation could not be loaded. Try again.'));
        if (axios.isAxiosError(error) && [401, 403, 404, 410].includes(error.response?.status ?? 0)) { setItem(null); setReplyViewing(null); setChoosing(false); setGone(true); }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, revision]);
  usePageTitle(item ? `${item.title}, ${item.recipient_id === viewerId ? `from ${item.sender_username}` : `for ${item.recipient_username}`}` : 'Recommendation');
  const refresh = () => setRevision(value => value + 1);
  // Arriving straight from sending it: say that it went.
  const sentTo = (useLocation().state as { sent?: string } | null)?.sent;
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
    if (busy || !(await confirm({ title: 'Remove your reply?', body: 'Your diary stays as it is. Conversation messages stay until their author deletes them.', action: 'Remove reply' }))) return;
    setBusy(true); setError('');
    try { await suggestionService.removeReply(id); setItem(previous => previous ? { ...previous, reply: null } : null); refresh(); }
    catch (error) { setError(apiError(error)); }
    finally { setBusy(false); }
  };
  const received = item?.recipient_id === viewerId;
  const saved = item ? library.get(item.movie_id) : undefined;
  return <>
    <section className="band band--tight">
      <div className="box box--narrow stack">
        <div className="actions actions--spread t-caption"><Link className="link" to="/suggestions">Recommendations</Link><button className="link" onClick={refresh} disabled={loading || busy}>Refresh</button></div>
        {loading && !item && <p className="status" role="status">Loading recommendation</p>}
        {!loading && !item && <h1>{gone ? 'This recommendation is not available' : 'This recommendation could not be loaded'}</h1>}
        {!loading && !item && gone && <p className="secondary">It may have been removed, or it is between two other people.</p>}
        {item && <RecommendationNote headingLevel={1} item={item} page tracker viewerId={viewerId}>
          {item.source_entry_id && <p className="t-caption"><Link className="link" to={`/response/${item.source_entry_id}`}>Their response</Link></p>}
          {item.origin === 'discovered' && !item.conversation_open && <p className="hint">Kept from their response. Only you can see this.</p>}
        </RecommendationNote>}
      </div>
    </section>
    {/* The same column as the note above. */}
    <div className="page page--narrow"><div className="stack stack--loose">
      {error && !gone && <p className="notice notice--error" role="alert">{error} <button className="link" onClick={refresh}>Retry</button></p>}
      {item && sentTo && <p className="said-so said-so--sent" role="status"><Mark name="plane" size={40} />Sent to {sentTo}.</p>}
      {item && <>
        {received && library.error && <p className="notice notice--error" role="alert">{library.error} <button className="link" onClick={library.refresh}>Retry library status</button></p>}
        {received && <section aria-label="Your viewing" className="stack">
          {replyViewing ? <SuggestionReplyForm item={item} viewing={replyViewing} onCancel={() => setReplyViewing(null)} onSaved={next => { setItem(next); setReplyViewing(null); }} /> : choosing ? <SuggestionViewingPicker item={item} busy={busy} onChoose={entryId => void update({ action: 'link', entryId })} onCancel={() => setChoosing(false)} /> : <>
            {item.linked_entry_id ? <>
              <div className="actions">
                <button className="btn btn--primary" disabled={busy} onClick={() => void openReply()}>{item.reply ? 'Edit your reply' : `Tell ${item.sender_username} how it landed`}</button>
                <Link className="btn btn--quiet" to={`/response/${item.linked_entry_id}`}>Read your viewing</Link>
                {!item.reply && <button className="btn btn--quiet" disabled={busy} onClick={() => setChoosing(true)}>Change linked viewing</button>}
              </div>
              {!item.reply && <p className="hint">Your viewing stays private here until you choose what to send.</p>}
            </> : <>
              {/* The buttons keep one line. A reminder that is set reads as a line of its own under them. */}
              <div className="actions">
                <Link className="btn btn--primary" to={`/log?movieId=${item.movie_id}&suggestionId=${item.id}`}>I watched it</Link>
                <button className="btn btn--secondary" disabled={busy || !saved || saved.saved} onClick={() => void update({ action: 'save' })}>{saved?.saved ? 'Saved for later' : 'Save for later'}</button>
                {!item.archived && !item.remind_at && <RemindMe item={item} onChange={setItem} small={false} />}
                <button className="btn btn--quiet" disabled={busy} onClick={() => setChoosing(true)}>Link an existing viewing</button>
              </div>
              {!item.archived && item.remind_at && <RemindMe item={item} onChange={setItem} small={false} />}
            </>}
            <details className="disclosure"><summary>Options</summary><div className="actions"><button className="btn btn--secondary btn--small" disabled={busy} onClick={() => void update({ action: item.archived ? 'restore' : 'archive' })}>{item.archived ? 'Restore recommendation' : 'Archive recommendation'}</button>{item.reply && <button className="btn btn--secondary btn--small" disabled={busy} onClick={() => void retract()}>Remove my reply</button>}</div></details>
          </>}
        </section>}
        {item.reply && <section className="stack" data-hue={personHue(item.recipient_username)}>
          <header className="section__head"><h2>{received ? 'Your reply' : `${item.recipient_username}’s reply`}</h2></header>
          <Spoiler key={`${item.id}:${item.reply.updated_at}`} hidden={item.reply.contains_spoilers && !received}>
            <div className="said">
              <Avatar username={item.recipient_username} />
              <div className="said__main">
                <ResponseDetails enjoyment={item.reply.enjoyment} highlights={item.reply.highlights} />
                {item.reply.note && <blockquote className="quote">{item.reply.note}</blockquote>}
                {item.reply.feelings && <Feelings entry={item.reply.feelings} />}
              </div>
            </div>
            {item.source_feelings && item.reply.feelings && <details className="disclosure"><summary>Two ways this film felt</summary><div className="two-up">
              <div className="stack stack--tight" data-hue={personHue(item.sender_username)}><p className="byline"><strong>{item.sender_username}</strong></p><Feelings entry={item.source_feelings} /></div>
              <div className="stack stack--tight"><p className="byline"><strong>{item.recipient_username}</strong></p><Feelings entry={item.reply.feelings} /></div>
            </div></details>}
          </Spoiler>
        </section>}
        {item.conversation_open && <SuggestionMessages id={item.id} viewerId={viewerId} onRevoked={refresh} />}
        <p><Link className="link" to={`/suggestions/new?movieId=${item.movie_id}`}>Recommend this to someone</Link></p>
      </>}
    </div></div>
  </>;
}
