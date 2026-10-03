import { formatBytes, MAX_UPLOAD_BYTES } from "../../caseStatus";

const isZip = (file: File) => file.name.toLowerCase().endsWith(".zip");

/** The same request checks as the server (FR-04.1), so mistakes show before uploading. */
export function selectionProblem(files: File[]): string | null {
  if (files.length === 0) return "Choose a .zip file or the scan's .dcm files to upload.";
  const zips = files.filter(isZip).length;
  if (zips > 0 && zips < files.length) {
    return "Upload either one .zip file or the scan's .dcm files, not both.";
  }
  if (zips > 1) return "Upload one .zip file at a time.";
  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_UPLOAD_BYTES) {
    return `The upload is larger than the ${formatBytes(MAX_UPLOAD_BYTES)} limit. Upload only the chest CT series, or compress it as a .zip.`;
  }
  return null;
}

export function describeSelection(files: File[]): string {
  const total = formatBytes(files.reduce((sum, file) => sum + file.size, 0));
  if (files.length === 1 && isZip(files[0])) return `1 .zip file (${total})`;
  return `${files.length} ${files.length === 1 ? "file" : "files"} (${total})`;
}
