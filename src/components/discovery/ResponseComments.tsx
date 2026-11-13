import { SafetyActions } from './SafetyActions';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import { Dispatch, FormEvent, SetStateAction, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useDiary } from '../../contexts/DiaryContext';
import { usePagedResource } from '../../hooks/usePagedResource';
import { apiError } from '../../services/apiClient';
import { discoveryService } from '../../services/discoveryService';

export function ResponseComments({ entryId, initialCount = 0 }: { entryId: number; initialCount?: number }) {
  const { user } = useUser();
  return <ScopedComments key={`${user?.id}:${entryId}`} entryId={entryId} initialCount={initialCount} />;
}

function ScopedComments({ entryId, initialCount }: { entryId: number; initialCount: number }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [body, setBody] = useState('');
  useEffect(() => setCount(initialCount), [initialCount]);
  return <div className={`response-comments${open ? ' response-comments--open' : ''}`}>
    <button aria-expanded={open} className="response-comments__toggle" onClick={() => setOpen(current => !current)} type="button">
      <MessageCircle aria-hidden="true" size={16} /><span>{count ? `${count} ${count === 1 ? 'comment' : 'comments'}` : 'Comment'}</span>
    </button>
    {open && <CommentPanel entryId={entryId} setCount={setCount} body={body} setBody={setBody} />}
  </div>;
}

function CommentPanel({ entryId, setCount, body, setBody }: { entryId: number; setCount: Dispatch<SetStateAction<number>>; body: string; setBody: (body: string) => void }) {
  const { user } = useUser();
  const { revision } = useDiary();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState('');
  const load = useCallback(async (offset: number | undefined, signal: AbortSignal) => {
    const result = await discoveryService.commentsPage(entryId, offset, signal);
    return { items: result.comments, next: result.nextOffset, metadata: result.total };
  }, [entryId]);
  const page = usePagedResource(`${user?.id}:${revision}:${entryId}`, load);
  useEffect(() => { if (page.metadata !== undefined) setCount(page.metadata); }, [page.metadata, setCount]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim() || saving || !page.loaded) return;
    setSaving(true); setError(''); setReceipt('');
    try {
      await discoveryService.addComment(entryId, body.trim());
      setBody(''); setReceipt('Comment posted.');
      setCount(current => current + 1);
      page.refresh();
    } catch (error) { setError(apiError(error, 'Comment could not be added.')); }
    finally { setSaving(false); }
  };
  const remove = async (id: number) => {
    if (saving) return;
    setSaving(true); setError(''); setReceipt('');
    try {
      await discoveryService.deleteComment(id);
      page.updateItems(items => items.filter(item => item.id !== id));
      setCount(current => Math.max(0, current - 1));
      setReceipt('Comment removed.'); page.refresh();
    } catch (error) { setError(apiError(error, 'Comment could not be removed.')); }
    finally { setSaving(false); }
  };
  return <div className="response-comments__panel">
    <div className="response-comments__list">{page.items.map(comment => <article className="response-comment" key={comment.id}>
      <Link className="response-comment__avatar" to={`/member/${comment.username}`}>{comment.username.charAt(0).toUpperCase()}</Link>
      <div><p><Link to={`/member/${comment.username}`}><strong>@{comment.username}</strong></Link><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></p><blockquote>{comment.body}</blockquote></div>
      {!comment.own && <SafetyActions kind="comment" targetId={comment.id} personId={comment.user_id} username={comment.username} />}
      {comment.own && <button aria-label="Delete comment" className="response-comment__delete" disabled={saving} onClick={() => void remove(comment.id)} type="button"><Trash2 aria-hidden="true" size={14} /></button>}
    </article>)}</div>
    {page.loading && <p role="status">Loading comments</p>}
    {page.loaded && !page.items.length && <p className="response-comments__status">No comments yet.</p>}
    {page.next !== null && <button disabled={page.loading} onClick={page.loadMore}>Load more comments</button>}
    {user ? <form className="response-comments__form" onSubmit={submit}>
      <textarea aria-label="Write a comment" maxLength={1000} onChange={event => setBody(event.target.value)} placeholder="Write a comment" rows={2} value={body} />
      <button aria-label="Post comment" disabled={!body.trim() || saving || page.loading || !page.loaded} type="submit"><Send aria-hidden="true" size={15} /></button>
    </form> : <p>Sign in to comment.</p>}
    {receipt && <p role="status">{receipt}</p>}
    {error && <p role="alert">{error}</p>}
    {page.error && <p role="alert">{page.error} <button onClick={page.refresh}>Retry comments</button></p>}
  </div>;
}
