import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const ACCESS = 'cf_access', REFRESH = 'cf_refresh', REMEMBER = 'cf_remember';

const storage = () => (localStorage.getItem(REMEMBER) === '1' ? localStorage : sessionStorage);

export const setTokens = (access: string, refresh: string, remember: boolean) => {
  if (remember) localStorage.setItem(REMEMBER, '1');
  storage().setItem(ACCESS, access);
  storage().setItem(REFRESH, refresh);
};
export const getAccess = () => localStorage.getItem(ACCESS) ?? sessionStorage.getItem(ACCESS);
export const getRefresh = () => localStorage.getItem(REFRESH) ?? sessionStorage.getItem(REFRESH);
export const clearTokens = () => {
  for (const s of [localStorage, sessionStorage]) { s.removeItem(ACCESS); s.removeItem(REFRESH); }
  localStorage.removeItem(REMEMBER);
};

export const api = axios.create({ baseURL: '/api', timeout: 15000 });

api.interceptors.request.use((c: InternalAxiosRequestConfig) => {
  const t = getAccess();
  if (t) c.headers.Authorization = `Bearer ${t}`;
  return c;
});

let refreshing: Promise<string | null> | null = null;
async function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const r = getRefresh();
      if (!r) return null;
      try {
        const res = await axios.post('/api/auth/refresh', { refreshToken: r });
        setTokens(res.data.accessToken, res.data.refreshToken, localStorage.getItem(REMEMBER) === '1');
        return res.data.accessToken;
      } catch { clearTokens(); return null; }
      finally { refreshing = null; }
    })();
  }
  return refreshing;
}

api.interceptors.response.use((r) => r, async (err: AxiosError) => {
  const original = err.config as InternalAxiosRequestConfig & { _retry?: boolean };
  if (err.response?.status === 401 && !original._retry) {
    original._retry = true;
    const newAccess = await refreshOnce();
    if (newAccess) {
      original.headers.Authorization = `Bearer ${newAccess}`;
      return api(original);
    }
  }
  return Promise.reject(err);
});
