/** Display helpers shared by the patient and dashboard pages. */

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** A calendar date from the API ("1975-04-12") as "12 Apr 1975", whatever the browser's zone. */
export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatDateTime(isoDateTime: string): string {
  return new Date(isoDateTime).toLocaleString();
}

export const SEX_LABELS = { male: "Male", female: "Female" } as const;
