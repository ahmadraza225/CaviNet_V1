import { vi } from "vitest";

import type { TokenResponse, UserSummary } from "../api/client";

export interface RecordedCall {
  method: string;
  path: string;
  query: URLSearchParams;
  body: unknown;
  headers: Headers;
}

/** `binary` sends raw bytes (e.g. a preview PNG) instead of JSON. */
type Reply = {
  status?: number;
  body?: unknown;
  binary?: { bytes: Uint8Array; type: string };
  headers?: Record<string, string>;
};
type Handler = Reply | ((call: RecordedCall) => Reply);

function jsonResponse({ status = 200, body, binary, headers = {} }: Reply): Response {
  if (binary) {
    return new Response(binary.bytes, {
      status,
      headers: { "Content-Type": binary.type, ...headers },
    });
  }
  return new Response(status === 204 ? null : JSON.stringify(body ?? {}), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Replace fetch with a fake API keyed by "METHOD /path". Unknown routes return 404. */
export function mockApi(handlers: Record<string, Handler>) {
  const calls: RecordedCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const call: RecordedCall = {
      method: (init?.method ?? "GET").toUpperCase(),
      path: url.pathname,
      query: url.searchParams,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: new Headers(init?.headers),
    };
    calls.push(call);
    const handler = handlers[`${call.method} ${call.path}`];
    if (!handler)
      return jsonResponse({ status: 404, body: { detail: `No mock for ${call.path}` } });
    return jsonResponse(typeof handler === "function" ? handler(call) : handler);
  });
  vi.stubGlobal("fetch", fetchMock);
  const callsTo = (method: string, path: string) =>
    calls.filter((call) => call.method === method && call.path === path);
  return { calls, callsTo, fetchMock };
}

export function makeUser(overrides: Partial<UserSummary> = {}): UserSummary {
  return {
    id: "u-doctor",
    email: "doctor@example.org",
    full_name: "Dan Doctor",
    role: "doctor",
    is_active: true,
    must_change_password: false,
    is_locked: false,
    last_login_at: "2026-10-03T09:00:00Z",
    created_at: "2026-10-01T09:00:00Z",
    ...overrides,
  };
}

export const doctor = makeUser();
export const admin = makeUser({
  id: "u-admin",
  email: "admin@example.org",
  full_name: "Ada Admin",
  role: "admin",
});

export function session(user: UserSummary): TokenResponse {
  return { access_token: `token-${user.id}`, token_type: "bearer", expires_in: 1800, user };
}

/** The first bytes of a PDF file, as GET /api/cases/{id}/report sends it. */
export const pdf = {
  binary: { bytes: new TextEncoder().encode("%PDF-1.4\n"), type: "application/pdf" },
  headers: {
    "Content-Disposition": 'attachment; filename="CaviNet-report-MR-1001-2026-10-05.pdf"',
  },
};

/** The first bytes of a PNG file: enough for a fake preview image. */
export const png = {
  binary: { bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), type: "image/png" },
};

export const healthy = {
  body: { status: "ok", version: "0.5.0", database: "ok", redis: "ok" },
};

export const emptyStats = {
  total_patients: 0,
  scans_last_7_days: 0,
  cases_in_progress: 0,
  completed_cases: 0,
  failed_cases: 0,
};

/** GET /api/model/status for a trained model, the demo model (FR-05.6) and no model. */
export const realModel = {
  installed: true,
  is_demo: false,
  model_name: "CaviNet ResNet-18 ensemble",
  model_version: "1.0.0",
  created_at: "2026-12-01T10:00:00Z",
  demo_banner: null,
};
export const demoModel = {
  installed: true,
  is_demo: true,
  model_name: "CaviNet demo model (synthetic data)",
  model_version: "demo-0.5.0",
  created_at: "2026-10-03T08:00:00Z",
  demo_banner: "DEMO MODEL: NOT FOR CLINICAL USE",
};
export const noModel = {
  installed: false,
  is_demo: false,
  model_name: null,
  model_version: null,
  created_at: null,
  demo_banner: null,
};

/** The doctor dashboard before any cases exist, and no notifications. */
export const emptyDashboard: Record<string, Handler> = {
  "GET /api/dashboard/stats": { body: emptyStats },
  "GET /api/dashboard/recent-cases": { body: [] },
  "GET /api/notifications/unread-count": { body: { count: 0 } },
  "GET /api/notifications": { body: { items: [], total: 0, page: 1, page_size: 20 } },
};

/** Handlers for a browser that already has a valid session for `user`. */
export function signedInAs(user: UserSummary): Record<string, Handler> {
  return {
    "POST /api/auth/refresh": { body: session(user) },
    "POST /api/auth/logout": { status: 204 },
    "GET /api/health": healthy,
    "GET /api/model/status": { body: realModel },
    ...emptyDashboard,
  };
}

/** Handlers for a browser with no session. */
export function signedOut(): Record<string, Handler> {
  return {
    "POST /api/auth/refresh": { status: 401, body: { detail: "No session", code: "no_session" } },
    "GET /api/health": healthy,
    ...emptyDashboard,
  };
}
