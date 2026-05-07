import { api } from './client';
import type { FamilyEvent } from '../types';

export const listEvents = (treeId: string, fromIso?: string, toIso?: string) =>
  api.get<FamilyEvent[]>(`/trees/${treeId}/events`, { params: { from: fromIso, to: toIso } }).then((r) => r.data);
