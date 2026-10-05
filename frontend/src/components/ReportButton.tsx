import { useMutation } from "@tanstack/react-query";

import { downloadReport } from "../api/cases";
import { saveFile } from "../api/client";
import { Alert, Button } from "./ui";

/** FR-07.1: one-click PDF report for a completed case. */
export function ReportButton({ caseId }: { caseId: string }) {
  const download = useMutation({
    mutationFn: () => downloadReport(caseId),
    onSuccess: saveFile,
  });
  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={() => download.mutate()} disabled={download.isPending}>
        {download.isPending ? "Preparing the report…" : "Download PDF report"}
      </Button>
      {download.isError && (
        <Alert tone="error">
          The report could not be downloaded: {(download.error as Error).message}
        </Alert>
      )}
    </div>
  );
}
