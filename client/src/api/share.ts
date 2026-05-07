import { api } from './client';
import type { FullTree } from '../types';

export interface ShareSettings { showBirthDates: boolean; showPhotos: boolean; allowSuggestions: boolean; }

export const enableShare = (treeId: string, settings?: Partial<ShareSettings>) => api.post<{ token: string; settings: ShareSettings }>(`/trees/${treeId}/share/enable`, settings ?? {}).then((r) => r.data);
export const updateShareSettings = (treeId: string, settings: Partial<ShareSettings>) => api.put<ShareSettings>(`/trees/${treeId}/share/settings`, settings).then((r) => r.data);
export const disableShare = (treeId: string) => api.post(`/trees/${treeId}/share/disable`).then((r) => r.data);
export const getSharedTree = (token: string) => api.get<FullTree & { settings: ShareSettings }>(`/share/${token}`).then((r) => r.data);
