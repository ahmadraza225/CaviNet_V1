import type { PatientDetail, PatientPage } from "../api/patients";

export function makePatient(overrides: Partial<PatientDetail> = {}): PatientDetail {
  return {
    id: "p-1",
    full_name: "Amina Bibi",
    mr_number: "MR-1001",
    date_of_birth: "1975-04-12",
    age: 51,
    sex: "female",
    phone: "+92 300 1234567",
    notes: "Referred from OPD.",
    created_at: "2026-10-01T09:00:00Z",
    updated_at: "2026-10-02T09:00:00Z",
    scans: [],
    ...overrides,
  };
}

/** A page of the patient list as the API returns it (20 per page). */
export function patientPage(items: PatientDetail[], total = items.length, page = 1): PatientPage {
  return {
    items: items.map((item) => {
      const summary: Partial<PatientDetail> = { ...item };
      delete summary.scans;
      return summary as PatientDetail;
    }),
    total,
    page,
    page_size: 20,
    pages: Math.max(1, Math.ceil(total / 20)),
  };
}
