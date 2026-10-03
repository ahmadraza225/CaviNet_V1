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

  it("maps validation messages to the request fields they belong to", async () => {
    mockApi({
      "POST /api/x": {
        status: 422,
        body: {
          detail: [
            { loc: ["body", "mr_number"], msg: "Value error, MR number is required." },
            { loc: ["body", "mr_number"], msg: "A second message for the same field." },
            { loc: ["body"], msg: "Value error, Full name cannot be empty." },
            { loc: ["query", "page"], msg: "Input should be greater than or equal to 1" },
          ],
        },
      },
    });
    const error = (await apiFetch("/api/x", { method: "POST", body: {}, auth: false }).catch(
      (caught: unknown) => caught,
    )) as ApiError;
    expect(error.fields).toEqual({ mr_number: "MR number is required." });
    expect(error.message).toContain("Full name cannot be empty.");
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
