import { apiErrorFromBody, apiFetch, ApiError, getAccessToken, refreshSession } from "./client";

export type CaseStatus =
  "uploaded" | "validating" | "queued" | "preprocessing" | "analysing" | "completed" | "failed";

export interface TimelineEntry {
  status: CaseStatus;
  at: string;
  message: string | null;
}

export interface ScanDetails {
  study_date: string | null;
  num_slices: number | null;
  slice_thickness_mm: number | null;
  slice_spacing_mm: number | null;
  pixel_spacing_mm: [number, number] | null;
  rows: number | null;
  columns: number | null;
  manufacturer: string | null;
  model: string | null;
  kernel: string | null;
  series_found: number | null;
  series_number: number | null;
}

export interface CaseResult {
  label: string;
  is_stub: boolean;
  analyser: string | null;
  note: string | null;
}

export interface CaseDetail {
  id: string;
  patient: { id: string; full_name: string; mr_number: string };
  status: CaseStatus;
  uploaded_at: string;
  uploaded_by: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  timeline: TimelineEntry[];
  upload: { kind: "zip" | "dcm"; files: number; bytes: number };
  scan: ScanDetails | null;
  result: CaseResult | null;
}

export const getCase = (id: string) => apiFetch<CaseDetail>(`/api/cases/${id}`);

export const NETWORK_ERROR =
  "The upload failed because the connection was lost. Check the connection and try again.";
export const UPLOAD_CANCELLED = "Upload cancelled.";

interface XhrResult {
  status: number;
  body: unknown;
}

function send(
  url: string,
  files: File[],
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Accept", "application/json");
    const token = getAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // Not JSON: the status code alone describes the problem.
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new ApiError(0, NETWORK_ERROR, "network_error"));
    xhr.onabort = () => reject(new ApiError(0, UPLOAD_CANCELLED, "cancelled"));
    signal?.addEventListener("abort", () => xhr.abort());
    const form = new FormData();
    for (const file of files) form.append("files", file, file.name);
    xhr.send(form);
  });
}

/**
 * FR-04.1: upload one .zip or several .dcm files for a patient. Uses XMLHttpRequest because
 * fetch cannot report upload progress. Resolves with the new case (status "queued", or
 * "failed" with the reason); rejects with an ApiError for refused requests.
 */
export async function uploadScan(
  patientId: string,
  files: File[],
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<CaseDetail> {
  const url = `/api/patients/${patientId}/cases`;
  if (!getAccessToken()) await refreshSession();
  let result = await send(url, files, onProgress, signal);
  if (result.status === 401 && (await refreshSession())) {
    result = await send(url, files, onProgress, signal);
  }
  if (result.status < 200 || result.status >= 300) {
    throw apiErrorFromBody(result.status, result.body);
  }
  return result.body as CaseDetail;
}
