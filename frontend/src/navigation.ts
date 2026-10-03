import type { UserSummary } from "./api/client";

export const DISCLAIMER = "Decision support only. Not a diagnosis. Confirm with laboratory tests.";

/** FR-05.6: shown wherever results appear while the model is the demo model. */
export const DEMO_BANNER = "DEMO MODEL: NOT FOR CLINICAL USE";

type Role = UserSummary["role"];

/** Role-based navigation (section 9.3). Admins have no access to patient data. */
export const NAV_ITEMS: { to: string; label: string; roles: Role[] }[] = [
  { to: "/", label: "Dashboard", roles: ["doctor"] },
  { to: "/patients", label: "Patients", roles: ["doctor"] },
  { to: "/", label: "Home", roles: ["admin"] },
  { to: "/admin/users", label: "Users", roles: ["admin"] },
  { to: "/admin/audit-log", label: "Audit log", roles: ["admin"] },
  { to: "/admin/model", label: "Model", roles: ["admin"] },
];

export const ROLE_LABELS: Record<Role, string> = { doctor: "Doctor", admin: "Administrator" };
