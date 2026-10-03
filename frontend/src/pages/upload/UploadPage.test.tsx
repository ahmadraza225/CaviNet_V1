import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { doctor, mockApi, signedInAs } from "../../test/api";
import { makeCase, rejectedCase } from "../../test/cases";
import { makePatient, patientPage } from "../../test/patients";
import { renderRoute } from "../../test/render";
import { fakeFile, mockXhr, type FakeXhr } from "../../test/xhr";

const patient = makePatient();

function setup(extra = {}) {
  return mockApi({
    ...signedInAs(doctor),
    "GET /api/patients/p-1": { body: patient },
    "GET /api/cases/c-1": { body: makeCase() },
    ...extra,
  });
}

function choose(...files: File[]) {
  fireEvent.change(screen.getByLabelText("CT scan files"), { target: { files } });
}

async function openUploadPage() {
  const view = renderRoute("/patients/p-1/upload");
  await screen.findByRole("link", { name: "Amina Bibi" });
  return view;
}

describe("Upload page (FR-04.1)", () => {
  it("shows which patient the scan is for", async () => {
    setup();
    mockXhr();
    await openUploadPage();

    expect(screen.getByRole("heading", { name: "Upload CT scan" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Patient" })).toHaveTextContent(
      "MR MR-1001 · born 12 Apr 1975 · Female",
    );
    expect(screen.getByRole("button", { name: "Upload scan" })).toBeDisabled();
  });

  it("uploads a .zip with a progress bar and opens the case", async () => {
    setup();
    const xhr = mockXhr();
    const { router } = await openUploadPage();

    choose(fakeFile("chest.zip", 25 * 1024 ** 2));
    expect(screen.getByText("Selected: 1 .zip file (25.0 MB)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload scan" }));

    await waitFor(() => expect(xhr.sent).toHaveLength(1));
    const request = xhr.sent[0];
    expect(request.method).toBe("POST");
    expect(request.url).toBe("/api/patients/p-1/cases");
    expect(request.headers.Authorization).toBe("Bearer token-u-doctor");
    expect(request.files().map((file) => file.name)).toEqual(["chest.zip"]);

    act(() => request.progress(10, 40));
    const bar = screen.getByRole("progressbar", { name: "Upload progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("Uploading… 25%")).toBeInTheDocument();
    act(() => request.progress(40, 40));
    expect(
      screen.getByText("Upload complete. Checking and de-identifying the scan…"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Uploading…" })).toBeDisabled();

    act(() => request.respond(201, makeCase()));
    expect(
      await screen.findByText("Upload complete. The scan is queued for analysis."),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/cases/c-1");
  });

  it("uploads several .dcm files in one request", async () => {
    setup();
    const xhr = mockXhr((request) => request.respond(201, makeCase()));
    await openUploadPage();

    choose(fakeFile("IM1.dcm", 512 * 1024), fakeFile("IM2.dcm", 512 * 1024));
    expect(screen.getByText("Selected: 2 files (1.0 MB)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upload scan" }));

    await screen.findByText("Upload complete. The scan is queued for analysis.");
    expect(xhr.sent[0].files().map((file) => file.name)).toEqual(["IM1.dcm", "IM2.dcm"]);
  });

  it("accepts files dropped on the page", async () => {
    setup();
    mockXhr();
    await openUploadPage();

    fireEvent.drop(screen.getByTestId("drop-zone"), {
      dataTransfer: { files: [fakeFile("scan.zip", 2048)] },
    });

    expect(screen.getByText("Selected: 1 .zip file (2 KB)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload scan" })).toBeEnabled();
  });

  it.each([
    [
      [fakeFile("a.zip"), fakeFile("b.dcm")],
      "Upload either one .zip file or the scan's .dcm files, not both.",
    ],
    [[fakeFile("a.zip"), fakeFile("b.zip")], "Upload one .zip file at a time."],
    [
      [fakeFile("huge.zip", 1537 * 1024 ** 2)],
      "The upload is larger than the 1.5 GB limit. Upload only the chest CT series, or compress it as a .zip.",
    ],
  ])("refuses a wrong selection before uploading (%#)", async (files, message) => {
    setup();
    const xhr = mockXhr();
    await openUploadPage();

    choose(...files);
    expect(screen.getByRole("alert")).toHaveTextContent(message);
    fireEvent.submit(screen.getByRole("form", { name: "Upload CT scan" }));
    expect(xhr.sent).toHaveLength(0);
  });

  it("explains why a scan was not accepted (FR-04.2) and links to the failed case", async () => {
    setup();
    mockXhr((request) => request.respond(201, rejectedCase()));
    const { router } = await openUploadPage();

    choose(fakeFile("short.zip"));
    fireEvent.click(screen.getByRole("button", { name: "Upload scan" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The scan was not accepted.");
    expect(alert).toHaveTextContent("The scan has 30 slices; at least 50 are needed.");
    expect(within(alert).getByRole("link", { name: "View the failed case" })).toHaveAttribute(
      "href",
      "/cases/c-9",
    );
    expect(router.state.location.pathname).toBe("/patients/p-1/upload");
    expect(screen.getByRole("button", { name: "Upload scan" })).toBeEnabled();
  });

  it("shows the server's message when the request is refused", async () => {
    setup();
    mockXhr((request) =>
      request.respond(413, {
        detail: "The upload is larger than the 1.5 GB limit.",
        code: "upload_too_large",
      }),
    );
    await openUploadPage();

    choose(fakeFile("scan.zip"));
    fireEvent.click(screen.getByRole("button", { name: "Upload scan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The upload is larger than the 1.5 GB limit.",
    );
  });

  it("explains a lost connection", async () => {
    setup();
    mockXhr((request) => request.failNetwork());
    await openUploadPage();

    choose(fakeFile("scan.zip"));
    fireEvent.click(screen.getByRole("button", { name: "Upload scan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The upload failed because the connection was lost.",
    );
  });

  it("can cancel an upload in progress", async () => {
    setup();
    const xhr = mockXhr();
    await openUploadPage();

    choose(fakeFile("scan.zip"));
    fireEvent.click(screen.getByRole("button", { name: "Upload scan" }));
    await waitFor(() => expect(xhr.sent).toHaveLength(1));
    act(() => xhr.sent[0].progress(1, 10));
    fireEvent.click(screen.getByRole("button", { name: "Cancel upload" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Upload cancelled.");
    expect((xhr.sent[0] as FakeXhr).aborted).toBe(true);
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});

describe("Upload from the dashboard: choose the patient first (NFR-5)", () => {
  it("searches and selects a patient, then shows that patient's upload form", async () => {
    const api = setup({
      "GET /api/patients": (call: { query: URLSearchParams }) => ({
        body: patientPage(call.query.get("q") === "amina" ? [patient] : []),
      }),
    });
    mockXhr();
    const { router } = renderRoute("/upload");

    expect(await screen.findByRole("heading", { name: "Choose the patient" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search patients" }), {
      target: { value: "amina" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    fireEvent.click(await screen.findByRole("link", { name: "Upload a scan for Amina Bibi" }));

    expect(await screen.findByLabelText("CT scan files")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/patients/p-1/upload");
    expect(api.callsTo("GET", "/api/patients").at(-1)!.query.get("q")).toBe("amina");
  });

  it("offers to add a patient when none match", async () => {
    setup({ "GET /api/patients": { body: patientPage([]) } });
    renderRoute("/upload");

    expect(await screen.findByText(/No patients yet\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add a patient" })).toHaveAttribute(
      "href",
      "/patients/new",
    );
  });
});
