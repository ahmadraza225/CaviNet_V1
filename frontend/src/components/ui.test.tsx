import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Loading } from "./ui";

describe("Loading", () => {
  it("is announced to screen readers as a status message", () => {
    render(<Loading className="p-6">Loading patients…</Loading>);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Loading patients…");
    expect(status).toHaveClass("p-6");
  });
});
