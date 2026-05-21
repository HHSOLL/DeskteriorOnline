import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";

type CanvasMetrics = {
  width: number;
  height: number;
  sampleWidth: number;
  sampleHeight: number;
  meanLuminance: number;
  luminanceStdDev: number;
  uniqueColorBuckets: number;
  nonFlatRatio: number;
  warmRatio: number;
  coolRatio: number;
  brightRatio: number;
  darkRatio: number;
};

type FurnitureRenderSource =
  | "builder-preview-proxy"
  | "placeholder-fallback"
  | "model-loading-fallback"
  | "real-glb"
  | "real-glb-lod"
  | "lod-proxy";

type FurnitureRenderSourceEntry = {
  assetId: string;
  assetKey: string;
  catalogItemId: string | null;
  productName: string | null;
  source: FurnitureRenderSource;
  viewMode: string;
  topMode: string;
  usesLodProxy: boolean;
};

type FurnitureRenderSourceSnapshot = {
  total: number;
  sourceCounts: Record<FurnitureRenderSource, number>;
  catalogItemIds: string[];
  assetKeys: string[];
  entries: FurnitureRenderSourceEntry[];
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..", "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "output", "playwright");
const NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";
const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const DEFAULT_BROWSER_TIMEOUT_MS = 180_000;
const CANVAS_READY_TIMEOUT_MS = 180_000;
const MIN_BUILDER_PREVIEW_FURNITURE_SOURCES = 8;
const MESHY_DECOR_CATALOG_ITEM_ID = "p2s_meshy_pastel_mascot_stack";

function getArg(name: string, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasArg(name: string) {
  return process.argv.includes(`--${name}`);
}

function isBenignNextRscFallbackConsoleError(message: string) {
  return (
    message.includes("Failed to fetch RSC payload for") &&
    message.includes("Falling back to browser navigation") &&
    message.includes("TypeError: Failed to fetch")
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isReachable(baseUrl: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(new URL("/studio/builder", baseUrl), {
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
  if (!canManage || await isReachable(baseUrl)) {
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

function createBuilderUrl(baseUrl: URL, step: "style" | "lighting") {
  const url = new URL("/studio/builder", baseUrl);
  url.searchParams.set("intent", "template");
  url.searchParams.set("step", step);
  url.searchParams.set("templateId", "rect-studio");
  url.searchParams.set("width", "6.4");
  url.searchParams.set("depth", "4.8");
  url.searchParams.set("wall", "0");
  url.searchParams.set("floor", "0");
  url.searchParams.set("lighting", "direct");
  url.searchParams.set("projectName", "Diorama Visual Smoke");
  url.searchParams.set("seed", "full");
  url.searchParams.set("scenePreset", "workspace-flex");
  return url;
}

async function captureCanvasMetrics(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return null;
    }

    const width = canvas.width;
    const height = canvas.height;
    if (width < 1 || height < 1) {
      return null;
    }

    const sampleWidth = 180;
    const sampleHeight = 120;
    const sample = document.createElement("canvas");
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return null;
    }

    try {
      context.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
      const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
      let luminanceSum = 0;
      let luminanceSquareSum = 0;
      let nonFlatCount = 0;
      let warmCount = 0;
      let coolCount = 0;
      let brightCount = 0;
      let darkCount = 0;
      const buckets = new Set<string>();
      const total = sampleWidth * sampleHeight;

      for (let index = 0; index < pixels.length; index += 4) {
        const red = pixels[index] ?? 0;
        const green = pixels[index + 1] ?? 0;
        const blue = pixels[index + 2] ?? 0;
        const alpha = pixels[index + 3] ?? 0;
        if (alpha < 24) {
          continue;
        }

        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        luminanceSum += luminance;
        luminanceSquareSum += luminance * luminance;

        const channelSpread = Math.max(red, green, blue) - Math.min(red, green, blue);
        if (channelSpread > 8) {
          nonFlatCount += 1;
        }
        if (red > blue + 16 && red > green - 6) {
          warmCount += 1;
        }
        if (blue > red + 16 && blue > green - 10) {
          coolCount += 1;
        }
        if (luminance > 168) {
          brightCount += 1;
        }
        if (luminance < 42) {
          darkCount += 1;
        }

        buckets.add(`${red >> 4}:${green >> 4}:${blue >> 4}`);
      }

      const meanLuminance = luminanceSum / total;
      const variance = Math.max(luminanceSquareSum / total - meanLuminance * meanLuminance, 0);
      return {
        width,
        height,
        sampleWidth,
        sampleHeight,
        meanLuminance,
        luminanceStdDev: Math.sqrt(variance),
        uniqueColorBuckets: buckets.size,
        nonFlatRatio: nonFlatCount / total,
        warmRatio: warmCount / total,
        coolRatio: coolCount / total,
        brightRatio: brightCount / total,
        darkRatio: darkCount / total
      } satisfies CanvasMetrics;
    } catch {
      return null;
    }
  });
}

function assertDioramaMetrics(metrics: CanvasMetrics, label: string) {
  assert.ok(metrics.width >= 900, `${label} canvas should render at desktop presentation width`);
  assert.ok(metrics.height >= 420, `${label} canvas should render at desktop presentation height`);
  assert.ok(metrics.meanLuminance > 16, `${label} canvas should not be black`);
  assert.ok(metrics.meanLuminance < 238, `${label} canvas should not be blown out`);
  assert.ok(metrics.luminanceStdDev >= 18, `${label} should have enough light/dark contrast for a 3D room`);
  assert.ok(metrics.uniqueColorBuckets >= 42, `${label} should contain varied material and light colors`);
  assert.ok(metrics.nonFlatRatio >= 0.18, `${label} should not collapse into a flat monochrome shell`);
  assert.ok(metrics.warmRatio >= 0.03, `${label} should preserve warm room/decor lighting pixels`);
  assert.ok(metrics.coolRatio >= 0.015, `${label} should preserve cool accent/shadow pixels`);
  assert.ok(metrics.brightRatio >= 0.008, `${label} should contain visible highlight surfaces`);
  assert.ok(metrics.darkRatio >= 0.006, `${label} should retain dark backdrop/screen contrast`);
}

async function waitForDioramaCanvas(page: Page, label: string) {
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: CANVAS_READY_TIMEOUT_MS });
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector("canvas");
      if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 1 || canvas.height < 1) {
        return false;
      }

      const sample = document.createElement("canvas");
      sample.width = 80;
      sample.height = 54;
      const context = sample.getContext("2d", { willReadFrequently: true });
      if (!context) return false;
      try {
        context.drawImage(canvas, 0, 0, sample.width, sample.height);
        const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
        let luminanceSum = 0;
        let luminanceSquareSum = 0;
        const buckets = new Set<string>();
        const total = sample.width * sample.height;
        for (let index = 0; index < pixels.length; index += 4) {
          const red = pixels[index] ?? 0;
          const green = pixels[index + 1] ?? 0;
          const blue = pixels[index + 2] ?? 0;
          const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
          luminanceSum += luminance;
          luminanceSquareSum += luminance * luminance;
          buckets.add(`${red >> 4}:${green >> 4}:${blue >> 4}`);
        }
        const mean = luminanceSum / total;
        const stdDev = Math.sqrt(Math.max(luminanceSquareSum / total - mean * mean, 0));
        return mean > 14 && mean < 240 && stdDev >= 12 && buckets.size >= 22;
      } catch {
        return false;
      }
    },
    { timeout: CANVAS_READY_TIMEOUT_MS }
  );

  const metrics = await captureCanvasMetrics(page);
  assert.ok(metrics, `${label} should expose readable canvas pixels`);
  assertDioramaMetrics(metrics, label);
  return metrics;
}

