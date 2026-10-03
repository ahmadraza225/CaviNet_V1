import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { getDashboardStats, getRecentCases, type DashboardStats } from "../api/dashboard";
import { useAuth } from "../auth/context";
import { SystemStatus } from "../components/SystemStatus";
import { StatusBadge } from "../components/StatusBadge";
import { Alert, Button } from "../components/ui";
import { UploadCtButton } from "../components/UploadCtButton";
import { formatDateTime } from "../format";

/** FR-02.1 counts stay live: they refresh every 10 seconds. */
export const DASHBOARD_POLL_MS = 10_000;

const STAT_CARDS: { key: keyof DashboardStats; label: string }[] = [
  { key: "total_patients", label: "Total patients" },
  { key: "scans_last_7_days", label: "Scans in the last 7 days" },
  { key: "cases_in_progress", label: "Cases in progress" },
  { key: "completed_cases", label: "Completed cases" },
  { key: "failed_cases", label: "Failed cases" },
];

/** FR-02.1 counts. */
function StatCards() {
  const stats = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
    refetchInterval: DASHBOARD_POLL_MS,
  });
  if (stats.isError) return <Alert tone="error">{(stats.error as Error).message}</Alert>;
  return (
    <section aria-label="Statistics" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {STAT_CARDS.map(({ key, label }) => {
        const labelId = `stat-${key}`;
        return (
          <div
            key={key}
            role="group"
            aria-labelledby={labelId}
            className="rounded-lg bg-white p-4 shadow-sm"
          >
            <p id={labelId} className="text-sm text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-3xl font-bold text-brand-700">
              {stats.data ? stats.data[key] : "…"}
            </p>
          </div>
        );
      })}
    </section>
  );
}

/** FR-02.2: the 10 most recent cases, each linking to its case page. */
function RecentCases() {
  const cases = useQuery({
    queryKey: ["dashboard", "recent-cases"],
    queryFn: getRecentCases,
    refetchInterval: DASHBOARD_POLL_MS,
  });
  return (
    <section aria-labelledby="recent-cases" className="rounded-lg bg-white shadow-sm">
      <h2 id="recent-cases" className="px-6 pt-5 text-lg font-semibold text-slate-800">
        Recent cases
      </h2>
      {cases.isError && (
        <div className="p-6">
          <Alert tone="error">{(cases.error as Error).message}</Alert>
        </div>
      )}
      {cases.isPending && <p className="p-6 text-sm text-slate-500">Loading recent cases…</p>}
      {cases.data && cases.data.length === 0 && (
        <p className="p-6 text-sm text-slate-500">
          No cases yet. Cases appear here once CT scans are uploaded.
        </p>
      )}
      {cases.data && cases.data.length > 0 && (
        <div className="overflow-x-auto p-3">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Patient</th>
                <th className="px-3 py-2">Uploaded</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cases.data.map((item) => (
                <tr key={item.case_id}>
                  <td className="px-3 py-2">
                    <Link
                      to={`/patients/${item.patient_id}`}
                      className="font-medium text-brand-700 underline"
                    >
                      {item.patient_name}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {formatDateTime(item.uploaded_at)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-3 py-2">{item.result ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to={`/cases/${item.case_id}`}
                      aria-label={`Open the case of ${item.patient_name} uploaded ${formatDateTime(item.uploaded_at)}`}
                      className="text-brand-700 underline"
                    >
                      Open case
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** FR-02.3: patient search box. Results open in the patient list. */
function PatientSearch() {
  const [text, setText] = useState("");
  const navigate = useNavigate();

  function submit(event: FormEvent) {
    event.preventDefault();
    const q = text.trim();
    navigate(q ? `/patients?${new URLSearchParams({ q }).toString()}` : "/patients");
  }

  return (
    <form role="search" onSubmit={submit} className="flex gap-2">
      <label htmlFor="dashboard-search" className="sr-only">
        Search patients
      </label>
      <input
        id="dashboard-search"
        type="search"
        placeholder="Search by name or MR number"
        maxLength={120}
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
      />
      <Button type="submit" variant="secondary">
        Search
      </Button>
    </form>
  );
}

/** Doctor dashboard (M-02). */
export function DashboardPage() {
  const { user } = useAuth();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;

  return (
    <div className="space-y-6">
      {notice && <Alert tone="success">{notice}</Alert>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-700">Dashboard</h1>
          <p className="mt-1 text-slate-600">Welcome, {user?.full_name}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PatientSearch />
          <UploadCtButton />
        </div>
      </div>
      <StatCards />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RecentCases />
        </div>
        <SystemStatus />
      </div>
    </div>
  );
}
