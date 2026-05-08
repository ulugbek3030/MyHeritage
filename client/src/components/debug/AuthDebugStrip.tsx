import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { clearTokens } from '../../api/client';

/**
 * Tiny diagnostic strip showing the current auth state — JWT presence,
 * web_session presence, and the current user. Useful for sorting out cases
 * like "I logged in via Click but I see somebody else's tree" — usually
 * means a stale JWT in localStorage shadowing fresh SSO.
 *
 * Render unconditionally for now while we debug Click SSO; remove or gate
 * behind ?debug=1 once flow is stable.
 */
const decodeJwtPayload = (token: string): unknown => {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch { return null; }
};

const peek = (s: string | null) => (s ? `${s.slice(0, 12)}…(${s.length}c)` : 'null');

interface ClickBridge { [k: string]: unknown }

export const AuthDebugStrip = () => {
  const { user, loading } = useAuth();
  const [snapshot, setSnapshot] = useState<{
    access: string | null;
    refresh: string | null;
    accessSub?: string;
    accessExp?: number;
    accessClaims?: string[];
    sessionWs: string | null;
    urlWs: string | null;
    urlHash: string;
    cookieKeys: string[];
    cookieRaw: string;
    referrer: string;
    href: string;
    ua: string;
    clickBridgeKeys: string[];
  } | null>(null);

  const refresh = () => {
    const access = localStorage.getItem('cf_access') ?? sessionStorage.getItem('cf_access');
    const refreshTok = localStorage.getItem('cf_refresh') ?? sessionStorage.getItem('cf_refresh');
    const sessionWs = (() => { try { return sessionStorage.getItem('cf_click_web_session'); } catch { return null; } })();
    const url = new URL(window.location.href);
    const urlWs = url.searchParams.get('web_session');
    const urlHash = url.hash;
    const cookieRaw = document.cookie;
    const cookieKeys = cookieRaw.split(';').map((s) => s.split('=')[0].trim()).filter(Boolean);
    const w = window as unknown as { click?: ClickBridge; tg?: ClickBridge; ClickWebApp?: ClickBridge };
    const bridges: string[] = [];
    if (w.click) bridges.push('window.click=[' + Object.keys(w.click).slice(0, 8).join(',') + ']');
    if (w.tg) bridges.push('window.tg=[' + Object.keys(w.tg).slice(0, 8).join(',') + ']');
    if (w.ClickWebApp) bridges.push('window.ClickWebApp=[' + Object.keys(w.ClickWebApp).slice(0, 8).join(',') + ']');
    const payload = access ? decodeJwtPayload(access) : null;
    const p = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {};
    setSnapshot({
      access, refresh: refreshTok,
      accessSub: typeof p.sub === 'string' ? p.sub : undefined,
      accessExp: typeof p.exp === 'number' ? p.exp : undefined,
      accessClaims: Object.keys(p),
      sessionWs, urlWs,
      urlHash, cookieKeys, cookieRaw,
      referrer: document.referrer,
      href: window.location.href,
      ua: navigator.userAgent,
      clickBridgeKeys: bridges,
    });
  };

  useEffect(() => { refresh(); }, [user, loading]);

  if (!snapshot) return null;

  const expIn = snapshot.accessExp ? Math.round((snapshot.accessExp * 1000 - Date.now()) / 1000) : null;
  const rows: Array<[string, string]> = [
    ['href', snapshot.href],
    ['url web_session', peek(snapshot.urlWs)],
    ['session web_session', peek(snapshot.sessionWs)],
    ['url hash', snapshot.urlHash || '—'],
    ['cookies', snapshot.cookieKeys.length ? snapshot.cookieKeys.join(', ') : '—'],
    ['cookie raw', snapshot.cookieRaw || '—'],
    ['referrer', snapshot.referrer || '—'],
    ['JS bridges', snapshot.clickBridgeKeys.length ? snapshot.clickBridgeKeys.join(' / ') : '—'],
    ['userAgent', snapshot.ua],
    ['JWT access', peek(snapshot.access)],
    ['JWT sub', snapshot.accessSub ?? '—'],
    ['JWT claims', (snapshot.accessClaims ?? []).join(', ')],
    ['JWT expires in', expIn !== null ? `${expIn}s` : '—'],
    ['user.id', user?.id ?? '—'],
    ['user.email', user?.email ?? '—'],
    ['user.phone', user?.phone ?? '—'],
    ['user.clickClientId', user?.clickClientId !== null && user?.clickClientId !== undefined ? String(user.clickClientId) : '—'],
    ['user.displayName', user?.displayName ?? '—'],
  ];

  const fullLogout = () => {
    clearTokens();
    try {
      sessionStorage.removeItem('cf_click_web_session');
      sessionStorage.removeItem('cf_access');
      sessionStorage.removeItem('cf_refresh');
    } catch { /* ignore */ }
    window.location.href = '/login';
  };

  return (
    <div style={{
      margin: '0 12px 12px',
      padding: '10px 12px',
      background: 'rgba(251,191,36,0.06)',
      border: '1px solid rgba(251,191,36,0.3)',
      borderRadius: 12,
      fontSize: 11,
      fontFamily: 'ui-monospace, Menlo, monospace',
      lineHeight: 1.5,
      color: 'var(--text)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontWeight: 800, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--accent)' }}>auth debug</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={refresh} style={{ background: 'transparent', border: '1px solid rgba(251,191,36,0.4)', color: 'var(--accent)', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Обновить</button>
          <button type="button" onClick={fullLogout} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.4)', color: '#f87171', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Выйти</button>
        </span>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)', minWidth: 130 }}>{k}</span>
          <span style={{ wordBreak: 'break-all' }}>{v}</span>
        </div>
      ))}
    </div>
  );
};
