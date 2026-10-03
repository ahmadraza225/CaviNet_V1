import { apiFetch } from "./client";

export type Sex = "male" | "female";
export type PatientSort = "full_name" | "mr_number" | "date_of_birth" | "created_at" | "updated_at";
export type SortOrder = "asc" | "desc";

export interface Patient {
  id: string;
  full_name: string;
  mr_number: string;
  date_of_birth: string;
  age: number;
  sex: Sex;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** One scan in the patient's history (FR-03.4). */
export interface ScanSummary {
  id: string;
  uploaded_at: string;
  status: string;
  result: string | null;
  /** FR-05.6: the result came from the demo model. */
  result_is_demo: boolean;
}

export interface PatientDetail extends Patient {
  scans: ScanSummary[];
}

export interface PatientPage {
  items: Patient[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface PatientListParams {
  q?: string;
  sort?: PatientSort;
  order?: SortOrder;
  page?: number;
}

export interface PatientInput {
  full_name: string;
  mr_number: string;
  date_of_birth: string;
  sex: Sex;
  phone: string | null;
  notes: string | null;
}

export function patientQuery(params: PatientListParams): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.sort) query.set("sort", params.sort);
  if (params.order) query.set("order", params.order);
  query.set("page", String(params.page ?? 1));
  return query.toString();
}

export const listPatients = (params: PatientListParams) =>
  apiFetch<PatientPage>(`/api/patients?${patientQuery(params)}`);

export const getPatient = (id: string) => apiFetch<PatientDetail>(`/api/patients/${id}`);

export const createPatient = (patient: PatientInput) =>
  apiFetch<Patient>("/api/patients", { method: "POST", body: patient });

export const updatePatient = (id: string, changes: Partial<PatientInput>) =>
  apiFetch<Patient>(`/api/patients/${id}`, { method: "PATCH", body: changes });

/** Permanent (FR-03.2): `confirmMrNumber` must be the patient's MR number. */
export const deletePatient = (id: string, confirmMrNumber: string) =>
  apiFetch<void>(
    `/api/patients/${id}?${new URLSearchParams({ confirm: confirmMrNumber }).toString()}`,
    { method: "DELETE" },
  );
