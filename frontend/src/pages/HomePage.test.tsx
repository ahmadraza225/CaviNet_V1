import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DISCLAIMER } from "../navigation";
import { admin, mockApi, signedInAs } from "../test/api";
import { renderRoute } from "../test/render";

describe("Home page (administrators)", () => {
  it("greets the admin and shows the disclaimer and system status", async () => {
    mockApi(signedInAs(admin));
    renderRoute("/");

    expect(await screen.findByRole("heading", { name: "Welcome, Ada Admin" })).toBeInTheDocument();
    expect(screen.getByText(/no\s+access to patient records/)).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(await screen.findByText("All systems operational")).toBeInTheDocument();
  });

  it("requests the health endpoint through the /api proxy and never the dashboard", async () => {
    const api = mockApi(signedInAs(admin));
    renderRoute("/");

    await screen.findByText("All systems operational");
    expect(api.callsTo("GET", "/api/health")).toHaveLength(1);
    expect(api.calls.some((call) => call.path.startsWith("/api/dashboard"))).toBe(false);
  });
});
