import { describe, expect, it } from "vitest";

import { admin, mockApi, png, session } from "../test/api";
import { ApiError, apiFetch, apiFetchBlob, refreshSession, setAccessToken } from "./client";

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

describe("apiFetchBlob", () => {
  it("sends the access token and returns the image bytes", async () => {
    const api = mockApi({ "GET /api/cases/c-1/previews/3": png });
    setAccessToken("token-1");
    const blob = await apiFetchBlob("/api/cases/c-1/previews/3");
    expect(blob.type).toBe("image/png");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(png.binary.bytes);
    const [call] = api.callsTo("GET", "/api/cases/c-1/previews/3");
    expect(call.headers.get("Authorization")).toBe("Bearer token-1");
    expect(call.headers.get("Accept")).toBe("*/*");
  });

  it("renews an expired session once, then retries", async () => {
    let calls = 0;
    const api = mockApi({
      "GET /api/x.png": () =>
        ++calls === 1 ? { status: 401, body: { detail: "Expired", code: "token_expired" } } : png,
      "POST /api/auth/refresh": { body: session(admin) },
    });
    setAccessToken("old-token");
    const blob = await apiFetchBlob("/api/x.png");
    expect(blob.size).toBe(8);
    expect(api.callsTo("GET", "/api/x.png")[1].headers.get("Authorization")).toBe(
      `Bearer token-${admin.id}`,
    );
  });

  it("throws the server's message for a missing image", async () => {
    mockApi({ "GET /api/x.png": { status: 404, body: { detail: "Preview not found." } } });
    await expect(apiFetchBlob("/api/x.png")).rejects.toMatchObject({
      status: 404,
      message: "Preview not found.",
    });
  });
});
