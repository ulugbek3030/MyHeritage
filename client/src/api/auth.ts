import client from './client';
import type { AuthResponse, LoginData, RegisterData, User } from '../types';

export async function login(data: LoginData): Promise<AuthResponse> {
  const res = await client.post<AuthResponse>('/auth/login', data);
  return res.data;
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  const res = await client.post<AuthResponse>('/auth/register', data);
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await client.get<User>('/auth/me');
  return res.data;
}

export async function logout(): Promise<void> {
  await client.post('/auth/logout');
}
