import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../types/database";
import { createProjectVersion } from "../src/lib/server/project-versions";
import { createProjectForOwner } from "../src/lib/server/projects";
import { createProjectShare } from "../src/lib/server/shares";

const ROUTES = [
  { name: "builder", path: "/studio/builder" },
  { name: "studio-home", path: "/studio" },
  { name: "gallery", path: "/gallery" },
  { name: "community", path: "/community" }
];

const FLOW_REQUIRED_ENVS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY"
] as const;

type Mode = "smoke" | "contract" | "flow";

type RouteResult = {
  route: string;
  status: number;
  ok: boolean;
  reason?: string;
};

type FlowArtifacts = {
  ownerId: string | null;
  projectId: string | null;
  shareId: string | null;
  token: string | null;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(SCRIPT_DIR, "..");

function getArg(name: string, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function hasArg(name: string) {
  return process.argv.includes(`--${name}`);
}

function parseMode(raw: string): Mode {
  if (raw === "contract") return "contract";
  if (raw === "flow") return "flow";
  return "smoke";
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\\r?\\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    if (!key || (process.env[key] !== undefined && process.env[key] !== "")) continue;
    const value = line.slice(idx + 1).trim();
    process.env[key] = value;
  }
}

function isEnvMissing(name: (typeof FLOW_REQUIRED_ENVS)[number]) {
  const value = process.env[name];
  return !value || value.trim().length === 0;
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

function loadFlowEnvFallback() {
  if (!FLOW_REQUIRED_ENVS.some((key) => isEnvMissing(key))) return;

  const candidates = [
    path.join(WEB_ROOT, ".env.local"),
    path.join(path.resolve(WEB_ROOT, ".."), ".env.local"),
    path.join(path.resolve(WEB_ROOT, "..", ".."), ".env.local"),
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), "apps", "web", ".env.local")
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const raw = fs.readFileSync(candidate, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const envMatch = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!envMatch) continue;
      const key = envMatch[1] as (typeof FLOW_REQUIRED_ENVS)[number];
      if (!FLOW_REQUIRED_ENVS.includes(key)) continue;
      if (!isEnvMissing(key)) continue;
      process.env[key] = normalizeEnvRawValue(envMatch[2] ?? "");
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkRoute(baseUrl: URL, route: string): Promise<RouteResult> {
  const target = new URL(route, baseUrl);
  try {
    const response = await fetch(target.toString(), {
      headers: {
        "user-agent": "deskterioronline-room-first-e2e/1.0"
      },
      redirect: "manual"
    });

    return {
      route,
      status: response.status,
      ok: response.ok || response.status === 303 || response.status === 302,
      reason: response.ok || response.status === 303 || response.status === 302 ? undefined : `${response.status} ${response.statusText}`
    };
  } catch (error) {
    return {
      route,
      status: 0,
      ok: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

async function pageContains(baseUrl: URL, route: string, pattern: string, attempts = 10) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(new URL(route, baseUrl), {
      headers: { "user-agent": "deskterioronline-room-first-e2e/1.0" }
    });

    const text = await response.text();
    if (response.ok && text.includes(pattern)) {
      return true;
    }

    await sleep(500);
  }

  return false;
}

function buildVersionPayload() {
  const roomShell = {
    scale: 1,
    scaleInfo: {
      value: 1,
      source: "user_measure",
      confidence: 0.9,
      evidence: { notes: "scripted-e2e" }
    },
    walls: [
      { id: "wall-1", start: [0, 0], end: [6, 0], thickness: 0.2, height: 2.8 },
      { id: "wall-2", start: [6, 0], end: [6, 4], thickness: 0.2, height: 2.8 },
      { id: "wall-3", start: [6, 4], end: [0, 4], thickness: 0.2, height: 2.8 },
      { id: "wall-4", start: [0, 4], end: [0, 0], thickness: 0.2, height: 2.8 }
    ],
    openings: [
      {
        id: "opening-door-main",
        wallId: "wall-1",
        type: "door",
        offset: 0.8,
        width: 0.9,
        height: 2.1,
        verticalOffset: 0,
        isEntrance: true
      },
      {
        id: "opening-window-main",
        wallId: "wall-2",
        type: "window",
        offset: 1.0,
        width: 1.4,
        height: 1.2,
        sillHeight: 0.9
      }
    ],
    floors: [
      {
        id: "floor-main",
        outline: [
          [0, 0],
          [6, 0],
          [6, 4],
          [0, 4]
        ],
        materialId: null
      }
    ],
    ceilings: [],
    rooms: [],
    cameraAnchors: [],
    navGraph: {
      nodes: [],
      edges: []
    },
    entranceId: "opening-door-main"
  };

  return {
    message: "E2E primary room flow",
    roomShell,
    assets: [
      {
        id: "asset-chair-1",
        assetId: "placeholder:chair",
        anchorType: "floor",
        position: [2.2, 0, 1.4],
        rotation: [0, 0.3, 0],
        scale: [1, 1, 1],
        materialId: null,
        catalogItemId: "chair"
      }
    ],
    materials: {
      wallIndex: 1,
      floorIndex: 0
    },
    lighting: {
      ambientIntensity: 0.38,
      hemisphereIntensity: 0.42,
      directionalIntensity: 1.04,
      environmentBlur: 0.2
    },
    assetSummary: {
      totalAssets: 1,
      highlightedItems: [
        {
          catalogItemId: "chair",
          assetId: "placeholder:chair",
          label: "Minimalist Chair",
          category: "Seating",
          collection: "Social Layer",
          tone: "sand" as const,
          count: 1
        }
      ],
      collections: [{ label: "Social Layer", count: 1 }],
      uncataloguedCount: 0,
      primaryTone: "sand" as const,
      primaryCollection: "Social Layer"
    },
    projectName: "E2E 룸 빌더 프로젝트",
    projectDescription: "primary room-first flow regression"
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

async function runFullPrimaryFlow(baseUrl: URL) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const publicClient = createClient<Database>(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const artifacts: FlowArtifacts = {
    ownerId: null,
    projectId: null,
    shareId: null,
    token: null
  };

  try {
    const email = `tmp-room-flow-${Date.now()}-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const password = "Passw0rd!123456";

    const createdUser = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createdUser.error || !createdUser.data.user) {
      throw createdUser.error ?? new Error("Failed to create temporary user.");
    }

    artifacts.ownerId = createdUser.data.user.id;

    const login = await publicClient.auth.signInWithPassword({ email, password });
    if (login.error || !login.data.session) {
      throw login.error ?? new Error("Temporary user sign-in failed.");
    }

    const project = await createProjectForOwner(admin, artifacts.ownerId, {
      name: "E2E Primary Room",
      description: "room-first primary flow validation"
    });

    artifacts.projectId = project.id;
    console.log("[PASS] 1) 새 방 만들기 완료");

    const versionPayload = buildVersionPayload();
    if (!Number.isFinite(versionPayload.roomShell.scale) || versionPayload.roomShell.walls.length < 4) {
      throw new Error("Invalid room shell payload for dimension step.");
    }
    console.log("[PASS] 2) 치수 조정하기 계약 데이터 확인");

    const hasDoor = versionPayload.roomShell.openings.some((opening) => opening.type === "door");
    const hasWindow = versionPayload.roomShell.openings.some((opening) => opening.type === "window");
    if (!hasDoor || !hasWindow) {
      throw new Error("Opening step payload is missing door or window.");
    }
    console.log("[PASS] 3) 문/창문 추가하기 계약 데이터 확인");

    const version = await createProjectVersion(publicClient, {
      projectId: artifacts.projectId,
      ownerId: artifacts.ownerId,
      payload: versionPayload
    });

    const versionId =
      typeof version === "object" && version && "id" in (version as Record<string, unknown>)
        ? String((version as Record<string, unknown>).id)
        : "unknown";

    if (versionPayload.materials.wallIndex < 0 || versionPayload.materials.floorIndex < 0) {
      throw new Error("Style step payload is invalid.");
    }
    const editorRoute = await checkRoute(baseUrl, `/project/${artifacts.projectId}`);
    if (!editorRoute.ok) {
      throw new Error(`Editor route check failed: ${editorRoute.status} ${editorRoute.reason ?? ""}`);
    }
    console.log("[PASS] 4) 스타일 선택 후 에디터 진입 경로 확인");

    if (versionPayload.assets.length === 0) {
      throw new Error("Asset payload is empty.");
    }
    console.log("[PASS] 5) 가구 추가하기 데이터 확인");

    const firstAsset = versionPayload.assets[0];
    const moved = Math.abs(firstAsset.position[0]) > 0.01 || Math.abs(firstAsset.position[2]) > 0.01;
    const rotated = Math.abs(firstAsset.rotation[1]) > 0.01;
    if (!moved || !rotated) {
      throw new Error("Asset move/rotate payload is not configured.");
    }
    console.log("[PASS] 6) 가구 이동/회전 데이터 확인");

    const share = await createProjectShare(publicClient, {
      projectId: artifacts.projectId,
      ownerId: artifacts.ownerId,
      shareType: "permanent",
      permissions: "view",
      publishToGallery: true
    });

    artifacts.shareId = share.id;
    artifacts.token = share.token;

    const shareRow = await admin
      .from("shared_projects")
      .select("id, project_version_id, permissions, is_gallery_visible")
      .eq("id", artifacts.shareId)
      .maybeSingle();

    if (shareRow.error || !shareRow.data) {
      throw new Error(shareRow.error?.message ?? "Failed to verify shared project row.");
    }

    if (!shareRow.data.project_version_id || shareRow.data.permissions !== "view" || !shareRow.data.is_gallery_visible) {
      throw new Error("Shared project row is not in expected read-only published state.");
    }
    console.log("[PASS] 7) 저장/발행 상태 및 gallery publish 상태 검증 완료");

    const sharedRoute = await checkRoute(baseUrl, `/shared/${share.token}`);
    if (!sharedRoute.ok) {
      throw new Error(`Shared route check failed: ${sharedRoute.status} ${sharedRoute.reason ?? ""}`);
    }
    console.log("[PASS] 8) shared token 열기 확인");

    const sharedHasInspectorText = await pageContains(baseUrl, `/shared/${share.token}`, "제품 정보", 8);
    if (!sharedHasInspectorText) {
      throw new Error("Shared viewer page did not render product inspector text.");
    }
    console.log("[PASS] 9) 읽기 전용 뷰어 제품 클릭/인스펙터 표면 확인");

    const galleryRoute = await checkRoute(baseUrl, "/gallery");
    if (!galleryRoute.ok) {
      throw new Error("Gallery route is not reachable.");
    }
    const communityRoute = await checkRoute(baseUrl, "/community");
    if (!communityRoute.ok) {
      throw new Error("Community route is not reachable.");
    }
    console.log("[PASS] 10) gallery/community 동일 뷰어 진입 경로(contract) 확인");

    return {
      projectId: artifacts.projectId,
      shareId: artifacts.shareId,
      token: artifacts.token,
      versionId
    };
  } finally {
    await cleanupArtifacts(admin, artifacts);
  }
}

function printGuide(mode: Mode, failures: number) {
  if (failures === 0) {
    console.log(`room-first contract checks passed (mode=${mode})`);
    return;
  }

  console.error("Room-first primary UX E2E를 strict 모드로 실행하려면 접근 가능한 base URL을 준비하세요.");
  console.error("권장 env:");
  console.error("  - E2E_ROOM_FLOW_BASE_URL (예: http://127.0.0.1:3100)");
  console.error("  - E2E_ROOM_FLOW_SHARED_TOKEN (선택)");
  console.error("  - E2E_ROOM_FLOW_PROJECT_ID (선택)");
  console.error("  - NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY (flow 모드)");
  console.error("실행 예시:");
  console.error("  E2E_ROOM_FLOW_STRICT=1 npm --workspace apps/web run primary:e2e:room-flow:strict");
  console.error("  npm --workspace apps/web run primary:e2e:room-flow:full");

  console.error(`strict 검증 실패: ${failures}개 항목 실패`);
  process.exit(1);
}

async function runRouteChecks(baseUrl: URL) {
  const results: RouteResult[] = [];

  for (const route of ROUTES) {
    const result = await checkRoute(baseUrl, route.path);
    results.push(result);
    const status = result.ok ? "PASS" : "FAIL";
    console.log(`[${status}] ${route.name}: ${route.path} -> ${result.status}`);
    if (!result.ok) {
      console.log(`  - ${result.reason}`);
    }
  }

  return results;
}

async function main() {
  // Match Next.js env resolution so standalone E2E runs behave like the app.
  loadEnvConfig(WEB_ROOT);
  loadEnvFile(path.join(WEB_ROOT, ".env.local"));
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  loadEnvFile(path.join(process.cwd(), "apps/web/.env.local"));
  loadFlowEnvFallback();

  const baseUrlInput = getArg("base-url", process.env.E2E_ROOM_FLOW_BASE_URL || "http://127.0.0.1:3100");
  const mode = parseMode(getArg("mode", "smoke"));
  const strict = hasArg("strict") || process.env.E2E_ROOM_FLOW_STRICT === "1";

  const baseUrl = new URL(baseUrlInput);

  const sharedToken = process.env.E2E_ROOM_FLOW_SHARED_TOKEN;
  const editorProjectId = process.env.E2E_ROOM_FLOW_PROJECT_ID;

  const routeResults = await runRouteChecks(baseUrl);

  if (sharedToken) {
    const sharedResult = await checkRoute(baseUrl, `/shared/${sharedToken}`);
    routeResults.push(sharedResult);
    const status = sharedResult.ok ? "PASS" : "WARN";
    console.log(`[${status}] shared-token: /shared/${sharedToken} -> ${sharedResult.status}`);
    if (!sharedResult.ok) {
      console.log(`  - ${sharedResult.reason}`);
    }
  }

  if (editorProjectId) {
    const projectResult = await checkRoute(baseUrl, `/project/${editorProjectId}`);
    routeResults.push(projectResult);
    const status = projectResult.ok ? "PASS" : "WARN";
    console.log(`[${status}] project-route: /project/${editorProjectId} -> ${projectResult.status}`);
    if (!projectResult.ok) {
      console.log(`  - ${projectResult.reason}`);
    }
  }

  let failures = routeResults.filter((entry) => !entry.ok).length;

  const shouldRunFlow = mode === "flow" || process.env.E2E_ROOM_FLOW_FULL === "1";

  if (shouldRunFlow) {
    try {
      const flow = await runFullPrimaryFlow(baseUrl);
      console.log(`[PASS] full-flow completed: project=${flow.projectId}, version=${flow.versionId}, share=${flow.shareId}`);
    } catch (error) {
      failures += 1;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Missing required env")) {
        console.error(
          "[FAIL] full-flow: flow 모드는 Supabase env가 필요합니다. (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)"
        );
      } else {
        console.error(`[FAIL] full-flow: ${message}`);
      }
    }
  }

  if (mode === "contract") {
    if (strict) {
      printGuide(mode, failures);
      return;
    }

    if (failures > 0) {
      console.log(`계약점검 경고: ${failures}개 항목에서 실패가 있습니다.`);
      console.log("권장: E2E_ROOM_FLOW_STRICT=1로 재실행해 CI fail-fast로 확인하세요.");
    } else {
      console.log("contract point-pass: route shell 접근성이 확보되었습니다.");
    }
  }

  if (!strict && mode === "smoke" && !shouldRunFlow) {
    console.log("[SKIP] room-first smoke 모드는 실패를 실패로 간주하지 않고 점검 리포트를 종료합니다.");
    console.log("강제 실패가 필요한 경우 E2E_ROOM_FLOW_STRICT=1 또는 --mode=contract로 실행하세요.");
    return;
  }

  if (failures > 0) {
    process.exitCode = 1;
    console.error(`room-first ${mode} checks failed: ${failures}`);
  } else {
    console.log(`room-first ${mode} checks passed`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
