/** Mirrors the server policy (FR-01.1) for instant feedback; the server is authoritative. */
export const PASSWORD_RULES =
  "At least 10 characters, including at least one letter and one digit.";

export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters long.";
  if (password.length > 128) return "Password must be at most 128 characters long.";
  if (!/[A-Za-z]/.test(password)) return "Password must contain at least one letter.";
  if (!/\d/.test(password)) return "Password must contain at least one digit.";
  return null;
}
