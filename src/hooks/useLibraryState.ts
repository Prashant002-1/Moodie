import { useCallback } from 'react';
import { useDiary } from '../contexts/DiaryContext';
import { useUser } from '../contexts/UserContext';
import { diaryService } from '../services/diaryService';
import { usePagedResource } from './usePagedResource';

// Query only films already loaded by a route. Saved preview membership is never
// used to guess whether a film elsewhere in the library is saved or watched.
export function useLibraryState(movieIds: number[]) {
  const { user } = useUser();
  const ownerId = user?.id;
  const { revision } = useDiary();
  const ids = [...new Set(movieIds.filter(id => Number.isSafeInteger(id) && id > 0))].sort((a, b) => a - b).join(',');
  const load = useCallback(async (_cursor: number | undefined, signal: AbortSignal) => {
    if (!ids || !ownerId) return { items: [], next: null };
    const all = ids.split(',').map(Number);
    const batches = Array.from({ length: Math.ceil(all.length / 100) }, (_, index) => all.slice(index * 100, (index + 1) * 100));
    const results = await Promise.all(batches.map(batch => diaryService.status(batch, signal)));
    return { items: results.flat(), next: null };
  }, [ids, ownerId]);
  const resource = usePagedResource(`${ownerId}:library:${revision}:${ids}`, load);
  const states = new Map(resource.items.map(film => [film.id, film]));
  return { ...resource, get: (id: number) => states.get(id) };
}