async function captureFurnitureRenderSources(
  page: Page,
  label: string,
  {
    requiredCatalogItemIds = [],
    minimumEntries = MIN_BUILDER_PREVIEW_FURNITURE_SOURCES
  }: {
    requiredCatalogItemIds?: string[];
    minimumEntries?: number;
  } = {}
) {
  await page.waitForFunction(
    (minimum) => {
      const registry = (
        window as Window & {
          __DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__?: Record<string, FurnitureRenderSourceEntry>;
        }
      ).__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__;
      return Boolean(registry && Object.keys(registry).length >= minimum);
    },
    minimumEntries,
    { timeout: DEFAULT_BROWSER_TIMEOUT_MS }
  );

  const snapshot = await page.evaluate(() => {
    const registry = (
      window as Window & {
        __DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__?: Record<string, FurnitureRenderSourceEntry>;
      }
    ).__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__;
    const entries = Object.values(registry ?? {}).sort((first, second) =>
      first.assetId.localeCompare(second.assetId)
    );
    const sourceCounts: Record<FurnitureRenderSource, number> = {
      "builder-preview-proxy": 0,
      "placeholder-fallback": 0,
      "model-loading-fallback": 0,
      "real-glb": 0,
      "real-glb-lod": 0,
      "lod-proxy": 0
    };

    for (const entry of entries) {
      sourceCounts[entry.source] += 1;
    }

    return {
      total: entries.length,
      sourceCounts,
      catalogItemIds: Array.from(
        new Set(
          entries
            .map((entry) => entry.catalogItemId)
            .filter((catalogItemId): catalogItemId is string => Boolean(catalogItemId))
        )
      ).sort(),
      assetKeys: Array.from(new Set(entries.map((entry) => entry.assetKey))).sort(),
      entries
    } satisfies FurnitureRenderSourceSnapshot;
  });

  assert.ok(
    snapshot.total >= minimumEntries,
    `${label} should expose at least ${minimumEntries} furniture render source entries`
  );
  assert.ok(
    snapshot.sourceCounts["builder-preview-proxy"] >= minimumEntries,
    `${label} should use builder-preview proxy geometry instead of blank placeholders`
  );
  assert.equal(
    snapshot.sourceCounts["placeholder-fallback"],
    0,
    `${label} should not fall back to generic placeholder geometry`
  );
  assert.equal(
    snapshot.sourceCounts["model-loading-fallback"],
    0,
    `${label} should not leave model-loading fallback geometry mounted after canvas readiness`
  );
  for (const catalogItemId of requiredCatalogItemIds) {
    assert.ok(
      snapshot.catalogItemIds.includes(catalogItemId),
      `${label} should include required catalog item ${catalogItemId}`
    );
  }

  return snapshot;
}

