import { apiFetch } from "./client";

export interface DashboardStats {
  total_patients: number;
  scans_last_7_days: number;
  cases_in_progress: number;
  completed_cases: number;
  failed_cases: number;
}

export interface RecentCase {
  case_id: string;
  patient_id: string;
  patient_name: string;
  uploaded_at: string;
  status: string;
  result: string | null;
  /** FR-05.6: the result came from the demo model. */
  result_is_demo: boolean;
}

export const getDashboardStats = () => apiFetch<DashboardStats>("/api/dashboard/stats");

export const getRecentCases = () => apiFetch<RecentCase[]>("/api/dashboard/recent-cases");
