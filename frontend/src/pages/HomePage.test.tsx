import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DISCLAIMER } from "../navigation";
import { doctor, mockApi, signedInAs } from "../test/api";
import { renderRoute } from "../test/render";

describe("Home page", () => {
  it("greets the signed-in user and shows the disclaimer and system status", async () => {
    mockApi(signedInAs(doctor));
    renderRoute("/");

    expect(await screen.findByRole("heading", { name: "Welcome, Dan Doctor" })).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(await screen.findByText("All systems operational")).toBeInTheDocument();
  });

  it("requests the health endpoint through the /api proxy", async () => {
    const api = mockApi(signedInAs(doctor));
    renderRoute("/");

    await screen.findByText("All systems operational");
    expect(api.callsTo("GET", "/api/health")).toHaveLength(1);
  });
});
