import {
  apiErrorFromBody,
  apiFetch,
  apiFetchBlob,
  ApiError,
  getAccessToken,
  refreshSession,
} from "./client";

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
  is_demo: boolean;
  analyser: string | null;
  note: string | null;
  probability_tb_pct: number | null;
  confidence_pct: number | null;
  band: string | null;
}

export type ConfidenceBand = "High" | "Moderate" | "Low";

/** FR-06.1 to FR-06.4 for a completed case (GET /api/cases/{id}/result). */
export interface AiResult {
  case_id: string;
  patient: { id: string; full_name: string; mr_number: string };
  predicted_class: "TB" | "NTM";
  probability_tb: number;
  probability_tb_pct: number;
  confidence_pct: number;
  band: ConfidenceBand;
  inconclusive: boolean;
  explanation: string;
  disclaimer: string;
  is_demo: boolean;
  demo_banner: string | null;
  model: {
    name: string;
    version: string;
    trained_at: string | null;
    folds: number | null;
    is_demo: boolean;
  };
  validated_performance: {
    auc: number | null;
    sensitivity: number | null;
    specificity: number | null;
    cases: number | null;
    dataset: string | null;
  };
  warnings: string[];
  processing_seconds: number | null;
  step_seconds: Record<string, number>;
  lung_volume_ml: number | null;
  preview_count: number;
  completed_at: string | null;
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

export const getResult = (id: string) => apiFetch<AiResult>(`/api/cases/${id}/result`);

/** FR-06.4: preview slice `index` (0 = nearest the head) as an object URL for <img>. */
export async function getPreviewUrl(id: string, index: number): Promise<string> {
  return URL.createObjectURL(await apiFetchBlob(`/api/cases/${id}/previews/${index}`));
}

export const NETWORK_ERROR =
  "The upload failed because the connection was lost. Check the connection and try again.";
export const UPLOAD_CANCELLED = "Upload cancelled.";
export const TOO_LARGE =
  "The upload is larger than the 1.5 GB limit. Upload only the chest CT series, or compress it as a .zip.";

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
  if (result.status === 413 && result.body === null) {
    // nginx's own refusal (an HTML page) when the body is over its limit.
    throw new ApiError(413, TOO_LARGE, "upload_too_large");
  }
  if (result.status < 200 || result.status >= 300) {
    throw apiErrorFromBody(result.status, result.body);
  }
  return result.body as CaseDetail;
}
