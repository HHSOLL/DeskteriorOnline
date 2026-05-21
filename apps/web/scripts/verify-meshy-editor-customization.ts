import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";

type FurnitureRenderSourceEntry = {
  assetId: string;
  assetKey: string;
  catalogItemId: string | null;
  productName: string | null;
  source: "builder-preview-proxy" | "placeholder-fallback" | "model-loading-fallback" | "real-glb" | "real-glb-lod" | "lod-proxy";
  viewMode: string;
  topMode: string;
  usesLodProxy: boolean;
};

type FurnitureGlbLoadEntry = {
  assetId: string;
  assetKey: string;
  catalogItemId: string | null;
  productName: string | null;
  source: "real-glb" | "real-glb-lod";
  status: "loaded";
  meshCount: number;
  materialCount: number;
  bounds: {
    width: number;
    height: number;
    depth: number;
  };
};

type MeshyEditorCustomizationQaEntry = {
  ready: boolean;
  sourceCatalogItemId: string;
  targetCatalogItemId: string;
  sourceSceneAssetId: string | null;
  selectedSceneAssetId: string | null;
  selectedCatalogItemId: string | null;
  replacementCandidateIds: string[];
  hasMeshyReplacementCandidate: boolean;
  replacementApplied: boolean;
  generatedProvider: string | null;
  generatedReviewStatus: string | null;
  saveCaptureCount: number;
  lastSaveAssetCatalogItemId: string | null;
  lastSaveAssetId: string | null;
  savedAssetIdStable: boolean;
  savedProductSourceKind: string | null;
  savedProductSourceUrl: string | null;
};

type CanvasMetrics = {
  width: number;
  height: number;
  cssWidth: number;
  cssHeight: number;
  nonTransparentRatio: number;
  uniqueColorBuckets: number;
  luminanceStdDev: number;
};

declare global {
  interface Window {
    __DESKTERIORONLINE_DISABLE_LOADING_OVERLAY__?: boolean;
    __DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__?: Record<string, FurnitureRenderSourceEntry>;
    __DESKTERIORONLINE_FURNITURE_GLB_LOADS__?: Record<string, FurnitureGlbLoadEntry>;
    __DESKTERIORONLINE_MESHY_EDITOR_CUSTOMIZATION_QA__?: MeshyEditorCustomizationQaEntry;
  }
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..", "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "output", "playwright");
const NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";
const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const SOURCE_CATALOG_ITEM_ID = "p2s_decor_mug_espresso";
const CATALOG_ITEM_ID = "p2s_meshy_pastel_mascot_stack";
const CUSTOMIZATION_ROUTE = "/labs/qa/meshy-editor-customization";
const MESHY_TEXT_TO_3D_DOCS_URL = "https://docs.meshy.ai/en/api/text-to-3d";

function getArg(name: string, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isReachable(baseUrl: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(new URL(CUSTOMIZATION_ROUTE, baseUrl), {
      redirect: "manual",
      signal: controller.signal
    });
    return response.ok || response.status === 302 || response.status === 303;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer(baseUrl: URL, child: ChildProcessWithoutNullStreams, timeoutMs = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) {
      throw new Error(`local dev server exited before readiness: ${child.exitCode}`);
    }
    if (await isReachable(baseUrl)) {
      return;
    }
    await sleep(500);
  }
  throw new Error(`local dev server was not reachable within ${timeoutMs}ms`);
}

async function maybeStartDevServer(baseUrl: URL) {
  const canManage =
    !getArg("base-url") &&
    (baseUrl.hostname === "127.0.0.1" || baseUrl.hostname === "localhost") &&
    baseUrl.port === "3100";
  if (!canManage || (await isReachable(baseUrl))) {
    return null;
  }

  const child = spawn(NPM_BIN, ["run", "dev"], {
    cwd: WEB_ROOT,
    env: process.env,
    stdio: "pipe"
  });
  child.stdout.on("data", (chunk) => process.stdout.write(`[dev] ${chunk.toString()}`));
  child.stderr.on("data", (chunk) => process.stderr.write(`[dev] ${chunk.toString()}`));
  await waitForServer(baseUrl, child);
  return child;
}

