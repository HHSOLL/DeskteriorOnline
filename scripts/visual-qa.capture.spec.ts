import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";

const projectId = process.env.QA_PROJECT_ID;
const liveToken = process.env.QA_LIVE_TOKEN;
const expiredToken = process.env.QA_EXPIRED_TOKEN;
const loginEmail = process.env.QA_LOGIN_EMAIL;
const loginPassword = process.env.QA_LOGIN_PASSWORD;
const outputDir = process.env.QA_OUTPUT_DIR ?? "docs/evidence/visual-qa/2026-04-11";
const qaBaseUrl = process.env.QA_BASE_URL ?? "http://127.0.0.1:3100";

if (!projectId || !liveToken || !expiredToken || !loginEmail || !loginPassword) {
  throw new Error("Missing QA_* env vars for visual QA capture.");
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function capture(page: any, fileName: string) {
  await page.screenshot({
    path: path.join(outputDir, fileName),
    fullPage: true,
    timeout: 120_000
  });
}

async function hasVisibleText(page: any, text: string) {
  return page
    .getByText(text, { exact: false })
    .first()
    .isVisible()
    .catch(() => false);
}

async function waitForAnyVisibleText(page: any, texts: string[], timeout = 35_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    for (const text of texts) {
      if (await hasVisibleText(page, text)) {
        return true;
      }
    }
    await page.waitForTimeout(250);
  }
  return false;
}

async function waitForLoadingOverlayToClear(page: any, timeout = 12_000) {
  const overlay = page.locator('[role="status"][aria-busy="true"]');
  const count = await overlay.count();
  if (count === 0) return;
  try {
    await overlay.first().waitFor({ state: "hidden", timeout });
  } catch {
    throw new Error("[visual-qa] Global loading overlay did not clear in time.");
  }
}

async function gotoAndHydrate(page: any, url: string, readyTexts: string[], surfaceName: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
    const hydrated = await waitForAnyVisibleText(page, readyTexts, 40_000);
    if (hydrated) {
      await waitForLoadingOverlayToClear(page, 12_000);
      await page.waitForTimeout(2500);
      return;
    }
    await page.waitForTimeout(1200);
  }
  throw new Error(`[visual-qa] ${surfaceName} failed to hydrate before capture.`);
}

function resolveWalkToggleButton(page: any) {
  const topViewButton = page.getByRole("button", { name: "Top View" }).first();
  return topViewButton.locator("xpath=..").getByRole("button", { name: "Walk" }).first();
}

test.describe.configure({ mode: "serial" });

