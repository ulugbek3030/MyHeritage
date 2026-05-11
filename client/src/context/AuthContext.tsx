import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '../types';
import * as authApi from '../api/auth';
import { getAccess, clearTokens } from '../api/client';

interface Ctx { user: User | null; loading: boolean; setUser: (u: User | null) => void; signOut: () => void; }
const AuthCtx = createContext<Ctx | null>(null);

const WEB_SESSION_KEY = 'cf_click_web_session';

/**
 * Pull the Click web_session out of wherever Click chose to deliver it.
 * Per Click's mini-app spec it lands as either:
 *   - ?web_session=<uuid>   (URL query — older example docs)
 *   - click-web-session=<uuid> in document.cookie  (current iOS behaviour)
 *
 * Whichever shows up wins; cookie also gets cached in sessionStorage so a
 * deep-link refresh inside the SPA doesn't lose it on a route change.
 */
const readWebSessionFromUrl = (): string | null =>
  new URL(window.location.href).searchParams.get('web_session');

const readWebSessionFromCookie = (): string | null => {
  try {
    const m = document.cookie.match(/(?:^|;\s*)click-web-session=([^;]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch { return null; }
};

const readCachedWebSession = (): string | null => {
  try { return sessionStorage.getItem(WEB_SESSION_KEY); } catch { return null; }
};

/** Pick the freshest web_session and side-cache it in sessionStorage. */
const readFreshWebSession = (): string | null => {
  const ws = readWebSessionFromUrl() ?? readWebSessionFromCookie();
  if (ws) { try { sessionStorage.setItem(WEB_SESSION_KEY, ws); } catch { /* ignore */ } }
  return ws;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        // 1) Fresh launch from Click — web_session shows up either as a URL
        //    query (?web_session=) or as the click-web-session cookie. When
        //    we have one, we always re-validate via Click instead of using a
        //    stale JWT, otherwise an old dev/email JWT shadows real SSO and
        //    the user sees somebody else's tree.
        const fresh = readFreshWebSession();
        if (fresh) {
          try {
            clearTokens();
            const u = await authApi.loginWithClickSession(fresh);
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

        // 3) Cached web_session (we've seen one this session, but neither URL
        //    nor cookie has it right now — e.g. user reloaded a deep link
        //    after Click's cookie expired). Try Click anyway.
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
