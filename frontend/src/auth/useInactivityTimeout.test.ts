import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { INACTIVITY_LIMIT_MS } from "./context";
import { useInactivityTimeout } from "./useInactivityTimeout";

describe("useInactivityTimeout (FR-01.5)", () => {
  it("uses a 30-minute limit", () => {
    expect(INACTIVITY_LIMIT_MS).toBe(30 * 60 * 1000);
  });

  it("fires after 30 minutes without activity", () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout(true, INACTIVITY_LIMIT_MS, onTimeout));

    vi.advanceTimersByTime(INACTIVITY_LIMIT_MS - 1000);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("restarts the countdown on user activity", () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout(true, INACTIVITY_LIMIT_MS, onTimeout));

    vi.advanceTimersByTime(20 * 60 * 1000);
    window.dispatchEvent(new Event("keydown"));
    vi.advanceTimersByTime(20 * 60 * 1000);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it("does nothing while signed out", () => {
    vi.useFakeTimers();
    const onTimeout = vi.fn();
    renderHook(() => useInactivityTimeout(false, INACTIVITY_LIMIT_MS, onTimeout));
    vi.advanceTimersByTime(2 * INACTIVITY_LIMIT_MS);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
