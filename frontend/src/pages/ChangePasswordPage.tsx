import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { changePassword } from "../api/auth";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/context";
import { PASSWORD_RULES, passwordProblem } from "../auth/password";
import { Alert, Button, TextField } from "../components/ui";

export function ChangePasswordPage() {
  const { user, applySession } = useAuth();
  const navigate = useNavigate();
  const forced = Boolean(user?.must_change_password);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = passwordProblem(next);
    if (problem) return setError(problem);
    if (next !== confirm) return setError("The new passwords do not match.");
    setError(null);
    setSubmitting(true);
    try {
      applySession(await changePassword(current, next));
      navigate("/", { replace: true, state: { notice: "Your password has been changed." } });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not reach the server.");
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-800">Change password</h1>
      {forced && (
        <div className="mt-4">
          <Alert tone="warning">
            You signed in with a temporary password. Choose your own password to continue.
          </Alert>
        </div>
      )}
      <form onSubmit={handleSubmit} className="mt-4 space-y-4" aria-label="Change password">
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label={forced ? "Temporary password" : "Current password"}
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <TextField
          label="New password"
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          hint={PASSWORD_RULES}
          value={next}
          onChange={(event) => setNext(event.target.value)}
        />
        <TextField
          label="Confirm new password"
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Change password"}
          </Button>
          {!forced && (
            <Link to="/" className="text-sm text-slate-600 underline">
              Cancel
            </Link>
          )}
        </div>
      </form>
    </section>
  );
}
