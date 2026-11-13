import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePagedResource } from '../../hooks/usePagedResource';
import { suggestionService } from '../../services/suggestionService';
import { apiError } from '../../services/apiClient';
import { Spoiler } from './Spoiler';

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
  return <section className="suggestion-conversation" aria-label="Conversation">
    <div className="suggestion-section-heading"><h2>Conversation</h2><button className="text-link" disabled={page.loading} onClick={page.refresh}>Refresh conversation</button></div>
    {page.error && <p role="alert" className="notice notice--error">{page.error}</p>}
    {page.items.map(message => <article className="suggestion-message" key={message.id}>
      <header><Link to={`/member/${encodeURIComponent(message.username)}`}>{message.user_id === viewerId ? 'You' : message.username}</Link><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
        {message.user_id === viewerId && <button className="text-link" aria-label={`Delete your message from ${new Date(message.created_at).toLocaleDateString()}`} disabled={deleting != null} onClick={() => void remove(message.id)}>Delete</button>}</header>
      <Spoiler key={`${message.id}:${message.contains_spoilers}`} hidden={message.contains_spoilers && message.user_id !== viewerId}><p>{message.body}</p></Spoiler>
    </article>)}
    {page.loading && <p role="status">Loading conversation</p>}
    {page.next != null && <button className="button button--quiet" disabled={page.loading} onClick={page.loadMore}>More messages</button>}
    {sent && <p className="metadata" role="status">Message sent.{page.next != null && ' Continue through the conversation to see the latest messages.'}</p>}
    <form onSubmit={event => { event.preventDefault(); void submit(); }} className="suggestion-message-form">
      <fieldset disabled={busy} className="suggestion-form-fields"><legend className="sr-only">Send a message</legend>
        <label htmlFor="recommendation-message">Talk about the film</label><textarea id="recommendation-message" rows={3} maxLength={1000} value={body} onChange={event => { setBody(event.target.value); setRequestId(crypto.randomUUID()); setSent(false); }} />
        <div className="suggestion-actions"><label className="suggestion-check"><input type="checkbox" checked={spoilers} onChange={event => { setSpoilers(event.target.checked); setRequestId(crypto.randomUUID()); }} />Contains spoilers</label><button className="button button--primary" disabled={!body.trim() || busy}>{busy ? 'Sending' : 'Send message'}</button></div>
      </fieldset>
      {error && <p role="alert" className="notice notice--error">{error}</p>}
    </form>
  </section>;
}
