import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useDiary } from '../../contexts/DiaryContext';
import { suggestionService } from '../../services/suggestionService';
import { apiError } from '../../services/apiClient';

/** Saves a film for later through one person's response. On your own response it offers to recommend the film instead. */
export function KeepRecommendation({ entryId, authorId, movieId, className = 'link' }: { entryId: number; authorId: number; movieId: number; className?: string }) {
  const { user } = useUser();
  const { refresh } = useDiary();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [kept, setKept] = useState<number | null>(null);
  const keep = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const item = await suggestionService.create({ origin: 'discovered', sourceEntryId: entryId });
      // Saving keeps the person where they were reading. The saved note is one tap away.
      void refresh(); setKept(item.id);
    } catch (error) { setError(apiError(error)); }
    finally { setBusy(false); }
  };
  if (authorId === user?.id) return <Link className={className} to={`/suggestions/new?movieId=${movieId}&sourceEntryId=${entryId}`}>Recommend</Link>;
  if (kept != null) return <Link className={className} to={`/suggestions/${kept}`}>Saved for later<span className="sr-only">. Open it</span></Link>;
  return <>
    <button className={className} disabled={busy} onClick={() => void keep()} type="button">{busy ? 'Adding' : 'Save for later'}</button>
    {error && <span className="error t-caption" role="alert">{error}</span>}
  </>;
}
