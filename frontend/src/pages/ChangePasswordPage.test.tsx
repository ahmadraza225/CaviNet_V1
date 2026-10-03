import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { doctor, makeUser, mockApi, session, signedInAs } from "../test/api";
import { renderRoute } from "../test/render";

function fill(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText(/(Current|Temporary) password/), {
    target: { value: current },
  });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
}

describe("Change password page", () => {
  it("checks the password rules and confirmation before calling the server", async () => {
    const api = mockApi(signedInAs(doctor));
    renderRoute("/change-password");
    await screen.findByRole("heading", { name: "Change password" });

    fill("Passw0rd123", "short1", "short1");
    expect(screen.getByRole("alert")).toHaveTextContent("at least 10 characters");

    fill("Passw0rd123", "Another-pass1", "Another-pass2");
    expect(screen.getByRole("alert")).toHaveTextContent("do not match");
    expect(api.callsTo("POST", "/api/auth/change-password")).toHaveLength(0);
  });

  it("completes a forced change and unlocks the app (FR-01.6)", async () => {
    const temporary = makeUser({ must_change_password: true });
    const api = mockApi({
      ...signedInAs(temporary),
      "POST /api/auth/change-password": { body: session(doctor) },
    });
    renderRoute("/");
    expect(await screen.findByRole("heading", { name: "Change password" })).toBeInTheDocument();

    fill("Temp-pass123", "Another-pass1", "Another-pass1");

    expect(await screen.findByText("Your password has been changed.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
    expect(api.callsTo("POST", "/api/auth/change-password")[0].body).toEqual({
      current_password: "Temp-pass123",
      new_password: "Another-pass1",
    });
  });

  it("shows server-side errors", async () => {
    mockApi({
      ...signedInAs(doctor),
      "POST /api/auth/change-password": {
        status: 422,
        body: { detail: "Current password is incorrect.", code: "wrong_current_password" },
      },
    });
    renderRoute("/change-password");
    await screen.findByRole("heading", { name: "Change password" });

    fill("Wrong-pass123", "Another-pass1", "Another-pass1");

    expect(await screen.findByRole("alert")).toHaveTextContent("Current password is incorrect.");
  });
});
