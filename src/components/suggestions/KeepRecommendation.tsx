import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useDiary } from '../../contexts/DiaryContext';
import { suggestionService } from '../../services/suggestionService';
import { apiError } from '../../services/apiClient';

/** Adds a film to the watchlist through one person's response. On your own response it offers to recommend the film instead. */
export function KeepRecommendation({ entryId, authorId, movieId, className = 'link' }: { entryId: number; authorId: number; movieId: number; className?: string }) {
  const { user } = useUser();
  const { refresh } = useDiary();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keep = async () => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const item = await suggestionService.create({ origin: 'discovered', sourceEntryId: entryId });
      void refresh(); navigate(`/suggestions/${item.id}`);
    } catch (error) { setError(apiError(error)); }
    finally { setBusy(false); }
  };
  if (authorId === user?.id) return <Link className={className} to={`/suggestions/new?movieId=${movieId}&sourceEntryId=${entryId}`}>Recommend</Link>;
  return <>
    <button className={className} disabled={busy} onClick={() => void keep()} type="button">{busy ? 'Adding' : 'Add to watchlist'}</button>
    {error && <span className="error t-caption" role="alert">{error}</span>}
  </>;
}
