import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../types';
import * as authApi from '../api/auth';
import { getAccess, clearTokens } from '../api/client';

interface Ctx { user: User | null; loading: boolean; setUser: (u: User | null) => void; signOut: () => void; }
const AuthCtx = createContext<Ctx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        let u: User | null = null;
        if (getAccess()) {
          try { u = await authApi.me(); }
          catch { clearTokens(); /* token stale (e.g. user purged) — fall through to devLogin */ }
        }
        if (!u) u = await authApi.devLogin();
        setUser(u);
      } catch (e) {
        console.error('[auth] init failed', e);
        clearTokens();
      } finally { setLoading(false); }
    })();
  }, []);
  const signOut = () => { authApi.logout(); setUser(null); };
  return <AuthCtx.Provider value={{ user, loading, setUser, signOut }}>{children}</AuthCtx.Provider>;
};

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
};
