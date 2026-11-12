import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { getHeatmapUrl, getPreviewUrl, type HeatmapInfo } from "../api/cases";
import { Button } from "./ui";

/**
 * FR-06.4: a slider over the case's lung-window preview slices (head to feet).
 * FR-11.2/11.3: when the case has a heatmap, a toggle lays it over the slice, the 3 slices with
 * the largest heatmap share can be jumped to, and the required label is shown.
 */
export function SliceViewer({
  caseId,
  count,
  heatmap = null,
}: {
  caseId: string;
  count: number;
  heatmap?: HeatmapInfo | null;
}) {
  const [index, setIndex] = useState(Math.floor(count / 2));
  const [showHeatmap, setShowHeatmap] = useState(false);
  const image = useQuery({
    queryKey: ["preview", caseId, index],
    queryFn: () => getPreviewUrl(caseId, index),
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  });
  const overlay = useQuery({
    queryKey: ["heatmap", caseId, index],
    queryFn: () => getHeatmapUrl(caseId, index),
    enabled: showHeatmap && heatmap !== null,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
  });
  if (count === 0) return <p className="text-sm text-slate-500">No preview slices.</p>;

  const go = (next: number) => setIndex(Math.min(count - 1, Math.max(0, next)));
  const rank = heatmap ? heatmap.top.indexOf(index) : -1;
  return (
    <div className="space-y-3">
      <div className="relative flex aspect-square w-full max-w-md items-center justify-center overflow-hidden rounded bg-black">
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
        {showHeatmap && overlay.data && image.data && (
          <img
            src={overlay.data}
            alt={`Heatmap over slice ${index + 1}`}
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          />
        )}
        {rank >= 0 && (
          <span className="absolute left-2 top-2 rounded bg-amber-400 px-2 py-0.5 text-xs font-semibold text-slate-900">
            Top heatmap slice {rank + 1}
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
      {heatmap && (
        <div className="max-w-md space-y-2 rounded border border-slate-200 p-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              checked={showHeatmap}
              onChange={(event) => setShowHeatmap(event.target.checked)}
            />
            Show heatmap (result {heatmap.target})
          </label>
          <p className="text-sm text-slate-600">{heatmap.label}</p>
          {heatmap.top.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-2"
              role="group"
              aria-label="Top heatmap slices"
            >
              <span className="text-xs text-slate-500">Top slices:</span>
              {heatmap.top.map((slice, number) => (
                <Button
                  key={slice}
                  variant="secondary"
                  aria-pressed={slice === index}
                  onClick={() => go(slice)}
                >
                  {number + 1}. Slice {slice + 1}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
