import { apiFetch, type TokenResponse, type UserSummary } from "./client";

export function login(email: string, password: string): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/api/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false,
  });
}

export function logout(): Promise<void> {
  return apiFetch<void>("/api/auth/logout", { method: "POST", auth: false });
}

export function fetchMe(): Promise<UserSummary> {
  return apiFetch<UserSummary>("/api/auth/me");
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<TokenResponse> {
  return apiFetch<TokenResponse>("/api/auth/change-password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}
