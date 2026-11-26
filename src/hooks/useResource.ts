import { useCallback } from 'react';
import { usePagedResource } from './usePagedResource';

export function useResource<T>(key: string, load: (signal: AbortSignal) => Promise<T>, version: string | number = 0) {
  const loadValue = useCallback(async (_cursor: number | undefined, signal: AbortSignal) => ({ items: [{ id: 0, value: await load(signal) }], next: null }), [load]);
  const page = usePagedResource(key, loadValue, version);
  return { data: page.items[0]?.value ?? null, error: page.error, loading: page.loading, loaded: page.loaded, refresh: page.refresh };
}
