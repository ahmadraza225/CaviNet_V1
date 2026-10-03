import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { getCase, type CaseDetail, type TimelineEntry } from "../../api/cases";
import { formatBytes, isFinal, STATUS_LABELS, STATUS_STEPS } from "../../caseStatus";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert } from "../../components/ui";
import { formatDate, formatDateTime } from "../../format";
import { DISCLAIMER } from "../../navigation";

/** While a case is in progress the page checks for news every 2 seconds. */
export const CASE_POLL_MS = 2_000;

type StepState = "done" | "current" | "pending" | "failed";

const STEP_STYLES: Record<StepState, { dot: string; text: string }> = {
  done: { dot: "bg-green-600", text: "text-slate-800" },
  current: { dot: "bg-amber-500 animate-pulse", text: "text-slate-800 font-semibold" },
  pending: { dot: "bg-slate-300", text: "text-slate-400" },
  failed: { dot: "bg-red-600", text: "text-red-800 font-semibold" },
};

/** FR-08.1: every step with its time. A failed case stops at the step that failed. */
function Timeline({ detail }: { detail: CaseDetail }) {
  const reached = new Map<string, TimelineEntry>(detail.timeline.map((e) => [e.status, e]));
  const failed = reached.get("failed");
  const steps: { status: string; state: StepState; entry?: TimelineEntry }[] = [];
  for (const status of STATUS_STEPS) {
    const entry = reached.get(status);
    if (entry) {
      const isLast = !failed && status === detail.status && !isFinal(status);
      steps.push({ status, state: isLast ? "current" : "done", entry });
    } else if (failed) {
      steps.push({ status: "failed", state: "failed", entry: failed });
      break;
    } else {
      steps.push({ status, state: "pending" });
    }
  }

  return (
    <section aria-labelledby="timeline-title" className="rounded-lg bg-white p-6 shadow-sm">
      <h2 id="timeline-title" className="text-lg font-semibold text-slate-800">
        Status timeline
      </h2>
      <ol className="mt-4 space-y-3" aria-label="Status timeline">
        {steps.map(({ status, state, entry }) => (
          <li key={status} className="flex gap-3" data-state={state}>
            <span
              aria-hidden="true"
              className={`mt-1.5 h-3 w-3 flex-none rounded-full ${STEP_STYLES[state].dot}`}
            />
            <div>
              <p className={STEP_STYLES[state].text}>
                {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
                {entry && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {formatDateTime(entry.at)}
                  </span>
                )}
                {state === "pending" && <span className="sr-only"> (not reached yet)</span>}
              </p>
              {entry?.message && <p className="text-sm text-slate-600">{entry.message}</p>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{children ?? "—"}</dd>
    </div>
  );
}

const mm = (value: number | null | undefined) => (value == null ? null : `${value} mm`);

/** FR-04.5 metadata, the FR-04.3 series choice and what was uploaded. */
function ScanDetailsCard({ detail }: { detail: CaseDetail }) {
  const scan = detail.scan;
  return (
    <section aria-labelledby="scan-title" className="rounded-lg bg-white p-6 shadow-sm">
      <h2 id="scan-title" className="text-lg font-semibold text-slate-800">
        Scan details
      </h2>
      {!scan && (
        <p className="mt-3 text-sm text-slate-500">
          No scan details: the upload did not pass the checks.
        </p>
      )}
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {scan && (
          <>
            <Item label="Study date">{scan.study_date ? formatDate(scan.study_date) : null}</Item>
            <Item label="Slices">{scan.num_slices}</Item>
            <Item label="Slice thickness">{mm(scan.slice_thickness_mm)}</Item>
            <Item label="Slice spacing">{mm(scan.slice_spacing_mm)}</Item>
            <Item label="Pixel spacing">
              {scan.pixel_spacing_mm
                ? `${scan.pixel_spacing_mm[0]} × ${scan.pixel_spacing_mm[1]} mm`
                : null}
            </Item>
            <Item label="Image size">
              {scan.rows && scan.columns ? `${scan.rows} × ${scan.columns}` : null}
            </Item>
            <Item label="Manufacturer">{scan.manufacturer}</Item>
            <Item label="Model">{scan.model}</Item>
            <Item label="Kernel">{scan.kernel}</Item>
            <Item label="Series used">
              {scan.series_found === 1
                ? "The only image series"
                : `Series ${scan.series_number ?? "?"} (most slices of ${scan.series_found} series)`}
            </Item>
          </>
        )}
        <Item label="Uploaded files">
          {detail.upload.kind === "zip"
            ? `1 .zip file (${formatBytes(detail.upload.bytes)})`
            : `${detail.upload.files} DICOM files (${formatBytes(detail.upload.bytes)})`}
        </Item>
      </dl>
    </section>
  );
}

function ResultCard({ detail }: { detail: CaseDetail }) {
  if (detail.status !== "completed" || !detail.result) return null;
  const { result } = detail;
  return (
    <section aria-labelledby="result-title" className="rounded-lg bg-white p-6 shadow-sm">
      <h2 id="result-title" className="text-lg font-semibold text-slate-800">
        Result
      </h2>
      {result.is_stub && (
        <div className="mt-3">
          <Alert tone="warning">
            <p className="font-semibold">STUB RESULT: PLACEHOLDER ONLY</p>
            <p className="mt-1">
              {result.note} The AI model is added in a later phase. Nothing here is a finding about
              this patient.
            </p>
          </Alert>
        </div>
      )}
      <p className="mt-4 text-3xl font-bold text-slate-800">{result.label}</p>
      {result.analyser && <p className="mt-1 text-sm text-slate-500">By {result.analyser}</p>}
      <p className="mt-4 text-xs text-slate-500">{DISCLAIMER}</p>
    </section>
  );
}

/** Case page: status timeline (FR-08.1), scan details and result. */
export function CasePage() {
  const { caseId } = useParams();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const query = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => getCase(caseId!),
    refetchInterval: (current) =>
      current.state.data && isFinal(current.state.data.status) ? false : CASE_POLL_MS,
  });

  if (query.isError) {
    return (
      <div className="space-y-4">
        <Alert tone="error">{(query.error as Error).message}</Alert>
        <Link to="/" className="text-brand-600 underline">
          Back to the dashboard
        </Link>
      </div>
    );
  }
  if (!query.data) return <p className="text-sm text-slate-500">Loading case…</p>;

  const detail = query.data;
  return (
    <div className="space-y-6">
      {notice && <Alert tone="success">{notice}</Alert>}
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-brand-700">CT scan case</h1>
            <p className="mt-1 text-slate-700">
              <Link to={`/patients/${detail.patient.id}`} className="font-medium underline">
                {detail.patient.full_name}
              </Link>{" "}
              <span className="font-mono text-sm text-slate-500">{detail.patient.mr_number}</span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Uploaded {formatDateTime(detail.uploaded_at)}
              {detail.uploaded_by && ` by ${detail.uploaded_by}`}
            </p>
          </div>
          <div className="text-right">
            <StatusBadge status={detail.status} />
            {!isFinal(detail.status) && (
              <p className="mt-2 text-xs text-slate-500">This page updates automatically.</p>
            )}
          </div>
        </div>
        {detail.status === "failed" && detail.failure_reason && (
          <div className="mt-4">
            <Alert tone="error">
              <span className="font-semibold">Failed:</span> {detail.failure_reason}
            </Alert>
          </div>
        )}
      </section>
      <ResultCard detail={detail} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Timeline detail={detail} />
        <ScanDetailsCard detail={detail} />
      </div>
    </div>
  );
}
