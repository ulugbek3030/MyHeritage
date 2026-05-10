import { api } from './client';

export interface TreeAccessRequest {
  id: string;
  requesterId: string;
  requesterDisplayName: string | null;
  requesterPhone: string | null;
  targetPhone: string;
  targetUserId: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  message: string | null;
  createdAt: string;
  respondedAt: string | null;
}

export const getIdentificationStatus = () =>
  api.get<{ isIdentified: boolean }>(`/me/identification-status`).then((r) => r.data);

export const createAccessRequest = (phone: string, message?: string) =>
  api.post<TreeAccessRequest>(`/tree-access-requests`, { phone, message }).then((r) => r.data);

export const listIncomingRequests = () =>
  api.get<TreeAccessRequest[]>(`/tree-access-requests/incoming`).then((r) => r.data);

export const listOutgoingRequests = () =>
  api.get<TreeAccessRequest[]>(`/tree-access-requests/outgoing`).then((r) => r.data);

export const acceptAccessRequest = (id: string) =>
  api.post<TreeAccessRequest>(`/tree-access-requests/${id}/accept`).then((r) => r.data);

export const declineAccessRequest = (id: string) =>
  api.post<TreeAccessRequest>(`/tree-access-requests/${id}/decline`).then((r) => r.data);

export const cancelAccessRequest = (id: string) =>
  api.post<TreeAccessRequest>(`/tree-access-requests/${id}/cancel`).then((r) => r.data);
