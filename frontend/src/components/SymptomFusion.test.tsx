import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { doctor, mockApi, png, realModel, signedInAs } from "../test/api";
import { aiCompletedCase, aiResult, makeCase } from "../test/cases";
import { makePatient } from "../test/patients";
import { renderRoute } from "../test/render";
import { fakeFile, mockXhr } from "../test/xhr";

const combined = {
  predicted_class: "NTM" as const,
  probability_tb_pct: 38.2,
  confidence_pct: 61.8,
  band: "Low" as const,
  inconclusive: true,
  explanation:
    "Inconclusive: the model is not confident (it leans towards NTM with 61.8% confidence). Confirm with laboratory testing.",
  age: 51,
  sex: "female",
  symptoms: ["Cough", "Night sweats"],
  fusion_version: "model-v1-fusion",
  is_demo: false,
};

function stubObjectUrls() {
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn(() => "blob:preview"),
    configurable: true,
    writable: true,
  });
}

function setupResult(overrides: Parameters<typeof aiResult>[0]) {
  const result = aiResult(overrides);
  const previews: Record<string, typeof png> = {};
  for (let index = 0; index < result.preview_count; index++) {
    previews[`GET /api/cases/c-1/previews/${index}`] = png;
  }
  return mockApi({
    ...signedInAs(doctor),
    "GET /api/cases/c-1": { body: aiCompletedCase(false) },
    "GET /api/cases/c-1/result": { body: result },
    ...previews,
  });
}

describe("Symptom-assisted result on the case page (FR-12.3)", () => {
  beforeEach(stubObjectUrls);

  it("shows the CT-only result and the combined result with its inputs", async () => {
    setupResult({ symptoms: ["Cough", "Night sweats"], combined });
    renderRoute("/cases/c-1");

    const card = await screen.findByRole("region", { name: "AI result" });
    expect(await within(card).findByRole("heading", { name: "CT only" })).toBeInTheDocument();
    const panel = within(card).getByRole("region", { name: "CT + age, sex and symptoms" });
    expect(within(panel).getByText("Inconclusive")).toBeInTheDocument();
    expect(within(panel).getByText("Leans towards NTM")).toBeInTheDocument();
    expect(within(panel).getByText("38.2%")).toBeInTheDocument();
    expect(within(panel).getByText("Low")).toBeInTheDocument();
    expect(within(panel).getByText(combined.explanation)).toBeInTheDocument();
    expect(panel).toHaveTextContent(
      "Combined with age (51 years), female and the symptoms entered at upload: Cough, Night sweats. Symptom-assisted model model-v1-fusion.",
    );
    // The CT-only result is still shown in full.
    expect(within(card).getByRole("meter", { name: "Probability of TB" })).toBeInTheDocument();
  });

  it("shows only the CT result when no symptoms were entered", async () => {
    setupResult({});
    renderRoute("/cases/c-1");

    const card = await screen.findByRole("region", { name: "AI result" });
    await within(card).findByText("Predicted class");
    expect(within(card).queryByRole("heading", { name: "CT only" })).not.toBeInTheDocument();
    expect(
      within(card).queryByRole("region", { name: "CT + age, sex and symptoms" }),
    ).not.toBeInTheDocument();
  });

  it("explains why there is no combined result when symptoms were entered", async () => {
    const note =
      "Symptoms were entered, but no symptom-assisted model is installed for this AI model, so only the CT result is shown.";
    setupResult({ symptoms: ["Cough"], combined: null, combined_note: note });
    renderRoute("/cases/c-1");

    const card = await screen.findByRole("region", { name: "AI result" });
    expect(await within(card).findByText(note)).toBeInTheDocument();
    expect(
      within(card).queryByRole("region", { name: "CT + age, sex and symptoms" }),
    ).not.toBeInTheDocument();
  });
});

describe("Symptoms at upload (FR-12.1)", () => {
  function setupUpload(symptomAssisted: boolean) {
    mockApi({
      ...signedInAs(doctor),
      "GET /api/model/status": { body: { ...realModel, symptom_assisted: symptomAssisted } },
      "GET /api/patients/p-1": { body: makePatient() },
      "GET /api/cases/c-1": { body: makeCase() },
    });
  }

  async function openAndChoose() {
    renderRoute("/patients/p-1/upload");
    await screen.findByRole("link", { name: "Amina Bibi" });
    fireEvent.change(screen.getByLabelText("CT scan files"), {
      target: { files: [fakeFile("chest.zip", 1024)] },
    });
  }

  it("sends the ticked symptoms in the dataset's order", async () => {
    setupUpload(true);
    const xhr = mockXhr();
    await openAndChoose();

    const toggle = await screen.findByRole("checkbox", {
      name: "Add the patient's symptoms for a symptom-assisted result",
    });
    expect(screen.queryByRole("group", { name: "Symptoms present" })).not.toBeInTheDocument();
    fireEvent.click(toggle);
    const group = screen.getByRole("group", { name: "Symptoms present" });
    expect(within(group).getAllByRole("checkbox")).toHaveLength(12);
    fireEvent.click(within(group).getByRole("checkbox", { name: "Night sweats" }));
    fireEvent.click(within(group).getByRole("checkbox", { name: "Cough" }));
    fireEvent.click(within(group).getByRole("checkbox", { name: "Fever" }));
    fireEvent.click(within(group).getByRole("checkbox", { name: "Fever" })); // unticked again
    fireEvent.click(screen.getByRole("button", { name: "Upload scan" }));

    await waitFor(() => expect(xhr.sent).toHaveLength(1));
    expect(xhr.sent[0].body?.get("symptoms")).toBe('["cough","night_sweats"]');
    act(() => xhr.sent[0].respond(201, makeCase()));
    expect(
      await screen.findByText("Upload complete. The scan is queued for analysis."),
    ).toBeInTheDocument();
  });

  it("sends an empty list when the section is on and nothing is ticked", async () => {
    setupUpload(true);
    const xhr = mockXhr();
    await openAndChoose();
    fireEvent.click(
      await screen.findByRole("checkbox", {
        name: "Add the patient's symptoms for a symptom-assisted result",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Upload scan" }));
    await waitFor(() => expect(xhr.sent).toHaveLength(1));
    expect(xhr.sent[0].body?.get("symptoms")).toBe("[]");
    act(() => xhr.sent[0].respond(201, makeCase()));
    expect(
      await screen.findByText("Upload complete. The scan is queued for analysis."),
    ).toBeInTheDocument();
  });

  it("sends no symptoms when the section is left off", async () => {
    setupUpload(true);
    const xhr = mockXhr();
    await openAndChoose();
    await screen.findByRole("checkbox", {
      name: "Add the patient's symptoms for a symptom-assisted result",
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload scan" }));
    await waitFor(() => expect(xhr.sent).toHaveLength(1));
    expect(xhr.sent[0].body?.has("symptoms")).toBe(false);
    act(() => xhr.sent[0].respond(201, makeCase()));
    expect(
      await screen.findByText("Upload complete. The scan is queued for analysis."),
    ).toBeInTheDocument();
  });

  it("hides the section when the model has no symptom-assisted parameters", async () => {
    setupUpload(false);
    mockXhr();
    await openAndChoose();
    await waitFor(() => expect(screen.getByRole("button", { name: "Upload scan" })).toBeEnabled());
    expect(screen.queryByRole("group", { name: "Symptoms (optional)" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", {
        name: "Add the patient's symptoms for a symptom-assisted result",
      }),
    ).not.toBeInTheDocument();
  });
});
