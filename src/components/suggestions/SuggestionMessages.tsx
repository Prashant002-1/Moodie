import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePagedResource } from '../../hooks/usePagedResource';
import { suggestionService } from '../../services/suggestionService';
import { apiError } from '../../services/apiClient';
import { personHue } from '../../utils/person';
import { Avatar } from '../common/Avatar';
import { Spoiler } from './Spoiler';

/** What two people said to each other about one recommendation, each in their own colour. */
export function SuggestionMessages({ id, viewerId, onRevoked }: { id: number; viewerId: number; onRevoked: () => void }) {
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await suggestionService.messages(id, offset, signal);
    return { items: result.messages, next: result.nextOffset };
  }, [id]);
  const page = usePagedResource(`${viewerId}:messages:${id}`, load);
  const [body, setBody] = useState('');
  const [spoilers, setSpoilers] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const submit = async () => {
    if (!body.trim() || busy) return;
    setBusy(true); setError(''); setSent(false);
    try {
      await suggestionService.sendMessage(id, { body: body.trim(), containsSpoilers: spoilers, clientRequestId: requestId });
      setBody(''); setSpoilers(false); setRequestId(crypto.randomUUID()); setSent(true); page.refresh();
    } catch (error) { setError(apiError(error)); onRevoked(); }
    finally { setBusy(false); }
  };
  const remove = async (messageId: number) => {
    if (deleting != null || !window.confirm('Delete this message?')) return;
    setDeleting(messageId); setError('');
    try { await suggestionService.deleteMessage(id, messageId); page.refresh(); }
    catch (error) { setError(apiError(error)); onRevoked(); }
    finally { setDeleting(null); }
  };
  return <section aria-label="Conversation" className="stack">
    <header className="section__head"><h2>Conversation</h2><button disabled={page.loading} onClick={page.refresh}>Refresh conversation</button></header>
    {page.error && <p role="alert" className="notice notice--error">{page.error}</p>}
    {page.items.length > 0 && <div className="list list--flush">{page.items.map(message => <article className="said" data-hue={personHue(message.username)} key={message.id}>
      <Avatar username={message.username} />
      <div className="said__main">
        <header className="meta"><Link className="who" to={`/member/${encodeURIComponent(message.username)}`}>{message.user_id === viewerId ? 'You' : message.username}</Link><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
          {message.user_id === viewerId && <button aria-label={`Delete your message from ${new Date(message.created_at).toLocaleDateString()}`} className="link" disabled={deleting != null} onClick={() => void remove(message.id)}>Delete</button>}</header>
        <Spoiler key={`${message.id}:${message.contains_spoilers}`} hidden={message.contains_spoilers && message.user_id !== viewerId}><blockquote className="quote quote--small">{message.body}</blockquote></Spoiler>
      </div>
    </article>)}</div>}
    {page.loading && <p className="status" role="status">Loading conversation</p>}
    {page.next != null && <div className="actions"><button className="btn btn--quiet btn--small" disabled={page.loading} onClick={page.loadMore}>More messages</button></div>}
    {sent && <p className="t-caption muted" role="status">Message sent.{page.next != null && ' Newer messages are under More messages.'}</p>}
    <form onSubmit={event => { event.preventDefault(); void submit(); }}>
      <fieldset className="stack" disabled={busy}><legend className="sr-only">Send a message</legend>
        <div className="field"><label htmlFor="recommendation-message">Talk about the film</label><textarea className="textarea" id="recommendation-message" rows={3} maxLength={1000} value={body} onChange={event => { setBody(event.target.value); setRequestId(crypto.randomUUID()); setSent(false); }} /></div>
        <div className="actions actions--spread"><label className="check"><input type="checkbox" checked={spoilers} onChange={event => { setSpoilers(event.target.checked); setRequestId(crypto.randomUUID()); }} />Contains spoilers</label><button className="btn btn--secondary" disabled={!body.trim() || busy}>{busy ? 'Sending' : 'Send message'}</button></div>
        {error && <p role="alert" className="notice notice--error">{error}</p>}
      </fieldset>
    </form>
  </section>;
}
