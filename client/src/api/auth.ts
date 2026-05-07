import { api, setTokens, clearTokens } from './client';
import type { User } from '../types';

export const devLogin = (phone = '+998900000001') =>
  api.post<{ user: User; accessToken: string; refreshToken: string }>('/auth/dev-login', { phone }).then((r) => {
    setTokens(r.data.accessToken, r.data.refreshToken, true);
    return r.data.user;
  });
export const me = () => api.get<User>('/auth/me').then((r) => r.data);
export const logout = () => { clearTokens(); };
