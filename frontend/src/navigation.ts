import type { UserSummary } from "./api/client";

export const DISCLAIMER = "Decision support only. Not a diagnosis. Confirm with laboratory tests.";

type Role = UserSummary["role"];

/** Role-based navigation (section 9.3). Later phases add doctor-only items (Patients…). */
export const NAV_ITEMS: { to: string; label: string; roles: Role[] }[] = [
  { to: "/", label: "Home", roles: ["doctor", "admin"] },
  { to: "/admin/users", label: "Users", roles: ["admin"] },
  { to: "/admin/audit-log", label: "Audit log", roles: ["admin"] },
];

export const ROLE_LABELS: Record<Role, string> = { doctor: "Doctor", admin: "Administrator" };
