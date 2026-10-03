import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { doctor, emptyStats, mockApi, signedInAs } from "../test/api";
import { patientPage } from "../test/patients";
import { renderRoute } from "../test/render";
import { DASHBOARD_POLL_MS } from "./DashboardPage";

function statValue(label: string) {
  return within(screen.getByRole("group", { name: label })).getByText(/^\d+$/).textContent;
}

describe("Doctor dashboard (M-02)", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps the counts live: they refresh every 10 seconds (FR-02.1)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let completed = 0;
    mockApi({
      ...signedInAs(doctor),
      "GET /api/dashboard/stats": () => ({
        body: {
          ...emptyStats,
          total_patients: 1,
          scans_last_7_days: 1,
          completed_cases: completed,
        },
      }),
    });
    renderRoute("/");
    await screen.findAllByText("1", { selector: "p" });
    expect(statValue("Completed cases")).toBe("0");

    completed = 1; // the worker finished a case meanwhile
    await act(() => vi.advanceTimersByTimeAsync(DASHBOARD_POLL_MS));
    expect(statValue("Completed cases")).toBe("1");
  });

  it("shows the FR-02.1 counts from the API", async () => {
    mockApi({
      ...signedInAs(doctor),
      "GET /api/dashboard/stats": {
        body: {
          total_patients: 3,
          scans_last_7_days: 0,
          cases_in_progress: 0,
          completed_cases: 0,
          failed_cases: 0,
        },
      },
    });
    renderRoute("/");

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Welcome, Dan Doctor")).toBeInTheDocument();
    await screen.findByText("3");
    expect(statValue("Total patients")).toBe("3");
    expect(statValue("Scans in the last 7 days")).toBe("0");
    expect(statValue("Cases in progress")).toBe("0");
    expect(statValue("Completed cases")).toBe("0");
    expect(statValue("Failed cases")).toBe("0");
  });

  it("shows an empty recent-cases table until scans are uploaded (FR-02.2)", async () => {
    mockApi(signedInAs(doctor));
    renderRoute("/");

    expect(await screen.findByRole("heading", { name: "Recent cases" })).toBeInTheDocument();
    expect(
      await screen.findByText("No cases yet. Cases appear here once CT scans are uploaded."),
    ).toBeInTheDocument();
  });

  it("lists recent cases with links to the patient and the case", async () => {
    mockApi({
      ...signedInAs(doctor),
      "GET /api/dashboard/recent-cases": {
        body: [
          {
            case_id: "c-1",
            patient_id: "p-1",
            patient_name: "Amina Bibi",
            uploaded_at: "2026-10-03T08:00:00Z",
            status: "completed",
            result: "TB",
          },
        ],
      },
    });
    renderRoute("/");

    const link = await screen.findByRole("link", { name: "Amina Bibi" });
    expect(link).toHaveAttribute("href", "/patients/p-1");
    const row = link.closest("tr")!;
    expect(within(row).getByText("Completed")).toBeInTheDocument();
    expect(within(row).getByText("TB")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: /Open the case of Amina Bibi/ })).toHaveAttribute(
      "href",
      "/cases/c-1",
    );
  });

  it("searches patients from the dashboard (FR-02.3)", async () => {
    const api = mockApi({
      ...signedInAs(doctor),
      "GET /api/patients": { body: patientPage([]) },
    });
    const { router } = renderRoute("/");
    await screen.findByRole("heading", { name: "Dashboard" });

    fireEvent.change(screen.getByRole("searchbox", { name: "Search patients" }), {
      target: { value: "  amina " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByRole("heading", { name: "Patients" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?q=amina");
    expect(api.callsTo("GET", "/api/patients")[0].query.get("q")).toBe("amina");
  });

  it("opens the upload page from Upload CT (FR-02.3, NFR-5)", async () => {
    mockApi({ ...signedInAs(doctor), "GET /api/patients": { body: patientPage([]) } });
    const { router } = renderRoute("/");

    fireEvent.click(await screen.findByRole("link", { name: "Upload CT" }));

    expect(await screen.findByRole("heading", { name: "Upload CT scan" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/upload");
  });

  it("shows an error if the counts cannot be loaded", async () => {
    mockApi({
      ...signedInAs(doctor),
      "GET /api/dashboard/stats": { status: 500, body: { detail: "Database unavailable." } },
    });
    renderRoute("/");

    expect(await screen.findByText("Database unavailable.")).toBeInTheDocument();
  });

  it("is reached from the Dashboard link and loads stats once", async () => {
    const api = mockApi({
      ...signedInAs(doctor),
      "GET /api/dashboard/stats": { body: emptyStats },
    });
    renderRoute("/");

    await screen.findByRole("group", { name: "Total patients" });
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/");
    expect(api.callsTo("GET", "/api/dashboard/stats")).toHaveLength(1);
  });
});
