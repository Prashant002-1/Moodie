import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { useDiary } from '../../contexts/DiaryContext';
import { suggestionService } from '../../services/suggestionService';
import { apiError } from '../../services/apiClient';

export function KeepRecommendation({ entryId, authorId, movieId }: { entryId: number; authorId: number; movieId: number }) {
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
  if (authorId === user?.id) return <Link className="text-link" to={`/suggestions/new?movieId=${movieId}&sourceEntryId=${entryId}`}>Recommend</Link>;
  return <span className="keep-recommendation"><button className="text-link" disabled={busy} onClick={() => void keep()}>{busy ? 'Keeping' : 'Keep recommendation'}</button>{error && <span className="error-text" role="alert">{error}</span>}</span>;
}
