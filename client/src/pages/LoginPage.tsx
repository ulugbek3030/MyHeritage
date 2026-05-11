import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithEmail, registerWithEmail } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import '../styles/form.css';

/**
 * Email + password login. Used as a fallback when there's no Click web_session
 * and no cached JWT — the standard flow is still SSO via Click SuperApp, but
 * this lets people open the app outside Click (web link, QR, share preview).
 *
 * Two modes — login (default) / register — toggled by a single link.
 */
export const LoginPage = () => {
  const nav = useNavigate();
  const { setUser } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordValid = password.length >= 8;
  const canSubmit = emailValid && passwordValid && !busy;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true); setErr(null);
    try {
      const u = mode === 'login'
        ? await loginWithEmail(email.trim(), password)
        : await registerWithEmail(email.trim(), password, displayName.trim() || undefined);
      setUser(u);
      nav('/', { replace: true });
    } catch (e) {
      console.error(`[login:${mode}] failed`, e);
      // Surface the server's hint when it's a 4xx — for 401 it'll be the
      // generic "Invalid email or password", for 422 (already registered)
      // it includes the offending field.
      const status = (e as { response?: { status?: number; data?: { message?: string } } }).response?.status;
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message;
      setErr(
        mode === 'login'
          ? (status === 401 ? 'Неверный email или пароль' : 'Не удалось войти. Попробуйте ещё раз.')
          : (msg && msg.toLowerCase().includes('already')
              ? 'Этот email уже зарегистрирован — войдите.'
              : (msg ?? 'Не удалось зарегистрироваться. Попробуйте ещё раз.'))
      );
    } finally { setBusy(false); }
  };

  const isLogin = mode === 'login';

  return (
    <div style={{ minHeight: 'calc(100dvh - var(--safe-top, 0px))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18 }}>
      <div style={{ fontSize: 48 }}>🌳</div>
      <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', textAlign: 'center' }}>Click Family</div>
      <div style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 320, lineHeight: 1.5 }}>
        Откройте приложение из Click SuperApp, либо {isLogin ? 'войдите' : 'зарегистрируйтесь'} по&nbsp;email.
      </div>

      <form onSubmit={onSubmit} style={{ width: '100%', maxWidth: 320 }}>
        {!isLogin && (
          <input
            className="auth-input"
            placeholder="Имя"
            autoComplete="name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        )}
        <input
          className="auth-input"
          placeholder="email@example.com"
          type="email"
          inputMode="email"
          autoComplete={isLogin ? 'email' : 'email'}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <input
          className="auth-input"
          placeholder="Пароль (от 8 символов)"
          type="password"
          autoComplete={isLogin ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={!canSubmit} className="auth-btn">
          {busy
            ? (isLogin ? 'Вход…' : 'Создание…')
            : (isLogin ? 'Войти' : 'Создать аккаунт')}
        </button>
        {err && <div style={{ marginTop: 12, fontSize: 13, color: '#f87171', textAlign: 'center' }}>{err}</div>}
      </form>

      <button
        type="button"
        onClick={() => { setMode(isLogin ? 'register' : 'login'); setErr(null); }}
        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginTop: 4 }}
      >
        {isLogin ? 'Нет аккаунта? Создать' : 'Уже есть аккаунт? Войти'}
      </button>
    </div>
  );
};
