import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import type { UserSummary } from "../api/client";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { useAuth } from "./context";

/** Signed-in users only; sends users with a temporary password to the change page first. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Loading CaviNet…
      </div>
    );
  }
  if (status === "anonymous" || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (user.must_change_password && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <>{children}</>;
}

/** Shows a "no access" page unless the user has one of the roles (the server also checks). */
export function RequireRole({ roles }: { roles: UserSummary["role"][] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <ForbiddenPage />;
  }
  return <Outlet />;
}
