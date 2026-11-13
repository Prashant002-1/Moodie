import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { diaryService } from '../services/diaryService';
import { DiaryEntry, DiaryEntryChanges, DiaryEntryInput, DiarySummary, SavedFilm } from '../types/diary';
import { EmotionScores } from '../types/emotion';
import { useUser } from './UserContext';

interface DiaryContextValue {
  /** The first 12 saved films are a preview. History lives in paged route state. */
  savedFilms: SavedFilm[];
  summary: DiarySummary | null;
  revision: number;
  currentSignal: EmotionScores | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  setCurrentSignal: (signal: EmotionScores | null) => void;
  createEntry: (input: DiaryEntryInput) => Promise<DiaryEntry>;
  updateEntry: (entryId: number, changes: DiaryEntryChanges) => Promise<DiaryEntry>;
  removeEntry: (entryId: number) => Promise<void>;
  saveFilm: (movieId: number) => Promise<void>;
  unsaveFilm: (movieId: number) => Promise<void>;
}
const DiaryContext = createContext<DiaryContextValue | null>(null);
// eslint-disable-next-line react-refresh/only-export-components
export const useDiary = () => {
  const value = useContext(DiaryContext);
  if (!value) throw new Error('useDiary must be used inside DiaryProvider');
  return value;
};

export const DiaryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useUser();
  // Account changes replace both the cache and its consumers before paint.
  return <AccountDiaryProvider key={user?.id ?? 'signed-out'} owner={user?.id}>{children}</AccountDiaryProvider>;
};

function AccountDiaryProvider({ owner, children }: { owner?: number; children: React.ReactNode }) {
  const [error, setError] = useState('');
  const [savedFilms, setSavedFilms] = useState<SavedFilm[]>([]);
  const [summary, setSummary] = useState<DiarySummary | null>(null);
  const [revision, setRevision] = useState(0);
  const [currentSignal, setCurrentSignal] = useState<EmotionScores | null>(null);
  const [loading, setLoading] = useState(Boolean(owner));
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const reload = useCallback(async () => {
    if (!owner || !mounted.current) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError('');
    const results = await Promise.allSettled([
      diaryService.savedPage({ limit: 12 }, controller.signal), diaryService.summary(controller.signal),
    ]);
    if (controller.signal.aborted || !mounted.current) return;
    const [saved, counts] = results;
    if (saved.status === 'fulfilled') setSavedFilms(saved.value.films);
    if (counts.status === 'fulfilled') setSummary(counts.value);
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length) {
      setError('Your library summary could not be refreshed. Try again.');
      if (failures.some(result => axios.isAxiosError(result.reason) && [401, 403].includes(result.reason.response?.status ?? 0))) {
        setSavedFilms([]); setSummary(null);
      }
    }
    setLoading(false);
  }, [owner]);
  useEffect(() => {
    mounted.current = true; void reload();
    return () => { mounted.current = false; request.current?.abort(); };
  }, [reload]);
  const refresh = useCallback(async () => {
    if (!mounted.current) return;
    setRevision(value => value + 1);
    await reload();
  }, [reload]);
  // A write is committed before refreshing dependent reads. Refresh failure does
  // not turn a successful save into a retry of the write.
  const createEntry = async (input: DiaryEntryInput) => { const entry = await diaryService.create(input); void refresh(); return entry; };
  const updateEntry = async (id: number, changes: DiaryEntryChanges) => { const entry = await diaryService.update(id, changes); void refresh(); return entry; };
  const removeEntry = async (id: number) => { await diaryService.remove(id); void refresh(); };
  const saveFilm = async (id: number) => { await diaryService.save(id); void refresh(); };
  const unsaveFilm = async (id: number) => { await diaryService.unsave(id); void refresh(); };
  return <DiaryContext.Provider value={{ savedFilms, summary, revision, currentSignal, setCurrentSignal, loading, error,
    refresh, createEntry, updateEntry, removeEntry, saveFilm, unsaveFilm }}>{children}</DiaryContext.Provider>;
}
