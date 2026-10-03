import { useQuery } from "@tanstack/react-query";

import { fetchHealth, type ComponentStatus } from "../api/health";

function StatusRow({ label, status }: { label: string; status: ComponentStatus }) {
  const ok = status === "ok";
  return (
    <li className="flex items-center justify-between py-2">
      <span>{label}</span>
      <span
        className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
          ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}
      >
        {ok ? "Working" : "Not responding"}
      </span>
    </li>
  );
}

export function SystemStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["health"],
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });

  return (
    <section aria-labelledby="system-status" className="rounded-lg bg-white p-6 shadow-sm">
      <h2 id="system-status" className="text-lg font-semibold text-slate-800">
        System status
      </h2>
      {isPending && <p className="mt-3 text-sm text-slate-500">Checking…</p>}
      {isError && (
        <p className="mt-3 text-sm text-red-700">
          The CaviNet server cannot be reached. Check that it is running.
        </p>
      )}
      {data && (
        <>
          <p
            className={`mt-3 text-sm font-medium ${
              data.status === "ok" ? "text-green-700" : "text-red-700"
            }`}
          >
            {data.status === "ok" ? "All systems operational" : "Some services are not working"}
          </p>
          <ul className="mt-2 divide-y divide-slate-100 text-sm">
            <StatusRow label="API server" status="ok" />
            <StatusRow label="Database" status={data.database} />
            <StatusRow label="Job queue" status={data.redis} />
          </ul>
          <p className="mt-3 text-xs text-slate-400">Version {data.version}</p>
        </>
      )}
    </section>
  );
}
