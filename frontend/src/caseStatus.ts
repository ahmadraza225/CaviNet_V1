/** Case statuses (FR-08.1) in workflow order, with plain-language labels. */
import type { CaseStatus } from "./api/cases";

export const STATUS_STEPS: CaseStatus[] = [
  "uploaded",
  "validating",
  "queued",
  "preprocessing",
  "analysing",
  "completed",
];

export const STATUS_LABELS: Record<CaseStatus, string> = {
  uploaded: "Uploaded",
  validating: "Validating",
  queued: "Queued",
  preprocessing: "Preprocessing",
  analysing: "Analysing",
  completed: "Completed",
  failed: "Failed",
};

export const isFinal = (status: string) => status === "completed" || status === "failed";

export const statusLabel = (status: string) => STATUS_LABELS[status as CaseStatus] ?? status;

export const STATUS_CLASSES: Record<"done" | "failed" | "working", string> = {
  done: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  working: "bg-amber-100 text-amber-900",
};

export function statusTone(status: string): keyof typeof STATUS_CLASSES {
  if (status === "completed") return "done";
  if (status === "failed") return "failed";
  return "working";
}

/** "1.5 GB", "63.1 MB", "512 KB". */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** FR-04.1 upload limit, the same as the server's. */
export const MAX_UPLOAD_BYTES = 1536 * 1024 ** 2;
