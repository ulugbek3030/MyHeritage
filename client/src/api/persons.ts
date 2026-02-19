import client from './client';
import type { Person, Relationship } from '../types';

export interface CreatePersonData {
  firstName: string;
  lastName?: string | null;
  middleName?: string | null;
  maidenName?: string | null;
  gender: 'male' | 'female';
  birthDate?: string | null;
  birthYear?: number | null;
  birthDateKnown?: boolean;
  isAlive?: boolean;
  deathDate?: string | null;
  deathYear?: number | null;
  deathDateKnown?: boolean;
  note?: string | null;
  relationships?: {
    category: 'couple' | 'parent_child';
    relatedPersonId: string;
    coupleStatus?: string;
    childRelation?: string;
  }[];
}

export async function createPerson(treeId: string, data: CreatePersonData): Promise<Person> {
  const res = await client.post<Person>(`/trees/${treeId}/persons`, data);
  return res.data;
}

export async function updatePerson(treeId: string, personId: string, data: Partial<CreatePersonData>): Promise<Person> {
  const res = await client.put<Person>(`/trees/${treeId}/persons/${personId}`, data);
  return res.data;
}

export async function deletePerson(treeId: string, personId: string): Promise<void> {
  await client.delete(`/trees/${treeId}/persons/${personId}`);
}

export async function uploadPersonPhoto(
  treeId: string,
  personId: string,
  file: File
): Promise<{ photoUrl: string }> {
  const formData = new FormData();
  formData.append('photo', file);
  const res = await client.post<{ photoUrl: string }>(
    `/trees/${treeId}/persons/${personId}/photo`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data;
}

export async function createRelationship(
  treeId: string,
  data: {
    category: 'couple' | 'parent_child';
    person1Id: string;
    person2Id: string;
    coupleStatus?: string;
    childRelation?: string;
  }
): Promise<Relationship> {
  const res = await client.post<Relationship>(`/trees/${treeId}/relationships`, data);
  return res.data;
}
