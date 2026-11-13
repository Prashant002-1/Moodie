import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { authService, type AiMode, type AuthResponse, type AuthUser } from '../services/authService';
import { responseDraftStore } from '../services/responseDraftStore';

export interface User extends AuthUser { displayName: string }
interface UserContextType {
  user: User | null;
  loading: boolean;
  sessionError: string;
  refreshSession: () => Promise<void>;
  signUp: (input: { email: string; username: string; password: string }) => Promise<AuthResponse>;
  signIn: (input: { identifier: string; password: string }) => Promise<AuthResponse>;
  recover: (input: { identifier: string; recoveryCode: string; password: string }) => Promise<AuthResponse>;
  signOut: () => Promise<void>;
  updateProfile: (bio: string) => Promise<void>;
  setAiMode: (mode: AiMode) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  deletionReceipt: { cleanupOwner: number | null } | null;
  retryDraftCleanup: () => Promise<void>;
}
const UserContext = createContext<UserContextType | undefined>(undefined);
// eslint-disable-next-line react-refresh/only-export-components
export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within a UserProvider');
  return context;
};
const asUser = (user: AuthUser): User => ({ ...user, displayName: user.username.charAt(0).toUpperCase() + user.username.slice(1) });
export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState('');
  const [deletionReceipt, setDeletionReceipt] = useState<{ cleanupOwner: number | null } | null>(null);
  const refreshSession = useCallback(async () => {
    setLoading(true);
    setSessionError('');
    try { setUser(asUser(await authService.me())); }
    catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) setUser(null);
      else setSessionError('Your session could not be checked. Try again.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    authService.clear();
    void refreshSession();
    const expire = () => { setUser(null); setSessionError(''); };
    const sync = (event: StorageEvent) => { if (event.key === 'moodie-account-change') window.location.reload(); };
    window.addEventListener('storage', sync);
    window.addEventListener('moodie:session-expired', expire);
    return () => { window.removeEventListener('moodie:session-expired', expire); window.removeEventListener('storage', sync); };
  }, [refreshSession]);
  const broadcast = () => {
    // Browser storage can be unavailable even after a committed server write.
    try { localStorage.setItem('moodie-account-change', `${Date.now()}-${Math.random()}`); } catch { /* Other tabs revalidate on their next request. */ }
  };
  const accept = async (request: Promise<AuthResponse>) => {
    const response = await request;
    setUser(asUser(response.user));
    setDeletionReceipt(null);
    broadcast();
    setSessionError('');
    return response;
  };
  return <UserContext.Provider value={{
    user, loading, sessionError, refreshSession, deletionReceipt,
    retryDraftCleanup: async () => {
      if (deletionReceipt?.cleanupOwner == null) return;
      await responseDraftStore.clearAccount(deletionReceipt.cleanupOwner);
      setDeletionReceipt({ cleanupOwner: null });
    },
    signUp: input => accept(authService.register(input)),
    signIn: input => accept(authService.login(input)),
    recover: input => accept(authService.recover(input)),
    signOut: async () => { await authService.logout(); setUser(null); authService.clear(); broadcast(); },
    updateProfile: async bio => setUser(asUser(await authService.profile(bio))),
    setAiMode: async mode => setUser(asUser(await authService.preferences(mode))),
    deleteAccount: async password => {
      const owner = user?.id;
      await authService.deleteAccount(password);
      let cleanupOwner: number | null = null;
      if (owner !== undefined) {
        try { await responseDraftStore.clearAccount(owner); }
        catch { cleanupOwner = owner; }
      }
      setDeletionReceipt({ cleanupOwner });
      setUser(null); authService.clear(); broadcast();
    },
  }}>{children}</UserContext.Provider>;
};