async function stopDevServer(child: ChildProcessWithoutNullStreams | null) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5_000) {
    if (child.exitCode !== null) return;
    await sleep(100);
  }
  child.kill("SIGKILL");
}

async function readCustomizationEntries(page: Page) {
  try {
    await page.waitForFunction(
      (catalogItemId) => {
        const qaEntry = window.__DESKTERIORONLINE_MESHY_EDITOR_CUSTOMIZATION_QA__;
        if (!qaEntry?.sourceSceneAssetId || !qaEntry.replacementApplied) return false;

        const sourceEntry = Object.values(window.__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__ ?? {}).find(
          (entry) => entry.assetId === qaEntry.sourceSceneAssetId && entry.catalogItemId === catalogItemId
        );
        const loadEntry = Object.values(window.__DESKTERIORONLINE_FURNITURE_GLB_LOADS__ ?? {}).find(
          (entry) => entry.assetId === qaEntry.sourceSceneAssetId && entry.catalogItemId === catalogItemId
        );

        return (
          qaEntry.selectedSceneAssetId === qaEntry.sourceSceneAssetId &&
          qaEntry.selectedCatalogItemId === catalogItemId &&
          sourceEntry?.source === "real-glb" &&
          sourceEntry.viewMode === "top" &&
          loadEntry?.source === "real-glb" &&
          loadEntry.status === "loaded" &&
          loadEntry.meshCount > 0 &&
          loadEntry.materialCount > 0
        );
      },
      CATALOG_ITEM_ID,
      { timeout: 120_000 }
    );
  } catch (error) {
    const snapshot = await page.evaluate((catalogItemId) => {
      const qaEntry = window.__DESKTERIORONLINE_MESHY_EDITOR_CUSTOMIZATION_QA__ ?? null;
      return {
        qaEntry,
        sourceEntries: Object.values(window.__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__ ?? {}).filter(
          (entry) => entry.catalogItemId === catalogItemId
        ),
        loadEntries: Object.values(window.__DESKTERIORONLINE_FURNITURE_GLB_LOADS__ ?? {}).filter(
          (entry) => entry.catalogItemId === catalogItemId
        )
      };
    }, CATALOG_ITEM_ID);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}; Meshy customization snapshot=${JSON.stringify(snapshot)}`
    );
  }

  return page.evaluate((catalogItemId) => {
    const qaEntry = window.__DESKTERIORONLINE_MESHY_EDITOR_CUSTOMIZATION_QA__ ?? null;
    const sourceEntry = Object.values(window.__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__ ?? {}).find(
      (entry) => entry.assetId === qaEntry?.sourceSceneAssetId && entry.catalogItemId === catalogItemId
    );
    const loadEntry = Object.values(window.__DESKTERIORONLINE_FURNITURE_GLB_LOADS__ ?? {}).find(
      (entry) => entry.assetId === qaEntry?.sourceSceneAssetId && entry.catalogItemId === catalogItemId
    );
    return {
      qaEntry,
      sourceEntry: sourceEntry ?? null,
      loadEntry: loadEntry ?? null
    };
  }, CATALOG_ITEM_ID) as Promise<{
    qaEntry: MeshyEditorCustomizationQaEntry | null;
    sourceEntry: FurnitureRenderSourceEntry | null;
    loadEntry: FurnitureGlbLoadEntry | null;
  }>;
}

async function captureCanvasMetrics(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="meshy-editor-customization-viewport"] canvas');
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 1 || canvas.height < 1) {
      return null;
    }

    const sampleWidth = 180;
    const sampleHeight = 140;
    const rect = canvas.getBoundingClientRect();
    const sample = document.createElement("canvas");
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const buckets = new Set<string>();
    let nonTransparent = 0;
    let luminanceTotal = 0;
    let luminanceSquaredTotal = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      const alpha = pixels[index + 3] ?? 0;
      if (alpha <= 8) continue;

      nonTransparent += 1;
      buckets.add(`${Math.floor(red / 24)}:${Math.floor(green / 24)}:${Math.floor(blue / 24)}`);
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      luminanceTotal += luminance;
      luminanceSquaredTotal += luminance * luminance;
    }

    const totalPixels = sampleWidth * sampleHeight;
    const meanLuminance = luminanceTotal / Math.max(1, nonTransparent);
    const luminanceVariance = luminanceSquaredTotal / Math.max(1, nonTransparent) - meanLuminance * meanLuminance;
    return {
      width: canvas.width,
      height: canvas.height,
      cssWidth: rect.width,
      cssHeight: rect.height,
      nonTransparentRatio: nonTransparent / totalPixels,
      uniqueColorBuckets: buckets.size,
      luminanceStdDev: Math.sqrt(Math.max(0, luminanceVariance))
    } satisfies CanvasMetrics;
  }) as Promise<CanvasMetrics | null>;
}

async function main() {
  const baseUrl = new URL(getArg("base-url", DEFAULT_BASE_URL));
  const child = await maybeStartDevServer(baseUrl);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 1 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__DESKTERIORONLINE_DISABLE_LOADING_OVERLAY__ = true;
  });

  try {
    await page.goto(new URL(CUSTOMIZATION_ROUTE, baseUrl).toString(), {
      waitUntil: "domcontentloaded",
      timeout: 120_000
    });
    await page.waitForSelector('[data-testid="meshy-editor-customization-viewport"] canvas', {
      state: "attached",
      timeout: 120_000
    });
    await page.waitForFunction(
      ([sourceCatalogItemId, targetCatalogItemId]) => {
        const qaEntry = window.__DESKTERIORONLINE_MESHY_EDITOR_CUSTOMIZATION_QA__;
        return (
          qaEntry?.ready === true &&
          qaEntry.sourceCatalogItemId === sourceCatalogItemId &&
          qaEntry.targetCatalogItemId === targetCatalogItemId &&
          qaEntry.sourceSceneAssetId !== null &&
          qaEntry.selectedSceneAssetId === qaEntry.sourceSceneAssetId &&
          qaEntry.selectedCatalogItemId === sourceCatalogItemId &&
          qaEntry.hasMeshyReplacementCandidate
        );
      },
      [SOURCE_CATALOG_ITEM_ID, CATALOG_ITEM_ID],
      { timeout: 120_000 }
    );
    await page.waitForSelector(`[data-testid="asset-replacement-generated-badge-${CATALOG_ITEM_ID}"]`, {
      state: "visible",
      timeout: 120_000
    });

    await page.locator(`[data-testid="asset-replacement-${CATALOG_ITEM_ID}"]`).click({ timeout: 120_000 });
    await page.waitForSelector('[data-testid="selected-asset-generated-badge"]', {
      state: "visible",
      timeout: 120_000
    });
    await page.waitForSelector('[data-testid="meshy-customization-replaced-state"]', {
      state: "visible",
      timeout: 120_000
    });

    const { qaEntry, sourceEntry, loadEntry } = await readCustomizationEntries(page);
    assert(qaEntry, "Meshy editor customization QA registry entry should be present");
    assert(sourceEntry, "Meshy replacement render source entry should be present");
    assert(loadEntry, "Meshy replacement GLB load registry entry should be present");
    assert.equal(qaEntry.sourceCatalogItemId, SOURCE_CATALOG_ITEM_ID, "QA should begin from the source decor item");
    assert.equal(qaEntry.targetCatalogItemId, CATALOG_ITEM_ID, "QA should target the Meshy generated decor item");
    assert.equal(qaEntry.selectedSceneAssetId, qaEntry.sourceSceneAssetId, "replacement should preserve the scene asset id");
    assert.equal(qaEntry.selectedCatalogItemId, CATALOG_ITEM_ID, "replacement should select the Meshy catalog item");
    assert.equal(qaEntry.generatedProvider, "Meshy", "replacement UI should retain Meshy provider provenance");
    assert.equal(qaEntry.generatedReviewStatus, "검수 필요", "replacement UI should retain generated review state");
    assert.equal(sourceEntry.assetId, qaEntry.sourceSceneAssetId, "render registry should track the replaced scene asset id");
    assert.equal(sourceEntry.assetKey, `/assets/models/${CATALOG_ITEM_ID}/${CATALOG_ITEM_ID}.glb`);
    assert.equal(sourceEntry.source, "real-glb", "replacement should render the generated GLB, not a proxy or placeholder");
    assert.equal(sourceEntry.viewMode, "top", "replacement proof should run through the top-view editor renderer");
    assert.equal(loadEntry.assetId, qaEntry.sourceSceneAssetId, "loaded GLB registry should match the replaced scene asset");
    assert.equal(loadEntry.source, "real-glb", "loaded replacement should come from the real generated GLB");
    assert.ok(loadEntry.meshCount > 0, "loaded replacement GLB should expose at least one mesh");
    assert.ok(loadEntry.materialCount > 0, "loaded replacement GLB should expose material data");

    await page.locator('[data-testid="project-save-button"]').click({ timeout: 120_000 });
    await page.waitForFunction(
      ([catalogItemId, sourceUrl]) => {
        const qaEntry = window.__DESKTERIORONLINE_MESHY_EDITOR_CUSTOMIZATION_QA__;
        return (
          qaEntry !== undefined &&
          qaEntry.saveCaptureCount > 0 &&
          qaEntry.lastSaveAssetCatalogItemId === catalogItemId &&
          qaEntry.lastSaveAssetId === qaEntry.sourceSceneAssetId &&
          qaEntry.savedAssetIdStable &&
          qaEntry.savedProductSourceKind === "deskterioronline_blender" &&
          qaEntry.savedProductSourceUrl === sourceUrl
        );
      },
      [CATALOG_ITEM_ID, MESHY_TEXT_TO_3D_DOCS_URL],
      { timeout: 120_000 }
    );
    const finalQaEntry = await page.evaluate(
      () => window.__DESKTERIORONLINE_MESHY_EDITOR_CUSTOMIZATION_QA__ ?? null
    );
    assert(finalQaEntry, "Meshy customization QA save registry should remain available after manual save");
    assert.ok(finalQaEntry.saveCaptureCount > 0, "manual save should be captured by the QA project-version endpoint");
    assert.equal(finalQaEntry.lastSaveAssetCatalogItemId, CATALOG_ITEM_ID);
    assert.equal(finalQaEntry.lastSaveAssetId, qaEntry.sourceSceneAssetId);
    assert.equal(finalQaEntry.savedAssetIdStable, true);
    assert.equal(finalQaEntry.savedProductSourceUrl, MESHY_TEXT_TO_3D_DOCS_URL);

    await page.waitForTimeout(900);
    const metrics = await captureCanvasMetrics(page);
    assert(metrics, "Meshy customization canvas metrics should be readable");
    assert.ok(metrics.cssWidth >= 640 && metrics.cssHeight >= 600, "customization viewport should render at room scale");
    assert.ok(metrics.nonTransparentRatio >= 0.95, "customization canvas should be opaque and nonblank");
    assert.ok(
      metrics.uniqueColorBuckets >= 16,
      `customization scene should preserve material variation; uniqueColorBuckets=${metrics.uniqueColorBuckets}`
    );
    assert.ok(
      metrics.luminanceStdDev >= 5,
      `customization scene should preserve readable lighting contrast; luminanceStdDev=${metrics.luminanceStdDev.toFixed(2)}`
    );
    assert.equal(pageErrors.length, 0, `page errors should be absent: ${pageErrors.join(" / ")}`);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const screenshotPath = path.join(OUTPUT_DIR, "meshy-editor-customization.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(
      JSON.stringify(
        {
          sourceCatalogItemId: SOURCE_CATALOG_ITEM_ID,
          targetCatalogItemId: CATALOG_ITEM_ID,
          sceneAssetId: qaEntry.sourceSceneAssetId,
          saveCaptureCount: finalQaEntry.saveCaptureCount,
          source: sourceEntry.source,
          meshCount: loadEntry.meshCount,
          materialCount: loadEntry.materialCount,
          uniqueColorBuckets: metrics.uniqueColorBuckets,
          luminanceStdDev: Number(metrics.luminanceStdDev.toFixed(2)),
          screenshot: path.relative(REPO_ROOT, screenshotPath)
        },
        null,
        2
      )
    );
  } finally {
    await browser.close();
    await stopDevServer(child);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
