import client from './client';
import type { Tree, FullTree } from '../types';

export async function listTrees(): Promise<Tree[]> {
  const res = await client.get<Tree[]>('/trees');
  return res.data;
}

export async function createTree(name: string, description?: string): Promise<Tree> {
  const res = await client.post<Tree>('/trees', { name, description });
  return res.data;
}

export async function getTree(id: string): Promise<Tree> {
  const res = await client.get<Tree>(`/trees/${id}`);
  return res.data;
}

export async function updateTree(id: string, data: { name?: string; description?: string; ownerPersonId?: string | null }): Promise<Tree> {
  const res = await client.put<Tree>(`/trees/${id}`, data);
  return res.data;
}

export async function deleteTree(id: string): Promise<void> {
  await client.delete(`/trees/${id}`);
}

export async function getFullTree(id: string): Promise<FullTree> {
  const res = await client.get<FullTree>(`/trees/${id}/full`);
  return res.data;
}
