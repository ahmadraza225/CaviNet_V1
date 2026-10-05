/**
 * The full journey of scope section 9.2, through the browser, against the running stack:
 * the admin creates a doctor, the doctor changes the temporary password, creates a patient,
 * uploads a synthetic scan, sees the result, downloads the PDF report and reads the
 * notification. Screenshots taken on the way illustrate docs/USER_MANUAL.md.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { pdfText, repoRoot, saveArtifact, setting, snap } from "./support";

const DISCLAIMER = "Decision support only. Not a diagnosis. Confirm with laboratory tests.";
const DEMO_BANNER = "DEMO MODEL: NOT FOR CLINICAL USE";

const run = Date.now().toString().slice(-6);
const adminEmail = setting("ADMIN_EMAIL");
const adminPassword = setting("ADMIN_PASSWORD");
// The first admin must change the password from .env at first sign-in (FR-01.7, FR-01.6).
const adminNewPassword = setting("E2E_ADMIN_NEW_PASSWORD", `${adminPassword}-e2e1`);
const doctor = {
  name: "Dr Sara Khan",
  email: `sara.khan.${run}@hospital.example`,
  temporary: `Welcome-${run}a`,
  own: `Sara-own-${run}b`,
};
const patient = {
  name: "Ayesha Siddiqui",
  mr: `MR-${run}`,
  born: "1975-04-12",
  sex: "female",
  phone: "+92 300 1234567",
};
const scanFile = path.resolve(
  repoRoot,
  setting("E2E_SCAN", path.join("demo-data", "e2e_synthetic_ct.zip")),
);

/** Fail the test on any Content-Security-Policy violation (NFR-2 headers must not break the app). */
function watchForPolicyViolations(page: Page, violations: string[]) {
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy|Refused to/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  page.on("pageerror", (error) => violations.push(`page error: ${error.message}`));
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  const form = page.getByRole("form", { name: "Sign in" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(password);
  await form.getByRole("button", { name: "Sign in" }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("form", { name: "Sign in" })).toBeVisible();
}

async function changePassword(page: Page, current: string, next: string) {
  const form = page.getByRole("form", { name: "Change password" });
  await form.getByLabel(/Temporary password|Current password/).fill(current);
  await form.getByLabel("New password", { exact: true }).fill(next);
  await form.getByLabel("Confirm new password").fill(next);
  await form.getByRole("button", { name: "Change password" }).click();
}

/** The first admin, whether or not an earlier run already replaced the password from .env. */
async function signInAsAdmin(page: Page) {
  await signIn(page, adminEmail, adminPassword);
  const outcome = await Promise.race([
    page.waitForURL(/\/change-password$/).then(() => "change" as const),
    page
      .getByText("Incorrect email or password.")
      .waitFor()
      .then(() => "wrong" as const),
    page
      .getByRole("heading", { name: "Users" })
      .waitFor()
      .then(() => "in" as const),
    page
      .getByRole("link", { name: "Users" })
      .waitFor()
      .then(() => "in" as const),
  ]);
  if (outcome === "change") {
    await changePassword(page, adminPassword, adminNewPassword);
  } else if (outcome === "wrong") {
    await signIn(page, adminEmail, adminNewPassword);
    await expect(
      page.getByRole("link", { name: "Users" }),
      `Cannot sign in as ${adminEmail} with ADMIN_PASSWORD or E2E_ADMIN_NEW_PASSWORD. ` +
        "Set ADMIN_PASSWORD to the admin's current password, or start from a fresh stack.",
    ).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Users" })).toBeVisible();
}

test("doctor's journey: account, patient, upload, result, PDF report, notification", async ({
  page,
}) => {
  expect(
    () => readFileSync(scanFile),
    `Synthetic scan missing: ${scanFile}. Run "make e2e" (it creates it).`,
  ).not.toThrow();
  const violations: string[] = [];
  watchForPolicyViolations(page, violations);

  await test.step("the admin signs in and creates a doctor account (FR-01.7, FR-09.1)", async () => {
    await page.goto("/login");
    await expect(page.getByRole("form", { name: "Sign in" })).toBeVisible();
    await snap(page, "01-sign-in");
    await signInAsAdmin(page);
    await page.getByRole("link", { name: "Users" }).click();
    await page.getByRole("button", { name: "Add user" }).click();
    const form = page.getByRole("form", { name: "Add user" });
    await form.getByLabel("Full name").fill(doctor.name);
    await form.getByLabel("Email").fill(doctor.email);
    await form.getByLabel("Role").selectOption("doctor");
    await form.getByLabel("Temporary password").fill(doctor.temporary);
    await snap(page, "11-admin-add-user");
    await form.getByRole("button", { name: "Create user" }).click();
    await expect(page.getByText(`Created ${doctor.name}.`)).toBeVisible();
    await expect(page.getByRole("cell", { name: doctor.email })).toBeVisible();
    // Section 9.3: no patient data for admins.
    await expect(page.getByRole("link", { name: "Patients" })).toHaveCount(0);
    await signOut(page);
  });

  await test.step("the doctor signs in and must change the temporary password (FR-01.6)", async () => {
    await signIn(page, doctor.email, doctor.temporary);
    await expect(page).toHaveURL(/\/change-password$/);
    await expect(page.getByLabel("Temporary password")).toBeVisible();
    await snap(page, "02-change-password");
    await changePassword(page, doctor.temporary, doctor.own);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Your password has been changed.")).toBeVisible();
    // Section 9.3: no user management for doctors.
    await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);
    await snap(page, "03-dashboard");
  });

  await test.step("the doctor creates the patient (FR-03.1)", async () => {
    await page.getByRole("navigation", { name: "Main navigation" }).getByText("Patients").click();
    await page.getByRole("link", { name: "Add patient" }).click();
    const form = page.getByRole("form", { name: "Add patient" });
    await form.getByLabel("Full name").fill(patient.name);
    await form.getByLabel("MR number").fill(patient.mr);
    await form.getByLabel("Date of birth").fill(patient.born);
    await form.getByLabel("Sex").selectOption(patient.sex);
    await form.getByLabel("Phone (optional)").fill(patient.phone);
    await snap(page, "04-add-patient");
    await form.getByRole("button", { name: "Add patient" }).click();
    await expect(page.getByRole("heading", { name: patient.name })).toBeVisible();
    await snap(page, "05-patient");
  });

  let caseUrl = "";
  await test.step("the doctor uploads the synthetic scan with a progress bar (FR-04.1)", async () => {
    await page.getByRole("link", { name: "Upload CT" }).click();
    await expect(page.getByRole("heading", { name: "Upload CT scan" })).toBeVisible();
    await page.getByLabel("CT scan files").setInputFiles(scanFile);
    await expect(page.getByText(/^Selected:/)).toBeVisible();
    await snap(page, "06-upload");
    await page.getByRole("button", { name: "Upload scan" }).click();
    await page.waitForURL(/\/cases\/[0-9a-f-]{36}$/, { timeout: 120_000 });
    caseUrl = page.url();
    await expect(page.getByRole("list", { name: "Status timeline" })).toBeVisible();
    await snap(page, "07-case-progress");
  });

  await test.step("the case completes and the result is shown (FR-08.1, FR-06.1 to 06.4)", async () => {
    const result = page.getByRole("region", { name: "AI result" });
    await expect(result.getByRole("button", { name: "Download PDF report" })).toBeVisible({
      timeout: 5 * 60_000,
    });
    await expect(result.getByText("Predicted class")).toBeVisible();
    await expect(result.getByText("Probability of TB")).toBeVisible();
    await expect(result.getByRole("meter", { name: "Probability of TB" })).toBeVisible();
    await expect(result.getByText(/Confirm with laboratory testing\.|Inconclusive/)).toBeVisible();
    await expect(result.getByText(DISCLAIMER)).toBeVisible();
    await expect(result.getByText(DEMO_BANNER)).toBeVisible(); // FR-05.6
    await expect(result.getByRole("slider", { name: "Slice" })).toBeVisible();
    // FR-08.1: every status was reached, in order, each with its time.
    const steps = page.getByRole("list", { name: "Status timeline" }).getByRole("listitem");
    const order = ["Uploaded", "Validating", "Queued", "Preprocessing", "Analysing", "Completed"];
    await expect(steps).toHaveCount(order.length);
    for (const [index, label] of order.entries()) {
      await expect(steps.nth(index)).toContainText(label);
      await expect(steps.nth(index)).toHaveAttribute("data-state", "done");
    }
    await snap(page, "08-result", { fullPage: true });
  });

  await test.step("the doctor downloads the PDF report with every FR-07.2 item (FR-07.1)", async () => {
    const result = page.getByRole("region", { name: "AI result" });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      result.getByRole("button", { name: "Download PDF report" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(
      new RegExp(`^CaviNet-report-${patient.mr}-\\d{4}-\\d\\d-\\d\\d\\.pdf$`),
    );
    const data = readFileSync(await download.path());
    expect(data.subarray(0, 5).toString()).toBe("%PDF-");
    saveArtifact("report.pdf", data);
    const text = await pdfText(data);
    const required: Record<string, string | RegExp> = {
      header: "CaviNet",
      "report date": "Report date",
      "patient name": patient.name,
      "MR number": patient.mr,
      age: /Age \d+ years/,
      sex: "Female",
      "scan details": "Scan details",
      "slice count": "Slices 60",
      result: /Result (TB|NTM)|Inconclusive \(leans towards (TB|NTM)\)/,
      probability: /Probability of TB \d+\.\d%/,
      "confidence band": /Confidence \d+\.\d% \((High|Moderate|Low)\)/,
      explanation: /Confidence band: (High|Moderate|Low)\./,
      "representative slices": "Representative slices",
      "model version": /Version demo-/,
      "validated performance": "Test AUC",
      disclaimer: DISCLAIMER,
      "signature line": "Reviewing doctor (name) Signature Date",
      "demo banner": DEMO_BANNER,
    };
    const missing = Object.entries(required)
      .filter(([, expected]) =>
        typeof expected === "string" ? !text.includes(expected) : !expected.test(text),
      )
      .map(([name]) => name);
    expect(missing, `PDF text: ${text}`).toEqual([]);
  });

  await test.step("the completion notification is read (FR-08.2, FR-08.3)", async () => {
    await page.goto("/");
    const bell = page.getByRole("button", { name: "Notifications (1 unread)" });
    await expect(bell).toBeVisible({ timeout: 30_000 }); // the bell checks every 10 s
    await bell.click();
    const panel = page.getByRole("region", { name: "Notifications" });
    await expect(panel.getByText(/completed/i)).toBeVisible();
    await snap(page, "09-notifications");
    await panel.getByRole("button", { name: /completed/i }).click();
    await expect(page).toHaveURL(caseUrl);
    await expect(page.getByRole("button", { name: "Notifications (0 unread)" })).toBeVisible();
    await signOut(page);
  });

  await test.step("the admin sees the report download in the audit log (FR-07.3, FR-09.3)", async () => {
    await signInAsAdmin(page);
    await page.getByRole("link", { name: "Audit log" }).click();
    const filters = page.getByRole("form", { name: "Audit log filters" });
    await filters.getByLabel("Action").selectOption({ label: "Report downloaded" });
    await filters.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("cell", { name: doctor.email }).first()).toBeVisible();
    await snap(page, "12-audit-log");
    await page.getByRole("link", { name: "Model" }).click();
    await expect(page.getByText(DEMO_BANNER).first()).toBeVisible();
    await snap(page, "13-admin-model");
    await signOut(page);
  });

  expect(violations, "Content-Security-Policy violations or page errors").toEqual([]);
});
