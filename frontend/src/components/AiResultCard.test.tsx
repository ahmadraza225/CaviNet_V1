import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_BANNER, DISCLAIMER } from "../navigation";
import { demoModel, doctor, mockApi, png, signedInAs } from "../test/api";
import { aiCompletedCase, aiResult } from "../test/cases";
import { renderRoute } from "../test/render";

function stubObjectUrls() {
  let next = 0;
  const create = vi.fn(() => `blob:preview-${next++}`);
  Object.defineProperty(URL, "createObjectURL", {
    value: create,
    configurable: true,
    writable: true,
  });
  return create;
}

function setup(result = aiResult(), isDemo = true) {
  const previews: Record<string, typeof png> = {};
  for (let index = 0; index < result.preview_count; index++) {
    previews[`GET /api/cases/c-1/previews/${index}`] = png;
  }
  return mockApi({
    ...signedInAs(doctor),
    "GET /api/model/status": { body: demoModel },
    "GET /api/cases/c-1": { body: aiCompletedCase(isDemo) },
    "GET /api/cases/c-1/result": { body: result },
    ...previews,
  });
}

async function resultCard() {
  return screen.findByRole("region", { name: "AI result" });
}

describe("AI result on the case page (FR-06.1 to FR-06.4)", () => {
  beforeEach(() => {
    stubObjectUrls();
  });

  it("shows the class, probability, confidence band and explanation", async () => {
    setup();
    renderRoute("/cases/c-1");

    const card = await resultCard();
    expect(await within(card).findByText("Predicted class")).toBeInTheDocument();
    expect(within(card).getByText("TB", { selector: "p" })).toBeInTheDocument();
    expect(within(card).getByRole("meter", { name: "Probability of TB" })).toHaveAttribute(
      "aria-valuenow",
      "91.3",
    );
    expect(within(card).getAllByText(/91\.3%/).length).toBeGreaterThanOrEqual(2);
    expect(within(card).getByText("High")).toBeInTheDocument();
    expect(
      within(card).getByText(
        "The scan pattern is more consistent with TB (confidence: High, 91.3%). Confirm with laboratory testing.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the exact disclaimer (FR-06.1)", async () => {
    setup();
    renderRoute("/cases/c-1");

    const card = await resultCard();
    expect(await within(card).findByText(DISCLAIMER)).toBeInTheDocument();
    expect(DISCLAIMER).toBe(
      "Decision support only. Not a diagnosis. Confirm with laboratory tests.",
    );
  });

  it("shows the validated performance and the model (FR-06.3)", async () => {
    setup();
    renderRoute("/cases/c-1");

    const card = await resultCard();
    const performance = (await within(card).findByText("Validated performance")).parentElement!;
    expect(within(performance).getByText("Test AUC").nextSibling).toHaveTextContent("1.00");
    expect(within(performance).getByText("Sensitivity").nextSibling).toHaveTextContent("100.0%");
    expect(within(performance).getByText("Specificity").nextSibling).toHaveTextContent("90.0%");
    expect(within(performance).getByText(/Measured on 20 test cases/)).toBeInTheDocument();
    expect(within(card).getByText("CaviNet demo model (synthetic data)")).toBeInTheDocument();
    expect(within(card).getByText("demo-0.5.0")).toBeInTheDocument();
    expect(within(card).getByText("74.6 s")).toBeInTheDocument();
  });

  it("shows the DEMO banner on the result while the model is the demo (FR-05.6)", async () => {
    setup();
    renderRoute("/cases/c-1");

    const card = await resultCard();
    const banner = await within(card).findByRole("alert");
    expect(banner).toHaveTextContent(DEMO_BANNER);
    expect(banner).toHaveTextContent("trained on synthetic data");
  });

  it("has no DEMO banner for a result from a trained model", async () => {
    setup(
      aiResult({
        is_demo: false,
        demo_banner: null,
        model: {
          name: "CaviNet ResNet-18 ensemble",
          version: "1.0.0",
          trained_at: "2026-12-01T10:00:00Z",
          folds: 5,
          is_demo: false,
        },
      }),
      false,
    );
    renderRoute("/cases/c-1");

    const card = await resultCard();
    await within(card).findByText("CaviNet ResNet-18 ensemble");
    expect(within(card).queryByText(DEMO_BANNER)).not.toBeInTheDocument();
  });

  it("says Inconclusive for a low-confidence result (FR-05.5)", async () => {
    setup(
      aiResult({
        predicted_class: "NTM",
        probability_tb: 0.42,
        probability_tb_pct: 42,
        confidence_pct: 58,
        band: "Low",
        inconclusive: true,
        explanation:
          "Inconclusive: the model is not confident (it leans towards NTM with 58.0% confidence). Confirm with laboratory testing.",
      }),
    );
    renderRoute("/cases/c-1");

    const card = await resultCard();
    expect(await within(card).findByText("Inconclusive")).toBeInTheDocument();
    expect(within(card).getByText("Leans towards NTM")).toBeInTheDocument();
    expect(within(card).getByText("Low")).toBeInTheDocument();
    expect(within(card).getByText(/^Inconclusive: the model is not confident/)).toBeInTheDocument();
  });

  it("lists warnings such as the fallback crop (FR-05.4)", async () => {
    setup(
      aiResult({
        warnings: [
          "Fallback crop: the lung segmentation found no lungs, so the scan was cropped to the body outline.",
        ],
      }),
    );
    renderRoute("/cases/c-1");

    const card = await resultCard();
    expect(await within(card).findByText(/^Fallback crop:/)).toBeInTheDocument();
  });

  it("explains when the result cannot be loaded", async () => {
    mockApi({
      ...signedInAs(doctor),
      "GET /api/cases/c-1": { body: aiCompletedCase() },
      "GET /api/cases/c-1/result": {
        status: 404,
        body: { detail: "This case has no AI result yet.", code: "no_result" },
      },
    });
    renderRoute("/cases/c-1");

    const card = await resultCard();
    expect(await within(card).findByText("This case has no AI result yet.")).toBeInTheDocument();
  });

  it("asks for the result once per visit (one audited view, FR-09.2)", async () => {
    const api = setup();
    renderRoute("/cases/c-1");

    await within(await resultCard()).findByText(DISCLAIMER);
    expect(api.callsTo("GET", "/api/cases/c-1/result")).toHaveLength(1);
  });
});

describe("Slice viewer (FR-06.4)", () => {
  it("starts in the middle and moves with the buttons and the slider", async () => {
    const create = stubObjectUrls();
    const api = setup();
    renderRoute("/cases/c-1");

    const card = await resultCard();
    const image = await within(card).findByRole("img", { name: /Axial CT slice 25 of 48/ });
    expect(image).toHaveAttribute("src", "blob:preview-0");
    expect(within(card).getByText("Slice 25 of 48 (head → feet)")).toBeInTheDocument();
    expect(api.callsTo("GET", "/api/cases/c-1/previews/24")).toHaveLength(1);
    expect(api.callsTo("GET", "/api/cases/c-1/previews/24")[0].headers.get("Authorization")).toBe(
      `Bearer token-${doctor.id}`,
    );

    fireEvent.click(within(card).getByRole("button", { name: "Down ›" }));
    expect(await within(card).findByText("Slice 26 of 48 (head → feet)")).toBeInTheDocument();
    expect(await within(card).findByRole("img", { name: /slice 26 of 48/ })).toBeInTheDocument();
    expect(api.callsTo("GET", "/api/cases/c-1/previews/25")).toHaveLength(1);

    fireEvent.change(within(card).getByRole("slider", { name: "Slice" }), {
      target: { value: "0" },
    });
    expect(await within(card).findByText("Slice 1 of 48 (head → feet)")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "‹ Up" })).toBeDisabled();

    fireEvent.change(within(card).getByRole("slider", { name: "Slice" }), {
      target: { value: "47" },
    });
    expect(await within(card).findByText("Slice 48 of 48 (head → feet)")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Down ›" })).toBeDisabled();
    expect(create).toHaveBeenCalled();
  });

  it("says when a slice image cannot be loaded", async () => {
    stubObjectUrls();
    mockApi({
      ...signedInAs(doctor),
      "GET /api/cases/c-1": { body: aiCompletedCase() },
      "GET /api/cases/c-1/result": { body: aiResult() },
    });
    renderRoute("/cases/c-1");

    const card = await resultCard();
    expect(await within(card).findByText("This slice could not be loaded.")).toBeInTheDocument();
  });

  it("handles a result without previews", async () => {
    stubObjectUrls();
    setup(aiResult({ preview_count: 0 }));
    renderRoute("/cases/c-1");

    const card = await resultCard();
    expect(await within(card).findByText("No preview slices.")).toBeInTheDocument();
  });
});
