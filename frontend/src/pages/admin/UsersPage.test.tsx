import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { admin, doctor, makeUser, mockApi, signedInAs } from "../../test/api";
import { renderRoute } from "../../test/render";

const locked = makeUser({
  id: "u-locked",
  email: "locked@example.org",
  full_name: "Lee Locked",
  is_locked: true,
  must_change_password: true,
  last_login_at: null,
});
const inactive = makeUser({
  id: "u-off",
  email: "off@example.org",
  full_name: "Olly Off",
  is_active: false,
});

function rowOf(name: string) {
  const row = screen.getByText(name, { selector: "td div" }).closest("tr");
  if (!row) throw new Error(`No row for ${name}`);
  return within(row);
}

async function openUsers(extra = {}) {
  const api = mockApi({
    ...signedInAs(admin),
    "GET /api/admin/users": { body: [admin, doctor, locked, inactive] },
    ...extra,
  });
  renderRoute("/admin/users");
  await screen.findByText("Dan Doctor", { selector: "td div" });
  return api;
}

describe("Admin Users page (FR-09.1)", () => {
  it("lists users with their role and status", async () => {
    await openUsers();
    expect(rowOf("Ada Admin").getByText("This is you")).toBeInTheDocument();
    expect(rowOf("Lee Locked").getByText("Locked")).toBeInTheDocument();
    expect(rowOf("Lee Locked").getByText("Temporary password")).toBeInTheDocument();
    expect(rowOf("Lee Locked").getByText("Never")).toBeInTheDocument();
    expect(rowOf("Olly Off").getByText("Deactivated")).toBeInTheDocument();
    expect(rowOf("Olly Off").getByRole("button", { name: "Reactivate" })).toBeInTheDocument();
    expect(rowOf("Ada Admin").getByLabelText("Role of Ada Admin")).toBeDisabled();
  });

  it("creates a user with a temporary password", async () => {
    const api = await openUsers({ "POST /api/admin/users": { status: 201, body: locked } });
    fireEvent.click(screen.getByRole("button", { name: "Add user" }));
    const form = within(screen.getByRole("form", { name: "Add user" }));

    fireEvent.change(form.getByLabelText("Full name"), { target: { value: "Lee Locked" } });
    fireEvent.change(form.getByLabelText("Email"), { target: { value: "locked@example.org" } });
    fireEvent.change(form.getByLabelText("Role"), { target: { value: "admin" } });
    fireEvent.change(form.getByLabelText("Temporary password"), {
      target: { value: "short" },
    });
    fireEvent.click(form.getByRole("button", { name: "Create user" }));
    expect(form.getByRole("alert")).toHaveTextContent("at least 10 characters");
    expect(api.callsTo("POST", "/api/admin/users")).toHaveLength(0);

    fireEvent.change(form.getByLabelText("Temporary password"), {
      target: { value: "Temp-pass123" },
    });
    fireEvent.click(form.getByRole("button", { name: "Create user" }));

    expect(await screen.findByText(/Created Lee Locked/)).toBeInTheDocument();
    expect(api.callsTo("POST", "/api/admin/users")[0].body).toEqual({
      full_name: "Lee Locked",
      email: "locked@example.org",
      role: "admin",
      temporary_password: "Temp-pass123",
    });
  });

  it("shows server errors such as a duplicate email", async () => {
    await openUsers({
      "POST /api/admin/users": {
        status: 409,
        body: { detail: "A user with this email already exists.", code: "email_taken" },
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add user" }));
    const form = within(screen.getByRole("form", { name: "Add user" }));
    fireEvent.change(form.getByLabelText("Full name"), { target: { value: "Dup" } });
    fireEvent.change(form.getByLabelText("Email"), { target: { value: "doctor@example.org" } });
    fireEvent.change(form.getByLabelText("Temporary password"), {
      target: { value: "Temp-pass123" },
    });
    fireEvent.click(form.getByRole("button", { name: "Create user" }));

    expect(await form.findByRole("alert")).toHaveTextContent("already exists");
  });

  it("deactivates and reactivates users", async () => {
    const api = await openUsers({
      [`POST /api/admin/users/${doctor.id}/deactivate`]: { body: { ...doctor, is_active: false } },
      [`POST /api/admin/users/${inactive.id}/reactivate`]: {
        body: { ...inactive, is_active: true },
      },
    });
    fireEvent.click(rowOf("Dan Doctor").getByRole("button", { name: "Deactivate" }));
    expect(await screen.findByText("Dan Doctor has been deactivated.")).toBeInTheDocument();
    fireEvent.click(rowOf("Olly Off").getByRole("button", { name: "Reactivate" }));
    expect(await screen.findByText("Olly Off has been reactivated.")).toBeInTheDocument();
    expect(api.callsTo("POST", `/api/admin/users/${doctor.id}/deactivate`)).toHaveLength(1);
  });

  it("changes a user's role", async () => {
    const api = await openUsers({
      [`PATCH /api/admin/users/${doctor.id}`]: { body: { ...doctor, role: "admin" } },
    });
    fireEvent.change(rowOf("Dan Doctor").getByLabelText("Role of Dan Doctor"), {
      target: { value: "admin" },
    });
    expect(await screen.findByText("Dan Doctor is now an administrator.")).toBeInTheDocument();
    expect(api.callsTo("PATCH", `/api/admin/users/${doctor.id}`)[0].body).toEqual({
      role: "admin",
    });
  });

  it("resets a password to a temporary one (FR-01.6)", async () => {
    const api = await openUsers({
      [`POST /api/admin/users/${locked.id}/reset-password`]: {
        body: { ...locked, is_locked: false },
      },
    });
    fireEvent.click(rowOf("Lee Locked").getByRole("button", { name: "Reset password" }));
    fireEvent.change(screen.getByLabelText("Temporary password for Lee Locked"), {
      target: { value: "Reset-pass123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));

    expect(await screen.findByText(/Temporary password set for Lee Locked/)).toBeInTheDocument();
    expect(api.callsTo("POST", `/api/admin/users/${locked.id}/reset-password`)[0].body).toEqual({
      temporary_password: "Reset-pass123",
    });
  });
});
