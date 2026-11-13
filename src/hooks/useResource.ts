import { useCallback } from 'react';
import { usePagedResource } from './usePagedResource';

export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>) {
  const loadValue = useCallback(async (_cursor: number | undefined, signal: AbortSignal) => ({ items: [{ id: 0, value: await load(signal) }], next: null }), [load]);
  const page = usePagedResource(key, loadValue);
  return { data: page.items[0]?.value ?? null, error: page.error, loading: page.loading, loaded: page.loaded, refresh: page.refresh };
}
