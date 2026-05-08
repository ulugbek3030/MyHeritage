import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/tokens.css';
import './styles/global.css';

// In Click SuperApp the mini-app is rendered inside a WebView with Click's own
// chrome (status row + "My Heritage" title bar + close button) overlaid on top.
// Plain `env(safe-area-inset-top)` only covers the device status bar, so we
// reserve extra room when we know we're inside Click. Detect via the same
// markers AuthContext uses for SSO.
const inClick = !!sessionStorage.getItem('cf_click_web_session') ||
  new URL(window.location.href).searchParams.has('web_session');
if (inClick) document.documentElement.classList.add('cf-click');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
