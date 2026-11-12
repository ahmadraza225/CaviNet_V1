import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { getResult, type AiResult, type CombinedResult, type ConfidenceBand } from "../api/cases";
import { formatDateTime } from "../format";
import { DEMO_BANNER } from "../navigation";
import { ReportButton } from "./ReportButton";
import { SliceViewer } from "./SliceViewer";
import { Alert, Loading } from "./ui";

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

const SEX = (sex: string | null) =>
  sex === "male" ? "male" : sex === "female" ? "female" : "unknown sex";

/** M-12 (FR-12.3): the result combined with age, sex and the symptoms entered at upload. */
function CombinedPanel({ combined }: { combined: CombinedResult }) {
  const symptoms = combined.symptoms.length
    ? combined.symptoms.join(", ")
    : "none of the 12 listed";
  return (
    <section
      aria-label="CT + age, sex and symptoms"
      className="rounded-md border border-brand-100 bg-brand-50 p-4"
    >
      <h3 className="font-semibold text-slate-800">CT + age, sex and symptoms</h3>
      <dl className="mt-2 flex flex-wrap gap-8">
        <div>
          <dt className="text-xs uppercase text-slate-500">Predicted class</dt>
          <dd className="text-2xl font-bold text-slate-900">
            {combined.inconclusive ? "Inconclusive" : combined.predicted_class}
          </dd>
          {combined.inconclusive && (
            <dd className="text-sm text-slate-600">Leans towards {combined.predicted_class}</dd>
          )}
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-500">Probability of TB</dt>
          <dd className="text-2xl font-semibold text-slate-900">
            {combined.probability_tb_pct.toFixed(1)}%
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-slate-500">Confidence</dt>
          <dd className="text-2xl font-semibold text-slate-900">
            {combined.confidence_pct.toFixed(1)}%{" "}
            <span
              className={`rounded px-2 py-0.5 align-middle text-sm ${BAND_STYLES[combined.band]}`}
            >
              {combined.band}
            </span>
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-slate-800">{combined.explanation}</p>
      <p className="mt-2 text-xs text-slate-600">
        Combined with age ({combined.age == null ? "unknown" : `${combined.age} years`}),{" "}
        {SEX(combined.sex)} and the symptoms entered at upload: {symptoms}. Symptom-assisted model{" "}
        {combined.fusion_version}.
      </p>
    </section>
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

      {result.combined && <h3 className="font-semibold text-slate-800">CT only</h3>}
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

      {result.combined && <CombinedPanel combined={result.combined} />}
      {!result.combined && result.combined_note && (
        <p className="text-sm text-slate-600">{result.combined_note}</p>
      )}

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
            <SliceViewer
              caseId={caseId}
              count={result.preview_count}
              heatmap={result.heatmap ?? null}
            />
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="result-title" className="text-lg font-semibold text-slate-800">
          AI result
        </h2>
        {result.data && <ReportButton caseId={caseId} />}
      </div>
      <div className="mt-4">
        {result.isError && <Alert tone="error">{(result.error as Error).message}</Alert>}
        {result.isPending && <Loading>Loading the result…</Loading>}
        {result.data && <ResultBody result={result.data} caseId={caseId} />}
      </div>
    </section>
  );
}
