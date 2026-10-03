import { describe, expect, it } from "vitest";

import { mockApi } from "../test/api";
import { fetchHealth } from "./health";

describe("fetchHealth", () => {
  it("returns the body of a degraded (503) response instead of throwing", async () => {
    const body = { status: "degraded", version: "0.5.0", database: "ok", redis: "error" };
    mockApi({ "GET /api/health": { status: 503, body } });
    await expect(fetchHealth()).resolves.toEqual(body);
  });

  it("throws on other HTTP errors", async () => {
    mockApi({ "GET /api/health": { status: 502, body: { detail: "bad gateway" } } });
    await expect(fetchHealth()).rejects.toThrow("HTTP 502");
  });
});
