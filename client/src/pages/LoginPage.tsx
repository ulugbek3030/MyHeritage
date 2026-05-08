/**
 * Shown when there's no Click web_session in the URL and no cached JWT.
 * For now this is a static "open via Click" placeholder — when email/password
 * registration lands, the form will live here.
 */
export const LoginPage = () => (
  <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center', gap: 18 }}>
    <div style={{ fontSize: 48 }}>🌳</div>
    <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>Click Family</div>
    <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 320, lineHeight: 1.5 }}>
      Откройте приложение из Click SuperApp — оно автоматически опознает вас по&nbsp;вашему профилю.
    </div>
    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 12 }}>
      web_session не получен от Click
    </div>
  </div>
);
