import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { doctor, mockApi, signedInAs } from "../test/api";
import { renderRoute } from "../test/render";

describe("Unknown routes", () => {
  it("show a not-found page inside the layout", async () => {
    mockApi(signedInAs(doctor));
    renderRoute("/does-not-exist");

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "CaviNet" })).toBeInTheDocument();
  });
});
