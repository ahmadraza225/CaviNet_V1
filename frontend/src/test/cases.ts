import type { CaseDetail } from "../api/cases";

export function makeCase(overrides: Partial<CaseDetail> = {}): CaseDetail {
  return {
    id: "c-1",
    patient: { id: "p-1", full_name: "Amina Bibi", mr_number: "MR-1001" },
    status: "queued",
    uploaded_at: "2026-10-03T09:00:00Z",
    uploaded_by: "Dan Doctor",
    completed_at: null,
    failure_reason: null,
    timeline: [
      { status: "uploaded", at: "2026-10-03T09:00:00Z", message: null },
      { status: "validating", at: "2026-10-03T09:00:01Z", message: null },
      {
        status: "queued",
        at: "2026-10-03T09:00:05Z",
        message: "One image series found (120 slices).",
      },
    ],
    upload: { kind: "zip", files: 1, bytes: 25 * 1024 ** 2 },
    scan: {
      study_date: "2026-09-15",
      num_slices: 120,
      slice_thickness_mm: 1.25,
      slice_spacing_mm: 1.25,
      pixel_spacing_mm: [0.7, 0.7],
      rows: 512,
      columns: 512,
      manufacturer: "SYNTHETIC",
      model: "CaviNet Synthetic CT",
      kernel: "STANDARD",
      series_found: 1,
      series_number: 2,
    },
    result: null,
    ...overrides,
  };
}

const LATER = [
  { status: "preprocessing" as const, at: "2026-10-03T09:00:07Z", message: "Stub analyser." },
  { status: "analysing" as const, at: "2026-10-03T09:00:09Z", message: "No AI model is used." },
];

export function completedCase(): CaseDetail {
  const base = makeCase();
  return makeCase({
    status: "completed",
    completed_at: "2026-10-03T09:00:11Z",
    timeline: [
      ...base.timeline,
      ...LATER,
      { status: "completed", at: "2026-10-03T09:00:11Z", message: "STUB result." },
    ],
    result: {
      label: "STUB",
      is_stub: true,
      analyser: "stub-analyser (Phase 4 placeholder)",
      note: "Placeholder from the Phase 4 stub analyser. No AI analysis was performed.",
    },
  });
}

export function rejectedCase(
  reason = "The scan has 30 slices; at least 50 are needed.",
): CaseDetail {
  const base = makeCase();
  return makeCase({
    id: "c-9",
    status: "failed",
    failure_reason: reason,
    completed_at: "2026-10-03T09:00:02Z",
    timeline: [
      base.timeline[0],
      base.timeline[1],
      { status: "failed", at: "2026-10-03T09:00:02Z", message: reason },
    ],
    scan: null,
  });
}
