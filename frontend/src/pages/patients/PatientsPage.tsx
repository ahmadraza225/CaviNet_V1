import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";

import {
  listPatients,
  type PatientListParams,
  type PatientSort,
  type SortOrder,
} from "../../api/patients";
import { Alert, Button, Loading } from "../../components/ui";
import { formatDate, formatDateTime, SEX_LABELS } from "../../format";

const SORTS: PatientSort[] = [
  "full_name",
  "mr_number",
  "date_of_birth",
  "created_at",
  "updated_at",
];
const DEFAULT_SORT: PatientSort = "created_at";
const DEFAULT_ORDER: SortOrder = "desc";

/** List state lives in the URL (?q=&sort=&order=&page=) so the dashboard search and the
 * browser's back button land on the same results. */
function readParams(search: URLSearchParams): Required<PatientListParams> {
  const sort = search.get("sort") as PatientSort | null;
  const order = search.get("order");
  const page = Number(search.get("page"));
  return {
    q: search.get("q") ?? "",
    sort: sort && SORTS.includes(sort) ? sort : DEFAULT_SORT,
    order: order === "asc" || order === "desc" ? order : DEFAULT_ORDER,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

function SortHeader({
  label,
  column,
  params,
  onSort,
}: {
  label: string;
  column: PatientSort;
  params: Required<PatientListParams>;
  onSort: (column: PatientSort) => void;
}) {
  const active = params.sort === column;
  const ariaSort = active ? (params.order === "asc" ? "ascending" : "descending") : "none";
  return (
    <th className="px-3 py-2" aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 uppercase hover:text-slate-800"
      >
        {label}
        <span aria-hidden="true">{active ? (params.order === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

/** Patient list (FR-03.3): search by name or MR number, sorting, 20 per page. */
export function PatientsPage() {
  const [search, setSearch] = useSearchParams();
  const params = readParams(search);
  const [text, setText] = useState(params.q);
  const notice = (useLocation().state as { notice?: string } | null)?.notice;

  // Keep the box in step when the URL changes (e.g. a search from the dashboard, or Back).
  useEffect(() => setText(params.q), [params.q]);

  const patients = useQuery({
    queryKey: ["patients", params],
    queryFn: () => listPatients(params),
    placeholderData: keepPreviousData,
  });

  function update(changes: Partial<PatientListParams>) {
    const next = { ...params, ...changes };
    const query = new URLSearchParams();
    if (next.q) query.set("q", next.q);
    if (next.sort !== DEFAULT_SORT || next.order !== DEFAULT_ORDER) {
      query.set("sort", next.sort);
      query.set("order", next.order);
    }
    if (next.page > 1) query.set("page", String(next.page));
    setSearch(query);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    update({ q: text.trim(), page: 1 });
  }

  function sortBy(column: PatientSort) {
    const order: SortOrder =
      params.sort === column
        ? params.order === "asc"
          ? "desc"
          : "asc"
        : column === "created_at" || column === "updated_at"
          ? "desc"
          : "asc";
    update({ sort: column, order, page: 1 });
  }

  const data = patients.data;

  return (
    <div className="space-y-6">
      {notice && <Alert tone="success">{notice}</Alert>}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-brand-700">Patients</h1>
        <Link
          to="/patients/new"
          className="rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          Add patient
        </Link>
      </div>

      <form role="search" onSubmit={submitSearch} className="flex flex-wrap gap-2">
        <label htmlFor="patient-search" className="sr-only">
          Search patients
        </label>
        <input
          id="patient-search"
          type="search"
          placeholder="Search by name or MR number"
          maxLength={120}
          value={text}
          onChange={(event) => setText(event.target.value)}
          className="w-80 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {params.q && (
          <Button
            variant="secondary"
            onClick={() => {
              setText("");
              update({ q: "", page: 1 });
            }}
          >
            Clear search
          </Button>
        )}
      </form>

      {patients.isError && <Alert tone="error">{(patients.error as Error).message}</Alert>}

      <section className="overflow-x-auto rounded-lg bg-white shadow-sm">
        {patients.isPending && <Loading className="p-6">Loading patients…</Loading>}
        {data && data.items.length === 0 && (
          <p className="p-6 text-sm text-slate-500">
            {params.q
              ? `No patients match “${params.q}”.`
              : data.total === 0
                ? "No patients yet. Use Add patient to create the first record."
                : "This page is empty."}
          </p>
        )}
        {data && data.items.length > 0 && (
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <SortHeader label="Name" column="full_name" params={params} onSort={sortBy} />
                <SortHeader label="MR number" column="mr_number" params={params} onSort={sortBy} />
                <SortHeader
                  label="Date of birth"
                  column="date_of_birth"
                  params={params}
                  onSort={sortBy}
                />
                <th className="px-3 py-2 uppercase">Sex</th>
                <SortHeader label="Added" column="created_at" params={params} onSort={sortBy} />
                <SortHeader
                  label="Last updated"
                  column="updated_at"
                  params={params}
                  onSort={sortBy}
                />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((patient) => (
                <tr key={patient.id}>
                  <td className="px-3 py-2">
                    <Link
                      to={`/patients/${patient.id}`}
                      className="font-medium text-brand-700 underline"
                    >
                      {patient.full_name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-mono">{patient.mr_number}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDate(patient.date_of_birth)}{" "}
                    <span className="text-slate-500">({patient.age} y)</span>
                  </td>
                  <td className="px-3 py-2">{SEX_LABELS[patient.sex]}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {formatDateTime(patient.created_at)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">
                    {formatDateTime(patient.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {data && data.total > 0 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
          <span className="text-slate-600">
            Page {params.page} of {data.pages} · {data.total}{" "}
            {data.total === 1 ? "patient" : "patients"}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={params.page <= 1}
              onClick={() => update({ page: params.page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={params.page >= data.pages}
              onClick={() => update({ page: params.page + 1 })}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
