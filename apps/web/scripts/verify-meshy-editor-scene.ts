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

type MeshyEditorSceneQaEntry = {
  catalogItemId: string;
  sceneAssetId: string | null;
  assetCount: number;
  viewMode: "top";
  clusterIds: readonly string[];
  generatedProvider: string | null;
  reviewStatus: string | null;
};

type CanvasMetrics = {
  width: number;
  height: number;
  cssWidth: number;
  cssHeight: number;
  nonTransparentRatio: number;
  uniqueColorBuckets: number;
  luminanceStdDev: number;
  brightRatio: number;
  darkRatio: number;
};

declare global {
  interface Window {
    __DESKTERIORONLINE_DISABLE_LOADING_OVERLAY__?: boolean;
    __DESKTERIORONLINE_FORCE_REAL_GLB_TOP_VIEW_QA__?: boolean;
    __DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__?: Record<string, FurnitureRenderSourceEntry>;
    __DESKTERIORONLINE_FURNITURE_GLB_LOADS__?: Record<string, FurnitureGlbLoadEntry>;
    __DESKTERIORONLINE_MESHY_EDITOR_SCENE_QA__?: MeshyEditorSceneQaEntry;
  }
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..", "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "output", "playwright");
const NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";
const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const CATALOG_ITEM_ID = "p2s_meshy_pastel_mascot_stack";
const EDITOR_SCENE_ROUTE = "/labs/qa/meshy-editor-scene";

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
    const response = await fetch(new URL(EDITOR_SCENE_ROUTE, baseUrl), {
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

async function readMeshyEditorSceneEntries(page: Page) {
  try {
    await page.waitForFunction(
      (catalogItemId) => {
        const sourceEntry = Object.values(window.__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__ ?? {}).find(
          (entry) => entry.catalogItemId === catalogItemId
        );
        const loadEntry = Object.values(window.__DESKTERIORONLINE_FURNITURE_GLB_LOADS__ ?? {}).find(
          (entry) => entry.catalogItemId === catalogItemId
        );
        const qaEntry = window.__DESKTERIORONLINE_MESHY_EDITOR_SCENE_QA__;

        return (
          qaEntry?.catalogItemId === catalogItemId &&
          qaEntry.sceneAssetId !== null &&
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
    const snapshot = await page.evaluate((catalogItemId) => ({
      qaEntry: window.__DESKTERIORONLINE_MESHY_EDITOR_SCENE_QA__ ?? null,
      sourceEntries: Object.values(window.__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__ ?? {}).filter(
        (entry) => entry.catalogItemId === catalogItemId
      ),
      loadEntries: Object.values(window.__DESKTERIORONLINE_FURNITURE_GLB_LOADS__ ?? {}).filter(
        (entry) => entry.catalogItemId === catalogItemId
      )
    }), CATALOG_ITEM_ID);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}; Meshy registry snapshot=${JSON.stringify(snapshot)}`
    );
  }

  return page.evaluate((catalogItemId) => {
    const sourceEntry = Object.values(window.__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__ ?? {}).find(
      (entry) => entry.catalogItemId === catalogItemId
    );
    const loadEntry = Object.values(window.__DESKTERIORONLINE_FURNITURE_GLB_LOADS__ ?? {}).find(
      (entry) => entry.catalogItemId === catalogItemId
    );
    return {
      qaEntry: window.__DESKTERIORONLINE_MESHY_EDITOR_SCENE_QA__ ?? null,
      sourceEntry: sourceEntry ?? null,
      loadEntry: loadEntry ?? null
    };
  }, CATALOG_ITEM_ID) as Promise<{
    qaEntry: MeshyEditorSceneQaEntry | null;
    sourceEntry: FurnitureRenderSourceEntry | null;
    loadEntry: FurnitureGlbLoadEntry | null;
  }>;
}

async function captureCanvasMetrics(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="meshy-editor-scene-viewport"] canvas');
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
    let bright = 0;
    let dark = 0;

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
      if (luminance >= 180) bright += 1;
      if (luminance <= 55) dark += 1;
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
      luminanceStdDev: Math.sqrt(Math.max(0, luminanceVariance)),
      brightRatio: bright / totalPixels,
      darkRatio: dark / totalPixels
    } satisfies CanvasMetrics;
  }) as Promise<CanvasMetrics | null>;
}

async function main() {
  const baseUrl = new URL(getArg("base-url", DEFAULT_BASE_URL));
  const child = await maybeStartDevServer(baseUrl);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__DESKTERIORONLINE_DISABLE_LOADING_OVERLAY__ = true;
  });

  try {
    await page.goto(new URL(EDITOR_SCENE_ROUTE, baseUrl).toString(), {
      waitUntil: "domcontentloaded",
      timeout: 120_000
    });
    await page.waitForSelector('[data-testid="meshy-editor-scene-viewport"] canvas', {
      state: "attached",
      timeout: 120_000
    });

    const { qaEntry, sourceEntry, loadEntry } = await readMeshyEditorSceneEntries(page);
    assert(qaEntry, "Meshy editor scene QA registry entry should be present");
    assert(sourceEntry, "Meshy furniture render source entry should be present");
    assert(loadEntry, "Meshy GLB load registry entry should be present");
    assert.equal(qaEntry.catalogItemId, CATALOG_ITEM_ID, "QA scene should target the Meshy catalog item");
    assert.ok(qaEntry.assetCount >= 4, "QA scene should include a room cluster, not a standalone model card");
    assert.ok(qaEntry.clusterIds.includes("display"), "QA scene should use the display cluster that places Meshy decor on a shelf");
    assert.equal(qaEntry.generatedProvider, "Meshy", "QA scene should carry Meshy provider provenance");
    assert.equal(qaEntry.reviewStatus, "검수 필요", "QA scene should carry generated asset review state");
    assert.equal(sourceEntry.catalogItemId, CATALOG_ITEM_ID);
    assert.equal(sourceEntry.assetKey, `/assets/models/${CATALOG_ITEM_ID}/${CATALOG_ITEM_ID}.glb`);
    assert.equal(sourceEntry.source, "real-glb", "Meshy editor scene should not use builder proxy, placeholder, or loading fallback");
    assert.equal(sourceEntry.viewMode, "top", "real GLB proof should run through the full room top-view renderer path");
    assert.equal(loadEntry.assetId, sourceEntry.assetId, "loaded GLB registry should match the scene asset handle");
    assert.equal(loadEntry.source, "real-glb", "loaded Meshy asset should be a real GLB source");
    assert.ok(loadEntry.meshCount > 0, "loaded Meshy GLB should expose at least one mesh");
    assert.ok(loadEntry.materialCount > 0, "loaded Meshy GLB should expose material data");
    assert.ok(
      loadEntry.bounds.width > 0 && loadEntry.bounds.height > 0 && loadEntry.bounds.depth > 0,
      "loaded Meshy GLB bounds should be non-zero"
    );

    await page.waitForTimeout(900);
    const metrics = await captureCanvasMetrics(page);
    assert(metrics, "Meshy editor scene canvas metrics should be readable");
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const screenshotPath = path.join(OUTPUT_DIR, "meshy-editor-scene.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });
    assert.ok(
      metrics.cssWidth >= 640 && metrics.cssHeight >= 600 && metrics.width >= 300 && metrics.height >= 150,
      `Meshy editor scene should render at room viewport scale; css=${metrics.cssWidth}x${metrics.cssHeight}, buffer=${metrics.width}x${metrics.height}`
    );
    assert.ok(metrics.nonTransparentRatio >= 0.95, "Meshy editor scene canvas should be opaque and nonblank");
    assert.ok(
      metrics.uniqueColorBuckets >= 16,
      `Meshy editor scene should preserve room/material color variation; uniqueColorBuckets=${metrics.uniqueColorBuckets}`
    );
    assert.ok(
      metrics.luminanceStdDev >= 5,
      `Meshy editor scene should have readable lighting contrast; luminanceStdDev=${metrics.luminanceStdDev.toFixed(2)}`
    );
    assert.ok(
      metrics.brightRatio >= 0.005,
      `Meshy editor scene should include visible lit surfaces; brightRatio=${metrics.brightRatio.toFixed(4)}`
    );
    assert.ok(
      metrics.darkRatio >= 0.005,
      `Meshy editor scene should include shadow/dark contrast; darkRatio=${metrics.darkRatio.toFixed(4)}`
    );
    assert.equal(pageErrors.length, 0, `page errors should be absent: ${pageErrors.join(" / ")}`);

    console.log(
      JSON.stringify(
        {
          catalogItemId: CATALOG_ITEM_ID,
          sceneAssetId: qaEntry.sceneAssetId,
          source: sourceEntry.source,
          meshCount: loadEntry.meshCount,
          materialCount: loadEntry.materialCount,
          uniqueColorBuckets: metrics.uniqueColorBuckets,
          luminanceStdDev: Number(metrics.luminanceStdDev.toFixed(2)),
          cssSize: `${Math.round(metrics.cssWidth)}x${Math.round(metrics.cssHeight)}`,
          bufferSize: `${metrics.width}x${metrics.height}`,
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
