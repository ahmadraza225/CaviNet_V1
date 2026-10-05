/** Settings, screenshots and PDF reading for the end-to-end test. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Page } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "..", "..");

/** KEY=value lines of the repository's .env (created by `make up`). */
function dotEnv(): Record<string, string> {
  const file = path.join(repoRoot, ".env");
  if (!existsSync(file)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

const fromFile = dotEnv();

export function setting(name: string, fallback?: string): string {
  const value = process.env[name] ?? fromFile[name] ?? fallback;
  if (value === undefined || value === "") {
    throw new Error(`${name} is not set (environment or .env).`);
  }
  return value;
}

/** Screenshots for the user manual: docs/images/manual with E2E_SCREENSHOTS=../docs/images/manual. */
const screenshotDir = path.resolve(
  process.env.E2E_SCREENSHOTS ?? path.join(here, "..", "test-results", "screenshots"),
);

export async function snap(page: Page, name: string, options: { fullPage?: boolean } = {}) {
  mkdirSync(screenshotDir, { recursive: true });
  // Let fonts and images finish loading so the picture matches what a person sees. (Never
  // "networkidle": the app polls the server, so the network is never idle.)
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = Array.from(document.images).filter((image) => !image.complete);
    const loaded = images.map(
      (image) =>
        new Promise((done) => {
          image.addEventListener("load", done);
          image.addEventListener("error", done);
        }),
    );
    await Promise.race([Promise.all(loaded), new Promise((done) => setTimeout(done, 5_000))]);
  });
  await page.screenshot({ path: path.join(screenshotDir, `${name}.png`), ...options });
}

export function saveArtifact(name: string, data: Buffer): string {
  mkdirSync(screenshotDir, { recursive: true });
  const file = path.join(screenshotDir, name);
  writeFileSync(file, data);
  return file;
}

/** All text of a PDF, words separated by single spaces. */
export async function pdfText(data: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: new Uint8Array(data), useSystemFonts: true })
    .promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const content = await (await document.getPage(number)).getTextContent();
    pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
  }
  return pages.join(" ").replace(/\s+/g, " ");
}
