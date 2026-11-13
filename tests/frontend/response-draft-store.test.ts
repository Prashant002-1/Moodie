import { DraftConflict, DraftUnreadable, ResponseDraftSession, ResponseDraftStore } from '../../src/services/responseDraftStore';
import { newResponseDraft } from '../../src/types/responseDraft';

const film = { id: 10, title: 'Scream', release_date: '1996-12-20', poster_path: null };

it('recovers the complete private response and retry identity without mixing accounts', async () => {
  const store = new ResponseDraftStore('roundtrip');
  const draft = { ...newResponseDraft(film), note: 'My private words', emotions: { ...newResponseDraft().emotions, happy: .8 },
    enjoyment: 'loved' as const, highlights: ['performances' as const], expressionImage: 'data:image/jpeg;base64,cGhvdG8=', suggestionId: 8, suggestionName: 'friend' };
  const revision = await store.replace(11, null, draft);
  expect(await new ResponseDraftStore('roundtrip').read(11)).toEqual({ ownerId: 11, revision, draft });
  expect(await store.read(12)).toBeNull();
  await store.replace(12, null, newResponseDraft());
  await store.clearAccount(12);
  expect((await store.read(11))?.draft).toEqual(draft);
  expect(await store.read(12)).toBeNull();
});

it('never overwrites or deletes a newer draft from another tab', async () => {
  const store = new ResponseDraftStore('concurrent');
  const initial = newResponseDraft(film);
  const revision = await store.replace(1, null, initial);
  const first = new ResponseDraftSession(1, revision, initial, store);
  const second = new ResponseDraftSession(1, revision, initial, store);
  await first.save({ ...initial, note: 'First tab changes' });
  await expect(second.save({ ...initial, note: 'Second tab changes' })).rejects.toBeInstanceOf(DraftConflict);
  await expect(second.finish()).rejects.toBeInstanceOf(DraftConflict);
  expect((await store.read(1))?.draft.note).toBe('First tab changes');
});

it('serializes pending saves and keeps discarded drafts deleted', async () => {
  const store = new ResponseDraftStore('queued');
  const session = new ResponseDraftSession(1, null, null, store);
  const draft = newResponseDraft(film);
  const saves = [session.save(draft), session.save({ ...draft, note: 'Later typing' })];
  await session.finish();
  await Promise.all(saves);
  await session.save({ ...draft, note: 'Unmount flush' });
  expect(await store.read(1)).toBeNull();
});

it('retains invalid or future-version records until an explicit revision-checked discard', async () => {
  const name = 'future-draft';
  const store = new ResponseDraftStore(name);
  const draft = newResponseDraft(film);
  const revision = await store.replace(1, null, draft);
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('responses', 'readwrite');
      transaction.objectStore('responses').put({ ownerId: 1, revision, draft: { ...draft, version: 99 } });
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  });
  await expect(store.read(1)).rejects.toBeInstanceOf(DraftUnreadable);
  await expect(store.replace(1, null, newResponseDraft())).rejects.toBeInstanceOf(DraftConflict);
  await store.replace(1, revision, null);
  expect(await store.read(1)).toBeNull();
});

it('preserves unfinished fields while surfacing storage unavailability', async () => {
  const store = new ResponseDraftStore('incomplete');
  const draft = { ...newResponseDraft(film), watchedOn: '' };
  await store.replace(1, null, draft);
  expect((await store.read(1))?.draft).toEqual(draft);
  vi.stubGlobal('indexedDB', undefined);
  await expect(store.read(1)).rejects.toThrow('unavailable');
});
