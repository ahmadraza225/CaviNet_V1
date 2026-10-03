import { screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { mockFetchJson, renderRoute } from "../test/render";

function statusOf(label: string) {
  const row = screen.getByText(label).closest("li");
  if (!row) throw new Error(`No status row for ${label}`);
  return within(row);
}

describe("System status card", () => {
  it("shows every component working when healthy", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchJson(200, { status: "ok", version: "0.1.0", database: "ok", redis: "ok" }),
    );
    renderRoute("/");

    expect(await screen.findByText("All systems operational")).toBeInTheDocument();
    expect(statusOf("Database").getByText("Working")).toBeInTheDocument();
    expect(statusOf("Job queue").getByText("Working")).toBeInTheDocument();
    expect(screen.getByText("Version 0.1.0")).toBeInTheDocument();
  });

  it("shows which component failed when the API reports degraded (HTTP 503)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchJson(503, { status: "degraded", version: "0.1.0", database: "error", redis: "ok" }),
    );
    renderRoute("/");

    expect(await screen.findByText("Some services are not working")).toBeInTheDocument();
    expect(statusOf("Database").getByText("Not responding")).toBeInTheDocument();
    expect(statusOf("Job queue").getByText("Working")).toBeInTheDocument();
  });

  it("explains when the server cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    renderRoute("/");

    expect(await screen.findByText(/cannot be reached/)).toBeInTheDocument();
  });
});
