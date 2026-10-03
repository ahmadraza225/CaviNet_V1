import { afterEach, describe, expect, it, vi } from "vitest";

import { makePatient } from "../../test/patients";
import {
  EMPTY_PATIENT_FORM,
  formValuesOf,
  todayIso,
  toPatientInput,
  validatePatientForm,
  type PatientFormValues,
} from "./patientForm";

const valid: PatientFormValues = {
  full_name: "Amina Bibi",
  mr_number: "MR-1001",
  date_of_birth: "1975-04-12",
  sex: "female",
  phone: "",
  notes: "",
};

describe("patient form rules (mirror the server, FR-03.1)", () => {
  afterEach(() => vi.useRealTimers());

  it("accepts a valid patient", () => {
    expect(validatePatientForm(valid)).toEqual({});
  });

  it("requires name, MR number, date of birth and sex", () => {
    expect(validatePatientForm(EMPTY_PATIENT_FORM)).toEqual({
      full_name: "Full name is required.",
      mr_number: "MR number is required.",
      date_of_birth: "Date of birth is required.",
      sex: "Select the patient's sex.",
    });
  });

  it.each([
    [{ full_name: "   " }, "full_name", "Full name is required."],
    [{ full_name: "A".repeat(121) }, "full_name", "Full name must be at most 120 characters."],
    [{ full_name: "Zoë Ñúñez" }, "full_name", undefined],
    [{ mr_number: "mr-10/a" }, "mr_number", undefined],
    [{ mr_number: "-10" }, "mr_number", "MR number may contain only letters, digits, '-' and '/'."],
    [{ mr_number: "M".repeat(33) }, "mr_number", "MR number must be at most 32 characters."],
    [{ phone: "+92 (51) 123-4567" }, "phone", undefined],
    [{ phone: "12" }, "phone", "Enter a valid phone number (digits, spaces, +, - and brackets)."],
    [{ notes: "x".repeat(2001) }, "notes", "Notes must be at most 2000 characters."],
  ])("%o → %s: %s", (change, field, message) => {
    const errors = validatePatientForm({ ...valid, ...change });
    expect(errors[field as keyof PatientFormValues]).toBe(message);
  });

  it("uses today's UTC date as the latest date of birth", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-03T23:30:00Z"));
    expect(todayIso()).toBe("2026-10-03");
    expect(validatePatientForm({ ...valid, date_of_birth: "2026-10-03" })).toEqual({});
    expect(validatePatientForm({ ...valid, date_of_birth: "2026-10-04" }).date_of_birth).toBe(
      "Date of birth cannot be in the future.",
    );
  });

  it("tidies values for the request", () => {
    expect(
      toPatientInput({
        ...valid,
        full_name: "  Amina   Bibi ",
        mr_number: " mr-1001 ",
        phone: " ",
        notes: " Seen. ",
      }),
    ).toEqual({
      full_name: "Amina Bibi",
      mr_number: "MR-1001",
      date_of_birth: "1975-04-12",
      sex: "female",
      phone: null,
      notes: "Seen.",
    });
  });

  it("fills the form from a saved patient", () => {
    expect(formValuesOf(makePatient({ phone: null, notes: null }))).toEqual({
      ...valid,
      phone: "",
      notes: "",
    });
  });
});
