/** Plain-language names for audit actions; unknown actions fall back to their code. */
export const ACTION_LABELS: Record<string, string> = {
  login_success: "Signed in",
  login_failure: "Sign-in failed",
  account_locked: "Account locked",
  logout: "Signed out",
  password_changed: "Changed own password",
  user_created: "User created",
  user_updated: "User updated",
  user_deactivated: "User deactivated",
  user_reactivated: "User reactivated",
  password_reset: "Password reset by admin",
  patient_created: "Patient created",
  patient_updated: "Patient edited",
  patient_deleted: "Patient deleted",
  scan_uploaded: "Scan uploaded",
  result_viewed: "Result viewed",
};

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action;

/** Audit entries name patients and cases by record id only (NFR-3); admins never see
 * patient identity. */
export function targetLabel(entry: {
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
}): string {
  if (entry.target_type === "patient" && entry.target_id) {
    return `Patient record ${entry.target_id.slice(0, 8)}`;
  }
  if (entry.target_type === "case" && entry.target_id) {
    return `Case ${entry.target_id.slice(0, 8)}`;
  }
  return String(entry.details?.target_email ?? "—");
}
