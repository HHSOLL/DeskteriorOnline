import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { chromium, type Page } from "playwright";
import type { Database } from "../../../types/database";
import { DEFAULT_CATALOG, toCatalogProductSnapshot } from "../src/lib/builder/catalog";
import { createProjectVersion } from "../src/lib/server/project-versions";
import { createProjectForOwner } from "../src/lib/server/projects";

type StageResult = {
  stage: string;
  ok: boolean;
  detail: string;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..", "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "output", "playwright");
const NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";
const FLOW_REQUIRED_ENVS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
] as const;

type FlowArtifacts = {
  ownerId: string | null;
  projectId: string | null;
  token: string | null;
};

function getArg(name: string, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasArg(name: string) {
  return process.argv.includes(`--${name}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeEnvRawValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const envMatch = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!envMatch) continue;
    const key = envMatch[1];
    if (process.env[key] !== undefined && process.env[key] !== "") continue;
    process.env[key] = normalizeEnvRawValue(envMatch[2] ?? "");
  }
}

function loadFunctionalEnv() {
  loadEnvConfig(WEB_ROOT);
  [
    path.join(WEB_ROOT, ".env.local"),
    path.join(REPO_ROOT, ".env.local"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "apps/web/.env.local")
  ].forEach(loadEnvFile);
}

function requireFlowEnv(name: (typeof FLOW_REQUIRED_ENVS)[number]) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
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

async function expectText(page: Page, text: string, stage: string) {
  const locator = page.getByText(text, { exact: false }).first();
  await locator.waitFor({ state: "visible", timeout: 20_000 });
  return {
    stage,
    ok: true,
    detail: `visible text: ${text}`
  } satisfies StageResult;
}

async function clickNext(page: Page) {
  await page.waitForFunction(
    () =>
      Array.from(document.querySelectorAll("button")).some(
        (button) => button.textContent?.trim() === "다음" && !button.disabled
      ),
    null,
    { timeout: 20_000 }
  );
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button")).filter(
      (button) => button.textContent?.trim() === "다음" && !button.disabled
    );
    buttons.at(-1)?.click();
  });
  await page.waitForTimeout(300);
}

async function countButtonsInSection(page: Page, heading: string) {
  return page.locator("section").filter({ hasText: heading }).locator("button").count();
}

function requireCatalogItem(id: string) {
  const item = DEFAULT_CATALOG.find((candidate) => candidate.id === id);
  if (!item) {
    throw new Error(`Catalog item not found: ${id}`);
  }
  return item;
}

function buildDeskProjectVersionPayload(projectName: string) {
  const deskItem = requireCatalogItem("p2s_desk_walnut_160");
  const deskSnapshot = toCatalogProductSnapshot(deskItem);

  return {
    message: "Functional browser walkthrough placement seed",
    roomShell: {
      scale: 1,
      scaleInfo: {
        value: 1,
        source: "user_measure" as const,
        confidence: 0.95,
        evidence: { notes: "functional-browser-e2e" }
      },
      walls: [
        { id: "wall-back", start: [0, 0], end: [5.6, 0], thickness: 0.18, height: 2.8 },
        { id: "wall-right", start: [5.6, 0], end: [5.6, 3.8], thickness: 0.18, height: 2.8 },
        { id: "wall-front", start: [5.6, 3.8], end: [0, 3.8], thickness: 0.18, height: 2.8 },
        { id: "wall-left", start: [0, 3.8], end: [0, 0], thickness: 0.18, height: 2.8 }
      ],
      openings: [
        {
          id: "door-main",
          wallId: "wall-front",
          type: "door",
          offset: 0.8,
          width: 0.9,
          height: 2.1,
          verticalOffset: 0,
          isEntrance: true
        },
        {
          id: "window-right",
          wallId: "wall-right",
          type: "window",
          offset: 1.1,
          width: 1.2,
          height: 1.1,
          sillHeight: 0.9
        }
      ],
      floors: [
        {
          id: "floor-main",
          outline: [
            [0, 0],
            [5.6, 0],
            [5.6, 3.8],
            [0, 3.8]
          ],
          materialId: null
        }
      ],
      ceilings: [
        {
          id: "ceiling-main",
          outline: [
            [0, 0],
            [5.6, 0],
            [5.6, 3.8],
            [0, 3.8]
          ],
          materialId: null,
          height: 2.8
        }
      ],
      rooms: [],
      cameraAnchors: [
        {
          id: "camera-room-center",
          kind: "room_center" as const,
          roomId: null,
          openingId: null,
          planPosition: [2.8, 0.9],
          targetPlanPosition: [2.8, 2.1],
          height: 1.5
        },
        {
          id: "camera-overview",
          kind: "overview" as const,
          roomId: null,
          openingId: null,
          planPosition: [2.8, 1.9],
          targetPlanPosition: [2.8, 1.9],
          height: 1.7
        }
      ],
      navGraph: { nodes: [], edges: [] },
      entranceId: "door-main"
    },
    assets: [
      {
        id: "desk-1",
        assetId: deskItem.assetId,
        catalogItemId: deskItem.id,
        product: deskSnapshot,
        anchorType: "floor" as const,
        supportAssetId: null,
        supportProfile: deskItem.supportProfile ?? null,
        position: [2.8, 0, 2.05] as [number, number, number],
        rotation: [0, 0, 0] as [number, number, number],
        scale: deskItem.scale,
        materialId: null
      }
    ],
    materials: {
      wallIndex: 2,
      floorIndex: 3,
      ceilingIndex: 1
    },
    lighting: {
      mode: "indirect" as const,
      ambientIntensity: 0.42,
      hemisphereIntensity: 0.5,
      directionalIntensity: 1.08,
      environmentBlur: 0.24,
      accentIntensity: 0.72,
      beamOpacity: 0.14
    },
    assetSummary: {
      totalAssets: 1,
      highlightedItems: [
        {
          catalogItemId: deskItem.id,
          assetId: deskItem.assetId,
          label: deskItem.label,
          category: deskItem.category,
          collection: deskItem.collection,
          tone: deskItem.tone,
          count: 1
        }
      ],
      collections: [{ label: deskItem.collection, count: 1 }],
      uncataloguedCount: 0,
      primaryTone: deskItem.tone,
      primaryCollection: deskItem.collection
    },
    projectName,
    projectDescription: "functional browser walkthrough placement regression"
  };
}

async function cleanupArtifacts(admin: SupabaseClient<Database>, artifacts: FlowArtifacts) {
  if (artifacts.projectId) {
    await admin.from("shared_projects").delete().eq("project_id", artifacts.projectId);
    await admin.from("project_versions").delete().eq("project_id", artifacts.projectId);
    await admin.from("projects").delete().eq("id", artifacts.projectId);
  }

  if (artifacts.ownerId) {
    await admin.auth.admin.deleteUser(artifacts.ownerId);
  }
}

async function createFunctionalProjectSeed() {
  const supabaseUrl = requireFlowEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireFlowEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = requireFlowEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const publicClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const artifacts: FlowArtifacts = {
    ownerId: null,
    projectId: null,
    token: null
  };

  const email = `tmp-functional-flow-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const password = "Passw0rd!123456";
  const projectName = `Functional Deskterior ${Date.now()}`;

  const createdUser = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (createdUser.error || !createdUser.data.user) {
    throw createdUser.error ?? new Error("Failed to create temporary E2E user.");
  }
  artifacts.ownerId = createdUser.data.user.id;

  const login = await publicClient.auth.signInWithPassword({ email, password });
  if (login.error || !login.data.session) {
    throw login.error ?? new Error("Temporary E2E user sign-in failed.");
  }

  const project = await createProjectForOwner(admin, artifacts.ownerId, {
    name: projectName,
    description: "functional browser walkthrough placement validation"
  });
  artifacts.projectId = project.id;

  await createProjectVersion(publicClient, {
    projectId: project.id,
    ownerId: artifacts.ownerId,
    payload: buildDeskProjectVersionPayload(projectName)
  });

  return {
    admin,
    artifacts,
    email,
    password,
    projectId: project.id,
    projectName
  };
}

async function loginBrowserUser(page: Page, baseUrl: URL, email: string, password: string) {
  await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(1000);
}

async function waitForRuntimePlacement(
  page: Page,
  input: {
    catalogItemId: string;
    supportObjectId?: string;
    attachmentType?: string;
  }
) {
  const handle = await page.waitForFunction(
    ({ catalogItemId, supportObjectId, attachmentType }) => {
      const engine = window.__DESKTERIORONLINE_RUNTIME_ENGINE__;
      const registry = engine?.runtimeScene?.objectRegistry;
      if (!registry) return null;

      for (const [objectId, runtimeObject] of registry.entries()) {
        const objectDocument = (runtimeObject.objectDocument ?? {}) as { catalogItemId?: string | null };
        const matchesCatalog =
          objectDocument.catalogItemId === catalogItemId ||
          runtimeObject.runtimeAssetId === catalogItemId ||
          runtimeObject.assetId === catalogItemId;
        if (!matchesCatalog) continue;

        const placement = runtimeObject.placement;
        if (!placement || placement.mode !== "surface_local") continue;
        if (supportObjectId && placement.supportObjectId !== supportObjectId) continue;
        if (attachmentType && placement.attachmentType !== attachmentType) continue;

        return {
          objectId,
          placement,
          position: runtimeObject.transform?.position ?? null
        };
      }

      return null;
    },
    input,
    { timeout: 25_000 }
  );
  return handle.jsonValue() as Promise<{
    objectId: string;
    placement: {
      mode: "surface_local";
      supportObjectId: string;
      surfaceId: string;
      attachmentType: string;
      localPose: { uMm: number; vMm: number; normalOffsetMm: number; rotationMilliDeg: number };
    };
    position: [number, number, number] | null;
  }>;
}

async function addAndCommitWalkPlacement(
  page: Page,
  input: {
    label: string;
    catalogItemId: string;
    attachmentType: string;
    search?: string;
    uMm?: number;
    vMm?: number;
    normalOffsetMm?: number;
    rotationDeg?: number;
  }
) {
  console.log(`[e2e] placement:start ${input.catalogItemId}`);
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByPlaceholder("무엇을 찾으시나요?").fill(input.search ?? input.label);
  await page.getByRole("button", { name: `${input.label} 추가` }).click();
  await page.getByTestId("focus-placement-launcher").waitFor({ state: "visible", timeout: 25_000 });
  await page.getByTestId("focus-placement-launcher").getByRole("button", { name: /정밀 배치 시작/ }).first().click();
  const hud = page.getByTestId("focus-placement-hud");
  await hud.waitFor({ state: "visible", timeout: 25_000 });

  const inputs = hud.locator("input");
  if (input.uMm !== undefined) await inputs.nth(0).fill(String(input.uMm));
  if (input.vMm !== undefined) await inputs.nth(1).fill(String(input.vMm));
  if (input.rotationDeg !== undefined) await inputs.nth(2).fill(String(input.rotationDeg));
  if (input.normalOffsetMm !== undefined) await inputs.nth(3).fill(String(input.normalOffsetMm));

  await hud.getByText("Surface").first().click({ force: true });
  await page.keyboard.press("Alt+ArrowRight");
  await hud.getByRole("button", { name: "확정" }).click();
  await hud.waitFor({ state: "hidden", timeout: 25_000 });
  const placement = await waitForRuntimePlacement(page, {
    catalogItemId: input.catalogItemId,
    supportObjectId: "desk-1",
    attachmentType: input.attachmentType
  });
  console.log(`[e2e] placement:commit ${input.catalogItemId} ${placement.placement.surfaceId}`);
  return placement;
}

async function runWalkPlacementSaveShareFlow(
  page: Page,
  baseUrl: URL,
  seed: Awaited<ReturnType<typeof createFunctionalProjectSeed>>,
  results: StageResult[]
) {
  await loginBrowserUser(page, baseUrl, seed.email, seed.password);
  await page.goto(new URL(`/project/${seed.projectId}`, baseUrl).toString(), { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "워크뷰" }).click();
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
  results.push({
    stage: "walk-view-entry",
    ok: true,
    detail: `opened project ${seed.projectId} in walk view`
  });

  const keyboardPlacement = await addAndCommitWalkPlacement(page, {
    label: "P2S 75% 화이트 키보드",
    catalogItemId: "p2s_keyboard_75_white",
    attachmentType: "place_on_surface",
    search: "75% 화이트 키보드",
    uMm: -180,
    vMm: 70,
    rotationDeg: 0
  });
  const mousePlacement = await addAndCommitWalkPlacement(page, {
    label: "P2S 버티컬 마우스",
    catalogItemId: "p2s_mouse_vertical_black",
    attachmentType: "place_on_surface",
    search: "버티컬 마우스",
    uMm: 190,
    vMm: 75,
    rotationDeg: 0
  });
  const trayPlacement = await addAndCommitWalkPlacement(page, {
    label: "P2S 메쉬 케이블 트레이 600",
    catalogItemId: "p2s_cable_tray_mesh_600",
    attachmentType: "underside_screw",
    search: "메쉬 케이블 트레이",
    uMm: 0,
    vMm: 0,
    normalOffsetMm: 90
  });
  const clipPlacement = await addAndCommitWalkPlacement(page, {
    label: "P2S 엣지 케이블 클립 싱글",
    catalogItemId: "p2s_cable_clip_edge_single",
    attachmentType: "edge_clamp",
    search: "엣지 케이블 클립",
    uMm: -260,
    vMm: 0
  });
  results.push({
    stage: "walk-placement-commit",
    ok: true,
    detail: `keyboard=${keyboardPlacement.placement.surfaceId}, mouse=${mousePlacement.placement.surfaceId}, tray=${trayPlacement.placement.surfaceId}, clip=${clipPlacement.placement.surfaceId}`
  });
  console.log("[e2e] placement:all-committed");

  const saveButton = page.getByTestId("project-save-button");
  await saveButton.waitFor({ state: "attached", timeout: 20_000 });
  let savePath = "autosave";
  if (await saveButton.isEnabled()) {
    savePath = "manual button";
    await saveButton.evaluate((element) => {
      const button = element as HTMLButtonElement;
      if (!button.disabled) {
        button.click();
      }
    });
    await page.waitForTimeout(2_500);
  } else {
    await page.waitForTimeout(500);
  }
  results.push({
    stage: "walk-placement-save",
    ok: true,
    detail: `saved ${seed.projectId} through ${savePath}`
  });
  console.log(`[e2e] save:complete ${savePath}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  console.log("[e2e] reload:domcontentloaded");
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.locator('[role="status"][aria-busy="true"]').waitFor({ state: "hidden", timeout: 30_000 }).catch(() => null);
  await page.getByRole("button", { name: "워크뷰" }).click();
  await waitForRuntimePlacement(page, {
    catalogItemId: "p2s_cable_tray_mesh_600",
    supportObjectId: "desk-1",
    attachmentType: "underside_screw"
  });
  await waitForRuntimePlacement(page, {
    catalogItemId: "p2s_cable_clip_edge_single",
    supportObjectId: "desk-1",
    attachmentType: "edge_clamp"
  });
  results.push({
    stage: "walk-placement-reload",
    ok: true,
    detail: "surface-local placements persisted after reload"
  });

  await page.getByLabel("공유").click();
  await page.getByText("읽기 전용 공유 설정").waitFor({ state: "visible", timeout: 20_000 });
  await page.locator("select").selectOption("permanent");
  const shareResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/projects/${seed.projectId}/shares`) &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "스냅샷 링크 만들기" }).click();
  const share = await shareResponse;
  if (!share.ok()) {
    throw new Error(`share creation failed: ${share.status()} ${await share.text().catch(() => "")}`);
  }
  const sharePayload = await share.json();
  const token = sharePayload?.share?.token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("share response did not include a token");
  }
  seed.artifacts.token = token;

  await page.goto(new URL(`/shared/${token}`, baseUrl).toString(), { waitUntil: "domcontentloaded" });
  await page.locator("canvas").first().waitFor({ state: "visible", timeout: 30_000 });
  await page.getByText(/읽기 전용|쇼케이스/).first().waitFor({ state: "visible", timeout: 25_000 });
  await waitForRuntimePlacement(page, {
    catalogItemId: "p2s_keyboard_75_white",
    supportObjectId: "desk-1",
    attachmentType: "place_on_surface"
  });
  await waitForRuntimePlacement(page, {
    catalogItemId: "p2s_cable_tray_mesh_600",
    supportObjectId: "desk-1",
    attachmentType: "underside_screw"
  });
  results.push({
    stage: "shared-viewer-placement",
    ok: true,
    detail: `/shared/${token} reproduces desktop and underside placements`
  });

  await page.screenshot({ path: path.join(OUTPUT_DIR, "local-functional-shared-viewer.png"), fullPage: true });
}

