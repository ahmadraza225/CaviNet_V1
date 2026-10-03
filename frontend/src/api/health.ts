export type ComponentStatus = "ok" | "error";

export interface HealthResponse {
  status: "ok" | "degraded";
  version: string;
  database: ComponentStatus;
  redis: ComponentStatus;
}

/**
 * Calls GET /api/health. A 503 still carries a JSON body describing which
 * component failed, so it is returned rather than thrown.
 */
export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/api/health", { headers: { Accept: "application/json" } });
  if (!response.ok && response.status !== 503) {
    throw new Error(`Health check failed with HTTP ${response.status}`);
  }
  return (await response.json()) as HealthResponse;
}
