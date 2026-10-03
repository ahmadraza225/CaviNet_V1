import { apiFetch } from "./client";

export interface AppNotification {
  id: number;
  kind: "case_completed" | "case_failed";
  message: string;
  case_id: string | null;
  created_at: string;
  read: boolean;
}

export interface NotificationPage {
  items: AppNotification[];
  total: number;
  page: number;
  page_size: number;
}

/** FR-08.2: the bell checks this every 10 seconds. */
export const UNREAD_POLL_MS = 10_000;

export const listNotifications = () => apiFetch<NotificationPage>("/api/notifications");

export const getUnreadCount = () => apiFetch<{ count: number }>("/api/notifications/unread-count");

export const markNotificationRead = (id: number) =>
  apiFetch<{ marked: number }>(`/api/notifications/${id}/read`, { method: "POST" });

export const markAllNotificationsRead = () =>
  apiFetch<{ marked: number }>("/api/notifications/read-all", { method: "POST" });