test("capture full visual QA pack", async ({ page, baseURL }) => {
  test.setTimeout(420_000);
  ensureDir(outputDir);
  const targetBaseUrl = baseURL ?? qaBaseUrl;
  const fallbackNotes: string[] = [];

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.addInitScript(() => {
    (
      window as Window & {
        __DESKTERIORONLINE_DISABLE_LOADING_OVERLAY__?: boolean;
      }
    ).__DESKTERIORONLINE_DISABLE_LOADING_OVERLAY__ = true;
  });

  await gotoAndHydrate(
    page,
    `${targetBaseUrl}/studio/create`,
    ["Choose room shape", "Guided room builder", "Template quick start"],
    "studio create"
  );
  await capture(page, "01-studio-create.png");

  await gotoAndHydrate(
    page,
    `${targetBaseUrl}/studio/builder`,
    ["Choose room shape", "Guided room builder", "Builder summary"],
    "studio builder step 1"
  );
  await capture(page, "02-builder-step1.png");

  await page.getByRole("button", { name: "3" }).first().click();
  await page.waitForTimeout(900);
  await capture(page, "03-builder-step3-openings.png");

  await page.getByRole("button", { name: "4" }).first().click();
  await page.waitForTimeout(900);
  await capture(page, "04-builder-step4-style.png");

  await page.goto(`${targetBaseUrl}/login`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  const emailBox = page.getByRole("textbox", { name: "Email" });
  const passwordBox = page.getByRole("textbox", { name: "Password" });
  const signInButton = page.getByRole("button", { name: /sign in/i });
  await expect(emailBox).toBeVisible({ timeout: 20_000 });
  await expect(passwordBox).toBeVisible({ timeout: 20_000 });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await emailBox.fill(loginEmail);
    await passwordBox.fill(loginPassword);
    if (await signInButton.isEnabled()) break;
    await page.waitForTimeout(500);
  }
  await expect(signInButton).toBeEnabled({ timeout: 20_000 });
  await signInButton.click();
  await page.waitForTimeout(1800);

  await gotoAndHydrate(page, `${targetBaseUrl}/project/${projectId}`, ["Share", "Preview", "Top"], "project editor");
  await capture(page, "05-editor-top-view.png");

  const editorWalkButton = resolveWalkToggleButton(page);
  if (await editorWalkButton.isEnabled()) {
    await editorWalkButton.dispatchEvent("click");
    const enteredWalk = await waitForAnyVisibleText(
      page,
      ["Preview mode active.", "Immersive preview", "Read-only preview"],
      5000
    );
    if (!enteredWalk) {
      fallbackNotes.push("06-editor-immersive-view.png captured before preview mode latch completed.");
    }
    await page.waitForTimeout(1300);
  } else {
    fallbackNotes.push("06-editor-immersive-view.png captured with Preview disabled (scale/layout gate).");
  }
  await capture(page, "06-editor-immersive-view.png");

  const shareButton = page.getByRole("button", { name: "Share" }).first();
  await expect(shareButton).toBeVisible({ timeout: 20_000 });
  let shareModalOpened = false;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await shareButton.click();
    shareModalOpened = await waitForAnyVisibleText(page, ["Share Project", "Create Snapshot Link"], 8_000);
    if (shareModalOpened) break;
    await page.waitForTimeout(600);
  }
  if (!shareModalOpened) {
    throw new Error("[visual-qa] Share modal did not open in editor.");
  }
  await page.waitForTimeout(800);
  await capture(page, "07-editor-share-modal.png");
  await page.keyboard.press("Escape");

  await gotoAndHydrate(
    page,
    `${targetBaseUrl}/shared/${liveToken}`,
    ["Shared scene", "Version", "products"],
    "shared viewer (live)"
  );
  await capture(page, "08-shared-top-view.png");

  const sharedWalkButton = resolveWalkToggleButton(page);
  if (await sharedWalkButton.isEnabled()) {
    await sharedWalkButton.dispatchEvent("click");
    const enteredWalk = await waitForAnyVisibleText(page, ["Immersive preview", "Read-only preview"], 5000);
    if (!enteredWalk) {
      fallbackNotes.push("09-shared-immersive-hotspots.png captured while shared preview remained in top view.");
    }
    await page.waitForTimeout(1300);
  } else {
    fallbackNotes.push("09-shared-immersive-hotspots.png captured with Preview disabled (scale/layout gate).");
  }
  await capture(page, "09-shared-immersive-hotspots.png");

  await gotoAndHydrate(
    page,
    `${targetBaseUrl}/community`,
    ["Community", "Public rooms", "Design motifs"],
    "community"
  );
  await capture(page, "10-community.png");

  await gotoAndHydrate(page, `${targetBaseUrl}/gallery`, ["Gallery", "Published rooms"], "gallery");
  await capture(page, "11-gallery.png");

  await gotoAndHydrate(
    page,
    `${targetBaseUrl}/shared/${expiredToken}`,
    ["Link expired", "no longer available"],
    "shared viewer (expired)"
  );
  await capture(page, "12-shared-expired.png");

  await expect(page).toHaveURL(new RegExp(`/shared/${expiredToken}$`));

  fs.writeFileSync(
    path.join(outputDir, "manifest.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        baseURL: targetBaseUrl,
        projectId,
        liveToken,
        expiredToken,
        captures: [
          "01-studio-create.png",
          "02-builder-step1.png",
          "03-builder-step3-openings.png",
          "04-builder-step4-style.png",
          "05-editor-top-view.png",
          "06-editor-immersive-view.png",
          "07-editor-share-modal.png",
          "08-shared-top-view.png",
          "09-shared-immersive-hotspots.png",
          "10-community.png",
          "11-gallery.png",
          "12-shared-expired.png"
        ],
        fallbackNotes
      },
      null,
      2
    ),
    "utf8"
  );
});