async function main() {
  const baseUrl = new URL(getArg("base-url", DEFAULT_BASE_URL));
  const managedServer = await maybeStartDevServer(baseUrl);
  const browser = await chromium.launch({
    headless: !hasArg("headed"),
    args: ["--use-gl=swiftshader", "--disable-dev-shm-usage"]
  });

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const requestFailures: string[] = [];
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(DEFAULT_BROWSER_TIMEOUT_MS);
    page.on("console", (message) => {
      const text = message.text();
      if (message.type() === "error" && !isBenignNextRscFallbackConsoleError(text)) {
        consoleErrors.push(text);
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      const failureText = request.failure()?.errorText ?? "";
      const url = request.url();
      const isNavigationAbort = failureText.includes("ERR_ABORTED");
      if (!url.startsWith("data:") && !isNavigationAbort) {
        requestFailures.push(`${request.method()} ${url} ${failureText}`.trim());
      }
    });

    const styleUrl = createBuilderUrl(baseUrl, "style");
    await page.goto(styleUrl.toString(), { waitUntil: "domcontentloaded", timeout: DEFAULT_BROWSER_TIMEOUT_MS });
    await page.locator('[data-testid="workspace-cluster-preset-controls"]').waitFor({
      state: "visible",
      timeout: DEFAULT_BROWSER_TIMEOUT_MS
    });
    await page.locator('[data-testid="workspace-cluster-controls"]').waitFor({
      state: "visible",
      timeout: DEFAULT_BROWSER_TIMEOUT_MS
    });
    const styleMetrics = await waitForDioramaCanvas(page, "builder style preview");
    const styleRenderSources = await captureFurnitureRenderSources(page, "builder style preview", {
      requiredCatalogItemIds: [MESHY_DECOR_CATALOG_ITEM_ID]
    });

    await page.locator('[data-testid="workspace-cluster-preset-media-lounge"]').click();
    await page.waitForFunction(
      () => new URL(window.location.href).searchParams.get("clusters") === "media,lounge",
      { timeout: DEFAULT_BROWSER_TIMEOUT_MS }
    );
    const mediaLoungeMetrics = await waitForDioramaCanvas(page, "media lounge preview");
    const mediaLoungeRenderSources = await captureFurnitureRenderSources(page, "media lounge preview");

    const lightingUrl = createBuilderUrl(baseUrl, "lighting");
    await page.goto(lightingUrl.toString(), { waitUntil: "domcontentloaded", timeout: DEFAULT_BROWSER_TIMEOUT_MS });
    await page.waitForFunction(
      () => document.body.textContent?.includes("선택한 조명") ?? false,
      { timeout: DEFAULT_BROWSER_TIMEOUT_MS }
    );
    const lightingMetrics = await waitForDioramaCanvas(page, "builder lighting preview");
    const lightingRenderSources = await captureFurnitureRenderSources(page, "builder lighting preview", {
      requiredCatalogItemIds: [MESHY_DECOR_CATALOG_ITEM_ID]
    });

    await page.screenshot({
      path: path.join(OUTPUT_DIR, "builder-preview-diorama-smoke.png"),
      fullPage: true
    });

    assert.deepEqual(pageErrors, [], "builder preview visual smoke should not throw page errors");
    assert.deepEqual(consoleErrors, [], "builder preview visual smoke should not emit console errors");
    assert.deepEqual(requestFailures, [], "builder preview visual smoke should not fail resource requests");

    console.log(
      JSON.stringify(
        {
          styleMetrics,
          styleRenderSources,
          mediaLoungeMetrics,
          mediaLoungeRenderSources,
          lightingMetrics,
          lightingRenderSources,
          screenshot: path.relative(REPO_ROOT, path.join(OUTPUT_DIR, "builder-preview-diorama-smoke.png"))
        },
        null,
        2
      )
    );
    console.log("[verify:builder-preview-diorama] PASS");
  } finally {
    await browser.close();
    await stopDevServer(managedServer);
  }
}

main().catch(async (error) => {
  console.error("[verify:builder-preview-diorama] FAIL");
  console.error(error);
  process.exitCode = 1;
});
