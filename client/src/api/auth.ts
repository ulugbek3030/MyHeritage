import { api, setTokens, clearTokens } from './client';
import type { User } from '../types';

export const devLogin = (phone = '+998900000001') =>
  api.post<{ user: User; accessToken: string; refreshToken: string }>('/auth/dev-login', { phone }).then((r) => {
    setTokens(r.data.accessToken, r.data.refreshToken, true);
    return r.data.user;
  });

/**
 * Click SuperApp SSO. Pass the web_session string the mini-app received from
 * Click; backend hits Click integration with our bearer + this session and
 * returns our JWT pair.
 */
export const loginWithClickSession = (webSession: string) =>
  api.post<{ user: User; accessToken: string; refreshToken: string }>('/auth/click-session', { web_session: webSession }).then((r) => {
    setTokens(r.data.accessToken, r.data.refreshToken, true);
    return r.data.user;
  });

export const me = () => api.get<User>('/auth/me').then((r) => r.data);
export const logout = () => { clearTokens(); };
