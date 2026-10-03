/** Patient form values and the FR-03.1 rules, mirroring backend/app/schemas/patients.py so
 * most mistakes are caught before the request is sent. The server checks again. */
import type { Patient, PatientInput, Sex } from "../../api/patients";

export interface PatientFormValues {
  full_name: string;
  mr_number: string;
  date_of_birth: string;
  sex: Sex | "";
  phone: string;
  notes: string;
}

export type PatientField = keyof PatientFormValues;
export type PatientFormErrors = Partial<Record<PatientField, string>>;

export const EMPTY_PATIENT_FORM: PatientFormValues = {
  full_name: "",
  mr_number: "",
  date_of_birth: "",
  sex: "",
  phone: "",
  notes: "",
};

export const MAX_LENGTH = { full_name: 120, mr_number: 32, phone: 32, notes: 2000 } as const;
export const EARLIEST_BIRTH_DATE = "1900-01-01";

const MR_PATTERN = /^[A-Z0-9][A-Z0-9/-]*$/;
const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{5,30}$/;
const LETTER = /\p{L}/u;

export const normalizeMrNumber = (value: string) => value.trim().toUpperCase();
const collapseSpaces = (value: string) => value.split(/\s+/).filter(Boolean).join(" ");

/** Today's date as the server sees it (UTC), as YYYY-MM-DD. */
export const todayIso = () => new Date().toISOString().slice(0, 10);

export function validatePatientForm(values: PatientFormValues): PatientFormErrors {
  const errors: PatientFormErrors = {};

  const name = collapseSpaces(values.full_name);
  if (!name) errors.full_name = "Full name is required.";
  else if (!LETTER.test(name)) errors.full_name = "Full name must contain letters.";
  else if (name.length > MAX_LENGTH.full_name)
    errors.full_name = `Full name must be at most ${MAX_LENGTH.full_name} characters.`;

  const mr = normalizeMrNumber(values.mr_number);
  if (!mr) errors.mr_number = "MR number is required.";
  else if (mr.length > MAX_LENGTH.mr_number)
    errors.mr_number = `MR number must be at most ${MAX_LENGTH.mr_number} characters.`;
  else if (!MR_PATTERN.test(mr))
    errors.mr_number = "MR number may contain only letters, digits, '-' and '/'.";

  if (!values.date_of_birth) errors.date_of_birth = "Date of birth is required.";
  else if (values.date_of_birth > todayIso())
    errors.date_of_birth = "Date of birth cannot be in the future.";
  else if (values.date_of_birth < EARLIEST_BIRTH_DATE)
    errors.date_of_birth = "Date of birth must be on or after 1900-01-01.";

  if (!values.sex) errors.sex = "Select the patient's sex.";

  const phone = values.phone.trim();
  if (phone && (phone.length > MAX_LENGTH.phone || !PHONE_PATTERN.test(phone)))
    errors.phone = "Enter a valid phone number (digits, spaces, +, - and brackets).";

  if (values.notes.trim().length > MAX_LENGTH.notes)
    errors.notes = `Notes must be at most ${MAX_LENGTH.notes} characters.`;

  return errors;
}

/** Tidied request body. Call only after validatePatientForm returned no errors. */
export function toPatientInput(values: PatientFormValues): PatientInput {
  return {
    full_name: collapseSpaces(values.full_name),
    mr_number: normalizeMrNumber(values.mr_number),
    date_of_birth: values.date_of_birth,
    sex: values.sex as Sex,
    phone: values.phone.trim() || null,
    notes: values.notes.trim() || null,
  };
}

export function formValuesOf(patient: Patient): PatientFormValues {
  return {
    full_name: patient.full_name,
    mr_number: patient.mr_number,
    date_of_birth: patient.date_of_birth,
    sex: patient.sex,
    phone: patient.phone ?? "",
    notes: patient.notes ?? "",
  };
}
