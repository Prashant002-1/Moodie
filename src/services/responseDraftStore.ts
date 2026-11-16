import { isResponseDraft, ResponseDraft } from '../types/responseDraft';

export interface StoredResponseDraft { ownerId: number; revision: string; draft: ResponseDraft }
export class DraftConflict extends Error {
  constructor() { super('This draft changed in another tab. Reopen the draft before continuing so neither version is overwritten.'); }
}
export class DraftUnreadable extends Error {
  constructor(readonly revision: string | null) { super('The saved draft could not be opened. It has not been replaced.'); }
}

export class ResponseDraftStore {
  constructor(private databaseName = 'moodie-local-drafts') {}

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('Draft storage is unavailable in this browser.')); return; }
      const request = indexedDB.open(this.databaseName, 1);
      let blocked = false;
      request.onupgradeneeded = () => request.result.createObjectStore('responses', { keyPath: 'ownerId' });
      request.onerror = () => reject(request.error);
      request.onblocked = () => { blocked = true; reject(new Error('Close other Moodie tabs to open draft storage.')); };
      request.onsuccess = () => {
        if (blocked) { request.result.close(); return; }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
    });
  }

  async read(ownerId: number): Promise<StoredResponseDraft | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('responses', 'readonly');
      const request = transaction.objectStore('responses').get(ownerId);
      transaction.oncomplete = () => {
        db.close();
        const record: unknown = request.result;
        if (record === undefined) { resolve(null); return; }
        if (typeof record !== 'object' || record === null || !('draft' in record) || !isResponseDraft(record.draft)
          || !('ownerId' in record) || record.ownerId !== ownerId || !('revision' in record) || typeof record.revision !== 'string') {
          reject(new DraftUnreadable(typeof record === 'object' && record !== null && 'revision' in record && typeof record.revision === 'string' ? record.revision : null)); return;
        }
        resolve(record as StoredResponseDraft);
      };
      transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error('Draft storage could not be read.')); };
    });
  }

  // The read and revision check share a readwrite transaction with the write.
  // Two tabs cannot both replace a revision they originally read.
  async replace(ownerId: number, expectedRevision: string | null, draft: ResponseDraft | null): Promise<string | null> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('responses', 'readwrite');
      const store = transaction.objectStore('responses');
      const read = store.get(ownerId);
      const revision = draft ? crypto.randomUUID() : null;
      let conflict = false;
      read.onsuccess = () => {
        if ((read.result?.revision ?? null) !== expectedRevision) { conflict = true; transaction.abort(); return; }
        if (draft) store.put({ ownerId, revision, draft });
        else store.delete(ownerId);
      };
      transaction.oncomplete = () => { db.close(); resolve(revision); };
      transaction.onabort = () => { db.close(); reject(conflict ? new DraftConflict() : transaction.error ?? new Error('Your draft could not be saved in this browser.')); };
    });
  }

  async clearAccount(ownerId: number): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('responses', 'readwrite');
      transaction.objectStore('responses').delete(ownerId);
      transaction.oncomplete = () => { db.close(); resolve(); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    });
  }
}

export const responseDraftStore = new ResponseDraftStore();

// Serialize this composer's writes and deletion. An already queued autosave
// cannot recreate a draft after saving or discarding the response.
export class ResponseDraftSession {
  private queue: Promise<unknown> = Promise.resolve();
  private finished = false;
  saved: ResponseDraft | null;
  constructor(readonly ownerId: number, private revision: string | null, saved: ResponseDraft | null, private store = responseDraftStore) { this.saved = saved; }

  save(draft: ResponseDraft): Promise<void> {
    if (this.finished) return Promise.resolve();
    const work = this.queue.catch(() => undefined).then(async () => {
      if (this.finished || this.saved === draft) return;
      this.revision = await this.store.replace(this.ownerId, this.revision, draft);
      this.saved = draft;
    });
    this.queue = work;
    return work;
  }

  async finish(): Promise<void> {
    this.finished = true;
    await this.queue.catch(() => undefined);
    try {
      this.revision = await this.store.replace(this.ownerId, this.revision, null);
      this.saved = null;
    } catch (error) { this.finished = false; throw error; }
  }
}
