import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DEMO_BANNER } from "../navigation";
import { admin, demoModel, doctor, mockApi, noModel, signedInAs } from "../test/api";
import { renderRoute } from "../test/render";

const PATIENT_PAGE = { items: [], total: 0, page: 1, page_size: 20 };
const AUDIT_PAGE = { items: [], total: 0, page: 1, page_size: 25 };

describe("DEMO banner on every screen (FR-05.6)", () => {
  it.each([
    ["the dashboard", doctor, "/", "Dashboard"],
    ["the patient list", doctor, "/patients", "Patients"],
    ["the upload page", doctor, "/upload", "Upload CT scan"],
    ["the admin home", admin, "/", "Welcome, Ada Admin"],
    ["the user list", admin, "/admin/users", "Users"],
    ["the audit log", admin, "/admin/audit-log", "Audit log"],
  ])("shows it on %s while the demo model is installed", async (_, user, path, heading) => {
    mockApi({
      ...signedInAs(user),
      "GET /api/model/status": { body: demoModel },
      "GET /api/patients": { body: PATIENT_PAGE },
      "GET /api/admin/users": { body: [] },
      "GET /api/admin/audit-logs": { body: AUDIT_PAGE },
      "GET /api/admin/audit-logs/actions": { body: [] },
    });
    renderRoute(path);

    await screen.findByRole("heading", { level: 1, name: heading });
    const banner = await screen.findByRole("status", { name: "Demo model" });
    expect(banner).toHaveTextContent(DEMO_BANNER);
    expect(banner).toHaveTextContent("trained on synthetic data");
  });

  it("is absent for a trained model", async () => {
    const api = mockApi(signedInAs(doctor));
    renderRoute("/");

    await screen.findByRole("heading", { name: "Dashboard" });
    expect(api.callsTo("GET", "/api/model/status")).toHaveLength(1);
    expect(screen.queryByText(DEMO_BANNER)).not.toBeInTheDocument();
  });

  it("says when no model is installed", async () => {
    mockApi({ ...signedInAs(doctor), "GET /api/model/status": { body: noModel } });
    renderRoute("/");

    expect(await screen.findByText("No AI model is installed.")).toBeInTheDocument();
    expect(screen.getByText("make fetch-model")).toBeInTheDocument();
    expect(screen.queryByText(DEMO_BANNER)).not.toBeInTheDocument();
  });

  it("is not shown on the sign-in page", async () => {
    mockApi({
      "POST /api/auth/refresh": { status: 401, body: { detail: "No session" } },
      "GET /api/health": { body: { status: "ok", version: "0.5.0", database: "ok", redis: "ok" } },
      "GET /api/model/status": { body: demoModel },
    });
    renderRoute("/login");

    await screen.findByRole("heading", { name: "CaviNet" });
    expect(screen.queryByText(DEMO_BANNER)).not.toBeInTheDocument();
  });
});
