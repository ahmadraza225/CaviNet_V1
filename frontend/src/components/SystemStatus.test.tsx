import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { doctor, mockApi, signedInAs } from "../test/api";
import { renderRoute } from "../test/render";

function statusOf(label: string) {
  const row = screen.getByText(label).closest("li");
  if (!row) throw new Error(`No status row for ${label}`);
  return within(row);
}

describe("System status card", () => {
  it("shows every component working when healthy", async () => {
    mockApi(signedInAs(doctor));
    renderRoute("/");

    expect(await screen.findByText("All systems operational")).toBeInTheDocument();
    expect(statusOf("Database").getByText("Working")).toBeInTheDocument();
    expect(statusOf("Job queue").getByText("Working")).toBeInTheDocument();
    expect(screen.getByText("Version 0.4.0")).toBeInTheDocument();
  });

  it("shows which component failed when the API reports degraded (HTTP 503)", async () => {
    mockApi({
      ...signedInAs(doctor),
      "GET /api/health": {
        status: 503,
        body: { status: "degraded", version: "0.4.0", database: "error", redis: "ok" },
      },
    });
    renderRoute("/");

    expect(await screen.findByText("Some services are not working")).toBeInTheDocument();
    expect(statusOf("Database").getByText("Not responding")).toBeInTheDocument();
    expect(statusOf("Job queue").getByText("Working")).toBeInTheDocument();
  });

  it("explains when the server cannot be reached", async () => {
    mockApi({ ...signedInAs(doctor), "GET /api/health": { status: 502, body: {} } });
    renderRoute("/");

    expect(await screen.findByText(/cannot be reached/)).toBeInTheDocument();
  });
});
