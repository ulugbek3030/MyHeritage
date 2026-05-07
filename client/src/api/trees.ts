import { api } from './client';
import type { Tree, FullTree } from '../types';

export const listTrees = () => api.get<(Tree & { personCount: number })[]>('/trees').then((r) => r.data);
export const createTree = (name: string, description?: string) => api.post<Tree>('/trees', { name, description }).then((r) => r.data);
export const getFullTree = (treeId: string) => api.get<FullTree>(`/trees/${treeId}/full`).then((r) => r.data);
