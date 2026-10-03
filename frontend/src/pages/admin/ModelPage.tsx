import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ApiError } from "../../api/client";
import { getModelInfo, type ModelInfo, type TestMetrics } from "../../api/model";
import { Alert } from "../../components/ui";
import { formatDateTime } from "../../format";
import { DEMO_BANNER } from "../../navigation";

const percent = (value: number | null | undefined) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;
const decimal = (value: number | null | undefined, digits = 3) =>
  value == null ? "—" : value.toFixed(digits);

function megabytes(bytes: number): string {
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-4 py-2">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="col-span-2 break-words text-sm text-slate-800">{children}</dd>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      <dl className="mt-3 divide-y divide-slate-100">{children}</dl>
    </section>
  );
}

function MetricRows({ metrics }: { metrics: TestMetrics | undefined }) {
  if (!metrics) return <Row label="Results">Not recorded</Row>;
  return (
    <>
      <Row label="AUC">{decimal(metrics.auc)}</Row>
      {metrics.sensitivity !== undefined && (
        <Row label="Sensitivity">{percent(metrics.sensitivity)}</Row>
      )}
      {metrics.specificity !== undefined && (
        <Row label="Specificity">{percent(metrics.specificity)}</Row>
      )}
      {metrics.accuracy !== undefined && <Row label="Accuracy">{percent(metrics.accuracy)}</Row>}
      <Row label="Cases">{metrics.n ?? "—"}</Row>
    </>
  );
}

function asText(value: unknown): string {
  if (Array.isArray(value)) return value.join(" × ");
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function ModelDetails({ info }: { info: ModelInfo }) {
  const labels = Object.entries(info.label_map)
    .map(([value, label]) => `${value} = ${label}`)
    .join(", ");
  return (
    <div className="space-y-6">
      {info.is_demo ? (
        <div role="alert" className="rounded-md bg-red-700 px-4 py-3 text-white">
          <p className="font-bold">{info.demo_banner ?? DEMO_BANNER}</p>
          <p className="mt-1 text-sm">
            The installed model was trained on synthetic volumes. Its results say nothing about real
            patients. Install the trained model with &apos;make fetch-model&apos; once it is
            released.
          </p>
        </div>
      ) : (
        <Alert tone="success">A trained (non-demo) model is installed.</Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Model">
          <Row label="Name">{info.model_name}</Row>
          <Row label="Version">{info.model_version ?? "—"}</Row>
          <Row label="Trained">{formatDateTime(info.created_at)}</Row>
          <Row label="Type">
            <span
              className={`rounded px-2 py-0.5 text-xs font-semibold ${
                info.is_demo ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
              }`}
            >
              {info.is_demo ? "Demo" : "Trained"}
            </span>
          </Row>
          <Row label="Architecture">{info.architecture.name ?? "—"}</Row>
          <Row label="Ensemble">{info.folds} fold models</Row>
          <Row label="Parameters per fold">{info.parameters_per_fold.toLocaleString()}</Row>
          <Row label="Initialisation">{info.initialisation ?? "—"}</Row>
          <Row label="Code version">{info.git_commit ?? "—"}</Row>
        </Card>

        <Card title="Locked test set">
          <MetricRows metrics={info.metrics.locked_test} />
          <Row label="Cross-validation AUC">{decimal(info.metrics.oof?.auc)}</Row>
          <Row label="Data">{info.metrics.dataset ?? "—"}</Row>
        </Card>

        <Card title="Decision and confidence">
          <Row label="Classes">{labels}</Row>
          <Row label="Decision threshold">{percent(info.decision_threshold)} probability of TB</Row>
          <Row label="Temperature">{decimal(info.temperature)}</Row>
          <Row label="High confidence">from {percent(info.confidence_bands.high)}</Row>
          <Row label="Moderate confidence">from {percent(info.confidence_bands.moderate)}</Row>
        </Card>

        <Card title="Preprocessing">
          {Object.entries(info.preprocessing)
            .filter(([key]) => key !== "extra")
            .map(([key, value]) => (
              <Row key={key} label={key.replace(/_/g, " ")}>
                {asText(value)}
              </Row>
            ))}
        </Card>

        <Card title="File">
          <Row label="Name">{info.file_name}</Row>
          <Row label="Size">{megabytes(info.file_size_bytes)}</Row>
          <Row label="SHA-256">
            <code className="text-xs">{info.file_sha256}</code>
          </Row>
          <Row label="Bundle format">{info.format_version}</Row>
          <Row label="Data manifest">
            {info.data_manifest_sha256 ? (
              <code className="text-xs">{info.data_manifest_sha256}</code>
            ) : (
              "—"
            )}
          </Row>
        </Card>
      </div>
    </div>
  );
}

/** FR-09.4: the installed model's name, version, training date and test results. */
export function ModelPage() {
  const info = useQuery({ queryKey: ["admin", "model"], queryFn: getModelInfo, retry: false });
  const error = info.error;
  const notInstalled = error instanceof ApiError && error.code === "no_model";
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">AI model</h1>
      {info.isPending && <p className="text-sm text-slate-500">Loading the model details…</p>}
      {error && <Alert tone={notInstalled ? "warning" : "error"}>{error.message}</Alert>}
      {info.data && <ModelDetails info={info.data} />}
    </div>
  );
}
