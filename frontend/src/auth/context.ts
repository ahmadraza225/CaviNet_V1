import { createContext, useContext } from "react";

import type { TokenResponse, UserSummary } from "../api/client";

export type SignOutReason = "signed_out" | "inactive" | "expired";

export interface AuthState {
  status: "loading" | "authenticated" | "anonymous";
  user: UserSummary | null;
  /** Why the last session ended, shown on the sign-in page. */
  signOutReason: SignOutReason | null;
  signIn(email: string, password: string): Promise<UserSummary>;
  signOut(reason?: SignOutReason): Promise<void>;
  /** Store the new session returned by a password change. */
  applySession(session: TokenResponse): void;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}

/** FR-01.5: sign out after 30 minutes without any interaction. */
export const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
