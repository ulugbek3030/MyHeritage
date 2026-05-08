import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

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
  } | null>(null);

  useEffect(() => {
    const access = localStorage.getItem('cf_access') ?? sessionStorage.getItem('cf_access');
    const refresh = localStorage.getItem('cf_refresh') ?? sessionStorage.getItem('cf_refresh');
    const sessionWs = (() => { try { return sessionStorage.getItem('cf_click_web_session'); } catch { return null; } })();
    const urlWs = (() => { try { return new URL(window.location.href).searchParams.get('web_session'); } catch { return null; } })();
    const payload = access ? decodeJwtPayload(access) : null;
    const p = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {};
    setSnapshot({
      access,
      refresh,
      accessSub: typeof p.sub === 'string' ? p.sub : undefined,
      accessExp: typeof p.exp === 'number' ? p.exp : undefined,
      accessClaims: Object.keys(p),
      sessionWs,
      urlWs,
    });
  }, [user, loading]);

  if (!snapshot) return null;

  const expIn = snapshot.accessExp ? Math.round((snapshot.accessExp * 1000 - Date.now()) / 1000) : null;
  const rows: Array<[string, string]> = [
    ['url web_session', peek(snapshot.urlWs)],
    ['session web_session', peek(snapshot.sessionWs)],
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
      <div style={{ fontWeight: 800, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--accent)', marginBottom: 6 }}>auth debug</div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', gap: 6 }}>
          <span style={{ color: 'var(--text-muted)', minWidth: 130 }}>{k}</span>
          <span style={{ wordBreak: 'break-all' }}>{v}</span>
        </div>
      ))}
    </div>
  );
};
