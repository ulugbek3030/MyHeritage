import { api } from './client';
import type { Person } from '../types';

export interface CreatePersonInput {
  firstName: string;
  lastName?: string;
  middleName?: string;
  maidenName?: string;
  gender: 'male' | 'female';
  // Dates / years are nullable so the client can explicitly CLEAR a
  // previously-set value via PATCH (undefined drops the key from the JSON
  // payload; null becomes a SQL NULL on the server).
  birthYear?: number | null;
  birthDate?: string | null;
  birthDateKnown?: boolean;
  isAlive?: boolean;
  deathYear?: number | null;
  deathDate?: string | null;
  deathDateKnown?: boolean;
  note?: string;
  phone?: string;
  address?: string;
  maritalStatus?: string;
  relationships?: { category: 'couple' | 'parent_child'; otherPersonId: string; role?: 'parent' | 'child' | 'spouse'; coupleStatus?: string; childRelation?: string }[];
}

export const createPerson = (treeId: string, input: CreatePersonInput) => api.post<Person>(`/trees/${treeId}/persons`, input).then((r) => r.data);
export const updatePerson = (treeId: string, personId: string, fields: Partial<CreatePersonInput>) => api.put<Person>(`/trees/${treeId}/persons/${personId}`, fields).then((r) => r.data);
export const deletePerson = (treeId: string, personId: string) => api.delete(`/trees/${treeId}/persons/${personId}`).then((r) => r.data);
