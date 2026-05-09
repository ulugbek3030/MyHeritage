import { api } from './client';
import type { Relationship } from '../types';

export interface CreateRelationshipInput {
  category: 'couple' | 'parent_child';
  person1Id: string;
  person2Id: string;
  coupleStatus?: string;
  childRelation?: string;
}

export const createRelationship = (treeId: string, input: CreateRelationshipInput) =>
  api.post<Relationship>(`/trees/${treeId}/relationships`, input).then((r) => r.data);

export const deleteRelationship = (treeId: string, relId: string) =>
  api.delete(`/trees/${treeId}/relationships/${relId}`).then((r) => r.data);
