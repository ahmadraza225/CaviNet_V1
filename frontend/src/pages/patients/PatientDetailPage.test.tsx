import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LATER_PHASE } from "../../navigation";
import { doctor, mockApi, signedInAs } from "../../test/api";
import { makePatient, patientPage } from "../../test/patients";
import { renderRoute } from "../../test/render";

const patient = makePatient();

function setup(extra = {}) {
  return mockApi({
    ...signedInAs(doctor),
    "GET /api/patients/p-1": { body: patient },
    "GET /api/patients": { body: patientPage([]) },
    ...extra,
  });
}

async function openDeleteDialog() {
  fireEvent.click(await screen.findByRole("button", { name: "Delete patient" }));
  return screen.getByRole("dialog", { name: "Delete patient permanently?" });
}

describe("Patient detail page (FR-03.2, FR-03.4)", () => {
  it("shows the patient's details", async () => {
    setup();
    renderRoute("/patients/p-1");

    expect(await screen.findByRole("heading", { name: "Amina Bibi" })).toBeInTheDocument();
    expect(screen.getByText("MR MR-1001")).toBeInTheDocument();
    expect(screen.getByText("12 Apr 1975 (51 years)")).toBeInTheDocument();
    expect(screen.getByText("Female")).toBeInTheDocument();
    expect(screen.getByText("+92 300 1234567")).toBeInTheDocument();
    expect(screen.getByText("Referred from OPD.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute(
      "href",
      "/patients/p-1/edit",
    );
  });

  it("has an empty Scans section with a disabled Upload CT button", async () => {
    setup();
    renderRoute("/patients/p-1");

    const scans = await screen.findByRole("region", { name: "Scans" });
    expect(
      within(scans).getByText("No scans have been uploaded for this patient."),
    ).toBeInTheDocument();
    const upload = within(scans).getByRole("button", { name: "Upload CT" });
    expect(upload).toBeDisabled();
    expect(upload).toHaveAccessibleDescription(LATER_PHASE);
    expect(upload.closest("[title]")).toHaveAttribute("title", LATER_PHASE);
  });

  it("lists scans with date, status and result once they exist", async () => {
    setup({
      "GET /api/patients/p-1": {
        body: makePatient({
          scans: [
            { id: "s-1", uploaded_at: "2026-10-03T08:00:00Z", status: "completed", result: "NTM" },
          ],
        }),
      },
    });
    renderRoute("/patients/p-1");

    const scans = await screen.findByRole("region", { name: "Scans" });
    expect(await within(scans).findByText("completed")).toBeInTheDocument();
    expect(within(scans).getByText("NTM")).toBeInTheDocument();
  });

  it("explains when the patient does not exist", async () => {
    setup({
      "GET /api/patients/gone": {
        status: 404,
        body: { detail: "Patient not found.", code: "not_found" },
      },
    });
    renderRoute("/patients/gone");

    expect(await screen.findByText("Patient not found.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to patients" })).toHaveAttribute(
      "href",
      "/patients",
    );
  });
});

describe("Deleting a patient (FR-03.2)", () => {
  it("warns that the delete is permanent and needs the MR number typed", async () => {
    const api = setup();
    renderRoute("/patients/p-1");
    const dialog = await openDeleteDialog();

    expect(dialog).toHaveAccessibleDescription(
      "This permanently deletes Amina Bibi and all of their scans, results, files and reports. It cannot be undone.",
    );
    const confirm = within(dialog).getByRole("button", { name: "Delete permanently" });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText(/Type the MR number/), {
      target: { value: "MR-100" },
    });
    expect(confirm).toBeDisabled();
    fireEvent.submit(dialog);
    expect(api.callsTo("DELETE", "/api/patients/p-1")).toHaveLength(0);

    fireEvent.change(within(dialog).getByLabelText(/Type the MR number/), {
      target: { value: " mr-1001 " },
    });
    expect(confirm).toBeEnabled();
  });

  it("can be cancelled", async () => {
    const api = setup();
    renderRoute("/patients/p-1");
    const dialog = await openDeleteDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.callsTo("DELETE", "/api/patients/p-1")).toHaveLength(0);
  });

  it("closes on Escape", async () => {
    setup();
    renderRoute("/patients/p-1");
    const dialog = await openDeleteDialog();

    fireEvent.keyDown(within(dialog).getByLabelText(/Type the MR number/), { key: "Escape" });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("deletes after confirmation and returns to the list with a notice", async () => {
    const api = setup({ "DELETE /api/patients/p-1": { status: 204 } });
    const { router } = renderRoute("/patients/p-1");
    const dialog = await openDeleteDialog();

    fireEvent.change(within(dialog).getByLabelText(/Type the MR number/), {
      target: { value: "mr-1001" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete permanently" }));

    expect(
      await screen.findByText("Amina Bibi and all of their records were deleted."),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/patients");
    const call = api.callsTo("DELETE", "/api/patients/p-1")[0];
    expect(call.query.get("confirm")).toBe("MR-1001");
    expect(api.callsTo("GET", "/api/patients")).toHaveLength(1);
  });

  it("shows the server's reason if the delete fails", async () => {
    setup({
      "DELETE /api/patients/p-1": {
        status: 422,
        body: {
          detail: "Type the patient's MR number to confirm the deletion.",
          code: "confirmation_required",
        },
      },
    });
    renderRoute("/patients/p-1");
    const dialog = await openDeleteDialog();

    fireEvent.change(within(dialog).getByLabelText(/Type the MR number/), {
      target: { value: "MR-1001" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete permanently" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Type the patient's MR number to confirm the deletion.",
    );
  });
});
