import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { uploadScan, type CaseDetail } from "../../api/cases";
import { ApiError } from "../../api/client";
import { getPatient, listPatients } from "../../api/patients";
import { formatBytes, MAX_UPLOAD_BYTES } from "../../caseStatus";
import { Alert, Button } from "../../components/ui";
import { formatDate, SEX_LABELS } from "../../format";
import { describeSelection, selectionProblem } from "./selection";

/** /upload without a patient: choose one first (reached from the dashboard). */
function PatientPicker() {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const found = useQuery({
    queryKey: ["patients", { q: query, page: 1 }],
    queryFn: () => listPatients({ q: query, page: 1 }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery(text.trim());
  }

  return (
    <section className="space-y-4 rounded-lg bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Choose the patient</h2>
      <form role="search" onSubmit={submit} className="flex gap-2">
        <label htmlFor="upload-patient-search" className="sr-only">
          Search patients
        </label>
        <input
          id="upload-patient-search"
          type="search"
          placeholder="Search by name or MR number"
          maxLength={120}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="w-80 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {found.isError && <Alert tone="error">{(found.error as Error).message}</Alert>}
      {found.data && found.data.items.length === 0 && (
        <p className="text-sm text-slate-500">
          {query ? `No patients match “${query}”.` : "No patients yet."}{" "}
          <Link to="/patients/new" className="text-brand-600 underline">
            Add a patient
          </Link>
        </p>
      )}
      {found.data && found.data.items.length > 0 && (
        <ul className="divide-y divide-slate-100" aria-label="Patients">
          {found.data.items.map((patient) => (
            <li key={patient.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                <span className="font-medium text-slate-800">{patient.full_name}</span>{" "}
                <span className="font-mono text-slate-500">{patient.mr_number}</span>
              </span>
              <Link
                to={`/patients/${patient.id}/upload`}
                aria-label={`Upload a scan for ${patient.full_name}`}
                className="rounded-md border border-slate-300 px-3 py-1 text-slate-700 hover:bg-slate-50"
              >
                Select
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Phase =
  | { name: "idle" }
  | { name: "uploading"; fraction: number }
  | { name: "checking" }
  | { name: "rejected"; detail: CaseDetail };

function UploadForm({ patientId }: { patientId: string }) {
  const patient = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => getPatient(patientId),
  });
  const [files, setFiles] = useState<File[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [dragging, setDragging] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const busy = phase.name === "uploading" || phase.name === "checking";

  function choose(chosen: File[]) {
    setFiles(chosen);
    setProblem(chosen.length ? selectionProblem(chosen) : null);
    if (phase.name === "rejected") setPhase({ name: "idle" });
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!busy) choose(Array.from(event.dataTransfer.files));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = selectionProblem(files);
    setProblem(found);
    if (found) return;
    abort.current = new AbortController();
    setPhase({ name: "uploading", fraction: 0 });
    try {
      const detail = await uploadScan(
        patientId,
        files,
        (fraction) =>
          setPhase(fraction >= 1 ? { name: "checking" } : { name: "uploading", fraction }),
        abort.current.signal,
      );
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      if (detail.status === "failed") {
        setPhase({ name: "rejected", detail });
        return;
      }
      navigate(`/cases/${detail.id}`, {
        state: { notice: "Upload complete. The scan is queued for analysis." },
      });
    } catch (caught) {
      setPhase({ name: "idle" });
      setProblem(
        caught instanceof ApiError ? caught.message : "Something went wrong. Please try again.",
      );
    }
  }

  const percent = phase.name === "uploading" ? Math.floor(phase.fraction * 100) : 100;

  return (
    <div className="space-y-6">
      {patient.isError && <Alert tone="error">{(patient.error as Error).message}</Alert>}
      {patient.data && (
        <section aria-label="Patient" className="rounded-lg bg-white p-4 text-sm shadow-sm">
          <Link
            to={`/patients/${patient.data.id}`}
            className="text-lg font-semibold text-brand-700 underline"
          >
            {patient.data.full_name}
          </Link>
          <p className="mt-1 text-slate-600">
            MR <span className="font-mono">{patient.data.mr_number}</span> · born{" "}
            {formatDate(patient.data.date_of_birth)} · {SEX_LABELS[patient.data.sex]}
          </p>
        </section>
      )}

      <form
        onSubmit={submit}
        aria-label="Upload CT scan"
        className="space-y-4 rounded-lg bg-white p-6 shadow-sm"
      >
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          data-testid="drop-zone"
          className={`rounded-lg border-2 border-dashed p-6 text-center ${
            dragging ? "border-brand-600 bg-brand-50" : "border-slate-300"
          }`}
        >
          <label htmlFor="scan-files" className="block text-sm font-medium text-slate-700">
            CT scan files
          </label>
          <p id="scan-files-hint" className="mt-1 text-xs text-slate-500">
            One .zip file, or the scan&apos;s .dcm files. Up to {formatBytes(MAX_UPLOAD_BYTES)}. You
            can also drag the files here. Names and other identifiers are removed from the files
            before they are stored.
          </p>
          <input
            id="scan-files"
            type="file"
            multiple
            accept=".zip,.dcm,application/zip,application/dicom"
            aria-describedby="scan-files-hint"
            disabled={busy}
            onChange={(event) => choose(Array.from(event.target.files ?? []))}
            className="mx-auto mt-3 block text-sm"
          />
          {files.length > 0 && (
            <p className="mt-2 text-sm text-slate-700">Selected: {describeSelection(files)}</p>
          )}
        </div>

        {problem && <Alert tone="error">{problem}</Alert>}

        {phase.name === "rejected" && (
          <Alert tone="error">
            <p className="font-medium">The scan was not accepted.</p>
            <p className="mt-1">{phase.detail.failure_reason}</p>
            <Link to={`/cases/${phase.detail.id}`} className="mt-2 inline-block underline">
              View the failed case
            </Link>
          </Alert>
        )}

        {busy && (
          <div className="space-y-1">
            <div
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-3 w-full overflow-hidden rounded bg-slate-200"
            >
              <div
                className="h-full bg-brand-600 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="text-sm text-slate-600" aria-live="polite">
              {phase.name === "uploading"
                ? `Uploading… ${percent}%`
                : "Upload complete. Checking and de-identifying the scan…"}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={busy || files.length === 0}>
            {busy ? "Uploading…" : "Upload scan"}
          </Button>
          {phase.name === "uploading" && (
            <Button variant="secondary" onClick={() => abort.current?.abort()}>
              Cancel upload
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}

/** FR-04.1 upload page: /upload (choose a patient) or /patients/:patientId/upload. */
export function UploadPage() {
  const { patientId } = useParams();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-brand-700">Upload CT scan</h1>
      {patientId ? <UploadForm patientId={patientId} /> : <PatientPicker />}
    </div>
  );
}
