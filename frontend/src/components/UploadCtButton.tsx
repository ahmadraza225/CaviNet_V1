import { useId } from "react";

import { LATER_PHASE } from "../navigation";
import { Button } from "./ui";

/** FR-02.3 "Upload CT" shortcut. Visible now, enabled when scan upload arrives (Phase 4).
 * A disabled button gets no mouse events, so the tooltip sits on a wrapper. */
export function UploadCtButton() {
  const hintId = useId();
  return (
    <span title={LATER_PHASE} className="inline-block cursor-not-allowed">
      <Button disabled aria-describedby={hintId} className="pointer-events-none">
        Upload CT
      </Button>
      <span id={hintId} className="sr-only">
        {LATER_PHASE}
      </span>
    </span>
  );
}
