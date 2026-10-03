import { Navigate, type RouteObject } from "react-router-dom";

import { RequireAuth, RequireRole } from "./auth/RequireAuth";
import { Layout } from "./components/Layout";
import { AuditLogPage } from "./pages/admin/AuditLogPage";
import { UsersPage } from "./pages/admin/UsersPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";
import { IndexPage } from "./pages/IndexPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PatientDetailPage } from "./pages/patients/PatientDetailPage";
import { PatientFormPage } from "./pages/patients/PatientFormPage";
import { PatientsPage } from "./pages/patients/PatientsPage";

export const routes: RouteObject[] = [
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <IndexPage /> },
      { path: "change-password", element: <ChangePasswordPage /> },
      {
        // Patient data is for doctors only (section 9.3); the server enforces it too.
        path: "patients",
        element: <RequireRole roles={["doctor"]} />,
        children: [
          { index: true, element: <PatientsPage /> },
          { path: "new", element: <PatientFormPage /> },
          { path: ":patientId", element: <PatientDetailPage /> },
          { path: ":patientId/edit", element: <PatientFormPage /> },
        ],
      },
      {
        path: "admin",
        element: <RequireRole roles={["admin"]} />,
        children: [
          { index: true, element: <Navigate to="users" replace /> },
          { path: "users", element: <UsersPage /> },
          { path: "audit-log", element: <AuditLogPage /> },
        ],
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
];

/** Opt into React Router v7 behaviour now so the later upgrade is painless. */
export const routerFuture = {
  v7_relativeSplatPath: true,
  v7_fetcherPersist: true,
  v7_normalizeFormMethod: true,
  v7_partialHydration: true,
  v7_skipActionErrorRevalidation: true,
} as const;

export const providerFuture = { v7_startTransition: true } as const;
