import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../types';
import * as authApi from '../api/auth';
import { getAccess, clearTokens } from '../api/client';

interface Ctx { user: User | null; loading: boolean; setUser: (u: User | null) => void; signOut: () => void; }
const AuthCtx = createContext<Ctx | null>(null);

const WEB_SESSION_KEY = 'cf_click_web_session';

/**
 * Find the Click web_session for this app load. Click typically passes it as
 * `?web_session=...` when opening the mini-app webview; we cache it in
 * sessionStorage so refreshing inside the app doesn't lose it.
 */
const readWebSession = (): string | null => {
  const url = new URL(window.location.href);
  const fromQs = url.searchParams.get('web_session');
  if (fromQs) {
    try { sessionStorage.setItem(WEB_SESSION_KEY, fromQs); } catch { /* ignore */ }
    return fromQs;
  }
  try { return sessionStorage.getItem(WEB_SESSION_KEY); } catch { return null; }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        // 1) Existing JWT? Trust it.
        if (getAccess()) {
          try {
            const u = await authApi.me();
            if (u) { setUser(u); return; }
          } catch { clearTokens(); /* stale, fall through */ }
        }

        // 2) Click SSO via web_session.
        const ws = readWebSession();
        if (ws) {
          try {
            const u = await authApi.loginWithClickSession(ws);
            setUser(u);
            return;
          } catch (e) {
            console.warn('[auth] click-session failed', e);
            // fall through to "show login" path
          }
        }

        // 3) No JWT, no web_session → user lands on /login (router handles it).
        setUser(null);
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
