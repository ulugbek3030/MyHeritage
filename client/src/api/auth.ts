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

export const requestOtp = (phone: string) =>
  api.post<{ ok: true; ttl: number }>('/auth/request-otp', { phone }).then((r) => r.data);

export const verifyOtp = (phone: string, code: string) =>
  api.post<{ user: User; accessToken: string; refreshToken: string }>('/auth/verify-otp', { phone, code }).then((r) => {
    setTokens(r.data.accessToken, r.data.refreshToken, true);
    return r.data.user;
  });

/** Email + password registration. Backend hashes via bcrypt(12) and returns
 *  the JWT pair just like phone-OTP / Click SSO. */
export const registerWithEmail = (email: string, password: string, displayName?: string) =>
  api.post<{ user: User; accessToken: string; refreshToken: string }>('/auth/register', { email, password, displayName }).then((r) => {
    setTokens(r.data.accessToken, r.data.refreshToken, true);
    return r.data.user;
  });

export const loginWithEmail = (email: string, password: string) =>
  api.post<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', { email, password }).then((r) => {
    setTokens(r.data.accessToken, r.data.refreshToken, true);
    return r.data.user;
  });

export const me = () => api.get<User>('/auth/me').then((r) => r.data);
export const logout = () => { clearTokens(); };
