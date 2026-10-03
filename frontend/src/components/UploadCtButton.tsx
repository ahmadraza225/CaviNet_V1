import { Link } from "react-router-dom";

/** FR-02.3 "Upload CT" shortcut. With a patient it opens their upload page; without one
 * (the dashboard) the upload page first asks which patient (NFR-5: two clicks to upload). */
export function UploadCtButton({ patientId }: { patientId?: string }) {
  return (
    <Link
      to={patientId ? `/patients/${patientId}/upload` : "/upload"}
      className="inline-block rounded-md bg-brand-700 px-3 py-2 text-sm font-medium text-white hover:bg-brand-800"
    >
      Upload CT
    </Link>
  );
}
