import type { UserSummary } from "./api/client";

export const DISCLAIMER = "Decision support only. Not a diagnosis. Confirm with laboratory tests.";

type Role = UserSummary["role"];

/** Role-based navigation (section 9.3). Admins have no access to patient data. */
export const NAV_ITEMS: { to: string; label: string; roles: Role[] }[] = [
  { to: "/", label: "Dashboard", roles: ["doctor"] },
  { to: "/patients", label: "Patients", roles: ["doctor"] },
  { to: "/", label: "Home", roles: ["admin"] },
  { to: "/admin/users", label: "Users", roles: ["admin"] },
  { to: "/admin/audit-log", label: "Audit log", roles: ["admin"] },
];

export const ROLE_LABELS: Record<Role, string> = { doctor: "Doctor", admin: "Administrator" };
