import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";

type LivePreviewRegistryEntry = {
  itemId: string;
  assetId: string;
  label: string;
  source: "real-glb-live-preview";
  status: "loaded";
  meshCount: number;
  materialCount: number;
  bounds: {
    width: number;
    height: number;
    depth: number;
    floorY: number;
    fitScale: number;
  };
  generatedProvider: string | null;
  reviewStatus: string | null;
  sourcePath: string | null;
};

type CanvasMetrics = {
  width: number;
  height: number;
  nonTransparentRatio: number;
  uniqueColorBuckets: number;
  meanAlpha: number;
};

declare global {
  interface Window {
    __DESKTERIORONLINE_DISABLE_LOADING_OVERLAY__?: boolean;
    __DESKTERIORONLINE_CATALOG_LIVE_MODEL_PREVIEWS__?: Record<string, LivePreviewRegistryEntry>;
  }
}

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..", "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "output", "playwright");
const NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";
const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const CATALOG_ITEM_ID = "p2s_meshy_pastel_mascot_stack";
const LIVE_PREVIEW_ROUTE = "/labs/qa/meshy-live-preview";

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
    const response = await fetch(new URL(LIVE_PREVIEW_ROUTE, baseUrl), {
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

async function readLivePreviewEntry(page: Page) {
  await page.waitForFunction(
    (catalogItemId) => {
      const entry = window.__DESKTERIORONLINE_CATALOG_LIVE_MODEL_PREVIEWS__?.[catalogItemId];
      return (
        entry?.source === "real-glb-live-preview" &&
        entry.status === "loaded" &&
        entry.meshCount > 0 &&
        entry.materialCount > 0
      );
    },
    CATALOG_ITEM_ID,
    { timeout: 120_000 }
  );

  return page.evaluate((catalogItemId) => {
    return window.__DESKTERIORONLINE_CATALOG_LIVE_MODEL_PREVIEWS__?.[catalogItemId] ?? null;
  }, CATALOG_ITEM_ID) as Promise<LivePreviewRegistryEntry | null>;
}

async function captureCanvasMetrics(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="meshy-live-preview-canvas"] canvas');
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 1 || canvas.height < 1) {
      return null;
    }

    const sampleWidth = 160;
    const sampleHeight = 160;
    const sample = document.createElement("canvas");
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const buckets = new Set<string>();
    let nonTransparent = 0;
    let alphaTotal = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      const alpha = pixels[index + 3] ?? 0;
      alphaTotal += alpha;
      if (alpha <= 8) continue;

      nonTransparent += 1;
      buckets.add(`${Math.floor(red / 24)}:${Math.floor(green / 24)}:${Math.floor(blue / 24)}`);
    }

    const totalPixels = sampleWidth * sampleHeight;
    return {
      width: canvas.width,
      height: canvas.height,
      nonTransparentRatio: nonTransparent / totalPixels,
      uniqueColorBuckets: buckets.size,
      meanAlpha: alphaTotal / totalPixels
    } satisfies CanvasMetrics;
  }) as Promise<CanvasMetrics | null>;
}

async function main() {
  const baseUrl = new URL(getArg("base-url", DEFAULT_BASE_URL));
  const child = await maybeStartDevServer(baseUrl);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__DESKTERIORONLINE_DISABLE_LOADING_OVERLAY__ = true;
  });

  try {
    await page.goto(new URL(LIVE_PREVIEW_ROUTE, baseUrl).toString(), {
      waitUntil: "domcontentloaded",
      timeout: 120_000
    });
    await page.waitForSelector('[data-testid="meshy-live-preview-canvas"] canvas', {
      state: "attached",
      timeout: 120_000
    });

    const entry = await readLivePreviewEntry(page);
    assert(entry, "Meshy live preview registry entry should be present");
    assert.equal(entry.itemId, CATALOG_ITEM_ID, "live preview entry should target the Meshy catalog item");
    assert.equal(
      entry.assetId,
      `/assets/models/${CATALOG_ITEM_ID}/${CATALOG_ITEM_ID}.glb`,
      "live preview should render the generated Meshy GLB asset"
    );
    assert.equal(entry.generatedProvider, "Meshy", "live preview should carry Meshy generated-asset provenance");
    assert.equal(entry.reviewStatus, "검수 필요", "live preview should carry generated-asset review state");
    assert.equal(
      entry.sourcePath,
      "assets/references/meshy-room-decor/meshy-room-decor-report.json",
      "live preview should point back to the Meshy generation report"
    );
    assert.ok(entry.meshCount > 0, "live preview should expose loaded GLB mesh count");
    assert.ok(entry.materialCount > 0, "live preview should expose loaded GLB material count");
    assert.ok(entry.bounds.width > 0 && entry.bounds.height > 0 && entry.bounds.depth > 0, "live preview bounds should be non-zero");
    assert.ok(entry.bounds.fitScale > 0, "live preview fit scale should be positive");

    await page.waitForTimeout(700);
    const metrics = await captureCanvasMetrics(page);
    assert(metrics, "Meshy live preview canvas metrics should be readable");
    assert.ok(metrics.width >= 300 && metrics.height >= 300, "Meshy live preview canvas should render at card scale");
    assert.ok(
      metrics.nonTransparentRatio >= 0.015,
      `Meshy live preview should contain visible GLB pixels; nonTransparentRatio=${metrics.nonTransparentRatio.toFixed(3)}`
    );
    assert.ok(
      metrics.uniqueColorBuckets >= 8,
      `Meshy live preview should preserve generated material variation; uniqueColorBuckets=${metrics.uniqueColorBuckets}`
    );
    assert.equal(pageErrors.length, 0, `page errors should be absent: ${pageErrors.join(" / ")}`);

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const screenshotPath = path.join(OUTPUT_DIR, "meshy-live-preview.png");
    await page.screenshot({ path: screenshotPath, fullPage: true });

    console.log(
      JSON.stringify(
        {
          catalogItemId: CATALOG_ITEM_ID,
          source: entry.source,
          meshCount: entry.meshCount,
          materialCount: entry.materialCount,
          nonTransparentRatio: Number(metrics.nonTransparentRatio.toFixed(4)),
          uniqueColorBuckets: metrics.uniqueColorBuckets,
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
