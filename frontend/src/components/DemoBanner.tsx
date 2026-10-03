import { useQuery } from "@tanstack/react-query";

import { getModelStatus } from "../api/model";
import { DEMO_BANNER } from "../navigation";

const MODEL_STATUS_KEY = ["model", "status"];

/** FR-05.6 / NFR-9: on every screen while the installed model is the demo model. Also says
 * when no model is installed (scans cannot be analysed then). */
export function DemoBanner() {
  const status = useQuery({
    queryKey: MODEL_STATUS_KEY,
    queryFn: getModelStatus,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  if (!status.data) return null;
  if (!status.data.installed) {
    return (
      <div role="status" className="bg-amber-100 text-amber-950">
        <p className="mx-auto max-w-6xl px-6 py-2 text-sm">
          <strong>No AI model is installed.</strong> Scans cannot be analysed until an administrator
          runs <code>make fetch-model</code>.
        </p>
      </div>
    );
  }
  if (!status.data.is_demo) return null;
  return (
    <div role="status" aria-label="Demo model" className="bg-red-700 text-white">
      <p className="mx-auto max-w-6xl px-6 py-2 text-sm">
        <strong className="tracking-wide">{DEMO_BANNER}</strong>
        <span className="ml-2 opacity-90">
          Results come from a demo model trained on synthetic data. They say nothing about a real
          patient.
        </span>
      </p>
    </div>
  );
}
