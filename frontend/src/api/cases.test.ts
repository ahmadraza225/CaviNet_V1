import { describe, expect, it } from "vitest";

import { admin, mockApi, session } from "../test/api";
import { makeCase } from "../test/cases";
import { fakeFile, mockXhr } from "../test/xhr";
import { SERVER_RESTARTING, setAccessToken } from "./client";
import { NETWORK_ERROR, TOO_LARGE, uploadScan } from "./cases";

describe("uploadScan", () => {
  it("renews an expired session once and sends the files again", async () => {
    setAccessToken("old-token");
    mockApi({ "POST /api/auth/refresh": { body: session(admin) } });
    const xhr = mockXhr((request) =>
      request.headers.Authorization === "Bearer old-token"
        ? request.respond(401, { detail: "Expired", code: "not_authenticated" })
        : request.respond(201, makeCase()),
    );

    const detail = await uploadScan("p-1", [fakeFile("a.zip")], () => undefined);

    expect(detail.id).toBe("c-1");
    expect(xhr.sent.map((request) => request.headers.Authorization)).toEqual([
      "Bearer old-token",
      "Bearer token-u-admin",
    ]);
  });

  it("gets a token first when the page has none yet", async () => {
    mockApi({ "POST /api/auth/refresh": { body: session(admin) } });
    const xhr = mockXhr((request) => request.respond(201, makeCase()));
    await uploadScan("p-1", [fakeFile("a.zip")], () => undefined);
    expect(xhr.sent[0].headers.Authorization).toBe("Bearer token-u-admin");
  });

  it("reports progress as a fraction and turns errors into ApiErrors", async () => {
    setAccessToken("t");
    const fractions: number[] = [];
    mockXhr((request) => {
      request.progress(1, 4);
      request.progress(0, 0); // unknown total: ignored
      request.respond(422, { detail: "Upload one .zip file at a time.", code: "several_zips" });
    });
    await expect(
      uploadScan("p-1", [fakeFile("a.zip")], (fraction) => fractions.push(fraction)),
    ).rejects.toMatchObject({ status: 422, code: "several_zips" });
    expect(fractions).toEqual([0.25]);
  });

  it("explains nginx's size refusal (an HTML page) in plain words", async () => {
    setAccessToken("t");
    mockXhr((request) => {
      request.status = 413;
      request.responseText = "<html>413 Request Entity Too Large</html>";
      request.onload?.();
    });
    await expect(uploadScan("p-1", [fakeFile("a.zip")], () => undefined)).rejects.toMatchObject({
      status: 413,
      message: TOO_LARGE,
      code: "upload_too_large",
    });
  });

  it("explains a network failure and survives a non-JSON error page", async () => {
    setAccessToken("t");
    mockXhr((request) => request.failNetwork());
    await expect(uploadScan("p-1", [fakeFile("a.zip")], () => undefined)).rejects.toMatchObject({
      message: NETWORK_ERROR,
    });
    mockXhr((request) => {
      request.status = 502;
      request.responseText = "<html>Bad gateway</html>";
      request.onload?.();
    });
    await expect(uploadScan("p-1", [fakeFile("a.zip")], () => undefined)).rejects.toMatchObject({
      status: 502,
      message: SERVER_RESTARTING,
    });
  });
});
