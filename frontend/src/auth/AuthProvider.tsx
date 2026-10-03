import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { login as apiLogin, logout as apiLogout } from "../api/auth";
import {
  onSessionExpired,
  refreshSession,
  setAccessToken,
  type TokenResponse,
  type UserSummary,
} from "../api/client";
import { AuthContext, INACTIVITY_LIMIT_MS, type AuthState, type SignOutReason } from "./context";
import { useInactivityTimeout } from "./useInactivityTimeout";

interface Props {
  children: ReactNode;
  /** Overridable for tests; defaults to 30 minutes. */
  inactivityLimitMs?: number;
}

export function AuthProvider({ children, inactivityLimitMs = INACTIVITY_LIMIT_MS }: Props) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthState["status"]>("loading");
  const [user, setUser] = useState<UserSummary | null>(null);
  const [signOutReason, setSignOutReason] = useState<SignOutReason | null>(null);

  const endSession = useCallback(
    (reason: SignOutReason) => {
      setAccessToken(null);
      setUser(null);
      setStatus("anonymous");
      setSignOutReason(reason);
      queryClient.clear();
    },
    [queryClient],
  );

  // On page load, resume the session from the refresh cookie if there is one.
  useEffect(() => {
    let cancelled = false;
    refreshSession().then((session) => {
      if (cancelled) return;
      if (session) {
        setUser(session.user);
        setStatus("authenticated");
      } else {
        setStatus("anonymous");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onSessionExpired(() => endSession("expired"));
    return () => onSessionExpired(null);
  }, [endSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const session = await apiLogin(email, password);
    setAccessToken(session.access_token);
    setUser(session.user);
    setStatus("authenticated");
    setSignOutReason(null);
    return session.user;
  }, []);

  const signOut = useCallback(
    async (reason: SignOutReason = "signed_out") => {
      try {
        await apiLogout();
      } catch {
        // Already signed out on the server; still clear the local session.
      }
      endSession(reason);
    },
    [endSession],
  );

  const applySession = useCallback((session: TokenResponse) => {
    setAccessToken(session.access_token);
    setUser(session.user);
    setStatus("authenticated");
  }, []);

  useInactivityTimeout(status === "authenticated", inactivityLimitMs, () => {
    void signOut("inactive");
  });

  const value = useMemo<AuthState>(
    () => ({ status, user, signOutReason, signIn, signOut, applySession }),
    [status, user, signOutReason, signIn, signOut, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
