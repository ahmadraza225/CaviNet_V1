import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderRoute } from "../test/render";

describe("Unknown routes", () => {
  it("show a not-found page inside the layout", () => {
    renderRoute("/does-not-exist");

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "CaviNet" })).toBeInTheDocument();
  });
});
