import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../types';
import * as authApi from '../api/auth';
import { getAccess, clearTokens } from '../api/client';

interface Ctx { user: User | null; loading: boolean; setUser: (u: User | null) => void; signOut: () => void; }
const AuthCtx = createContext<Ctx | null>(null);

const WEB_SESSION_KEY = 'cf_click_web_session';

/**
 * Find the Click web_session for this app load. Click passes it as
 * `?web_session=...` when opening the mini-app webview; we cache it in
 * sessionStorage so client-side navigation inside the app doesn't lose it.
 */
const readWebSessionFromUrl = (): string | null => {
  const fromQs = new URL(window.location.href).searchParams.get('web_session');
  if (fromQs) {
    try { sessionStorage.setItem(WEB_SESSION_KEY, fromQs); } catch { /* ignore */ }
  }
  return fromQs;
};
const readCachedWebSession = (): string | null => {
  try { return sessionStorage.getItem(WEB_SESSION_KEY); } catch { return null; }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        // 1) Fresh launch from Click (web_session in URL) — always re-validate
        //    via Click's user.profile so we don't end up serving stale JWTs
        //    for a different user. This costs one extra Click round-trip per
        //    app open but keeps SSO authoritative.
        const wsFromUrl = readWebSessionFromUrl();
        if (wsFromUrl) {
          try {
            clearTokens();
            const u = await authApi.loginWithClickSession(wsFromUrl);
            setUser(u);
            return;
          } catch (e) {
            console.warn('[auth] fresh click-session failed', e);
            // Fall through — maybe a cached JWT is still good.
          }
        }

        // 2) Existing JWT? Trust it.
        if (getAccess()) {
          try {
            const u = await authApi.me();
            if (u) { setUser(u); return; }
          } catch { clearTokens(); /* stale, fall through */ }
        }

        // 3) Cached web_session (we've seen one this session, but it's not in
        //    the URL right now — e.g. user reloaded a deep link). Try Click.
        const wsCached = readCachedWebSession();
        if (wsCached) {
          try {
            const u = await authApi.loginWithClickSession(wsCached);
            setUser(u);
            return;
          } catch (e) {
            console.warn('[auth] cached click-session failed', e);
          }
        }

        // 4) No JWT, no web_session → user lands on /login.
        setUser(null);
      } catch (e) {
        console.error('[auth] init failed', e);
        clearTokens();
      } finally { setLoading(false); }
    })();
  }, []);
  const signOut = () => {
    authApi.logout();
    try { sessionStorage.removeItem(WEB_SESSION_KEY); } catch { /* ignore */ }
    setUser(null);
  };
  return <AuthCtx.Provider value={{ user, loading, setUser, signOut }}>{children}</AuthCtx.Provider>;
};

export const useAuth = () => {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
};
