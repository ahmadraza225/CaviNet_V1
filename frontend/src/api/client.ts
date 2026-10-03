/**
 * HTTP client for the CaviNet API.
 *
 * The access token is kept in memory only (never localStorage). The refresh token is an
 * httpOnly cookie the browser sends to /api/auth/*; when a request gets 401 the client
 * refreshes once and retries, so 30-minute access tokens renew without the user noticing.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    /** Validation messages by request field, e.g. { mr_number: "MR number is required." }. */
    public readonly fields: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface UserSummary {
  id: string;
  email: string;
  full_name: string;
  role: "doctor" | "admin";
  is_active: boolean;
  must_change_password: boolean;
  is_locked: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserSummary;
}

let accessToken: string | null = null;
let sessionExpiredHandler: (() => void) | null = null;
let refreshInFlight: Promise<TokenResponse | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Called when the session cannot be renewed (e.g. the 8-hour limit was reached). */
export function onSessionExpired(handler: (() => void) | null): void {
  sessionExpiredHandler = handler;
}

/** Turn an error response body ({detail, code} or FastAPI validation errors) into an ApiError. */
export function apiErrorFromBody(status: number, body: unknown): ApiError {
  let message = `Request failed (HTTP ${status}).`;
  let code: string | undefined;
  const fields: Record<string, string> = {};
  if (body && typeof body === "object") {
    const { detail, code: bodyCode } = body as { detail?: unknown; code?: unknown };
    code = typeof bodyCode === "string" ? bodyCode : undefined;
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail) && detail.length > 0) {
      // FastAPI validation errors: [{ loc: ["body", "<field>"], msg, type }, ...]
      const items = detail as { loc?: unknown[]; msg?: string }[];
      const messages = items.map((item) => String(item.msg ?? "").replace(/^Value error, /, ""));
      items.forEach((item, index) => {
        const loc = Array.isArray(item.loc) ? item.loc : [];
        if (loc[0] === "body" && loc.length === 2 && !(String(loc[1]) in fields)) {
          fields[String(loc[1])] = messages[index];
        }
      });
      message = messages.join(" ");
    }
  }
  return new ApiError(status, message, code, fields);
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON error body: keep the generic message.
  }
  return apiErrorFromBody(response.status, body);
}

/** Exchange the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshSession(): Promise<TokenResponse | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        if (!response.ok) {
          setAccessToken(null);
          return null;
        }
        const session = (await response.json()) as TokenResponse;
        setAccessToken(session.access_token);
        return session;
      } catch {
        return null;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Send the access token and refresh it on 401 (default true). */
  auth?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true } = options;

  const send = () => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let response = await send();
  if (response.status === 401 && auth) {
    const renewed = await refreshSession();
    if (renewed) {
      response = await send();
    } else {
      sessionExpiredHandler?.();
    }
  }
  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
