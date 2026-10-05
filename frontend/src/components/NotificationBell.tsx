import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  UNREAD_POLL_MS,
  type AppNotification,
} from "../api/notifications";
import { formatDateTime } from "../format";
import { Loading } from "./ui";

const KEY = ["notifications"];

/** FR-08.2 bell with the unread count (checked every 10 seconds) and FR-08.3 mark read. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const unread = useQuery({
    queryKey: [...KEY, "unread"],
    queryFn: getUnreadCount,
    refetchInterval: UNREAD_POLL_MS,
  });
  const list = useQuery({ queryKey: [...KEY, "list"], queryFn: listNotifications, enabled: open });
  const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });
  const markOne = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh });
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh });

  const count = unread.data?.count ?? 0;
  const label = `Notifications (${count} unread)`;

  function openItem(item: AppNotification) {
    if (!item.read) markOne.mutate(item.id);
    setOpen(false);
    if (item.case_id) navigate(`/cases/${item.case_id}`);
  }

  return (
    <div className="relative" onKeyDown={(event) => event.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => {
          setOpen(!open);
          if (!open) queryClient.invalidateQueries({ queryKey: [...KEY, "list"] });
        }}
        className="relative rounded p-1 hover:bg-white/10"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
          <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5-6.71V3.5a2 2 0 1 0-4 0v.79A7 7 0 0 0 5 11v5l-2 2v1h18v-1Z" />
        </svg>
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs font-bold leading-5 text-white"
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <section
          aria-label="Notifications"
          className="absolute right-0 z-20 mt-2 w-96 rounded-lg bg-white text-slate-800 shadow-xl ring-1 ring-slate-200"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="font-semibold">Notifications</h2>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={count === 0 || markAll.isPending}
              className="text-sm text-brand-700 underline disabled:text-slate-400 disabled:no-underline"
            >
              Mark all as read
            </button>
          </div>
          {list.isPending && <Loading className="px-4 py-3">Loading…</Loading>}
          {list.isError && (
            <p className="px-4 py-3 text-sm text-red-700">{(list.error as Error).message}</p>
          )}
          {list.data && list.data.items.length === 0 && (
            <p className="px-4 py-3 text-sm text-slate-500">No notifications yet.</p>
          )}
          {list.data && list.data.items.length > 0 && (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {list.data.items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openItem(item)}
                    className={`flex w-full gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                      item.read ? "text-slate-500" : "text-slate-800"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                        item.read
                          ? "bg-transparent"
                          : item.kind === "case_failed"
                            ? "bg-red-600"
                            : "bg-green-600"
                      }`}
                    />
                    <span>
                      <span className={item.read ? "" : "font-medium"}>{item.message}</span>
                      {!item.read && <span className="sr-only"> (unread)</span>}
                      <span className="block text-xs text-slate-400">
                        {formatDateTime(item.created_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
