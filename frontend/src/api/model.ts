import { apiFetch } from "./client";

/** FR-05.6: shown as a banner on every screen while the installed model is the demo model. */
export interface ModelStatus {
  installed: boolean;
  is_demo: boolean;
  model_name: string | null;
  model_version: string | null;
  created_at: string | null;
  demo_banner: string | null;
}

export interface TestMetrics {
  auc?: number | null;
  sensitivity?: number | null;
  specificity?: number | null;
  accuracy?: number | null;
  n?: number | null;
}

/** FR-09.4: the installed bundle's model card (no weights). */
export interface ModelInfo {
  model_name: string;
  model_version: string | null;
  created_at: string;
  is_demo: boolean;
  format_version: number;
  git_commit: string | null;
  initialisation: string | null;
  architecture: Record<string, unknown> & { name?: string };
  folds: number;
  parameters_per_fold: number;
  temperature: number;
  decision_threshold: number;
  confidence_bands: { high: number; moderate: number };
  preprocessing: Record<string, unknown>;
  label_map: Record<string, string>;
  metrics: {
    dataset?: string;
    oof?: TestMetrics;
    locked_test?: TestMetrics;
    [key: string]: unknown;
  };
  data_manifest_sha256: string | null;
  file_name: string;
  file_size_bytes: number;
  file_sha256: string;
  demo_banner: string | null;
}

export const getModelStatus = () => apiFetch<ModelStatus>("/api/model/status");

export const getModelInfo = () => apiFetch<ModelInfo>("/api/admin/model");
