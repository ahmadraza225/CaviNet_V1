import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DISCLAIMER } from "../components/Layout";
import { mockFetchJson, renderRoute } from "../test/render";

const healthy = { status: "ok", version: "0.1.0", database: "ok", redis: "ok" };

describe("Home page", () => {
  it("shows the CaviNet shell, welcome text and disclaimer", async () => {
    vi.stubGlobal("fetch", mockFetchJson(200, healthy));
    renderRoute("/");

    expect(screen.getByRole("link", { name: "CaviNet" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Welcome to CaviNet" })).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(await screen.findByText("All systems operational")).toBeInTheDocument();
  });

  it("requests the health endpoint through the /api proxy", async () => {
    const fetchMock = mockFetchJson(200, healthy);
    vi.stubGlobal("fetch", fetchMock);
    renderRoute("/");

    await screen.findByText("All systems operational");
    expect(fetchMock).toHaveBeenCalledWith("/api/health", expect.anything());
  });
});
