import { describe, expect, it, vi } from "vitest";

import { mockFetchJson } from "../test/render";
import { fetchHealth } from "./health";

describe("fetchHealth", () => {
  it("returns the body of a degraded (503) response instead of throwing", async () => {
    const body = { status: "degraded", version: "0.1.0", database: "ok", redis: "error" };
    vi.stubGlobal("fetch", mockFetchJson(503, body));
    await expect(fetchHealth()).resolves.toEqual(body);
  });

  it("throws on other HTTP errors", async () => {
    vi.stubGlobal("fetch", mockFetchJson(502, { detail: "bad gateway" }));
    await expect(fetchHealth()).rejects.toThrow("HTTP 502");
  });
});
