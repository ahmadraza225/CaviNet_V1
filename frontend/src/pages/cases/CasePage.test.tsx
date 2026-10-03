import { act, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DISCLAIMER } from "../../navigation";
import { doctor, mockApi, signedInAs } from "../../test/api";
import { completedCase, makeCase, rejectedCase } from "../../test/cases";
import { renderRoute } from "../../test/render";
import { CASE_POLL_MS } from "./CasePage";

function steps() {
  const list = screen.getByRole("list", { name: "Status timeline" });
  return within(list)
    .getAllByRole("listitem")
    .map((item) => [item.dataset.state, item.querySelector("p")!.firstChild!.textContent]);
}

describe("Case page (FR-08.1)", () => {
  afterEach(() => vi.useRealTimers());

  it("shows the timeline with done, current and pending steps", async () => {
    mockApi({ ...signedInAs(doctor), "GET /api/cases/c-1": { body: makeCase() } });
    renderRoute("/cases/c-1");

    await screen.findByRole("heading", { name: "Status timeline" });
    expect(steps()).toEqual([
      ["done", "Uploaded"],
      ["done", "Validating"],
      ["current", "Queued"],
      ["pending", "Preprocessing"],
      ["pending", "Analysing"],
      ["pending", "Completed"],
    ]);
    expect(screen.getByText("One image series found (120 slices).")).toBeInTheDocument();
    expect(screen.getByText("This page updates automatically.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Amina Bibi" })).toHaveAttribute(
      "href",
      "/patients/p-1",
    );
    expect(screen.getByText(/by Dan Doctor/)).toBeInTheDocument();
  });

  it("shows the FR-04.5 scan details and the upload", async () => {
    mockApi({ ...signedInAs(doctor), "GET /api/cases/c-1": { body: makeCase() } });
    renderRoute("/cases/c-1");

    const details = await screen.findByRole("region", { name: "Scan details" });
    for (const [label, value] of [
      ["Study date", "15 Sept 2026"],
      ["Slices", "120"],
      ["Slice thickness", "1.25 mm"],
      ["Slice spacing", "1.25 mm"],
      ["Pixel spacing", "0.7 × 0.7 mm"],
      ["Image size", "512 × 512"],
      ["Manufacturer", "SYNTHETIC"],
      ["Model", "CaviNet Synthetic CT"],
      ["Kernel", "STANDARD"],
      ["Series used", "The only image series"],
      ["Uploaded files", "1 .zip file (25.0 MB)"],
    ]) {
      const term = within(details).getByText(label);
      expect(term.nextElementSibling).toHaveTextContent(value);
    }
  });

  it("checks for progress every 2 seconds until the case ends", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let call = 0;
    const api = mockApi({
      ...signedInAs(doctor),
      "GET /api/cases/c-1": () => ({ body: ++call === 1 ? makeCase() : completedCase() }),
    });
    renderRoute("/cases/c-1");
    await screen.findByText("Queued", { selector: "p *, p" });

    await act(() => vi.advanceTimersByTimeAsync(CASE_POLL_MS + 100));
    expect(await screen.findByText("STUB")).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(CASE_POLL_MS * 3));
    expect(api.callsTo("GET", "/api/cases/c-1")).toHaveLength(2);
  });

  it("marks the stub result as a placeholder, never a diagnosis", async () => {
    mockApi({ ...signedInAs(doctor), "GET /api/cases/c-1": { body: completedCase() } });
    renderRoute("/cases/c-1");

    const result = await screen.findByRole("region", { name: "Result" });
    expect(within(result).getByText("STUB RESULT: PLACEHOLDER ONLY")).toBeInTheDocument();
    expect(within(result).getByText(/No AI analysis was performed/)).toBeInTheDocument();
    expect(within(result).getByText("STUB")).toBeInTheDocument();
    expect(within(result).getByText(DISCLAIMER)).toBeInTheDocument();
    expect(steps().every(([state]) => state === "done")).toBe(true);
    expect(screen.queryByText("This page updates automatically.")).not.toBeInTheDocument();
  });

  it("shows where and why a case failed", async () => {
    mockApi({ ...signedInAs(doctor), "GET /api/cases/c-9": { body: rejectedCase() } });
    renderRoute("/cases/c-9");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Failed: The scan has 30 slices; at least 50 are needed.",
    );
    expect(steps()).toEqual([
      ["done", "Uploaded"],
      ["done", "Validating"],
      ["failed", "Failed"],
    ]);
    expect(
      screen.getByText("No scan details: the upload did not pass the checks."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Result" })).not.toBeInTheDocument();
  });

  it("explains a missing case", async () => {
    mockApi({
      ...signedInAs(doctor),
      "GET /api/cases/gone": {
        status: 404,
        body: { detail: "Case not found.", code: "not_found" },
      },
    });
    renderRoute("/cases/gone");

    expect(await screen.findByText("Case not found.")).toBeInTheDocument();
  });
});
