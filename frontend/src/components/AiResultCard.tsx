import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { getResult, type AiResult, type ConfidenceBand } from "../api/cases";
import { formatDateTime } from "../format";
import { DEMO_BANNER } from "../navigation";
import { SliceViewer } from "./SliceViewer";
import { Alert } from "./ui";

const BAND_STYLES: Record<ConfidenceBand, string> = {
  High: "bg-green-100 text-green-900",
  Moderate: "bg-amber-100 text-amber-900",
  Low: "bg-slate-200 text-slate-800",
};

const percent = (value: number | null | undefined) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-800">{children}</dd>
    </div>
  );
}

function ResultBody({ result, caseId }: { result: AiResult; caseId: string }) {
  const performance = result.validated_performance;
  return (
    <div className="space-y-6">
      {result.is_demo && (
        <div role="alert" className="rounded-md bg-red-700 px-4 py-3 text-white">
          <p className="text-base font-bold tracking-wide">{result.demo_banner ?? DEMO_BANNER}</p>
          <p className="mt-1 text-sm opacity-95">
            This result comes from a demo model trained on synthetic data. It says nothing about
            this patient.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-8">
        <div>
          <p className="text-xs uppercase text-slate-500">Predicted class</p>
          <p className="text-4xl font-bold text-slate-900">
            {result.inconclusive ? "Inconclusive" : result.predicted_class}
          </p>
          {result.inconclusive && (
            <p className="text-sm text-slate-600">Leans towards {result.predicted_class}</p>
          )}
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Probability of TB</p>
          <p className="text-2xl font-semibold text-slate-900">
            {result.probability_tb_pct.toFixed(1)}%
          </p>
          <div
            role="meter"
            aria-label="Probability of TB"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={result.probability_tb_pct}
            className="mt-1 h-2 w-48 overflow-hidden rounded bg-slate-200"
          >
            <div
              className="h-full bg-brand-600"
              style={{ width: `${result.probability_tb_pct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">NTM ← 50% → TB</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Confidence</p>
          <p className="text-2xl font-semibold text-slate-900">
            {result.confidence_pct.toFixed(1)}%{" "}
            <span
              className={`rounded px-2 py-0.5 align-middle text-sm ${BAND_STYLES[result.band]}`}
            >
              {result.band}
            </span>
          </p>
        </div>
      </div>

      <p className="rounded-md bg-slate-50 p-4 text-slate-800">{result.explanation}</p>

      {result.warnings.length > 0 && (
        <Alert tone="warning">
          <p className="font-medium">Warnings</p>
          <ul className="mt-1 list-disc pl-5">
            {result.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-semibold text-slate-800">Slice viewer</h3>
          <div className="mt-3">
            <SliceViewer caseId={caseId} count={result.preview_count} />
          </div>
        </div>
        <div className="space-y-5">
          <div>
            <h3 className="font-semibold text-slate-800">Validated performance</h3>
            <dl className="mt-2 grid grid-cols-3 gap-3">
              <Fact label="Test AUC">
                {performance.auc == null ? "—" : performance.auc.toFixed(2)}
              </Fact>
              <Fact label="Sensitivity">{percent(performance.sensitivity)}</Fact>
              <Fact label="Specificity">{percent(performance.specificity)}</Fact>
            </dl>
            <p className="mt-2 text-xs text-slate-500">
              {performance.cases ? `Measured on ${performance.cases} test cases. ` : ""}
              {performance.dataset}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Model</h3>
            <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
              <Fact label="Name">{result.model.name}</Fact>
              <Fact label="Version">{result.model.version}</Fact>
              <Fact label="Trained">
                {result.model.trained_at ? formatDateTime(result.model.trained_at) : "—"}
              </Fact>
              <Fact label="Processing time">
                {result.processing_seconds == null
                  ? "—"
                  : `${result.processing_seconds.toFixed(1)} s`}
              </Fact>
            </dl>
          </div>
        </div>
      </div>

      <p className="border-t border-slate-200 pt-4 text-sm font-medium text-slate-700">
        {result.disclaimer}
      </p>
    </div>
  );
}

/** M-06 result for a completed case (FR-06.1 to FR-06.4, FR-05.6). */
export function AiResultCard({ caseId }: { caseId: string }) {
  const result = useQuery({
    queryKey: ["result", caseId],
    queryFn: () => getResult(caseId),
    staleTime: Infinity, // one audited view per page visit (FR-09.2)
    refetchOnWindowFocus: false,
  });
  return (
    <section aria-labelledby="result-title" className="rounded-lg bg-white p-6 shadow-sm">
      <h2 id="result-title" className="text-lg font-semibold text-slate-800">
        AI result
      </h2>
      <div className="mt-4">
        {result.isError && <Alert tone="error">{(result.error as Error).message}</Alert>}
        {result.isPending && <p className="text-sm text-slate-500">Loading the result…</p>}
        {result.data && <ResultBody result={result.data} caseId={caseId} />}
      </div>
    </section>
  );
}
