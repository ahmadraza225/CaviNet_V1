import { describe, expect, it } from "vitest";

import { admin, mockApi, session } from "../test/api";
import { ApiError, apiFetch, refreshSession } from "./client";

describe("apiFetch", () => {
  it("turns FastAPI validation errors into one readable message", async () => {
    mockApi({
      "POST /api/x": {
        status: 422,
        body: { detail: [{ msg: "Value error, Enter a valid email address." }] },
      },
    });
    const error = (await apiFetch("/api/x", { method: "POST", body: {}, auth: false }).catch(
      (caught: unknown) => caught,
    )) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe("Enter a valid email address.");
    expect(error.status).toBe(422);
  });

  it("keeps the error code from the server", async () => {
    mockApi({ "GET /api/x": { status: 409, body: { detail: "Taken.", code: "email_taken" } } });
    await expect(apiFetch("/api/x", { auth: false })).rejects.toMatchObject({
      code: "email_taken",
      message: "Taken.",
    });
  });

  it("shares one refresh request between simultaneous callers", async () => {
    const api = mockApi({ "POST /api/auth/refresh": { body: session(admin) } });
    const [first, second] = await Promise.all([refreshSession(), refreshSession()]);
    expect(first?.user.email).toBe(admin.email);
    expect(second).toEqual(first);
    expect(api.callsTo("POST", "/api/auth/refresh")).toHaveLength(1);
  });
});
