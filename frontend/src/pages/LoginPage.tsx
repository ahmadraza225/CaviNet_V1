import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "../api/client";
import { Alert, Button, TextField } from "../components/ui";
import { useAuth, type SignOutReason } from "../auth/context";
import { DISCLAIMER } from "../navigation";

const REASON_MESSAGES: Record<SignOutReason, string> = {
  signed_out: "You have signed out.",
  inactive: "You were signed out after 30 minutes of inactivity.",
  expired: "Your session has ended. Please sign in again.",
};

export function LoginPage() {
  const { status, user, signIn, signOutReason } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "authenticated" && user && !submitting) {
    return <Navigate to={user.must_change_password ? "/change-password" : from} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const signedIn = await signIn(email, password);
      navigate(signedIn.must_change_password ? "/change-password" : from, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not reach the server.");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-bold text-brand-700">CaviNet</h1>
        <p className="mt-1 text-center text-sm text-slate-500">TB vs NTM decision support</p>

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-4 rounded-lg bg-white p-6 shadow-sm"
          aria-label="Sign in"
        >
          <h2 className="text-lg font-semibold text-slate-800">Sign in</h2>
          {signOutReason && !error && <Alert tone="info">{REASON_MESSAGES[signOutReason]}</Alert>}
          {error && <Alert tone="error">{error}</Alert>}
          <TextField
            label="Email"
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Password"
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-xs text-slate-500">
            Forgot your password? Ask an administrator to set a temporary one.
          </p>
        </form>
        <p className="mt-6 text-center text-xs text-slate-400">{DISCLAIMER}</p>
      </div>
    </div>
  );
}
