import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { routes } from "../routes";
import { ErrorPage } from "./ErrorPage";

function Broken(): never {
  throw new Error("render failed");
}

describe("Error page", () => {
  it("replaces a page that fails with a plain explanation and a way back", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const router = createMemoryRouter(
      [{ path: "/", element: <Broken />, errorElement: <ErrorPage /> }],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong");
    expect(alert).toHaveTextContent("Your data is safe: nothing was changed.");
    expect(screen.getByRole("button", { name: "Reload the page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the start page" })).toHaveAttribute("href", "/");
    expect(screen.queryByText("render failed")).toBeNull(); // no technical detail on screen
    quiet.mockRestore();
  });

  it("is the error page of every route", () => {
    for (const route of routes) {
      expect(route.errorElement).toBeTruthy();
    }
  });
});
