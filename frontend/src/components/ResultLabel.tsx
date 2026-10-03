import { DEMO_BANNER } from "../navigation";

/** A result in a table (dashboard, patient scans): the class, flagged when it came from the
 * demo model (FR-05.6) or the Phase 4 stub. */
export function ResultLabel({ result, isDemo }: { result: string | null; isDemo: boolean }) {
  if (!result) return <>—</>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-semibold">{result}</span>
      {isDemo && (
        <span
          title={DEMO_BANNER}
          className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-red-800"
        >
          Demo
          <span className="sr-only"> ({DEMO_BANNER})</span>
        </span>
      )}
    </span>
  );
}
