import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { demoModel, doctor, mockApi, png, signedInAs } from "../test/api";
import { aiCompletedCase, aiResult } from "../test/cases";
import { renderRoute } from "../test/render";

const LABEL = "Regions that most influenced the prediction. This is not a lesion marker.";
const heatmap = {
  label: LABEL,
  target: "TB" as const,
  count: 48,
  top: [30, 12, 31],
  lung_share: 0.91,
};

function stubObjectUrls() {
  let next = 0;
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn(() => `blob:image-${next++}`),
    configurable: true,
    writable: true,
  });
}

function setup(result = aiResult({ heatmap })) {
  const images: Record<string, typeof png> = {};
  for (let index = 0; index < 48; index++) {
    images[`GET /api/cases/c-1/previews/${index}`] = png;
    images[`GET /api/cases/c-1/heatmaps/${index}`] = png;
  }
  return mockApi({
    ...signedInAs(doctor),
    "GET /api/model/status": { body: demoModel },
    "GET /api/cases/c-1": { body: aiCompletedCase() },
    "GET /api/cases/c-1/result": { body: result },
    ...images,
  });
}

async function viewer() {
  return screen.findByRole("region", { name: "AI result" });
}

describe("Heatmap in the slice viewer (FR-11.2, FR-11.3)", () => {
  beforeEach(() => {
    stubObjectUrls();
  });

  it("shows the required label and loads the overlay only when it is switched on", async () => {
    const api = setup();
    renderRoute("/cases/c-1");
    const card = await viewer();
    expect(await within(card).findByText(LABEL)).toBeInTheDocument();
    const toggle = within(card).getByRole("checkbox", { name: "Show heatmap (result TB)" });
    expect(toggle).not.toBeChecked();
    expect(within(card).queryByRole("img", { name: /Heatmap over slice/ })).not.toBeInTheDocument();
    expect(api.callsTo("GET", "/api/cases/c-1/heatmaps/24")).toHaveLength(0);

    fireEvent.click(toggle);
    expect(
      await within(card).findByRole("img", { name: "Heatmap over slice 25" }),
    ).toBeInTheDocument();
    expect(api.callsTo("GET", "/api/cases/c-1/heatmaps/24")).toHaveLength(1);

    fireEvent.click(within(card).getByRole("button", { name: "Down ›" }));
    expect(
      await within(card).findByRole("img", { name: "Heatmap over slice 26" }),
    ).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(within(card).queryByRole("img", { name: /Heatmap over slice/ })).not.toBeInTheDocument();
  });

  it("jumps to the 3 top slices and marks them", async () => {
    setup();
    renderRoute("/cases/c-1");
    const card = await viewer();
    const group = await within(card).findByRole("group", { name: "Top heatmap slices" });
    const buttons = within(group).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "1. Slice 31",
      "2. Slice 13",
      "3. Slice 32",
    ]);
    expect(within(card).queryByText(/Top heatmap slice \d/)).not.toBeInTheDocument();

    fireEvent.click(within(group).getByRole("button", { name: "2. Slice 13" }));
    expect(await within(card).findByText("Slice 13 of 48 (head → feet)")).toBeInTheDocument();
    expect(within(card).getByText("Top heatmap slice 2")).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "2. Slice 13" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("has no heatmap controls for a case analysed before heatmaps existed", async () => {
    setup(aiResult({ heatmap: null }));
    renderRoute("/cases/c-1");
    const card = await viewer();
    await within(card).findByRole("img", { name: /Axial CT slice 25 of 48/ });
    expect(within(card).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(card).queryByText(LABEL)).not.toBeInTheDocument();
  });
});
