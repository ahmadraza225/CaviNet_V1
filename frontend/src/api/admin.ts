import { apiFetch, type UserSummary } from "./client";

export type Role = UserSummary["role"];

export interface NewUser {
  email: string;
  full_name: string;
  role: Role;
  temporary_password: string;
}

export interface AuditEntry {
  id: number;
  created_at: string;
  user_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
}

export interface AuditPage {
  items: AuditEntry[];
  total: number;
  page: number;
  page_size: number;
}

export interface AuditFilters {
  userId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export const listUsers = () => apiFetch<UserSummary[]>("/api/admin/users");

export const createUser = (user: NewUser) =>
  apiFetch<UserSummary>("/api/admin/users", { method: "POST", body: user });

export const updateUser = (id: string, changes: { role?: Role; full_name?: string }) =>
  apiFetch<UserSummary>(`/api/admin/users/${id}`, { method: "PATCH", body: changes });

export const deactivateUser = (id: string) =>
  apiFetch<UserSummary>(`/api/admin/users/${id}/deactivate`, { method: "POST" });

export const reactivateUser = (id: string) =>
  apiFetch<UserSummary>(`/api/admin/users/${id}/reactivate`, { method: "POST" });

export const resetPassword = (id: string, temporaryPassword: string) =>
  apiFetch<UserSummary>(`/api/admin/users/${id}/reset-password`, {
    method: "POST",
    body: { temporary_password: temporaryPassword },
  });

export function auditQuery(filters: AuditFilters): string {
  const params = new URLSearchParams();
  if (filters.userId) params.set("user_id", filters.userId);
  if (filters.action) params.set("action", filters.action);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.pageSize ?? 25));
  return params.toString();
}

export const listAuditLogs = (filters: AuditFilters) =>
  apiFetch<AuditPage>(`/api/admin/audit-logs?${auditQuery(filters)}`);

export const listAuditActions = () => apiFetch<string[]>("/api/admin/audit-logs/actions");
