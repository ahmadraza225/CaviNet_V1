import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { admin, doctor, makeUser, mockApi, session, signedOut } from "../test/api";
import { renderRoute } from "../test/render";

function signIn(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

function navLinks() {
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  return Array.from(nav.querySelectorAll("a")).map((link) => link.textContent);
}

describe("Sign-in (FR-01.1, FR-01.2)", () => {
  it("sends visitors without a session to the sign-in page", async () => {
    mockApi(signedOut());
    renderRoute("/");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("signs a doctor in and shows only the doctor navigation", async () => {
    const api = mockApi({ ...signedOut(), "POST /api/auth/login": { body: session(doctor) } });
    renderRoute("/");
    await screen.findByRole("heading", { name: "Sign in" });

    signIn("doctor@example.org", "Passw0rd123");

    expect(await screen.findByRole("heading", { name: "Welcome, Dan Doctor" })).toBeInTheDocument();
    expect(api.callsTo("POST", "/api/auth/login")[0].body).toEqual({
      email: "doctor@example.org",
      password: "Passw0rd123",
    });
    expect(navLinks()).toEqual(["Home"]);
    expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.getByText("Doctor")).toBeInTheDocument();
  });

  it("shows the admin navigation (users and audit log, no patient menu) to admins", async () => {
    mockApi({ ...signedOut(), "POST /api/auth/login": { body: session(admin) } });
    renderRoute("/");
    await screen.findByRole("heading", { name: "Sign in" });

    signIn("admin@example.org", "Passw0rd123");

    await screen.findByRole("heading", { name: "Welcome, Ada Admin" });
    expect(navLinks()).toEqual(["Home", "Users", "Audit log"]);
    expect(navLinks()).not.toContain("Patients");
  });

  it("returns to the page the user originally asked for", async () => {
    mockApi({
      ...signedOut(),
      "POST /api/auth/login": { body: session(admin) },
      "GET /api/admin/users": { body: [admin] },
    });
    renderRoute("/admin/users");
    await screen.findByRole("heading", { name: "Sign in" });

    signIn("admin@example.org", "Passw0rd123");

    expect(await screen.findByRole("heading", { name: "Users" })).toBeInTheDocument();
  });

  it("shows the server's message for wrong credentials", async () => {
    mockApi({
      ...signedOut(),
      "POST /api/auth/login": {
        status: 401,
        body: { detail: "Incorrect email or password.", code: "invalid_credentials" },
      },
    });
    renderRoute("/login");
    await screen.findByRole("heading", { name: "Sign in" });

    signIn("doctor@example.org", "nope");

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
  });

  it("explains a lockout (FR-01.4)", async () => {
    mockApi({
      ...signedOut(),
      "POST /api/auth/login": {
        status: 423,
        body: {
          detail: "Too many failed sign-in attempts. Try again in 15 minute(s).",
          code: "account_locked",
        },
      },
    });
    renderRoute("/login");
    await screen.findByRole("heading", { name: "Sign in" });

    signIn("doctor@example.org", "nope");

    expect(await screen.findByRole("alert")).toHaveTextContent("Try again in 15 minute(s)");
  });

  it("sends a user with a temporary password straight to the change-password page (FR-01.6)", async () => {
    const temporary = makeUser({ must_change_password: true });
    mockApi({ ...signedOut(), "POST /api/auth/login": { body: session(temporary) } });
    renderRoute("/");
    await screen.findByRole("heading", { name: "Sign in" });

    signIn("doctor@example.org", "Temp-pass123");

    expect(await screen.findByRole("heading", { name: "Change password" })).toBeInTheDocument();
    expect(screen.getByText(/signed in with a temporary password/)).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
  });
});
