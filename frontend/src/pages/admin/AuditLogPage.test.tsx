import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { admin, doctor, mockApi, signedInAs } from "../../test/api";
import { renderRoute } from "../../test/render";

const entries = [
  {
    id: 2,
    created_at: "2026-10-03T10:00:00Z",
    user_id: admin.id,
    actor_email: admin.email,
    action: "user_created",
    target_type: "user",
    target_id: doctor.id,
    details: { target_email: doctor.email, role: "doctor" },
    ip_address: "10.0.0.5",
  },
  {
    id: 1,
    created_at: "2026-10-03T09:00:00Z",
    user_id: null,
    actor_email: "nobody@example.org",
    action: "login_failure",
    target_type: null,
    target_id: null,
    details: { reason: "unknown_email" },
    ip_address: "10.0.0.9",
  },
];

function setup(total = 2) {
  return mockApi({
    ...signedInAs(admin),
    "GET /api/admin/users": { body: [admin, doctor] },
    "GET /api/admin/audit-logs/actions": {
      body: ["login_success", "login_failure", "user_created"],
    },
    "GET /api/admin/audit-logs": { body: { items: entries, total, page: 1, page_size: 25 } },
  });
}

describe("Admin Audit Log page (FR-09.3)", () => {
  it("lists entries in plain language", async () => {
    setup();
    renderRoute("/admin/audit-log");

    expect(await screen.findByText("User created", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText("Sign-in failed", { selector: "td" })).toBeInTheDocument();
    expect(screen.getByText(doctor.email)).toBeInTheDocument();
    expect(screen.getByText("reason: unknown_email")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 1 · 2 entries")).toBeInTheDocument();
  });

  it("filters by user, action and date range", async () => {
    const api = setup();
    renderRoute("/admin/audit-log");
    await screen.findByText("User created", { selector: "td" });
    await screen.findByRole("option", { name: "Signed in" });

    fireEvent.change(screen.getByLabelText("User"), { target: { value: doctor.id } });
    fireEvent.change(screen.getByLabelText("Action"), { target: { value: "login_success" } });
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-10-03" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await screen.findByText("User created", { selector: "td" });
    const last = api.callsTo("GET", "/api/admin/audit-logs").at(-1)!;
    expect(Object.fromEntries(last.query)).toEqual({
      user_id: doctor.id,
      action: "login_success",
      date_from: "2026-10-01",
      date_to: "2026-10-03",
      page: "1",
      page_size: "25",
    });
  });

  it("pages through results", async () => {
    const api = setup(60);
    renderRoute("/admin/audit-log");
    await screen.findByText("Page 1 of 3 · 60 entries");

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByText("Page 2 of 3 · 60 entries")).toBeInTheDocument();
    expect(api.callsTo("GET", "/api/admin/audit-logs").at(-1)!.query.get("page")).toBe("2");
  });
});
