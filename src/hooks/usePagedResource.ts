import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { apiError } from '../services/apiClient';

export interface ResourcePage<T, Cursor, Meta = unknown> { items: T[]; next: Cursor | null; metadata?: Meta }
interface PageState<T, Cursor, Meta> extends ResourcePage<T, Cursor, Meta> {
  key: string; loading: boolean; error: string; loaded: boolean;
}

// Route/query/account identity belongs in key. Callers memoize load. Each request
// reads ONE page; neither initial loads nor refreshes drain an entire history.
export function usePagedResource<T extends { id: number | string }, Cursor extends string | number, Meta = unknown>(
  key: string,
  load: (cursor: Cursor | undefined, signal: AbortSignal) => Promise<ResourcePage<T, Cursor, Meta>>,
) {
  const [state, setState] = useState<PageState<T, Cursor, Meta>>({ key, items: [], next: null, loading: true, error: '', loaded: false });
  const [revision, setRevision] = useState(0);
  const request = useRef<{ controller: AbortController; token: symbol } | null>(null);
  const currentKey = useRef(key);
  currentKey.current = key;

  const fetchPage = useCallback(async (cursor?: Cursor) => {
    request.current?.controller.abort();
    const pending = { controller: new AbortController(), token: Symbol() };
    request.current = pending;
    setState(previous => ({ ...previous, key, items: previous.key === key ? previous.items : [],
      metadata: previous.key === key ? previous.metadata : undefined,
      next: previous.key === key ? previous.next : null, loading: true, error: '', loaded: previous.key === key && previous.loaded }));
    try {
      const page = await load(cursor, pending.controller.signal);
      if (pending.controller.signal.aborted || request.current !== pending || currentKey.current !== key) return;
      setState(previous => ({ key, items: cursor === undefined ? page.items
        : [...new Map([...previous.items, ...page.items].map(item => [item.id, item])).values()],
      metadata: page.metadata, next: page.next, loading: false, error: '', loaded: true }));
    } catch (error) {
      if (pending.controller.signal.aborted || request.current !== pending || currentKey.current !== key) return;
      const revoked = axios.isAxiosError(error) && [401, 403, 404, 410].includes(error.response?.status ?? 0);
      setState(previous => ({ ...previous, loading: false, error: apiError(error, 'This could not be loaded. Try again.'),
        ...(revoked ? { items: [], next: null, metadata: undefined, loaded: false } : {}) }));
    }
  }, [key, load]);

  useEffect(() => {
    void fetchPage();
    return () => request.current?.controller.abort();
  }, [fetchPage, revision]);

  const refresh = useCallback(() => setRevision(value => value + 1), []);
  const updateItems = useCallback((update: (items: T[]) => T[]) => {
    setState(previous => previous.key === key ? { ...previous, items: update(previous.items) } : previous);
  }, [key]);
  const loadMore = () => { if (!state.loading && state.key === key && state.next != null) void fetchPage(state.next); };
  // Hide the previous account/query synchronously, before the effect starts.
  return { ...(state.key === key ? state : { items: [], next: null, metadata: undefined, loading: true, error: '', loaded: false }), refresh, loadMore, updateItems };
}
