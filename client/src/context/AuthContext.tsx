import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../types';
import * as authApi from '../api/auth';
import { getAccess } from '../api/client';

interface Ctx { user: User | null; loading: boolean; setUser: (u: User | null) => void; signOut: () => void; }
const AuthCtx = createContext<Ctx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // T30 will replace this with auto-login bypass; minimal placeholder for T28:
    if (!getAccess()) { setLoading(false); return; }
    authApi.me().then(setUser).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const signOut = () => { authApi.logout(); setUser(null); };
  return <AuthCtx.Provider value={{ user, loading, setUser, signOut }}>{children}</AuthCtx.Provider>;
};

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
};