async function run() {
  loadFunctionalEnv();
  const baseUrl = new URL(getArg("base-url", process.env.E2E_FUNCTIONAL_BASE_URL ?? "http://127.0.0.1:3100"));
  const results: StageResult[] = [];
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const devServer = await maybeStartDevServer(baseUrl);
  const browser = await chromium.launch({ headless: !hasArg("headed") });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const seed = await createFunctionalProjectSeed();

  try {
    await page.goto(new URL("/studio/builder", baseUrl).toString(), { waitUntil: "networkidle" });
    results.push(await expectText(page, "모양 및 크기 설정하기", "new-room-builder-entry"));
    await clickNext(page);
    results.push(await expectText(page, "치수 조정하기", "room-size-step"));
    await clickNext(page);
    results.push(await expectText(page, "문과 창문 추가하기", "openings-step"));
    await clickNext(page);
    results.push(await expectText(page, "방 스타일 선택하기", "material-step"));

    const wallCount = await countButtonsInSection(page, "벽 색상");
    const floorCount = await countButtonsInSection(page, "바닥 스타일");
    if (wallCount < 10 || floorCount < 11) {
      throw new Error(`material options too shallow: wall=${wallCount}, floor=${floorCount}`);
    }
    results.push({
      stage: "material-options",
      ok: true,
      detail: `wall=${wallCount}, floor=${floorCount}`
    });

    await page.getByRole("button", { name: "Terrazzo Wallpaper" }).click();
    await page.getByRole("button", { name: "Cork Desk Studio" }).click();
    results.push({
      stage: "material-selection",
      ok: true,
      detail: "selected wall=Terrazzo Wallpaper, floor=Cork Desk Studio"
    });

    const canvas = page.locator("canvas").first();
    await canvas.waitFor({ state: "visible", timeout: 20_000 });
    const screenshotPath = path.join(OUTPUT_DIR, "local-functional-room-flow.png");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    const screenshotSize = fs.statSync(screenshotPath).size;
    if (screenshotSize < 12_000) {
      throw new Error(`canvas screenshot is unexpectedly small: ${screenshotSize} bytes`);
    }
    results.push({
      stage: "room-preview-render",
      ok: true,
      detail: screenshotPath
    });

    await clickNext(page);
    results.push(await expectText(page, "조명 분위기 선택하기", "lighting-step"));
    await page.getByRole("button", { name: /Indirect Lighting|간접/ }).click();
    results.push({
      stage: "lighting-selection",
      ok: true,
      detail: "indirect lighting selected"
    });

    await runWalkPlacementSaveShareFlow(page, baseUrl, seed, results);
  } catch (error) {
    results.push({
      stage: "blocked",
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    });
    throw error;
  } finally {
    await page.screenshot({ path: path.join(OUTPUT_DIR, "local-functional-room-flow-final.png"), fullPage: true });
    await browser.close();
    await cleanupArtifacts(seed.admin, seed.artifacts);
    await stopDevServer(devServer);
    console.log(JSON.stringify({ baseUrl: baseUrl.toString(), results }, null, 2));
  }
}

run().catch(() => {
  process.exitCode = 1;
});
