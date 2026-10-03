import { STATUS_CLASSES, statusLabel, statusTone } from "../caseStatus";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${STATUS_CLASSES[statusTone(status)]}`}
    >
      {statusLabel(status)}
    </span>
  );
}
