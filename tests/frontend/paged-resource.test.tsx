import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ResourcePage, usePagedResource } from '../../src/hooks/usePagedResource';

type Row = { id: number; title: string };
function pending<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(accept => { resolve = accept; }); return { promise, resolve }; }

it('ignores old-query responses even when the transport fails to honor cancellation', async () => {
  const old = pending<ResourcePage<Row, number>>();
  const loadOld = vi.fn().mockReturnValue(old.promise);
  const loadNew = vi.fn().mockResolvedValue({ items: [{ id: 2, title: 'New account' }], next: null });
  const hook = renderHook(({ identity, load }) => usePagedResource<Row, number>(identity, load), { initialProps: { identity: 'account-1', load: loadOld } });
  hook.rerender({ identity: 'account-2', load: loadNew });
  await waitFor(() => expect(hook.result.current.items[0]?.title).toBe('New account'));
  await act(async () => { old.resolve({ items: [{ id: 1, title: 'Private old account' }], next: null }); });
  expect(hook.result.current.items).toEqual([{ id: 2, title: 'New account' }]);
});

it('keeps existing content on a transient refresh failure but clears revoked content', async () => {
  const load = vi.fn().mockResolvedValueOnce({ items: [{ id: 1, title: 'A response' }], next: 30 }).mockRejectedValueOnce(new Error('offline'))
    .mockRejectedValueOnce({ isAxiosError: true, response: { status: 403, data: { error: 'No longer available' } } });
  const hook = renderHook(() => usePagedResource<Row, number>('account-1', load));
  await waitFor(() => expect(hook.result.current.items).toHaveLength(1));
  act(() => hook.result.current.refresh());
  await waitFor(() => expect(hook.result.current.error).not.toBe(''));
  expect(hook.result.current.items).toHaveLength(1);
  act(() => hook.result.current.refresh());
  await waitFor(() => expect(hook.result.current.error).toBe('No longer available'));
  expect(hook.result.current.items).toEqual([]);
  expect(hook.result.current.next).toBe(null);
});
