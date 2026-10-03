import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UNREAD_POLL_MS } from "../api/notifications";
import { admin, doctor, makeUser, mockApi, signedInAs } from "../test/api";
import { completedCase } from "../test/cases";
import { renderRoute } from "../test/render";

const items = [
  {
    id: 2,
    kind: "case_failed",
    message: "Scan analysis failed for Amina Bibi (MR-1001). Open the case to see why.",
    case_id: "c-9",
    created_at: "2026-10-03T09:05:00Z",
    read: false,
  },
  {
    id: 1,
    kind: "case_completed",
    message: "Scan analysis completed for Amina Bibi (MR-1001).",
    case_id: "c-1",
    created_at: "2026-10-03T09:00:00Z",
    read: true,
  },
];

function setup(count = 1) {
  let unread = count;
  return mockApi({
    ...signedInAs(doctor),
    "GET /api/notifications/unread-count": () => ({ body: { count: unread } }),
    "GET /api/notifications": { body: { items, total: 2, page: 1, page_size: 20 } },
    "POST /api/notifications/2/read": () => {
      unread = 0;
      return { body: { marked: 1 } };
    },
    "POST /api/notifications/read-all": () => {
      unread = 0;
      return { body: { marked: 1 } };
    },
    "GET /api/cases/c-9": { body: completedCase() },
  });
}

describe("Notification bell (FR-08.2, FR-08.3)", () => {
  afterEach(() => vi.useRealTimers());

  it("shows the unread count", async () => {
    setup(3);
    renderRoute("/");

    expect(
      await screen.findByRole("button", { name: "Notifications (3 unread)" }),
    ).toBeInTheDocument();
  });

  it("checks for new notifications every 10 seconds", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = setup(0);
    renderRoute("/");
    await screen.findByRole("button", { name: "Notifications (0 unread)" });
    await waitFor(() =>
      expect(api.callsTo("GET", "/api/notifications/unread-count")).toHaveLength(1),
    );
    const before = 1;

    await act(() => vi.advanceTimersByTimeAsync(UNREAD_POLL_MS));
    expect(api.callsTo("GET", "/api/notifications/unread-count").length).toBe(before + 1);
    await act(() => vi.advanceTimersByTimeAsync(UNREAD_POLL_MS));
    expect(api.callsTo("GET", "/api/notifications/unread-count").length).toBe(before + 2);
  });

  it("lists notifications and opens the case, marking it read", async () => {
    const api = setup(1);
    const { router } = renderRoute("/");
    fireEvent.click(await screen.findByRole("button", { name: "Notifications (1 unread)" }));

    const panel = screen.getByRole("region", { name: "Notifications" });
    const failed = await within(panel).findByRole("button", { name: /failed for Amina Bibi/ });
    expect(failed).toHaveTextContent("(unread)");
    expect(
      within(panel).getByRole("button", { name: /completed for Amina Bibi/ }),
    ).not.toHaveTextContent("(unread)");

    fireEvent.click(failed);
    await waitFor(() => expect(router.state.location.pathname).toBe("/cases/c-9"));
    expect(api.callsTo("POST", "/api/notifications/2/read")).toHaveLength(1);
    expect(
      await screen.findByRole("button", { name: "Notifications (0 unread)" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("marks all as read", async () => {
    const api = setup(1);
    renderRoute("/");
    fireEvent.click(await screen.findByRole("button", { name: "Notifications (1 unread)" }));
    fireEvent.click(screen.getByRole("button", { name: "Mark all as read" }));

    expect(
      await screen.findByRole("button", { name: "Notifications (0 unread)" }),
    ).toBeInTheDocument();
    expect(api.callsTo("POST", "/api/notifications/read-all")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Mark all as read" })).toBeDisabled();
  });

  it("says when there are no notifications and closes on Escape", async () => {
    mockApi(signedInAs(doctor));
    renderRoute("/");
    fireEvent.click(await screen.findByRole("button", { name: "Notifications (0 unread)" }));

    expect(await screen.findByText("No notifications yet.")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByText("No notifications yet."), { key: "Escape" });
    expect(screen.queryByRole("region", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("caps a large count at 99+", async () => {
    setup(150);
    renderRoute("/");
    const bell = await screen.findByRole("button", { name: "Notifications (150 unread)" });
    expect(bell).toHaveTextContent("99+");
  });

  it("is only shown to doctors who have finished signing in", async () => {
    const api = mockApi(signedInAs(admin));
    renderRoute("/");
    await screen.findByRole("heading", { name: "Welcome, Ada Admin" });
    expect(screen.queryByRole("button", { name: /Notifications/ })).not.toBeInTheDocument();
    expect(api.calls.some((call) => call.path.startsWith("/api/notifications"))).toBe(false);

    const pending = makeUser({ must_change_password: true });
    mockApi(signedInAs(pending));
    renderRoute("/");
    await screen.findAllByRole("heading", { name: "Change password" });
    expect(screen.queryByRole("button", { name: /Notifications/ })).not.toBeInTheDocument();
  });
});
