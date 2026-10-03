import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"];

/**
 * Calls `onTimeout` once after `timeoutMs` with no user interaction (FR-01.5).
 * Background requests (e.g. status polling) do not count as activity.
 */
export function useInactivityTimeout(enabled: boolean, timeoutMs: number, onTimeout: () => void) {
  const callback = useRef(onTimeout);
  callback.current = onTimeout;

  useEffect(() => {
    if (!enabled) return;
    let timer = window.setTimeout(() => callback.current(), timeoutMs);
    let lastReset = Date.now();

    const reset = () => {
      const now = Date.now();
      if (now - lastReset < 1000) return; // at most one reset per second
      lastReset = now;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => callback.current(), timeoutMs);
    };

    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, reset));
    };
  }, [enabled, timeoutMs]);
}
