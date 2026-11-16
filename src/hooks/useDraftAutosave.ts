import { useCallback, useEffect, useRef, useState } from 'react';
import { ResponseDraftSession } from '../services/responseDraftStore';
import { ResponseDraft } from '../types/responseDraft';

export function useDraftAutosave(session: ResponseDraftSession | null, draft: ResponseDraft | null, enabled: boolean) {
  const [error, setError] = useState('');
  const [savedDraft, setSavedDraft] = useState<ResponseDraft | null>(null);
  const current = useRef({ session, draft, enabled });
  current.current = { session, draft, enabled };
  const mounted = useRef(true);
  const persist = useCallback(async () => {
    const snapshot = current.current;
    if (!snapshot.enabled || !snapshot.session || !snapshot.draft) return;
    try {
      await snapshot.session.save(snapshot.draft);
      if (mounted.current && current.current.session === snapshot.session) {
        setSavedDraft(snapshot.draft); setError('');
      }
    } catch (error) {
      if (mounted.current && current.current.session === snapshot.session) {
        setError(error instanceof Error ? error.message : 'Your draft could not be saved in this browser.');
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!enabled || !draft || !session) return;
    const timer = window.setTimeout(() => { void persist().catch(() => undefined); }, 350);
    return () => window.clearTimeout(timer);
  }, [draft, session, enabled, persist]);

  useEffect(() => {
    mounted.current = true;
    const flush = () => { void persist().catch(() => undefined); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const { enabled, session, draft } = current.current;
      if (enabled && session && draft && session.saved !== draft) {
        event.preventDefault(); event.returnValue = ''; flush();
      }
    };
    const hide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('beforeunload', beforeUnload);
      flush();
    };
  }, [persist]);
  return { persist, error, saved: draft === savedDraft || draft === session?.saved };
}
