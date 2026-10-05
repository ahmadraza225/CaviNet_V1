import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { listAuditActions, listAuditLogs, listUsers, type AuditFilters } from "../../api/admin";
import { Alert, Button, Loading, SelectField, TextField } from "../../components/ui";
import { actionLabel, targetLabel } from "./auditLabels";

const PAGE_SIZE = 25;
const EMPTY_FILTERS: AuditFilters = { userId: "", action: "", dateFrom: "", dateTo: "" };

function describeDetails(details: Record<string, unknown> | null): string {
  if (!details) return "";
  return Object.entries(details)
    .filter(([key]) => key !== "target_email")
    .map(([key, value]) => {
      const shown = Array.isArray(value)
        ? value.map((item) => String(item).replace(/_/g, " ")).join(", ")
        : String(value);
      return `${key.replace(/_/g, " ")}: ${shown}`;
    })
    .join(", ");
}

export function AuditLogPage() {
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const users = useQuery({ queryKey: ["admin", "users"], queryFn: listUsers });
  const actions = useQuery({ queryKey: ["admin", "audit-actions"], queryFn: listAuditActions });
  const logs = useQuery({
    queryKey: ["admin", "audit", applied, page],
    queryFn: () => listAuditLogs({ ...applied, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });

  const totalPages = logs.data ? Math.max(1, Math.ceil(logs.data.total / PAGE_SIZE)) : 1;

  function apply(event: FormEvent) {
    event.preventDefault();
    setApplied(draft);
    setPage(1);
  }

  function clear() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Audit log</h1>

      <form
        onSubmit={apply}
        aria-label="Audit log filters"
        className="grid gap-4 rounded-lg bg-white p-6 shadow-sm md:grid-cols-5 md:items-end"
      >
        <SelectField
          label="User"
          id="filter-user"
          value={draft.userId}
          onChange={(event) => setDraft({ ...draft, userId: event.target.value })}
        >
          <option value="">All users</option>
          {users.data?.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name} ({user.email})
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Action"
          id="filter-action"
          value={draft.action}
          onChange={(event) => setDraft({ ...draft, action: event.target.value })}
        >
          <option value="">All actions</option>
          {actions.data?.map((action) => (
            <option key={action} value={action}>
              {actionLabel(action)}
            </option>
          ))}
        </SelectField>
        <TextField
          label="From"
          id="filter-from"
          type="date"
          value={draft.dateFrom}
          onChange={(event) => setDraft({ ...draft, dateFrom: event.target.value })}
        />
        <TextField
          label="To"
          id="filter-to"
          type="date"
          value={draft.dateTo}
          onChange={(event) => setDraft({ ...draft, dateTo: event.target.value })}
        />
        <div className="flex gap-2">
          <Button type="submit">Apply</Button>
          <Button variant="secondary" onClick={clear}>
            Clear
          </Button>
        </div>
      </form>

      {logs.isError && <Alert tone="error">{(logs.error as Error).message}</Alert>}

      <section className="overflow-x-auto rounded-lg bg-white shadow-sm">
        {logs.isPending && <Loading className="p-6">Loading audit log…</Loading>}
        {logs.data && logs.data.items.length === 0 && (
          <p className="p-6 text-sm text-slate-500">No entries match these filters.</p>
        )}
        {logs.data && logs.data.items.length > 0 && (
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Details</th>
                <th className="px-3 py-2">IP address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.data.items.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{entry.actor_email ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{actionLabel(entry.action)}</td>
                  <td className="px-3 py-2" title={entry.target_id ?? undefined}>
                    {targetLabel(entry)}
                  </td>
                  <td className="px-3 py-2 text-slate-600">{describeDetails(entry.details)}</td>
                  <td className="px-3 py-2 text-slate-500">{entry.ip_address ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {logs.data && logs.data.total > 0 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            Page {page} of {totalPages} · {logs.data.total} entries
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
