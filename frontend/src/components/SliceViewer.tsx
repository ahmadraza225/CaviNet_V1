import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getPreviewUrl } from "../api/cases";
import { Button } from "./ui";

/** FR-06.4: a slider over the case's lung-window preview slices (head to feet). */
export function SliceViewer({ caseId, count }: { caseId: string; count: number }) {
  const [index, setIndex] = useState(Math.floor(count / 2));
  const image = useQuery({
    queryKey: ["preview", caseId, index],
    queryFn: () => getPreviewUrl(caseId, index),
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  });
  if (count === 0) return <p className="text-sm text-slate-500">No preview slices.</p>;

  const go = (next: number) => setIndex(Math.min(count - 1, Math.max(0, next)));
  return (
    <div className="space-y-3">
      <div className="flex aspect-square w-full max-w-md items-center justify-center overflow-hidden rounded bg-black">
        {image.data ? (
          <img
            src={image.data}
            alt={`Axial CT slice ${index + 1} of ${count}, lung window`}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-sm text-slate-300">
            {image.isError ? "This slice could not be loaded." : "Loading slice…"}
          </span>
        )}
      </div>
      <div className="flex max-w-md items-center gap-3">
        <Button variant="secondary" onClick={() => go(index - 1)} disabled={index === 0}>
          ‹ Up
        </Button>
        <label htmlFor="slice-slider" className="sr-only">
          Slice
        </label>
        <input
          id="slice-slider"
          type="range"
          min={0}
          max={count - 1}
          value={index}
          onChange={(event) => go(Number(event.target.value))}
          className="flex-1"
        />
        <Button variant="secondary" onClick={() => go(index + 1)} disabled={index === count - 1}>
          Down ›
        </Button>
      </div>
      <p className="text-sm text-slate-600" aria-live="polite">
        Slice {index + 1} of {count} (head → feet)
      </p>
    </div>
  );
}
