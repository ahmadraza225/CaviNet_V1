import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { doctor, mockApi, signedInAs } from "../../test/api";
import { makePatient } from "../../test/patients";
import { renderRoute } from "../../test/render";

const LABELS = {
  full_name: "Full name",
  mr_number: "MR number",
  date_of_birth: "Date of birth",
  sex: "Sex",
  phone: "Phone (optional)",
  notes: "Notes (optional)",
} as const;

type Values = Partial<Record<keyof typeof LABELS, string>>;

function fill(values: Values) {
  for (const [field, value] of Object.entries(values)) {
    fireEvent.change(screen.getByLabelText(LABELS[field as keyof typeof LABELS]), {
      target: { value },
    });
  }
}

const VALID: Values = {
  full_name: "  Amina   Bibi ",
  mr_number: " mr-1001 ",
  date_of_birth: "1975-04-12",
  sex: "female",
  phone: "  ",
  notes: "Referred from OPD.",
};

function errorFor(label: string) {
  const field = screen.getByLabelText(label);
  expect(field).toHaveAttribute("aria-invalid", "true");
  return field;
}

describe("Add patient form (FR-03.1)", () => {
  it("checks required fields before sending anything", async () => {
    const api = mockApi(signedInAs(doctor));
    renderRoute("/patients/new");
    await screen.findByRole("heading", { name: "Add patient" });

    fireEvent.click(screen.getByRole("button", { name: "Add patient" }));

    expect(await screen.findByText("Please correct the highlighted fields.")).toBeInTheDocument();
    expect(errorFor("Full name")).toHaveAccessibleDescription("Full name is required.");
    expect(errorFor("MR number")).toHaveAccessibleDescription(
      "Hospital medical record number. Must be unique. MR number is required.",
    );
    expect(errorFor("Date of birth")).toHaveAccessibleDescription("Date of birth is required.");
    expect(errorFor("Sex")).toHaveAccessibleDescription("Select the patient's sex.");
    expect(screen.getByLabelText("Phone (optional)")).not.toHaveAttribute("aria-invalid");
    expect(api.callsTo("POST", "/api/patients")).toHaveLength(0);
  });

  it.each([
    [{ full_name: "12345" }, "Full name", "Full name must contain letters."],
    [
      { mr_number: "MR 10#" },
      "MR number",
      "MR number may contain only letters, digits, '-' and '/'.",
    ],
    [{ date_of_birth: "2999-01-01" }, "Date of birth", "Date of birth cannot be in the future."],
    [
      { date_of_birth: "1899-12-31" },
      "Date of birth",
      "Date of birth must be on or after 1900-01-01.",
    ],
    [
      { phone: "call me" },
      "Phone (optional)",
      "Enter a valid phone number (digits, spaces, +, - and brackets).",
    ],
  ])("rejects %o", async (values, label, message) => {
    const api = mockApi(signedInAs(doctor));
    renderRoute("/patients/new");
    await screen.findByRole("heading", { name: "Add patient" });

    fill({ ...VALID, ...values });
    fireEvent.click(screen.getByRole("button", { name: "Add patient" }));

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(errorFor(label)).toBeInTheDocument();
    expect(api.callsTo("POST", "/api/patients")).toHaveLength(0);
  });

  it("clears a field's message as soon as it is corrected", async () => {
    mockApi(signedInAs(doctor));
    renderRoute("/patients/new");
    await screen.findByRole("heading", { name: "Add patient" });
    fireEvent.click(screen.getByRole("button", { name: "Add patient" }));
    await screen.findByText("Full name is required.");

    fill({ full_name: "Amina" });

    expect(screen.queryByText("Full name is required.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).not.toHaveAttribute("aria-invalid");
  });

  it("creates the patient with tidied values and opens their page", async () => {
    const created = makePatient();
    const api = mockApi({
      ...signedInAs(doctor),
      "POST /api/patients": { status: 201, body: created },
      "GET /api/patients/p-1": { body: created },
    });
    const { router } = renderRoute("/patients/new");
    await screen.findByRole("heading", { name: "Add patient" });

    fill(VALID);
    fireEvent.click(screen.getByRole("button", { name: "Add patient" }));

    expect(await screen.findByText("Patient added.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/patients/p-1");
    expect(api.callsTo("POST", "/api/patients")[0].body).toEqual({
      full_name: "Amina Bibi",
      mr_number: "MR-1001",
      date_of_birth: "1975-04-12",
      sex: "female",
      phone: null,
      notes: "Referred from OPD.",
    });
  });

  it("shows a duplicate MR number next to the MR number field", async () => {
    mockApi({
      ...signedInAs(doctor),
      "POST /api/patients": {
        status: 409,
        body: { detail: "A patient with this MR number already exists.", code: "mr_number_taken" },
      },
    });
    renderRoute("/patients/new");
    await screen.findByRole("heading", { name: "Add patient" });

    fill(VALID);
    fireEvent.click(screen.getByRole("button", { name: "Add patient" }));

    expect(
      await screen.findByText("A patient with this MR number already exists."),
    ).toBeInTheDocument();
    expect(errorFor("MR number")).toHaveAccessibleDescription(
      /A patient with this MR number already exists\./,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Please correct the highlighted fields.");
  });

  it("shows the server's validation messages next to their fields", async () => {
    mockApi({
      ...signedInAs(doctor),
      "POST /api/patients": {
        status: 422,
        body: {
          detail: [
            {
              loc: ["body", "date_of_birth"],
              msg: "Value error, Date of birth cannot be in the future.",
            },
          ],
        },
      },
    });
    renderRoute("/patients/new");
    await screen.findByRole("heading", { name: "Add patient" });

    fill(VALID);
    fireEvent.click(screen.getByRole("button", { name: "Add patient" }));

    await waitFor(() =>
      expect(errorFor("Date of birth")).toHaveAccessibleDescription(
        "Date of birth cannot be in the future.",
      ),
    );
  });

  it("shows other server errors at the top of the form", async () => {
    mockApi({
      ...signedInAs(doctor),
      "POST /api/patients": { status: 500, body: { detail: "Database unavailable." } },
    });
    renderRoute("/patients/new");
    await screen.findByRole("heading", { name: "Add patient" });

    fill(VALID);
    fireEvent.click(screen.getByRole("button", { name: "Add patient" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable.");
  });

  it("goes back to the list on Cancel", async () => {
    mockApi(signedInAs(doctor));
    renderRoute("/patients/new");

    expect(await screen.findByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/patients",
    );
  });
});

describe("Edit patient form (FR-03.2)", () => {
  it("starts from the saved values and saves the changes", async () => {
    const patient = makePatient();
    const api = mockApi({
      ...signedInAs(doctor),
      "GET /api/patients/p-1": { body: patient },
      "PATCH /api/patients/p-1": { body: { ...patient, full_name: "Amina Khan", phone: null } },
    });
    const { router } = renderRoute("/patients/p-1/edit");
    const form = await screen.findByRole("form", { name: "Edit patient" });

    expect(within(form).getByLabelText("Full name")).toHaveValue("Amina Bibi");
    expect(within(form).getByLabelText("MR number")).toHaveValue("MR-1001");
    expect(within(form).getByLabelText("Date of birth")).toHaveValue("1975-04-12");
    expect(within(form).getByLabelText("Sex")).toHaveValue("female");
    expect(within(form).getByLabelText("Phone (optional)")).toHaveValue("+92 300 1234567");

    expect(within(form).getByRole("link", { name: "Cancel" })).toHaveAttribute(
      "href",
      "/patients/p-1",
    );

    fill({ full_name: "Amina Khan", phone: "" });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Changes saved.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/patients/p-1");
    expect(api.callsTo("PATCH", "/api/patients/p-1")[0].body).toMatchObject({
      full_name: "Amina Khan",
      phone: null,
      mr_number: "MR-1001",
    });
  });

  it("explains when the patient no longer exists", async () => {
    mockApi({
      ...signedInAs(doctor),
      "GET /api/patients/gone": {
        status: 404,
        body: { detail: "Patient not found.", code: "not_found" },
      },
    });
    renderRoute("/patients/gone/edit");

    expect(await screen.findByText("Patient not found.")).toBeInTheDocument();
  });
});
