import { SafetyActions } from './SafetyActions';
import { MessageCircle } from 'lucide-react';
import { Dispatch, FormEvent, SetStateAction, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useDiary } from '../../contexts/DiaryContext';
import { usePagedResource } from '../../hooks/usePagedResource';
import { apiError } from '../../services/apiClient';
import { discoveryService } from '../../services/discoveryService';
import { personHue } from '../../utils/person';
import { Avatar } from '../common/Avatar';

export function ResponseComments({ entryId, initialCount = 0 }: { entryId: number; initialCount?: number }) {
  const { user } = useUser();
  return <ScopedComments key={`${user?.id}:${entryId}`} entryId={entryId} initialCount={initialCount} />;
}

function ScopedComments({ entryId, initialCount }: { entryId: number; initialCount: number }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [body, setBody] = useState('');
  useEffect(() => setCount(initialCount), [initialCount]);
  return <div className="comments">
    <button aria-expanded={open} onClick={() => setOpen(current => !current)} type="button">
      <MessageCircle aria-hidden="true" size={16} />{count > 0 ? <span>{count}<span className="sr-only"> {count === 1 ? 'comment' : 'comments'}</span></span> : <span className="sr-only">Comment</span>}
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
  const page = usePagedResource(`${user?.id}:comments:${entryId}`, load, revision);
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
  return <div className="comments__panel">
    {page.items.length > 0 && <ul className="list">{page.items.map(comment => <li className="row" data-hue={personHue(comment.username)} key={comment.id}>
      <Avatar size="sm" username={comment.username} />
      <div className="row__main">
        <p className="byline"><Link to={`/member/${comment.username}`}>@{comment.username}</Link> <time className="t-caption muted" dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time></p>
        <p className="note">{comment.body}</p>
      </div>
      <div className="row__aside">
        {!comment.own && <SafetyActions kind="comment" targetId={comment.id} personId={comment.user_id} username={comment.username} />}
        {comment.own && <button aria-label="Delete comment" className="t-caption muted" disabled={saving} onClick={() => void remove(comment.id)} type="button">Delete</button>}
      </div>
    </li>)}</ul>}
    {page.loading && <p className="muted" role="status">Loading comments</p>}
    {page.loaded && !page.items.length && <p className="muted">No comments.</p>}
    {page.next !== null && <div className="actions"><button className="btn btn--secondary btn--small" disabled={page.loading} onClick={page.loadMore} type="button">Load more comments</button></div>}
    {user ? <form className="comments__form" onSubmit={submit}>
      <textarea aria-label="Write a comment" className="textarea" maxLength={1000} onChange={event => setBody(event.target.value)} placeholder="Comment" rows={2} value={body} />
      <button aria-label="Post comment" className="btn btn--secondary" disabled={!body.trim() || saving || page.loading || !page.loaded} type="submit">Post</button>
    </form> : <p className="muted">Sign in to comment.</p>}
    {receipt && <p className="muted" role="status">{receipt}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    {page.error && <p className="error" role="alert">{page.error} <button className="link" onClick={page.refresh} type="button">Retry comments</button></p>}
  </div>;
}
