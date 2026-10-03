import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { admin, doctor, mockApi, session, signedInAs } from "../test/api";
import { renderRoute } from "../test/render";

describe("Protected routes and sessions", () => {
  it("shows 'No access' when a doctor opens an admin page (role check in the UI too)", async () => {
    mockApi(signedInAs(doctor));
    renderRoute("/admin/users");
    expect(await screen.findByRole("heading", { name: "No access" })).toBeInTheDocument();
  });

  it("signs out on request and says so (FR-01.2)", async () => {
    const api = mockApi(signedInAs(doctor));
    renderRoute("/");
    await screen.findByRole("heading", { name: "Welcome, Dan Doctor" });

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByText("You have signed out.")).toBeInTheDocument();
    expect(api.callsTo("POST", "/api/auth/logout")).toHaveLength(1);
  });

  it("renews an expired access token once and retries the request", async () => {
    let usersCalls = 0;
    const api = mockApi({
      ...signedInAs(admin),
      "GET /api/admin/users": () =>
        ++usersCalls === 1 ? { status: 401, body: { detail: "expired" } } : { body: [admin] },
    });
    renderRoute("/admin/users");

    expect(await screen.findByText("Ada Admin", { selector: "td div" })).toBeInTheDocument();
    expect(api.callsTo("POST", "/api/auth/refresh")).toHaveLength(2); // page load + renewal
    const retried = api.callsTo("GET", "/api/admin/users")[1];
    expect(retried.headers.get("Authorization")).toBe(`Bearer ${session(admin).access_token}`);
  });

  it("returns to sign-in with an explanation when the session cannot be renewed", async () => {
    let refreshCalls = 0;
    mockApi({
      ...signedInAs(admin),
      "POST /api/auth/refresh": () =>
        ++refreshCalls === 1 ? { body: session(admin) } : { status: 401, body: {} },
      "GET /api/admin/users": { status: 401, body: { detail: "expired" } },
    });
    renderRoute("/admin/users");

    expect(
      await screen.findByText("Your session has ended. Please sign in again."),
    ).toBeInTheDocument();
  });

  it("signs out after a period of inactivity (FR-01.5)", async () => {
    const api = mockApi(signedInAs(doctor));
    renderRoute("/", { inactivityLimitMs: 200 });
    await screen.findByRole("heading", { name: "Welcome, Dan Doctor" });

    expect(
      await screen.findByText("You were signed out after 30 minutes of inactivity.", undefined, {
        timeout: 2000,
      }),
    ).toBeInTheDocument();
    await waitFor(() => expect(api.callsTo("POST", "/api/auth/logout")).toHaveLength(1));
  });
});
