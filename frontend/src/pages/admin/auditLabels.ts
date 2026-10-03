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
};

export const actionLabel = (action: string) => ACTION_LABELS[action] ?? action;
