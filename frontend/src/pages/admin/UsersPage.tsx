import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import {
  createUser,
  deactivateUser,
  listUsers,
  reactivateUser,
  resetPassword,
  updateUser,
  type NewUser,
  type Role,
} from "../../api/admin";
import { ApiError, type UserSummary } from "../../api/client";
import { useAuth } from "../../auth/context";
import { PASSWORD_RULES, passwordProblem } from "../../auth/password";
import { Alert, Button, Loading, SelectField, TextField } from "../../components/ui";

const USERS_KEY = ["admin", "users"];
const EMPTY_FORM: NewUser = { full_name: "", email: "", role: "doctor", temporary_password: "" };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "Never";
}

function StatusBadges({ user }: { user: UserSummary }) {
  const badges: { label: string; className: string }[] = [];
  badges.push(
    user.is_active
      ? { label: "Active", className: "bg-green-100 text-green-800" }
      : { label: "Deactivated", className: "bg-slate-200 text-slate-700" },
  );
  if (user.is_locked) badges.push({ label: "Locked", className: "bg-red-100 text-red-800" });
  if (user.must_change_password)
    badges.push({ label: "Temporary password", className: "bg-amber-100 text-amber-900" });
  return (
    <div className="flex flex-wrap gap-1">
      {badges.map((badge) => (
        <span key={badge.label} className={`rounded px-2 py-0.5 text-xs ${badge.className}`}>
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function AddUserForm({ onCreated }: { onCreated: (user: UserSummary) => void }) {
  const [form, setForm] = useState<NewUser>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: (user) => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      setForm(EMPTY_FORM);
      onCreated(user);
    },
    onError: (caught) => setError(messageOf(caught)),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = passwordProblem(form.temporary_password);
    if (problem) return setError(problem);
    setError(null);
    mutation.mutate(form);
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Add user"
      className="space-y-4 rounded-lg bg-white p-6 shadow-sm"
    >
      <h2 className="text-lg font-semibold text-slate-800">Add user</h2>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Full name"
          id="new-full-name"
          required
          value={form.full_name}
          onChange={(event) => setForm({ ...form, full_name: event.target.value })}
        />
        <TextField
          label="Email"
          id="new-email"
          type="email"
          required
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <SelectField
          label="Role"
          id="new-role"
          value={form.role}
          onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
        >
          <option value="doctor">Doctor</option>
          <option value="admin">Administrator</option>
        </SelectField>
        <TextField
          label="Temporary password"
          id="new-password"
          type="text"
          autoComplete="off"
          required
          hint={`${PASSWORD_RULES} The user must change it at first sign-in.`}
          value={form.temporary_password}
          onChange={(event) => setForm({ ...form, temporary_password: event.target.value })}
        />
      </div>
      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Creating…" : "Create user"}
      </Button>
    </form>
  );
}

function UserRow({
  user,
  isSelf,
  onDone,
}: {
  user: UserSummary;
  isSelf: boolean;
  onDone: (message: string, tone?: "success" | "error") => void;
}) {
  const queryClient = useQueryClient();
  const [resetting, setResetting] = useState(false);
  const [temporary, setTemporary] = useState("");

  const run = useMutation({
    mutationFn: (action: () => Promise<UserSummary>) => action(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
    onError: (caught) => onDone(messageOf(caught), "error"),
  });

  function changeRole(role: Role) {
    run.mutate(() => updateUser(user.id, { role }), {
      onSuccess: () =>
        onDone(`${user.full_name} is now ${role === "admin" ? "an administrator" : "a doctor"}.`),
    });
  }

  function toggleActive() {
    const action = user.is_active ? deactivateUser : reactivateUser;
    run.mutate(() => action(user.id), {
      onSuccess: () =>
        onDone(`${user.full_name} has been ${user.is_active ? "deactivated" : "reactivated"}.`),
    });
  }

  function submitReset(event: FormEvent) {
    event.preventDefault();
    const problem = passwordProblem(temporary);
    if (problem) return onDone(problem, "error");
    run.mutate(() => resetPassword(user.id, temporary), {
      onSuccess: () => {
        setResetting(false);
        setTemporary("");
        onDone(
          `Temporary password set for ${user.full_name}. They must change it at next sign-in.`,
        );
      },
    });
  }

  return (
    <tr className="align-top">
      <td className="px-3 py-3">
        <div className="font-medium text-slate-800">{user.full_name}</div>
        <div className="text-xs text-slate-500">{user.email}</div>
      </td>
      <td className="px-3 py-3">
        <label className="sr-only" htmlFor={`role-${user.id}`}>
          Role of {user.full_name}
        </label>
        <select
          id={`role-${user.id}`}
          value={user.role}
          disabled={isSelf || run.isPending}
          onChange={(event) => changeRole(event.target.value as Role)}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
        >
          <option value="doctor">Doctor</option>
          <option value="admin">Administrator</option>
        </select>
      </td>
      <td className="px-3 py-3">
        <StatusBadges user={user} />
      </td>
      <td className="px-3 py-3 text-sm text-slate-600">{formatDate(user.last_login_at)}</td>
      <td className="px-3 py-3">
        {isSelf ? (
          <span className="text-xs text-slate-400">This is you</span>
        ) : resetting ? (
          <form
            onSubmit={submitReset}
            className="flex flex-col gap-2"
            aria-label={`Reset password for ${user.full_name}`}
          >
            <label className="sr-only" htmlFor={`temp-${user.id}`}>
              Temporary password for {user.full_name}
            </label>
            <input
              id={`temp-${user.id}`}
              type="text"
              autoComplete="off"
              placeholder="Temporary password"
              value={temporary}
              onChange={(event) => setTemporary(event.target.value)}
              className="rounded border border-slate-300 px-2 py-1 text-sm"
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={run.isPending}>
                Set password
              </Button>
              <Button variant="secondary" onClick={() => setResetting(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setResetting(true)}>
              Reset password
            </Button>
            <Button
              variant={user.is_active ? "danger" : "secondary"}
              onClick={toggleActive}
              disabled={run.isPending}
            >
              {user.is_active ? "Deactivate" : "Reactivate"}
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function UsersPage() {
  const { user: me } = useAuth();
  const {
    data: users,
    isPending,
    isError,
    error,
  } = useQuery({ queryKey: USERS_KEY, queryFn: listUsers });
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "error" } | null>(null);

  const done = (text: string, tone: "success" | "error" = "success") => setNotice({ text, tone });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Users</h1>
        <Button onClick={() => setShowForm((value) => !value)}>
          {showForm ? "Close" : "Add user"}
        </Button>
      </div>
      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {showForm && (
        <AddUserForm
          onCreated={(created) => {
            setShowForm(false);
            done(
              `Created ${created.full_name}. Give them the temporary password; they must change it at first sign-in.`,
            );
          }}
        />
      )}
      <section className="overflow-x-auto rounded-lg bg-white shadow-sm">
        {isPending && <Loading className="p-6">Loading users…</Loading>}
        {isError && (
          <p role="alert" className="p-6 text-sm text-red-700">
            Could not load users. {(error as Error).message}
          </p>
        )}
        {users && (
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Last sign-in</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <UserRow key={user.id} user={user} isSelf={user.id === me?.id} onDone={done} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
