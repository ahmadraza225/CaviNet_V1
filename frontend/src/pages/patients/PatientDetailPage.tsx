import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "../../api/client";
import { deletePatient, getPatient, type PatientDetail } from "../../api/patients";
import { ResultLabel } from "../../components/ResultLabel";
import { StatusBadge } from "../../components/StatusBadge";
import { Alert, Button, Loading } from "../../components/ui";
import { UploadCtButton } from "../../components/UploadCtButton";
import { isFinal } from "../../caseStatus";
import { formatDate, formatDateTime, SEX_LABELS } from "../../format";
import { normalizeMrNumber } from "./patientForm";

const SCANS_POLL_MS = 5_000;

/** FR-03.2: permanent delete, confirmed by typing the patient's MR number. */
function DeleteDialog({ patient, onCancel }: { patient: PatientDetail; onCancel: () => void }) {
  const [typed, setTyped] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const matches = normalizeMrNumber(typed) === patient.mr_number;

  useEffect(() => inputRef.current?.focus(), []);

  const remove = useMutation({
    mutationFn: () => deletePatient(patient.id, normalizeMrNumber(typed)),
    onSuccess: () => {
      navigate("/patients", {
        replace: true,
        state: { notice: `${patient.full_name} and all of their records were deleted.` },
      });
      queryClient.removeQueries({ queryKey: ["patient", patient.id] });
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (matches) remove.mutate();
  }

  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4"
      onKeyDown={(event) => event.key === "Escape" && onCancel()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        aria-describedby="delete-warning"
        onSubmit={submit}
        className="w-full max-w-md space-y-4 rounded-lg bg-white p-6 shadow-xl"
      >
        <h2 id="delete-title" className="text-lg font-semibold text-red-800">
          Delete patient permanently?
        </h2>
        <p id="delete-warning" className="text-sm text-slate-700">
          This permanently deletes <strong>{patient.full_name}</strong> and all of their scans,
          results, files and reports. It cannot be undone.
        </p>
        {remove.isError && (
          <Alert tone="error">
            {remove.error instanceof ApiError
              ? remove.error.message
              : "Something went wrong. Please try again."}
          </Alert>
        )}
        <div>
          <label htmlFor="delete-confirm" className="block text-sm font-medium text-slate-700">
            Type the MR number <span className="font-mono">{patient.mr_number}</span> to confirm
          </label>
          <input
            id="delete-confirm"
            ref={inputRef}
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm shadow-sm focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
          />
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!matches || remove.isPending}
            className="bg-red-700 text-white hover:bg-red-800 disabled:bg-slate-300"
          >
            {remove.isPending ? "Deleting…" : "Delete permanently"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 text-slate-800">{children}</dd>
    </div>
  );
}

/** FR-03.4: the patient's scans with date, status and result, newest first. */
function ScanHistory({ patient }: { patient: PatientDetail }) {
  return (
    <section aria-labelledby="scans-title" className="rounded-lg bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <h2 id="scans-title" className="text-lg font-semibold text-slate-800">
          Scans
        </h2>
        <UploadCtButton patientId={patient.id} />
      </div>
      {patient.scans.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No scans have been uploaded for this patient.</p>
      ) : (
        <table className="mt-4 min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2">Uploaded</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Result</th>
              <th className="px-3 py-2">
                <span className="sr-only">Open</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patient.scans.map((scan) => (
              <tr key={scan.id}>
                <td className="px-3 py-2">{formatDateTime(scan.uploaded_at)}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={scan.status} />
                </td>
                <td className="px-3 py-2">
                  <ResultLabel result={scan.result} isDemo={scan.result_is_demo} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    to={`/cases/${scan.id}`}
                    aria-label={`Open the case uploaded ${formatDateTime(scan.uploaded_at)}`}
                    className="text-brand-700 underline"
                  >
                    Open case
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function PatientDetailPage() {
  const { patientId } = useParams();
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  const [deleting, setDeleting] = useState(false);
  const patient = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => getPatient(patientId!),
    // Keep scan statuses current while any scan is still being processed.
    refetchInterval: (query) =>
      query.state.data?.scans.some((scan) => !isFinal(scan.status)) ? SCANS_POLL_MS : false,
  });

  if (patient.isError) {
    return (
      <div className="space-y-4">
        <Alert tone="error">{(patient.error as Error).message}</Alert>
        <Link to="/patients" className="text-brand-600 underline">
          Back to patients
        </Link>
      </div>
    );
  }
  if (!patient.data) return <Loading>Loading patient…</Loading>;

  const data = patient.data;
  return (
    <div className="space-y-6">
      {notice && <Alert tone="success">{notice}</Alert>}
      <Link to="/patients" className="text-sm text-brand-600 underline">
        ← All patients
      </Link>
      <section className="rounded-lg bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-brand-700">{data.full_name}</h1>
            <p className="mt-1 font-mono text-sm text-slate-600">MR {data.mr_number}</p>
          </div>
          <div className="flex gap-2">
            <Link
              to={`/patients/${data.id}/edit`}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Edit
            </Link>
            <Button variant="danger" onClick={() => setDeleting(true)}>
              Delete patient
            </Button>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date of birth">
            {formatDate(data.date_of_birth)} ({data.age} years)
          </Field>
          <Field label="Sex">{SEX_LABELS[data.sex]}</Field>
          <Field label="Phone">{data.phone ?? "—"}</Field>
          <Field label="Last updated">{formatDateTime(data.updated_at)}</Field>
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Notes">
              <span className="whitespace-pre-wrap">{data.notes ?? "—"}</span>
            </Field>
          </div>
        </dl>
      </section>
      <ScanHistory patient={data} />
      {deleting && <DeleteDialog patient={data} onCancel={() => setDeleting(false)} />}
    </div>
  );
}
