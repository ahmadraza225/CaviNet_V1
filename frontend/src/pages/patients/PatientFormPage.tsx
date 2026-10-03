import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "../../api/client";
import { createPatient, getPatient, updatePatient, type Patient } from "../../api/patients";
import { Alert, Button, SelectField, TextAreaField, TextField } from "../../components/ui";
import {
  EARLIEST_BIRTH_DATE,
  EMPTY_PATIENT_FORM,
  formValuesOf,
  MAX_LENGTH,
  todayIso,
  toPatientInput,
  validatePatientForm,
  type PatientField,
  type PatientFormErrors,
  type PatientFormValues,
} from "./patientForm";

const FIELDS: PatientField[] = ["full_name", "mr_number", "date_of_birth", "sex", "phone", "notes"];

/** Server validation messages by field, so they show next to the field they belong to. */
function serverErrors(error: unknown): { fields: PatientFormErrors; message: string | null } {
  if (!(error instanceof ApiError)) {
    return { fields: {}, message: "Something went wrong. Please try again." };
  }
  if (error.code === "mr_number_taken") {
    return { fields: { mr_number: error.message }, message: null };
  }
  const fields: PatientFormErrors = {};
  for (const field of FIELDS) {
    if (error.fields[field]) fields[field] = error.fields[field];
  }
  return { fields, message: Object.keys(fields).length ? null : error.message };
}

function PatientForm({ patient }: { patient?: Patient }) {
  const editing = Boolean(patient);
  const [values, setValues] = useState<PatientFormValues>(
    patient ? formValuesOf(patient) : EMPTY_PATIENT_FORM,
  );
  const [errors, setErrors] = useState<PatientFormErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const save = useMutation({
    mutationFn: (input: ReturnType<typeof toPatientInput>) =>
      patient ? updatePatient(patient.id, input) : createPatient(input),
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      queryClient.invalidateQueries({ queryKey: ["patient", saved.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate(`/patients/${saved.id}`, {
        state: { notice: editing ? "Changes saved." : "Patient added." },
      });
    },
    onError: (caught) => {
      const found = serverErrors(caught);
      setErrors(found.fields);
      setMessage(found.message ?? "Please correct the highlighted fields.");
    },
  });

  function set<K extends PatientField>(field: K, value: PatientFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validatePatientForm(values);
    setErrors(found);
    if (Object.keys(found).length) {
      setMessage("Please correct the highlighted fields.");
      return;
    }
    setMessage(null);
    save.mutate(toPatientInput(values));
  }

  const title = editing ? "Edit patient" : "Add patient";
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={title}
      className="space-y-5 rounded-lg bg-white p-6 shadow-sm"
    >
      <h1 className="text-2xl font-bold text-brand-700">{title}</h1>
      {message && <Alert tone="error">{message}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          label="Full name"
          id="patient-full-name"
          required
          maxLength={MAX_LENGTH.full_name}
          autoComplete="off"
          value={values.full_name}
          error={errors.full_name}
          onChange={(event) => set("full_name", event.target.value)}
        />
        <TextField
          label="MR number"
          id="patient-mr-number"
          required
          maxLength={MAX_LENGTH.mr_number}
          autoComplete="off"
          hint="Hospital medical record number. Must be unique."
          value={values.mr_number}
          error={errors.mr_number}
          onChange={(event) => set("mr_number", event.target.value)}
        />
        <TextField
          label="Date of birth"
          id="patient-date-of-birth"
          type="date"
          required
          min={EARLIEST_BIRTH_DATE}
          max={todayIso()}
          value={values.date_of_birth}
          error={errors.date_of_birth}
          onChange={(event) => set("date_of_birth", event.target.value)}
        />
        <SelectField
          label="Sex"
          id="patient-sex"
          required
          value={values.sex}
          error={errors.sex}
          onChange={(event) => set("sex", event.target.value as PatientFormValues["sex"])}
        >
          <option value="">Select…</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </SelectField>
        <TextField
          label="Phone (optional)"
          id="patient-phone"
          type="tel"
          maxLength={MAX_LENGTH.phone}
          autoComplete="off"
          value={values.phone}
          error={errors.phone}
          onChange={(event) => set("phone", event.target.value)}
        />
        <div className="md:col-span-2">
          <TextAreaField
            label="Notes (optional)"
            id="patient-notes"
            rows={4}
            maxLength={MAX_LENGTH.notes}
            value={values.notes}
            error={errors.notes}
            onChange={(event) => set("notes", event.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : editing ? "Save changes" : "Add patient"}
        </Button>
        <Link
          to={patient ? `/patients/${patient.id}` : "/patients"}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

/** Create (/patients/new) or edit (/patients/:patientId/edit) a patient (FR-03.1, FR-03.2). */
export function PatientFormPage() {
  const { patientId } = useParams();
  const existing = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => getPatient(patientId!),
    enabled: Boolean(patientId),
  });

  if (!patientId) return <PatientForm />;
  if (existing.isError) {
    return <Alert tone="error">{(existing.error as Error).message}</Alert>;
  }
  if (!existing.data) return <p className="text-sm text-slate-500">Loading patient…</p>;
  return <PatientForm patient={existing.data} />;
}
