import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";
import { MESHY_COMMUNITY_ASSETS } from "../src/lib/qa/meshy-community-assets";

const EXPECTED_ASSEMBLY_STEPS = [
  "workspace-prep",
  "motherboard-on-box",
  "socket-lever-opened",
  "cpu-aligned",
  "cpu-seated",
  "cpu-retention-locked",
  "m2-heatsink-removed",
  "ssd-inserted",
  "m2-screw-tightened",
  "m2-heatsink-reinstalled",
  "ram-latches-opened",
  "ram-a2-inserted",
  "ram-b2-inserted",
  "case-side-panels-removed",
  "case-standoffs-checked",
  "io-shield-aligned",
  "motherboard-lowered",
  "motherboard-screws-tightened",
  "psu-bracket-mounted",
  "psu-mounted",
  "atx-24pin-connected",
  "eps-8pin-connected",
  "cooler-brackets-mounted",
  "thermal-paste-applied",
  "pump-block-mounted",
  "radiator-mounted",
  "radiator-fans-connected",
  "case-fans-mounted",
  "front-panel-connected",
  "usb-audio-connected",
  "gpu-slot-covers-removed",
  "gpu-inserted",
  "gpu-power-connected",
  "cable-management-tied",
  "side-panels-closed",
  "external-cables-connected",
  "first-boot-powered",
  "bios-post-confirmed"
] as const;

const EXPECTED_CASE_ID = "lian-li-o11d-mini-v2-flow-white";
const EXPECTED_ROOM_SETUP_STEPS = [
  "pc-placed-on-desk",
  "monitor-mounted",
  "keyboard-mouse-placed",
  "microphone-arm-clamped",
  "lamp-positioned",
  "plant-and-books-styled",
  "collectibles-stacked",
  "wall-leds-enabled",
  "media-console-styled",
  "sofa-zone-styled",
  "room-lighting-set"
] as const;

type CompletedAssemblyStep = (typeof EXPECTED_ASSEMBLY_STEPS)[number];
type CompletedRoomSetupStep = (typeof EXPECTED_ROOM_SETUP_STEPS)[number];
type FlowStep = "not-started" | CompletedAssemblyStep | CompletedRoomSetupStep;
type PcCaseId = typeof EXPECTED_CASE_ID;

type PcAssemblyPayload = {
  version: 1;
  savedAt: string;
  mode: "pc-assembly-workbench";
  currentStep: FlowStep;
  selectedCase: {
    id: PcCaseId;
    label: string;
    maker: string;
    fit: string;
    finish: string;
  };
  completedSteps: CompletedAssemblyStep[];
  totalSteps: number;
  components: {
    caseOpen: boolean;
    psuMounted: boolean;
    motherboardMounted: boolean;
    cpuSeated: boolean;
    thermalPasteApplied: boolean;
    coolerMounted: boolean;
    ramInserted: boolean;
    ssdInstalled: boolean;
    gpuInstalled: boolean;
    fanInstalled: boolean;
    cablesManaged: boolean;
    firstBootPassed: boolean;
  };
  roomSetup: {
    currentStep: "not-started" | CompletedRoomSetupStep;
    completedSteps: CompletedRoomSetupStep[];
    totalSteps: number;
    pcPlacedOnDesk: boolean;
    deskStyled: boolean;
    roomStyled: boolean;
    brunoSimonMood: boolean;
  };
  interactions: {
    thermalPasteCoverage: number;
    audioEvents: string[];
    keyboardSwitchProfile?: string;
    keyboardSwitchEvents?: string[];
    keyboardLastPressedTargetId?: string | null;
  };
  pcSystem: {
    compatibilityStatus: "pass" | "warning" | "fail";
    compatibilityChecks: number;
    physicalFitStatus: "pass" | "warning" | "fail";
    physicalFitChecks: number;
    attachmentAnchors: number;
    occupiedAttachmentAnchors: number;
    stateMachineComplete: boolean;
    uniqueCompletedAnchorCount: number;
  };
  quote: {
    productNo: "1336041";
    productUrl: string;
    parts: Array<{ category: string; label: string; slot: string }>;
  };
};

type PcAssemblyQaRegistry = {
  currentStep: FlowStep;
  selectedCaseId: PcCaseId | null;
  caseSelectionComplete: boolean;
  completedSteps: CompletedAssemblyStep[];
  stepCount: number;
  totalSteps: number;
  completedRoomSteps: CompletedRoomSetupStep[];
  roomCurrentStep: "not-started" | CompletedRoomSetupStep;
  roomStepCount: number;
  totalRoomSteps: number;
  caseOpen: boolean;
  psuMounted: boolean;
  motherboardMounted: boolean;
  cpuSeated: boolean;
  thermalPasteApplied: boolean;
  coolerMounted: boolean;
  ramInserted: boolean;
  ssdInstalled: boolean;
  gpuInstalled: boolean;
  fanInstalled: boolean;
  cablesManaged: boolean;
  firstBootPassed: boolean;
  pcPlacedOnDesk: boolean;
  deskStyled: boolean;
  roomStyled: boolean;
  brunoSimonMood: boolean;
  thermalPasteCoverage: number;
  audioEvents: string[];
  keyboardSwitchProfile?: string;
  keyboardSwitchEvents?: string[];
  keyboardLastPressedTargetId?: string | null;
  savedPayload: PcAssemblyPayload | null;
  pcSystem: PcAssemblyPayload["pcSystem"];
  flowComplete: boolean;
  checklistComplete: boolean;
};

type BrunoSurfaceMaterialRuntimeQa = {
  texturePackageUrl: string;
  ktx2PackageConsumed: boolean;
  loadedRoles: string[];
  requestedTextureUrls: Record<string, string>;
  enhancedMaterialNames: string[];
  aoUv2ReadyMeshCount: number;
  uv2PatchedMeshCount: number;
};

type BrunoFurnitureMaterialRuntimeQa = BrunoSurfaceMaterialRuntimeQa;

type CanvasMetrics = {
  width: number;
  height: number;
  uniqueColorBuckets: number;
  luminanceStdDev: number;
  meanAlpha: number;
  brightPixelRatio: number;
  clippedHighlightRatio: number;
};

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..", "..");
const OUTPUT_DIR = path.join(REPO_ROOT, "output", "playwright");
const NPM_BIN = process.platform === "win32" ? "npm.cmd" : "npm";
const DEFAULT_BASE_URL = "http://127.0.0.1:3100";
const PC_ASSEMBLY_ROUTE = "/labs/qa/pc-assembly-workbench";
const PC_ASSEMBLY_QA_PATH = `${PC_ASSEMBLY_ROUTE}?qaNoLoader=1`;
const QA_VERBOSE = process.env.PC_ASSEMBLY_QA_VERBOSE === "1";
const PC_ASSEMBLY_PAGE_PATH = path.join(REPO_ROOT, "apps/web/src/app/labs/qa/pc-assembly-workbench/page.tsx");
const MESHY_BUILD_KIT_MODEL_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/models/compuzone_p2364w_pc_build_kit/compuzone_p2364w_pc_build_kit.glb"
);
const MESHY_BUILD_KIT_PROXY_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/models/compuzone_p2364w_pc_build_kit/compuzone_p2364w_pc_build_kit.proxy.glb"
);
const MESHY_BUILD_KIT_THUMBNAIL_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/catalog/thumbnails/compuzone_p2364w_pc_build_kit.webp"
);
const MESHY_BUILD_KIT_REPORT_PATH = path.join(
  REPO_ROOT,
  "assets/references/compuzone-p2364w-pc-build/meshy-compuzone-pc-build-kit-report.json"
);
const MESHY_ROOM_PREVIEW_MODEL_PATHS = [
  "apps/web/public/assets/models/p2s_meshy_pastel_mascot_stack/p2s_meshy_pastel_mascot_stack.proxy.glb",
  "apps/web/public/assets/models/p2s_video_so_ong_tfg40q14wp_monitor/p2s_video_so_ong_tfg40q14wp_monitor.proxy.glb",
  "apps/web/public/assets/models/p2s_video_so_ong_reproducer_epic5/p2s_video_so_ong_reproducer_epic5.proxy.glb",
  "apps/web/public/assets/models/p2s_video_so_ong_ivy_planter/p2s_video_so_ong_ivy_planter.proxy.glb",
  "apps/web/public/assets/models/p2s_low_profile_keyboard/p2s_low_profile_keyboard.proxy.glb",
  "apps/web/public/assets/models/p2s_wireless_mouse/p2s_wireless_mouse.proxy.glb",
  "apps/web/public/assets/models/p2s_desk_lamp_glow/p2s_desk_lamp_glow.proxy.glb",
  "apps/web/public/assets/models/p2s_ceramic_mug/p2s_ceramic_mug.proxy.glb",
  "apps/web/public/assets/models/p2s_book_stack_warm/p2s_book_stack_warm.proxy.glb",
  "apps/web/public/assets/models/p2s_video_so_ong_charging_reel_cable/p2s_video_so_ong_charging_reel_cable.proxy.glb",
  "apps/web/public/assets/models/p2s_video_so_ong_divoom_times_gate/p2s_video_so_ong_divoom_times_gate.proxy.glb",
  "apps/web/public/assets/models/p2s_video_so_ong_hyte_y70_snow_white/p2s_video_so_ong_hyte_y70_snow_white.proxy.glb",
  "apps/web/public/assets/models/modern_coffee_table_02/modern_coffee_table_02_1k.gltf",
  "apps/web/public/assets/models/steel_frame_shelves_03/steel_frame_shelves_03_1k.gltf"
].map((relativePath) => path.join(REPO_ROOT, relativePath));
const BLENDER_ROOM_DETAIL_KIT_MODEL_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/models/p2s_bruno_room_detail_kit/p2s_bruno_room_detail_kit.glb"
);
const BLENDER_ROOM_DETAIL_KIT_REPORT_PATH = path.join(
  REPO_ROOT,
  "assets/references/blender-authored/bruno-room-detail-kit/asset-review-2026-05-19.json"
);
const BLENDER_ROOM_SURFACE_KIT_MODEL_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/models/p2s_bruno_room_surface_kit/p2s_bruno_room_surface_kit.glb"
);
const BLENDER_ROOM_SURFACE_KIT_REPORT_PATH = path.join(
  REPO_ROOT,
  "assets/references/blender-authored/bruno-room-surface-kit/asset-review-2026-05-19.json"
);
const BRUNO_ROOM_SURFACE_RUNTIME_DESCRIPTOR_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/catalog/runtime-packages/p2s_bruno_room_surface_kit.json"
);
const BRUNO_ROOM_SURFACE_RUNTIME_INDEX_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/catalog/runtime-packages.json"
);
const BRUNO_ROOM_SURFACE_PUBLIC_TEXTURE_MANIFEST_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/models/p2s_bruno_room_surface_kit/texture-package-2026-05-19.json"
);
const BLENDER_FURNITURE_HERO_KIT_MODEL_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/models/p2s_bruno_furniture_hero_kit/p2s_bruno_furniture_hero_kit.glb"
);
const BLENDER_FURNITURE_HERO_KIT_REPORT_PATH = path.join(
  REPO_ROOT,
  "assets/references/blender-authored/bruno-furniture-hero-kit/asset-review-2026-05-19.json"
);
const BRUNO_FURNITURE_HERO_PUBLIC_TEXTURE_MANIFEST_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/models/p2s_bruno_furniture_hero_kit/texture-package-2026-05-19.json"
);
const BRUNO_ASSET_BENCHMARK_LEDGER_PATH = path.join(
  REPO_ROOT,
  "assets/references/blender-authored/bruno-furniture-hero-kit/benchmark-ledger-2026-05-19.json"
);
const BRUNO_ASSET_BENCHMARK_CONTACT_SHEET_PATH = path.join(
  REPO_ROOT,
  "output/visual-qa/bruno-room-asset-benchmark-contact-sheet.png"
);
const COMMERCIAL_TASK_CHAIR_MODEL_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/models/p2s_commercial_task_chair_hero_v1/p2s_commercial_task_chair_hero_v1.glb"
);
const COMMERCIAL_TASK_CHAIR_RUNTIME_PACKAGE_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/models/p2s_commercial_task_chair_hero_v1/runtime-package.json"
);
const COMMERCIAL_TASK_CHAIR_REVIEW_PATH = path.join(
  REPO_ROOT,
  "assets/references/blender-authored/commercial-task-chair-hero-v1/asset-review-2026-05-21.json"
);
const COMMERCIAL_TASK_CHAIR_MESHY_PROMPT_PACK_PATH = path.join(
  REPO_ROOT,
  "assets/references/blender-authored/commercial-task-chair-hero-v1/meshy-prompt-pack-2026-05-21.json"
);
const COMMERCIAL_DESK_ACCESSORY_KIT_MODEL_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/models/p2s_commercial_desk_accessory_kit_v2/p2s_commercial_desk_accessory_kit_v2.glb"
);
const COMMERCIAL_DESK_ACCESSORY_KIT_RUNTIME_PACKAGE_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/models/p2s_commercial_desk_accessory_kit_v2/runtime-package.json"
);
const COMMERCIAL_DESK_ACCESSORY_KIT_REVIEW_PATH = path.join(
  REPO_ROOT,
  "assets/references/blender-authored/commercial-desk-accessory-kit-v2/asset-review-2026-05-21.json"
);
const COMMERCIAL_DESK_ACCESSORY_KIT_MESHY_PROMPT_PACK_PATH = path.join(
  REPO_ROOT,
  "assets/references/blender-authored/commercial-desk-accessory-kit-v2/meshy-prompt-pack-2026-05-21.json"
);
const MECHANICAL_KEYBOARD_SWITCH_LAB_MODEL_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/models/p2s_abko_ar108g_sage_green_keyboard_v1/p2s_abko_ar108g_sage_green_keyboard_v1.glb"
);
const MECHANICAL_KEYBOARD_SWITCH_LAB_RUNTIME_PACKAGE_PATH = path.join(
  REPO_ROOT,
  "apps/web/public/assets/models/p2s_abko_ar108g_sage_green_keyboard_v1/runtime-package.json"
);
const MECHANICAL_KEYBOARD_SWITCH_LAB_REVIEW_PATH = path.join(
  REPO_ROOT,
  "assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1/asset-review-2026-05-21.json"
);
const MECHANICAL_KEYBOARD_SWITCH_LAB_ISOMETRIC_PREVIEW_PATH = path.join(
  REPO_ROOT,
  "assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1/previews/abko-ar108g-v1-isometric.png"
);
const MESHY_COMMUNITY_MODEL_PATHS = [
  ...MESHY_COMMUNITY_ASSETS.map((asset) => path.join(REPO_ROOT, asset.sourceRelativePath))
];

function getArg(name: string, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.find((entry) => entry.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function logQa(message: string) {
  if (QA_VERBOSE) console.error(`[pc-assembly-qa] ${message}`);
}

async function isReachable(baseUrl: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(new URL(PC_ASSEMBLY_QA_PATH, baseUrl), {
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

function verifyMeshyBuildKitOutputs() {
  for (const assetPath of [MESHY_BUILD_KIT_MODEL_PATH, MESHY_BUILD_KIT_PROXY_PATH]) {
    assert.ok(fs.existsSync(assetPath), `${path.relative(REPO_ROOT, assetPath)} should exist`);
    assert.ok(fs.statSync(assetPath).size > 1024 * 1024, `${path.relative(REPO_ROOT, assetPath)} should contain a GLB`);
  }
  for (const assetPath of MESHY_ROOM_PREVIEW_MODEL_PATHS) {
    assert.ok(fs.existsSync(assetPath), `${path.relative(REPO_ROOT, assetPath)} should exist for room preview`);
    assert.ok(fs.statSync(assetPath).size > 1024, `${path.relative(REPO_ROOT, assetPath)} should contain a visible GLB`);
  }
  for (const assetPath of MESHY_COMMUNITY_MODEL_PATHS) {
    assert.ok(fs.existsSync(assetPath), `${path.relative(REPO_ROOT, assetPath)} should exist for Meshy community QA staging`);
    assert.ok(fs.statSync(assetPath).size > 1024, `${path.relative(REPO_ROOT, assetPath)} should contain a visible GLB`);
  }
  assert.ok(fs.existsSync(BLENDER_ROOM_DETAIL_KIT_MODEL_PATH), "Blender-authored room detail kit should exist");
  assert.ok(
    fs.statSync(BLENDER_ROOM_DETAIL_KIT_MODEL_PATH).size > 100 * 1024,
    "Blender-authored room detail kit should contain production-scale geometry"
  );
  assert.ok(fs.existsSync(BLENDER_ROOM_DETAIL_KIT_REPORT_PATH), "Blender-authored room detail review report should exist");
  const detailKitReport = JSON.parse(fs.readFileSync(BLENDER_ROOM_DETAIL_KIT_REPORT_PATH, "utf8")) as {
    schemaVersion?: string;
    metrics?: { objectCount?: number; materialCount?: number; triangleCount?: number };
    comparisonReview?: { knownGapsBeforeCommercialPromotion?: unknown[]; currentGrade?: string };
  };
  assert.equal(
    detailKitReport.schemaVersion,
    "deskterior-blender-authored-asset-review-v1",
    "Blender-authored detail kit report schema should match"
  );
  assert.ok((detailKitReport.metrics?.objectCount ?? 0) >= 40, "detail kit should preserve authored micro-object density");
  assert.ok((detailKitReport.metrics?.materialCount ?? 0) >= 8, "detail kit should preserve material variation");
  assert.ok((detailKitReport.metrics?.triangleCount ?? 0) <= 35_000, "detail kit should stay inside QA triangle budget");
  assert.ok(
    (detailKitReport.comparisonReview?.knownGapsBeforeCommercialPromotion?.length ?? 0) >= 3,
    "detail kit report should record commercial-promotion gaps"
  );
  assert.ok(fs.existsSync(BLENDER_ROOM_SURFACE_KIT_MODEL_PATH), "Blender-authored room surface kit should exist");
  assert.ok(
    fs.statSync(BLENDER_ROOM_SURFACE_KIT_MODEL_PATH).size > 1024 * 1024,
    "Blender-authored room surface kit should contain embedded texture atlases"
  );
  assert.ok(fs.existsSync(BLENDER_ROOM_SURFACE_KIT_REPORT_PATH), "Blender-authored room surface review report should exist");
  const surfaceKitReport = JSON.parse(fs.readFileSync(BLENDER_ROOM_SURFACE_KIT_REPORT_PATH, "utf8")) as {
    schemaVersion?: string;
    asset?: {
      textureSet?: {
        authoredMaps?: string[];
        generatedPbrMapCount?: number;
        ktx2Ready?: boolean;
        packedOrmMapCount?: number;
        packedOrmReady?: boolean;
      };
      bakedContactShadowPass?: {
        floorZones?: unknown[];
        wallZones?: unknown[];
        runtimeOverlayReplacement?: boolean;
      };
      wallRevealCleanupPass?: {
        lineOpacityBefore?: number;
        lineOpacityAfter?: number;
        softWashZones?: unknown[];
        gridOverlayRisk?: string;
        stillRequiresBrowserHumanReview?: boolean;
      };
      artDirectedGiPass?: {
        floorBounceZones?: unknown[];
        wallBounceZones?: unknown[];
        physicallyBaked?: boolean;
        runtimeOverlayReplacement?: boolean;
        stillRequiresPathTracedBake?: boolean;
      };
      cyclesAoBakePass?: {
        engine?: string;
        bakeType?: string;
        samples?: number;
        resolution?: unknown[];
        receiverSurfaces?: unknown[];
        blockerProxies?: unknown[];
        uvBakedProxy?: boolean;
        physicallyBakedAo?: boolean;
        pathTracedGi?: boolean;
        stillRequiresPathTracedGi?: boolean;
        stillRequiresFinalUvBake?: boolean;
      };
      texturePackagingPass?: {
        packageStatus?: string;
        packedOrmMapCount?: number;
        packedOrmMaps?: Array<{
          path?: string;
          channels?: { r?: string; g?: string; b?: string; a?: string };
          colorSpace?: string;
        }>;
        packedOrmChannels?: { r?: string; g?: string; b?: string; a?: string };
        ktx2Ready?: boolean;
        ktx2TranscodeAttempted?: boolean;
        toktxAvailable?: boolean;
        stillRequiresRuntimeKtx2Transcode?: boolean;
        stillRequiresFinalUvBake?: boolean;
        promotionBoundary?: string;
      };
    };
    outputs?: { texturePackageManifest?: string; texturePackageDirectory?: string };
    metrics?: { objectCount?: number; materialCount?: number; textureCount?: number; triangleCount?: number };
    comparisonReview?: { knownGapsBeforeCommercialPromotion?: unknown[]; currentGrade?: string };
  };
  assert.equal(
    surfaceKitReport.schemaVersion,
    "deskterior-blender-authored-asset-review-v1",
    "Blender-authored surface kit report schema should match"
  );
  assert.ok((surfaceKitReport.metrics?.objectCount ?? 0) >= 80, "surface kit should preserve authored surface density");
  assert.ok((surfaceKitReport.metrics?.materialCount ?? 0) >= 8, "surface kit should preserve material variation");
  assert.ok(
    (surfaceKitReport.metrics?.textureCount ?? 0) >= 13,
    "surface kit should include generated PBR/contact-shadow/bounce texture atlases"
  );
  assert.ok((surfaceKitReport.metrics?.triangleCount ?? 0) <= 25_000, "surface kit should stay inside QA triangle budget");
  assert.deepEqual(
    surfaceKitReport.asset?.textureSet?.authoredMaps,
    [
      "baseColor",
      "normal",
      "roughness",
      "ambientOcclusion",
      "contactShadowLightmap",
      "artDirectedBounceLightmap",
      "cyclesAoBakeLightmap",
      "packedOrm"
    ],
    "surface kit should report base/normal/roughness/AO/contact-shadow/art-directed-bounce/Cycles-AO/ORM map roles"
  );
  assert.ok(
    (surfaceKitReport.asset?.textureSet?.generatedPbrMapCount ?? 0) >= 19,
    "surface kit should report generated PBR, contact-shadow, wall-wash, bounce, Cycles AO, and packed ORM map count"
  );
  assert.ok(
    (surfaceKitReport.asset?.textureSet?.packedOrmMapCount ?? 0) >= 3,
    "surface kit should report packed ORM maps for wood, plaster, and trim"
  );
  assert.equal(
    surfaceKitReport.asset?.textureSet?.packedOrmReady,
    true,
    "surface kit should mark PNG ORM sidecar package readiness separately from KTX2 readiness"
  );
  assert.equal(
    surfaceKitReport.asset?.textureSet?.ktx2Ready,
    false,
    "surface kit should keep KTX2 readiness explicit until a transcode package exists"
  );
  assert.equal(
    surfaceKitReport.asset?.texturePackagingPass?.packageStatus,
    "orm-png-sidecar-ready-ktx2-pending",
    "surface kit should record ORM sidecar package status separately from final KTX2 release packaging"
  );
  assert.equal(
    surfaceKitReport.asset?.texturePackagingPass?.ktx2Ready,
    false,
    "surface kit texture package should not claim KTX2 readiness before transcode artifacts exist"
  );
  assert.equal(
    surfaceKitReport.asset?.texturePackagingPass?.ktx2TranscodeAttempted,
    false,
    "surface kit should not pretend a KTX2 transcode was attempted when toktx is unavailable"
  );
  assert.equal(
    surfaceKitReport.asset?.texturePackagingPass?.stillRequiresRuntimeKtx2Transcode,
    true,
    "surface kit texture package should keep KTX2 follow-up explicit"
  );
  assert.equal(
    surfaceKitReport.asset?.texturePackagingPass?.stillRequiresFinalUvBake,
    true,
    "surface kit texture package should keep final UV bake follow-up explicit"
  );
  assert.deepEqual(
    surfaceKitReport.asset?.texturePackagingPass?.packedOrmChannels,
    { r: "ambientOcclusion", g: "roughness", b: "metallic", a: "constantOne" },
    "surface kit ORM package should use the expected channel layout"
  );
  assert.ok(
    (surfaceKitReport.asset?.texturePackagingPass?.packedOrmMaps?.length ?? 0) >= 3,
    "surface kit texture package should list generated ORM sidecar maps"
  );
  assert.ok(
    surfaceKitReport.asset?.texturePackagingPass?.packedOrmMaps?.every((entry) => {
      return (
        entry.path &&
        fs.existsSync(path.join(REPO_ROOT, entry.path)) &&
        entry.channels?.r === "ambientOcclusion" &&
        entry.channels?.g === "roughness" &&
        entry.channels?.b === "metallic" &&
        entry.colorSpace === "Non-Color"
      );
    }),
    "surface kit ORM sidecar maps should exist and record channel semantics"
  );
  assert.ok(
    surfaceKitReport.outputs?.texturePackageManifest &&
      fs.existsSync(path.join(REPO_ROOT, surfaceKitReport.outputs.texturePackageManifest)),
    "surface kit should write a texture package manifest"
  );
  assert.ok(
    fs.existsSync(BRUNO_ROOM_SURFACE_RUNTIME_DESCRIPTOR_PATH),
    "surface kit should be published into runtime package descriptors"
  );
  assert.ok(
    fs.existsSync(BRUNO_ROOM_SURFACE_RUNTIME_INDEX_PATH),
    "runtime package index should exist for surface package lookup"
  );
  assert.ok(
    fs.existsSync(BRUNO_ROOM_SURFACE_PUBLIC_TEXTURE_MANIFEST_PATH),
    "surface kit should publish a public runtime texture package manifest"
  );
  const surfaceRuntimeDescriptor = JSON.parse(
    fs.readFileSync(BRUNO_ROOM_SURFACE_RUNTIME_DESCRIPTOR_PATH, "utf8")
  ) as {
    key?: string;
    runtimePath?: string;
    contractMetadata?: { textureSet?: { ktx2Ready?: boolean } };
    files?: { texturePackageManifest?: { path?: string; exists?: boolean; required?: boolean } };
    texturePackages?: Array<{
      kind?: string;
      status?: string;
      manifestPath?: string;
      ktx2Ready?: boolean;
      stillRequiresRuntimeKtx2Transcode?: boolean;
      stillRequiresFinalUvBake?: boolean;
      channels?: { r?: string; g?: string; b?: string; a?: string };
      maps?: Array<{ publicPath?: string; sourcePath?: string; exists?: boolean; ktx2Path?: string | null }>;
    }>;
    qa?: { status?: string; warnings?: string[] };
  };
  const surfaceRuntimeIndex = JSON.parse(fs.readFileSync(BRUNO_ROOM_SURFACE_RUNTIME_INDEX_PATH, "utf8")) as {
    assets?: Array<{
      key?: string;
      packagePath?: string;
      texturePackageStatus?: string;
      texturePackageCount?: number;
      ktx2Ready?: boolean;
      releaseEligible?: boolean;
    }>;
  };
  const surfacePublicTextureManifest = JSON.parse(
    fs.readFileSync(BRUNO_ROOM_SURFACE_PUBLIC_TEXTURE_MANIFEST_PATH, "utf8")
  ) as {
    packageStatus?: string;
    ktx2Ready?: boolean;
    stillRequiresRuntimeKtx2Transcode?: boolean;
    stillRequiresFinalUvBake?: boolean;
    maps?: Array<{
      publicPath?: string;
      ktx2Path?: string | null;
      exists?: boolean;
      channels?: { r?: string; g?: string; b?: string; a?: string };
    }>;
  };
  const runtimeTexturePackage = surfaceRuntimeDescriptor.texturePackages?.find((entry) => entry.kind === "packed_orm");
  const runtimeTextureMaps = runtimeTexturePackage?.maps ?? [];
  const runtimeMapsHaveKtx2 =
    runtimeTextureMaps.length >= 3 &&
    runtimeTextureMaps.every((entry) => {
      return (
        entry.ktx2Path &&
        fs.existsSync(path.join(REPO_ROOT, "apps/web/public", entry.ktx2Path.replace(/^\//, "")))
      );
    });
  const expectedTexturePackageStatus = runtimeMapsHaveKtx2
    ? "ktx2-ready"
    : "orm-png-sidecar-ready-ktx2-pending";
  assert.equal(surfaceRuntimeDescriptor.key, "p2s_bruno_room_surface_kit", "surface runtime descriptor key mismatch");
  assert.equal(
    surfaceRuntimeDescriptor.contractMetadata?.textureSet?.ktx2Ready,
    runtimeMapsHaveKtx2,
    "surface runtime descriptor should reflect whether every public ORM map has a KTX2 sidecar"
  );
  assert.equal(
    surfaceRuntimeDescriptor.files?.texturePackageManifest?.path,
    "/assets/models/p2s_bruno_room_surface_kit/texture-package-2026-05-19.json",
    "surface runtime descriptor should point at the public texture manifest"
  );
  assert.equal(
    surfaceRuntimeDescriptor.files?.texturePackageManifest?.exists,
    true,
    "surface runtime descriptor should confirm public texture manifest exists"
  );
  assert.equal(
    runtimeTexturePackage?.status,
    expectedTexturePackageStatus,
    "surface runtime descriptor should expose the KTX2-ready status only when all sidecars exist"
  );
  assert.equal(
    runtimeTexturePackage?.ktx2Ready,
    runtimeMapsHaveKtx2,
    "surface runtime package KTX2 readiness should match public sidecar availability"
  );
  assert.equal(
    runtimeTexturePackage?.stillRequiresRuntimeKtx2Transcode,
    !runtimeMapsHaveKtx2,
    "surface runtime package should keep KTX2 transcode follow-up only while sidecars are missing"
  );
  assert.equal(
    runtimeTexturePackage?.stillRequiresFinalUvBake,
    true,
    "surface runtime package should keep final UV bake follow-up"
  );
  assert.deepEqual(
    runtimeTexturePackage?.channels,
    { r: "ambientOcclusion", g: "roughness", b: "metallic", a: "constantOne" },
    "surface runtime package should preserve packed ORM channel semantics"
  );
  assert.ok(
    runtimeTextureMaps.length >= 3,
    "surface runtime package should list public ORM sidecar maps"
  );
  assert.ok(
    runtimeTextureMaps.every((entry) => {
      return (
        entry.publicPath &&
        entry.sourcePath &&
        entry.exists === true &&
        fs.existsSync(path.join(REPO_ROOT, "apps/web/public", entry.publicPath.replace(/^\//, ""))) &&
        (runtimeMapsHaveKtx2
          ? entry.ktx2Path &&
            fs.existsSync(path.join(REPO_ROOT, "apps/web/public", entry.ktx2Path.replace(/^\//, "")))
          : entry.ktx2Path === null)
      );
    }),
    "surface runtime package ORM public files and conditional KTX2 sidecars should exist"
  );
  assert.equal(
    surfacePublicTextureManifest.packageStatus,
    expectedTexturePackageStatus,
    "public texture manifest should expose the same ORM package status as the runtime descriptor"
  );
  assert.equal(
    surfacePublicTextureManifest.ktx2Ready,
    runtimeMapsHaveKtx2,
    "public texture manifest KTX2 readiness should match public sidecar availability"
  );
  assert.equal(
    surfacePublicTextureManifest.stillRequiresRuntimeKtx2Transcode,
    !runtimeMapsHaveKtx2,
    "public texture manifest should keep runtime KTX2 follow-up only while sidecars are missing"
  );
  assert.equal(
    surfacePublicTextureManifest.stillRequiresFinalUvBake,
    true,
    "public texture manifest should keep final UV bake follow-up"
  );
  assert.ok(
    surfacePublicTextureManifest.maps?.every(
      (entry) =>
        entry.publicPath &&
        entry.exists === true &&
        entry.channels?.r === "ambientOcclusion" &&
        entry.channels?.g === "roughness" &&
        entry.channels?.b === "metallic" &&
        entry.channels?.a === "constantOne" &&
        (runtimeMapsHaveKtx2
          ? entry.ktx2Path &&
            fs.existsSync(path.join(REPO_ROOT, "apps/web/public", entry.ktx2Path.replace(/^\//, "")))
          : entry.ktx2Path === null)
    ),
    "public texture manifest should preserve sidecar channel semantics and conditional KTX2 paths"
  );
  const surfaceIndexEntry = surfaceRuntimeIndex.assets?.find((entry) => entry.key === "p2s_bruno_room_surface_kit");
  assert.equal(
    surfaceIndexEntry?.packagePath,
    "/assets/catalog/runtime-packages/p2s_bruno_room_surface_kit.json",
    "runtime package index should point to the surface descriptor"
  );
  assert.equal(
    surfaceIndexEntry?.texturePackageStatus,
    expectedTexturePackageStatus,
    "runtime package index should expose surface texture package status"
  );
  assert.equal(surfaceIndexEntry?.texturePackageCount, 1, "runtime package index should count the ORM package");
  assert.equal(
    surfaceIndexEntry?.ktx2Ready,
    runtimeMapsHaveKtx2,
    "runtime package index KTX2 readiness should match public sidecar availability"
  );
  assert.equal(surfaceIndexEntry?.releaseEligible, false, "surface QA runtime package should not be release eligible");
  assert.ok(
    (surfaceKitReport.asset?.bakedContactShadowPass?.floorZones?.length ?? 0) >= 6,
    "surface kit should include floor-zone contact-shadow lightmap metadata"
  );
  assert.ok(
    (surfaceKitReport.asset?.bakedContactShadowPass?.wallZones?.length ?? 0) >= 3,
    "surface kit should include wall-zone contact-shadow lightmap metadata"
  );
  assert.equal(
    surfaceKitReport.asset?.bakedContactShadowPass?.runtimeOverlayReplacement,
    false,
    "surface kit contact-shadow lightmap should be additive evidence until true GI replaces runtime overlays"
  );
  assert.ok(
    (surfaceKitReport.asset?.wallRevealCleanupPass?.lineOpacityAfter ?? 1) <= 0.1,
    "surface kit should reduce wall reveal line opacity below grid-overlay visibility"
  );
  assert.ok(
    (surfaceKitReport.asset?.wallRevealCleanupPass?.softWashZones?.length ?? 0) >= 4,
    "surface kit should include broad wall soft-wash zones after reveal cleanup"
  );
  assert.equal(
    surfaceKitReport.asset?.wallRevealCleanupPass?.gridOverlayRisk,
    "reduced-not-eliminated",
    "surface kit should keep wall grid risk explicit until browser review clears it"
  );
  assert.equal(
    surfaceKitReport.asset?.wallRevealCleanupPass?.stillRequiresBrowserHumanReview,
    true,
    "surface kit should require browser human review after wall reveal cleanup"
  );
  assert.ok(
    (surfaceKitReport.asset?.artDirectedGiPass?.floorBounceZones?.length ?? 0) >= 5,
    "surface kit should include floor-zone art-directed bounce lightmap metadata"
  );
  assert.ok(
    (surfaceKitReport.asset?.artDirectedGiPass?.wallBounceZones?.length ?? 0) >= 4,
    "surface kit should include wall-zone art-directed bounce lightmap metadata"
  );
  assert.equal(
    surfaceKitReport.asset?.artDirectedGiPass?.physicallyBaked,
    false,
    "surface kit should not label hand-authored bounce cards as physically baked GI"
  );
  assert.equal(
    surfaceKitReport.asset?.artDirectedGiPass?.runtimeOverlayReplacement,
    false,
    "surface kit art-directed bounce pass should remain additive evidence until runtime overlays can be retired"
  );
  assert.equal(
    surfaceKitReport.asset?.artDirectedGiPass?.stillRequiresPathTracedBake,
    true,
    "surface kit should keep path-traced bake follow-up explicit"
  );
  assert.equal(
    surfaceKitReport.asset?.cyclesAoBakePass?.engine,
    "CYCLES",
    "surface kit should include a Blender Cycles bake evidence pass"
  );
  assert.equal(
    surfaceKitReport.asset?.cyclesAoBakePass?.bakeType,
    "AO",
    "surface kit Cycles bake evidence should identify AO bake type"
  );
  assert.ok(
    (surfaceKitReport.asset?.cyclesAoBakePass?.samples ?? 0) >= 32,
    "surface kit Cycles AO bake should use enough samples for a QA evidence pass"
  );
  assert.ok(
    (surfaceKitReport.asset?.cyclesAoBakePass?.blockerProxies?.length ?? 0) >= 6,
    "surface kit Cycles AO bake should include room/furniture blocker proxies"
  );
  assert.equal(
    surfaceKitReport.asset?.cyclesAoBakePass?.physicallyBakedAo,
    true,
    "surface kit should distinguish physically baked AO from hand-authored bounce cards"
  );
  assert.equal(
    surfaceKitReport.asset?.cyclesAoBakePass?.pathTracedGi,
    false,
    "surface kit should not overclaim Cycles AO probe as path-traced GI"
  );
  assert.equal(
    surfaceKitReport.asset?.cyclesAoBakePass?.stillRequiresPathTracedGi,
    true,
    "surface kit should keep true GI follow-up explicit after AO bake probe"
  );
  assert.ok(
    (surfaceKitReport.comparisonReview?.knownGapsBeforeCommercialPromotion?.length ?? 0) >= 3,
    "surface kit report should record commercial-promotion gaps"
  );
  assert.ok(fs.existsSync(BLENDER_FURNITURE_HERO_KIT_MODEL_PATH), "Blender-authored furniture hero kit should exist");
  assert.ok(
    fs.statSync(BLENDER_FURNITURE_HERO_KIT_MODEL_PATH).size > 2 * 1024 * 1024,
    "Blender-authored furniture hero kit should contain embedded texture atlases and dense furniture geometry"
  );
  assert.ok(fs.existsSync(BLENDER_FURNITURE_HERO_KIT_REPORT_PATH), "Blender-authored furniture hero review report should exist");
  const furnitureHeroKitReport = JSON.parse(fs.readFileSync(BLENDER_FURNITURE_HERO_KIT_REPORT_PATH, "utf8")) as {
    schemaVersion?: string;
    asset?: {
      textureSet?: {
        authoredMaps?: string[];
        generatedPbrMapCount?: number;
        packedOrmMapCount?: number;
        packedOrmReady?: boolean;
        ktx2Ready?: boolean;
      };
      texturePackagingPass?: {
        packageStatus?: string;
        packedOrmMapCount?: number;
        packedOrmMaps?: Array<{
          role?: string;
          path?: string;
          channels?: { r?: string; g?: string; b?: string; a?: string };
          colorSpace?: string;
        }>;
        packedOrmChannels?: { r?: string; g?: string; b?: string; a?: string };
        ktx2Ready?: boolean;
        stillRequiresRuntimeKtx2Transcode?: boolean;
        stillRequiresFinalUvBake?: boolean;
      };
      bespokeCurvaturePass?: {
        meshFamilies?: string[];
        sofaMeshes?: string[];
        coffeeTableMeshes?: string[];
        deskMeshes?: string[];
        shelfMeshes?: string[];
        mediaConsoleMeshes?: string[];
        stillRequiresHumanArtReview?: boolean;
      };
    };
    metrics?: { objectCount?: number; materialCount?: number; textureCount?: number; triangleCount?: number };
    comparisonReview?: {
      commercialBenchmarkRubric?: unknown[];
      knownGapsBeforeCommercialPromotion?: unknown[];
      currentGrade?: string;
    };
  };
  assert.equal(
    furnitureHeroKitReport.schemaVersion,
    "deskterior-blender-authored-asset-review-v1",
    "Blender-authored furniture hero kit report schema should match"
  );
  assert.ok((furnitureHeroKitReport.metrics?.objectCount ?? 0) >= 120, "furniture hero kit should preserve large furniture object density");
  assert.ok((furnitureHeroKitReport.metrics?.materialCount ?? 0) >= 16, "furniture hero kit should preserve material variation");
  assert.ok((furnitureHeroKitReport.metrics?.textureCount ?? 0) >= 12, "furniture hero kit should include generated PBR helper maps");
  assert.ok((furnitureHeroKitReport.metrics?.triangleCount ?? 0) <= 65_000, "furniture hero kit should stay inside QA triangle budget");
  assert.deepEqual(
    furnitureHeroKitReport.asset?.textureSet?.authoredMaps,
    ["baseColor", "normal", "roughness", "ambientOcclusion", "packedOrm"],
    "furniture hero kit should report generated PBR helper map roles plus packed ORM sidecars"
  );
  assert.ok(
    (furnitureHeroKitReport.asset?.textureSet?.generatedPbrMapCount ?? 0) >= 20,
    "furniture hero kit should report the generated PBR and packed ORM helper map count"
  );
  assert.ok(
    (furnitureHeroKitReport.asset?.textureSet?.packedOrmMapCount ?? 0) >= 4,
    "furniture hero kit should report packed ORM maps for wood, fabric, lacquer, and speaker material families"
  );
  assert.equal(
    furnitureHeroKitReport.asset?.textureSet?.packedOrmReady,
    true,
    "furniture hero kit should mark PNG ORM sidecar readiness separately from KTX2 readiness"
  );
  assert.equal(
    furnitureHeroKitReport.asset?.textureSet?.ktx2Ready,
    true,
    "furniture hero kit review should reflect runtime KTX2 readiness after transcode"
  );
  assert.equal(
    furnitureHeroKitReport.asset?.texturePackagingPass?.packageStatus,
    "ktx2-ready",
    "furniture hero kit review should record KTX2 package status after runtime promotion"
  );
  assert.equal(
    furnitureHeroKitReport.asset?.texturePackagingPass?.stillRequiresRuntimeKtx2Transcode,
    false,
    "furniture hero kit review should not keep runtime KTX2 as a blocker once sidecars exist"
  );
  assert.equal(
    furnitureHeroKitReport.asset?.texturePackagingPass?.packedOrmChannels?.r,
    "ambientOcclusion",
    "furniture ORM red channel should carry AO"
  );
  assert.equal(
    furnitureHeroKitReport.asset?.texturePackagingPass?.packedOrmChannels?.g,
    "roughness",
    "furniture ORM green channel should carry roughness"
  );
  assert.equal(
    furnitureHeroKitReport.asset?.texturePackagingPass?.packedOrmChannels?.b,
    "metallic",
    "furniture ORM blue channel should carry metallic"
  );
  assert.ok(
    (furnitureHeroKitReport.asset?.texturePackagingPass?.packedOrmMaps?.length ?? 0) >= 4,
    "furniture hero kit should list each packed ORM sidecar"
  );
  for (const entry of furnitureHeroKitReport.asset?.texturePackagingPass?.packedOrmMaps ?? []) {
    assert.ok(entry.path && fs.existsSync(path.join(REPO_ROOT, entry.path)), `furniture ORM sidecar should exist: ${entry.path}`);
    assert.equal(entry.colorSpace, "Non-Color", `furniture ORM sidecar ${entry.role} should be Non-Color`);
  }
  assert.ok(
    fs.existsSync(BRUNO_FURNITURE_HERO_PUBLIC_TEXTURE_MANIFEST_PATH),
    "furniture hero kit public texture manifest should exist for runtime material binding"
  );
  const furnitureTextureManifest = JSON.parse(
    fs.readFileSync(BRUNO_FURNITURE_HERO_PUBLIC_TEXTURE_MANIFEST_PATH, "utf8")
  ) as {
    packageStatus?: string;
    ktx2Ready?: boolean;
    maps?: Array<{ role?: string; publicPath?: string | null; ktx2Path?: string | null }>;
  };
  assert.equal(
    furnitureTextureManifest.packageStatus,
    "ktx2-ready",
    "furniture public texture package should be KTX2-ready after encode"
  );
  assert.equal(furnitureTextureManifest.ktx2Ready, true, "furniture public texture package should mark KTX2 readiness");
  for (const role of ["furnitureWoodOrm", "furnitureFabricOrm", "furnitureLacquerOrm", "furnitureSpeakerOrm"]) {
    const entry = furnitureTextureManifest.maps?.find((map) => map.role === role);
    assert.ok(entry?.publicPath, `furniture texture package should include PNG source for ${role}`);
    assert.ok(entry?.ktx2Path?.endsWith(".ktx2"), `furniture texture package should include KTX2 path for ${role}`);
    assert.ok(
      fs.existsSync(path.join(REPO_ROOT, "apps/web/public", entry.ktx2Path.replace(/^\//, ""))),
      `furniture KTX2 runtime sidecar should exist for ${role}`
    );
  }
  assert.ok(
    furnitureHeroKitReport.asset?.bespokeCurvaturePass?.meshFamilies?.includes("rounded_rect_slab"),
    "furniture hero kit should record its bespoke rounded topology mesh family"
  );
  assert.ok(
    furnitureHeroKitReport.asset?.bespokeCurvaturePass?.meshFamilies?.includes("soft_rear_upholstery_shell"),
    "furniture hero kit should record the continuous rear upholstery shell mesh family"
  );
  assert.ok(
    furnitureHeroKitReport.asset?.bespokeCurvaturePass?.sofaMeshes?.includes(
      "hero_sofa_rear_continuous_wrapped_upholstery_shell"
    ),
    "furniture hero kit should record the foreground sofa rear continuous shell"
  );
  assert.ok(
    (furnitureHeroKitReport.asset?.bespokeCurvaturePass?.sofaMeshes?.length ?? 0) >= 3,
    "furniture hero kit should record foreground sofa curved meshes"
  );
  assert.ok(
    (furnitureHeroKitReport.asset?.bespokeCurvaturePass?.coffeeTableMeshes?.length ?? 0) >= 4,
    "furniture hero kit should record foreground coffee-table curved meshes"
  );
  assert.ok(
    furnitureHeroKitReport.asset?.bespokeCurvaturePass?.deskMeshes?.includes("hero_desk_rounded_oiled_wood_worktop"),
    "furniture hero kit should record the rounded desk worktop source mesh"
  );
  assert.ok(
    furnitureHeroKitReport.asset?.bespokeCurvaturePass?.deskMeshes?.includes("hero_desk_round_wire_grommet_black_ring"),
    "furniture hero kit should record desk grommet detail instead of a bare tabletop"
  );
  assert.ok(
    furnitureHeroKitReport.asset?.bespokeCurvaturePass?.shelfMeshes?.includes("hero_shelf_center_soft_lacquer_cabinet"),
    "furniture hero kit should record the rounded shelf cabinet source mesh"
  );
  assert.ok(
    furnitureHeroKitReport.asset?.bespokeCurvaturePass?.shelfMeshes?.includes("hero_shelf_woven_storage_box_lower"),
    "furniture hero kit should record shelf storage detail"
  );
  assert.ok(
    furnitureHeroKitReport.asset?.bespokeCurvaturePass?.mediaConsoleMeshes?.includes(
      "hero_media_console_rounded_lacquer_body"
    ),
    "furniture hero kit should record the rounded media console body source mesh"
  );
  assert.ok(
    furnitureHeroKitReport.asset?.bespokeCurvaturePass?.mediaConsoleMeshes?.includes(
      "hero_media_console_fine_slatted_front_*"
    ),
    "furniture hero kit should record media console slatted front detail"
  );
  assert.equal(
    furnitureHeroKitReport.asset?.bespokeCurvaturePass?.stillRequiresHumanArtReview,
    true,
    "furniture hero kit should keep human art review required after the topology pass"
  );
  assert.ok(
    (furnitureHeroKitReport.comparisonReview?.commercialBenchmarkRubric?.length ?? 0) >= 5,
    "furniture hero kit report should include a commercial benchmark rubric"
  );
  assert.ok(
    (furnitureHeroKitReport.comparisonReview?.knownGapsBeforeCommercialPromotion?.length ?? 0) >= 4,
    "furniture hero kit report should record commercial-promotion gaps"
  );
  assert.ok(
    fs.existsSync(BRUNO_ASSET_BENCHMARK_LEDGER_PATH),
    "Bruno asset benchmark ledger should exist before claiming commercial-quality progress"
  );
  assert.ok(
    fs.existsSync(BRUNO_ASSET_BENCHMARK_CONTACT_SHEET_PATH),
    "Bruno asset benchmark contact sheet should exist before screenshot QA"
  );
  assert.ok(
    fs.statSync(BRUNO_ASSET_BENCHMARK_CONTACT_SHEET_PATH).size > 100 * 1024,
    "Bruno asset benchmark contact sheet should contain visible comparison imagery"
  );
  const brunoBenchmarkLedger = JSON.parse(fs.readFileSync(BRUNO_ASSET_BENCHMARK_LEDGER_PATH, "utf8")) as {
    schemaVersion?: string;
    status?: string;
    contactSheet?: string;
    comparisonPolicy?: {
      noUnlicensedCommercialImagesEmbedded?: boolean;
      meshyProviderGeneration?: string;
    };
    panels?: unknown[];
    benchmarkGates?: unknown[];
    weakestAreas?: unknown[];
    nextIterationOrder?: unknown[];
  };
  assert.equal(
    brunoBenchmarkLedger.schemaVersion,
    "deskterior-bruno-room-asset-benchmark-v1",
    "Bruno asset benchmark ledger schema should match"
  );
  assert.equal(
    brunoBenchmarkLedger.status,
    "not-commercial-ready",
    "Bruno benchmark should explicitly block commercial readiness until visual gaps are closed"
  );
  assert.equal(
    brunoBenchmarkLedger.contactSheet,
    path.relative(REPO_ROOT, BRUNO_ASSET_BENCHMARK_CONTACT_SHEET_PATH),
    "Bruno benchmark ledger should point at the generated contact sheet"
  );
  assert.equal(
    brunoBenchmarkLedger.comparisonPolicy?.noUnlicensedCommercialImagesEmbedded,
    true,
    "Bruno benchmark should avoid embedding unlicensed commercial imagery"
  );
  assert.equal(
    brunoBenchmarkLedger.comparisonPolicy?.meshyProviderGeneration,
    "not-used-in-this-pass",
    "Bruno benchmark should preserve Meshy provider usage status"
  );
  assert.ok((brunoBenchmarkLedger.panels?.length ?? 0) >= 6, "Bruno benchmark should include all comparison panels");
  assert.ok((brunoBenchmarkLedger.benchmarkGates?.length ?? 0) >= 6, "Bruno benchmark should include commercial gates");
  assert.ok((brunoBenchmarkLedger.weakestAreas?.length ?? 0) >= 5, "Bruno benchmark should rank remaining visual blockers");
  assert.ok((brunoBenchmarkLedger.nextIterationOrder?.length ?? 0) >= 5, "Bruno benchmark should preserve next iteration order");
  assert.ok(fs.existsSync(COMMERCIAL_TASK_CHAIR_MODEL_PATH), "Commercial task chair GLB should exist");
  assert.ok(
    fs.statSync(COMMERCIAL_TASK_CHAIR_MODEL_PATH).size > 1024 * 1024,
    "Commercial task chair GLB should contain packed PBR geometry"
  );
  assert.ok(fs.existsSync(COMMERCIAL_TASK_CHAIR_RUNTIME_PACKAGE_PATH), "Commercial task chair runtime package should exist");
  assert.ok(fs.existsSync(COMMERCIAL_TASK_CHAIR_REVIEW_PATH), "Commercial task chair review report should exist");
  assert.ok(fs.existsSync(COMMERCIAL_TASK_CHAIR_MESHY_PROMPT_PACK_PATH), "Commercial task chair Meshy prompt pack should exist");
  const commercialTaskChairReview = JSON.parse(fs.readFileSync(COMMERCIAL_TASK_CHAIR_REVIEW_PATH, "utf8")) as {
    status?: string;
    metrics?: { triangles?: number; glbBytes?: number; runtimeOptimization?: string };
    licenseReview?: { selfAuthored?: boolean; thirdPartyModelCopied?: boolean; thirdPartyImageCopied?: boolean; releaseEligible?: boolean };
    commercialComparisonChecklist?: unknown[];
    meshApi?: { status?: string; meshApiPreflight?: { balanceEndpointReachable?: boolean; balanceAvailable?: boolean; providerPostSent?: boolean } };
  };
  assert.equal(
    commercialTaskChairReview.status,
    "generic-chair-commercial-candidate-review-required",
    "Commercial task chair should remain review-required"
  );
  assert.ok((commercialTaskChairReview.metrics?.triangles ?? 0) >= 25_000, "Commercial task chair should preserve visible mesh detail");
  assert.ok((commercialTaskChairReview.metrics?.triangles ?? 0) <= 45_000, "Commercial task chair should stay inside QA triangle budget");
  assert.equal(
    commercialTaskChairReview.metrics?.runtimeOptimization,
    "gltf-transform dedup + prune + meshopt",
    "Commercial task chair should record runtime meshopt packaging"
  );
  assert.equal(commercialTaskChairReview.licenseReview?.selfAuthored, true, "Commercial task chair should be self-authored");
  assert.equal(
    commercialTaskChairReview.licenseReview?.thirdPartyModelCopied,
    false,
    "Commercial task chair should not copy a third-party model"
  );
  assert.equal(
    commercialTaskChairReview.licenseReview?.thirdPartyImageCopied,
    false,
    "Commercial task chair should not copy third-party images"
  );
  assert.equal(commercialTaskChairReview.licenseReview?.releaseEligible, false, "Commercial task chair should not be release eligible yet");
  assert.ok(
    (commercialTaskChairReview.commercialComparisonChecklist?.length ?? 0) >= 5,
    "Commercial task chair should include comparison checklist evidence"
  );
  assert.equal(
    commercialTaskChairReview.meshApi?.status,
    "review_pending_no_meshy_post_sent",
    "Commercial task chair should preserve Meshy prompt-review gate status"
  );
  assert.equal(
    commercialTaskChairReview.meshApi?.meshApiPreflight?.balanceEndpointReachable,
    true,
    "Commercial task chair should record Meshy API preflight reachability"
  );
  assert.equal(
    commercialTaskChairReview.meshApi?.meshApiPreflight?.providerPostSent,
    false,
    "Commercial task chair should not send Meshy provider POST before prompt review"
  );
  const commercialTaskChairRuntimePackage = JSON.parse(fs.readFileSync(COMMERCIAL_TASK_CHAIR_RUNTIME_PACKAGE_PATH, "utf8")) as {
    source?: { kind?: string; releaseEligible?: boolean; reviewRequired?: boolean };
    textureSet?: { authored?: string; imageModelStatus?: string };
    optimization?: { applied?: boolean; glbBytesBefore?: number; glbBytesAfter?: number };
  };
  assert.equal(commercialTaskChairRuntimePackage.source?.kind, "blender_authored_generic", "Commercial task chair source should be Blender-authored generic");
  assert.equal(commercialTaskChairRuntimePackage.source?.releaseEligible, false, "Commercial task chair runtime package should block release");
  assert.equal(commercialTaskChairRuntimePackage.source?.reviewRequired, true, "Commercial task chair runtime package should require review");
  assert.equal(commercialTaskChairRuntimePackage.textureSet?.authored, "procedural_pbr_from_blender", "Commercial task chair should ship authored PBR maps");
  assert.equal(commercialTaskChairRuntimePackage.optimization?.applied, true, "Commercial task chair should be meshopt packaged");
  assert.ok(
    (commercialTaskChairRuntimePackage.optimization?.glbBytesBefore ?? 0) > (commercialTaskChairRuntimePackage.optimization?.glbBytesAfter ?? 0),
    "Commercial task chair meshopt packaging should reduce GLB bytes"
  );
  assert.ok(fs.existsSync(COMMERCIAL_DESK_ACCESSORY_KIT_MODEL_PATH), "Commercial desk accessory kit GLB should exist");
  assert.ok(
    fs.statSync(COMMERCIAL_DESK_ACCESSORY_KIT_MODEL_PATH).size > 5 * 1024 * 1024,
    "Commercial desk accessory kit should contain packed PBR geometry and texture maps"
  );
  assert.ok(fs.existsSync(COMMERCIAL_DESK_ACCESSORY_KIT_RUNTIME_PACKAGE_PATH), "Commercial desk accessory kit runtime package should exist");
  assert.ok(fs.existsSync(COMMERCIAL_DESK_ACCESSORY_KIT_REVIEW_PATH), "Commercial desk accessory kit review report should exist");
  assert.ok(fs.existsSync(COMMERCIAL_DESK_ACCESSORY_KIT_MESHY_PROMPT_PACK_PATH), "Commercial desk accessory kit Meshy prompt pack should exist");
  const commercialDeskAccessoryReview = JSON.parse(fs.readFileSync(COMMERCIAL_DESK_ACCESSORY_KIT_REVIEW_PATH, "utf8")) as {
    status?: string;
    metrics?: {
      objectCount?: number;
      materialCount?: number;
      textureCount?: number;
      triangles?: number;
      glbBytes?: number;
    };
    realScaleReferenceMm?: Record<string, number[]>;
    optimization?: { tool?: string; beforeBytes?: number; afterBytes?: number; savedBytes?: number };
    licenseReview?: { selfAuthored?: boolean; thirdPartyModelCopied?: boolean; thirdPartyImageCopied?: boolean; releaseEligible?: boolean };
    commercialComparisonChecklist?: unknown[];
    referenceStudy?: unknown[];
    meshApi?: { status?: string; meshApiPreflight?: { balanceEndpointReachable?: boolean; balanceAvailable?: boolean; providerPostSent?: boolean } };
  };
  assert.equal(
    commercialDeskAccessoryReview.status,
    "generic-desk-accessory-v2-real-scale-candidate-review-required",
    "Commercial desk accessory kit should remain review-required"
  );
  assert.ok((commercialDeskAccessoryReview.metrics?.objectCount ?? 0) >= 120, "Commercial desk accessory kit should preserve prop density");
  assert.ok((commercialDeskAccessoryReview.metrics?.materialCount ?? 0) >= 15, "Commercial desk accessory kit should include material variation");
  assert.ok((commercialDeskAccessoryReview.metrics?.textureCount ?? 0) >= 8, "Commercial desk accessory kit should include authored PBR maps");
  assert.ok((commercialDeskAccessoryReview.metrics?.triangles ?? 0) >= 40_000, "Commercial desk accessory kit should preserve visible object detail");
  assert.ok((commercialDeskAccessoryReview.metrics?.triangles ?? 0) <= 120_000, "Commercial desk accessory kit should stay inside QA triangle budget");
  assert.ok(
    (commercialDeskAccessoryReview.realScaleReferenceMm?.mxMechanicalMini?.[0] ?? 0) >= 300,
    "Commercial desk accessory kit should record real keyboard scale references"
  );
  assert.ok(
    (commercialDeskAccessoryReview.optimization?.beforeBytes ?? 0) > (commercialDeskAccessoryReview.optimization?.afterBytes ?? 0),
    "Commercial desk accessory kit meshopt packaging should reduce GLB bytes"
  );
  assert.equal(commercialDeskAccessoryReview.licenseReview?.selfAuthored, true, "Commercial desk accessory kit should be self-authored");
  assert.equal(commercialDeskAccessoryReview.licenseReview?.thirdPartyModelCopied, false, "Commercial desk accessory kit should not copy third-party models");
  assert.equal(commercialDeskAccessoryReview.licenseReview?.thirdPartyImageCopied, false, "Commercial desk accessory kit should not copy third-party images");
  assert.equal(commercialDeskAccessoryReview.licenseReview?.releaseEligible, false, "Commercial desk accessory kit should not be release eligible yet");
  assert.ok((commercialDeskAccessoryReview.referenceStudy?.length ?? 0) >= 5, "Commercial desk accessory kit should record internet reference study");
  assert.ok(
    (commercialDeskAccessoryReview.commercialComparisonChecklist?.length ?? 0) >= 7,
    "Commercial desk accessory kit should include comparison checklist evidence"
  );
  assert.equal(
    commercialDeskAccessoryReview.meshApi?.status,
    "review_pending_no_meshy_post_sent",
    "Commercial desk accessory kit should preserve Meshy prompt-review gate status"
  );
  assert.equal(
    commercialDeskAccessoryReview.meshApi?.meshApiPreflight?.balanceEndpointReachable,
    true,
    "Commercial desk accessory kit should record Meshy API balance preflight reachability"
  );
  assert.equal(
    commercialDeskAccessoryReview.meshApi?.meshApiPreflight?.providerPostSent,
    false,
    "Commercial desk accessory kit should not send Meshy provider POST before prompt review"
  );
  const commercialDeskAccessoryRuntimePackage = JSON.parse(fs.readFileSync(COMMERCIAL_DESK_ACCESSORY_KIT_RUNTIME_PACKAGE_PATH, "utf8")) as {
    source?: { kind?: string; releaseEligible?: boolean; reviewRequired?: boolean };
    textureSet?: { authored?: string; imageModelStatus?: string; maps?: Record<string, string>; ktx2Ready?: boolean };
    realScaleReferenceMm?: Record<string, number[]>;
    optimization?: { tool?: string; beforeBytes?: number; afterBytes?: number };
  };
  assert.equal(commercialDeskAccessoryRuntimePackage.source?.kind, "blender_authored_generic", "Commercial desk accessory source should be Blender-authored generic");
  assert.equal(commercialDeskAccessoryRuntimePackage.source?.releaseEligible, false, "Commercial desk accessory runtime package should block release");
  assert.equal(commercialDeskAccessoryRuntimePackage.source?.reviewRequired, true, "Commercial desk accessory runtime package should require review");
  assert.equal(commercialDeskAccessoryRuntimePackage.textureSet?.authored, "procedural_pbr_from_blender", "Commercial desk accessory should ship authored PBR maps");
  assert.equal(Object.keys(commercialDeskAccessoryRuntimePackage.textureSet?.maps ?? {}).length >= 8, true, "Commercial desk accessory should list authored texture maps");
  assert.ok(
    (commercialDeskAccessoryRuntimePackage.realScaleReferenceMm?.mxMaster3s?.[1] ?? 0) >= 120,
    "Commercial desk accessory runtime package should retain mouse scale references"
  );
  assert.equal(commercialDeskAccessoryRuntimePackage.optimization?.tool, "gltf-transform meshopt", "Commercial desk accessory should be meshopt packaged");
  assert.ok(
    (commercialDeskAccessoryRuntimePackage.optimization?.beforeBytes ?? 0) > (commercialDeskAccessoryRuntimePackage.optimization?.afterBytes ?? 0),
    "Commercial desk accessory meshopt packaging should reduce GLB bytes"
  );
  assert.ok(fs.existsSync(MECHANICAL_KEYBOARD_SWITCH_LAB_MODEL_PATH), "Mechanical keyboard switch lab GLB should exist");
  assert.ok(
    fs.statSync(MECHANICAL_KEYBOARD_SWITCH_LAB_MODEL_PATH).size > 700 * 1024,
    "ABKO AR108G keyboard reference GLB should keep dense meshopt-packed PBR geometry"
  );
  assert.ok(fs.existsSync(MECHANICAL_KEYBOARD_SWITCH_LAB_RUNTIME_PACKAGE_PATH), "Mechanical keyboard switch lab runtime package should exist");
  assert.ok(fs.existsSync(MECHANICAL_KEYBOARD_SWITCH_LAB_REVIEW_PATH), "Mechanical keyboard switch lab review report should exist");
  assert.ok(fs.existsSync(MECHANICAL_KEYBOARD_SWITCH_LAB_ISOMETRIC_PREVIEW_PATH), "Mechanical keyboard switch lab preview should exist");
  const mechanicalKeyboardRuntimePackage = JSON.parse(fs.readFileSync(MECHANICAL_KEYBOARD_SWITCH_LAB_RUNTIME_PACKAGE_PATH, "utf8")) as {
    product?: { brand?: string; model?: string; productUrl?: string; releaseEligible?: boolean };
    pressTargets?: unknown[];
    switchProfiles?: Record<string, { forceG?: number; defaultForThisSku?: boolean; sound?: string }>;
    materialSlots?: unknown[];
  };
  assert.equal(mechanicalKeyboardRuntimePackage.product?.brand, "ABKO", "Keyboard package should record the ABKO reference brand");
  assert.equal(mechanicalKeyboardRuntimePackage.product?.model, "AR108G", "Keyboard package should record the AR108G reference model");
  assert.equal(
    mechanicalKeyboardRuntimePackage.product?.productUrl,
    "https://www.compuzone.co.kr/product/product_detail.htm?ProductNo=1297630&BigDivNo=8&MediumDivNo=1018&DivNo=4425",
    "Keyboard package should preserve the Compuzone reference URL"
  );
  assert.equal(mechanicalKeyboardRuntimePackage.product?.releaseEligible, false, "Keyboard package should stay private/reference-only");
  assert.ok((mechanicalKeyboardRuntimePackage.pressTargets?.length ?? 0) >= 100, "ABKO AR108G keyboard should expose dense per-key press targets");
  assert.equal(mechanicalKeyboardRuntimePackage.switchProfiles?.["clicky-blue"]?.forceG, 50, "ABKO AR108G blue switch force should follow the 50G reference spec");
  assert.equal(mechanicalKeyboardRuntimePackage.switchProfiles?.["clicky-blue"]?.defaultForThisSku, true, "ABKO AR108G should default to the clicky blue SKU profile");
  assert.ok((mechanicalKeyboardRuntimePackage.materialSlots?.length ?? 0) >= 6, "ABKO AR108G keyboard should record material slots for visual QA");
  const mechanicalKeyboardReview = JSON.parse(fs.readFileSync(MECHANICAL_KEYBOARD_SWITCH_LAB_REVIEW_PATH, "utf8")) as {
    productUrl?: string;
    referenceImages?: unknown[];
    referenceSummary?: { spec?: string; observedVisualFeatures?: unknown[] };
    qualityTargets?: unknown[];
    knownGaps?: unknown[];
  };
  assert.equal(
    mechanicalKeyboardReview.productUrl,
    "https://www.compuzone.co.kr/product/product_detail.htm?ProductNo=1297630&BigDivNo=8&MediumDivNo=1018&DivNo=4425",
    "Keyboard review should record the user-provided Compuzone reference"
  );
  assert.ok((mechanicalKeyboardReview.referenceImages?.length ?? 0) >= 4, "Keyboard review should retain the product image reference set");
  assert.ok(mechanicalKeyboardReview.referenceSummary?.spec?.includes("키압 50G"), "Keyboard review should preserve the 50G blue-switch product spec");
  assert.ok(
    (mechanicalKeyboardReview.referenceSummary?.observedVisualFeatures?.length ?? 0) >= 5,
    "Keyboard review should record observed visual features from the reference"
  );
  assert.ok((mechanicalKeyboardReview.qualityTargets?.length ?? 0) >= 4, "Mechanical keyboard review should record asset quality targets");
  assert.ok((mechanicalKeyboardReview.knownGaps?.length ?? 0) >= 2, "Mechanical keyboard review should keep commercial promotion gaps explicit");
  const workbenchSource = fs.readFileSync(PC_ASSEMBLY_PAGE_PATH, "utf8");
  assert.ok(
    workbenchSource.includes("COMMERCIAL_TASK_CHAIR_HERO_URL"),
    "PC assembly room should use the Blender-authored commercial task chair"
  );
  assert.ok(
    workbenchSource.includes("20260521-commercial-task-chair-meshopt-v1"),
    "PC assembly room should cache-bust the latest commercial task chair package"
  );
  assert.ok(
    workbenchSource.includes("COMMERCIAL_DESK_ACCESSORY_KIT_URL"),
    "PC assembly room should use the Blender-authored commercial desk accessory kit"
  );
  assert.ok(
    workbenchSource.includes("20260521-commercial-desk-accessory-kit-v2-real-scale-meshopt"),
    "PC assembly room should cache-bust the latest commercial desk accessory package"
  );
  assert.ok(
    workbenchSource.includes("MECHANICAL_KEYBOARD_SWITCH_LAB_URL"),
    "PC assembly room should use the Blender-authored mechanical keyboard switch lab"
  );
  assert.ok(
    workbenchSource.includes("20260521-abko-ar108g-sage-green-keyboard-v1-meshopt"),
    "PC assembly room should cache-bust the latest ABKO AR108G keyboard package"
  );
  assert.ok(
    workbenchSource.includes("playKeyboardSwitchCue"),
    "PC assembly room should include synthesized switch-specific keyboard audio"
  );
  assert.ok(
    workbenchSource.includes("RoomCinematicContactOcclusionPass"),
    "PC assembly room should keep the cinematic contact occlusion pass wired"
  );
  assert.ok(
    workbenchSource.includes("room-cinematic-contact-occlusion-pass"),
    "PC assembly room should expose a named cinematic occlusion layer for visual QA"
  );
  assert.ok(
    workbenchSource.includes("luminanceThreshold={1.18}"),
    "PC assembly cinematic bloom should keep a high threshold to avoid Bruno-room glare washout"
  );
  assert.ok(
    workbenchSource.includes("cinematicRoomLightingProfile"),
    "PC assembly room should use a centralized cinematic lighting profile instead of scattered high-key light values"
  );
  assert.ok(
    workbenchSource.includes("gl.toneMappingExposure = isCinematicCapture ? 0.42 : 0.5"),
    "PC assembly cinematic capture should keep a lower exposure for richer wall and furniture depth"
  );
  assert.ok(
    workbenchSource.includes("authoredFurnitureHeroActive"),
    "PC assembly room should centralize authored furniture hero visibility for overlap control"
  );
  assert.ok(
    workbenchSource.includes("suppressLounge={authoredFurnitureHeroActive}"),
    "PC assembly room should suppress lounge community meshes when the authored furniture hero is active"
  );
  assert.ok(
    workbenchSource.includes("<SofaArea visible={sofaZoneStyled} authoredHeroActive={authoredFurnitureHeroActive} />"),
    "PC assembly room should avoid drawing the legacy block sofa over the authored hero furniture"
  );
  assert.ok(fs.existsSync(MESHY_BUILD_KIT_THUMBNAIL_PATH), "Compuzone PC kit thumbnail should exist");
  assert.ok(fs.statSync(MESHY_BUILD_KIT_THUMBNAIL_PATH).size > 1024, "Compuzone PC kit thumbnail should not be empty");
  assert.ok(fs.existsSync(MESHY_BUILD_KIT_REPORT_PATH), "Compuzone PC kit generation report should exist");

  const report = JSON.parse(fs.readFileSync(MESHY_BUILD_KIT_REPORT_PATH, "utf8")) as {
    schemaVersion?: string;
    source?: { productNo?: string };
    parts?: unknown[];
    asset?: { finalizerStatus?: string; outputGlb?: string; outputProxyGlb?: string; outputThumbnail?: string };
    budget?: { reservedEstimate?: number; maxBudgetPerJob?: number };
  };
  assert.equal(report.schemaVersion, "meshy-compuzone-pc-build-kit-v1", "Meshy report schema should match");
  assert.equal(report.source?.productNo, "1336041", "Meshy report should preserve Compuzone product number");
  assert.equal(report.parts?.length, 9, "Meshy report should include all quote parts");
  assert.equal(report.asset?.finalizerStatus, "finalized", "Meshy build kit should pass finalizer");
  assert.equal(report.asset?.outputGlb, MESHY_BUILD_KIT_MODEL_PATH, "Meshy report should point at output GLB");
  assert.equal(report.asset?.outputProxyGlb, MESHY_BUILD_KIT_PROXY_PATH, "Meshy report should point at proxy GLB");
  assert.equal(report.asset?.outputThumbnail, MESHY_BUILD_KIT_THUMBNAIL_PATH, "Meshy report should point at thumbnail");
  assert.ok((report.budget?.reservedEstimate ?? 0) <= 60, "Meshy reserved budget should stay capped at 60");
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

async function readQaRegistry(page: Page) {
  return page
    .evaluate(
      () =>
        (window as Window & { __DESKTERIORONLINE_PC_ASSEMBLY_QA__?: PcAssemblyQaRegistry })
          .__DESKTERIORONLINE_PC_ASSEMBLY_QA__ ?? null
    )
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Execution context was destroyed")) {
        return null;
      }
      throw error;
    }) as Promise<PcAssemblyQaRegistry | null>;
}

async function readBrunoSurfaceQa(page: Page) {
  return page
    .evaluate(
      () =>
        (window as Window & { __DESKTERIORONLINE_BRUNO_SURFACE_QA__?: BrunoSurfaceMaterialRuntimeQa })
          .__DESKTERIORONLINE_BRUNO_SURFACE_QA__ ?? null
    )
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Execution context was destroyed")) {
        return null;
      }
      throw error;
    }) as Promise<BrunoSurfaceMaterialRuntimeQa | null>;
}

async function readBrunoFurnitureQa(page: Page) {
  return page
    .evaluate(
      () =>
        (window as Window & { __DESKTERIORONLINE_BRUNO_FURNITURE_QA__?: BrunoFurnitureMaterialRuntimeQa })
          .__DESKTERIORONLINE_BRUNO_FURNITURE_QA__ ?? null
    )
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Execution context was destroyed")) {
        return null;
      }
      throw error;
    }) as Promise<BrunoFurnitureMaterialRuntimeQa | null>;
}

async function waitForRegistryState(
  page: Page,
  label: string,
  predicate: (entry: PcAssemblyQaRegistry) => boolean,
  timeoutMs = 6_000
) {
  const startedAt = Date.now();
  let entry: PcAssemblyQaRegistry | null = null;
  while (Date.now() - startedAt < timeoutMs) {
    entry = await readQaRegistry(page);
    if (entry && predicate(entry)) return entry;
    await sleep(60);
  }
  throw new Error(`${label} QA state did not settle: ${JSON.stringify(entry)}`);
}

async function waitForStableQaRegistry(page: Page, timeoutMs = 30_000, stableMs = 1_800) {
  const startedAt = Date.now();
  let stableStartedAt = 0;
  let previousSnapshot = "";
  let entry: PcAssemblyQaRegistry | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    entry = await readQaRegistry(page);
    if (!entry) {
      previousSnapshot = "";
      stableStartedAt = 0;
      await sleep(100);
      continue;
    }

    const snapshot = JSON.stringify({
      selectedCaseId: entry.selectedCaseId,
      currentStep: entry.currentStep,
      stepCount: entry.stepCount,
      roomCurrentStep: entry.roomCurrentStep,
      roomStepCount: entry.roomStepCount
    });
    if (snapshot === previousSnapshot) {
      if (stableStartedAt !== 0 && Date.now() - stableStartedAt >= stableMs) {
        return entry;
      }
    } else {
      previousSnapshot = snapshot;
      stableStartedAt = Date.now();
    }
    await sleep(100);
  }

  throw new Error(`initial QA registry did not stabilize: ${JSON.stringify(entry)}`);
}

async function waitForBrunoSurfaceMaterialQa(page: Page, timeoutMs = 20_000) {
  const startedAt = Date.now();
  let entry: BrunoSurfaceMaterialRuntimeQa | null = null;
  while (Date.now() - startedAt < timeoutMs) {
    entry = await readBrunoSurfaceQa(page);
    if (
      entry?.ktx2PackageConsumed === true &&
      entry.loadedRoles.includes("floorWoodOrm") &&
      entry.loadedRoles.includes("plasterWallOrm") &&
      entry.loadedRoles.includes("trimOrm") &&
      Object.values(entry.requestedTextureUrls).every((url) => url.endsWith(".ktx2")) &&
      entry.enhancedMaterialNames.includes("surface_uv_wood_plank_oiled_pbr") &&
      entry.enhancedMaterialNames.includes("surface_uv_plaster_warm_cool_pbr") &&
      entry.enhancedMaterialNames.includes("surface_uv_trim_satin_warm_pbr") &&
      entry.aoUv2ReadyMeshCount >= 3
    ) {
      return entry;
    }
    await sleep(100);
  }
  throw new Error(`Bruno surface material QA did not settle: ${JSON.stringify(entry)}`);
}

async function waitForBrunoFurnitureMaterialQa(page: Page, timeoutMs = 20_000) {
  const startedAt = Date.now();
  let entry: BrunoFurnitureMaterialRuntimeQa | null = null;
  while (Date.now() - startedAt < timeoutMs) {
    entry = await readBrunoFurnitureQa(page);
    if (
      entry?.ktx2PackageConsumed === true &&
      entry.loadedRoles.includes("furnitureWoodOrm") &&
      entry.loadedRoles.includes("furnitureFabricOrm") &&
      entry.loadedRoles.includes("furnitureLacquerOrm") &&
      entry.loadedRoles.includes("furnitureSpeakerOrm") &&
      Object.values(entry.requestedTextureUrls).every((url) => url.endsWith(".ktx2")) &&
      entry.enhancedMaterialNames.includes("hero_uv_oiled_walnut_pbr_1k") &&
      entry.enhancedMaterialNames.includes("hero_uv_bluegrey_fabric_pbr_1k") &&
      entry.enhancedMaterialNames.includes("hero_uv_warm_lacquer_pbr_512") &&
      entry.enhancedMaterialNames.includes("hero_uv_speaker_grille_pbr_512") &&
      entry.aoUv2ReadyMeshCount >= 4
    ) {
      return entry;
    }
    await sleep(100);
  }
  throw new Error(`Bruno furniture material QA did not settle: ${JSON.stringify(entry)}`);
}

async function waitForCaseSelection(page: Page) {
  return waitForRegistryState(
    page,
    "case selection",
    (entry) => entry.selectedCaseId === EXPECTED_CASE_ID && entry.caseSelectionComplete === true
  );
}

async function waitForQaStep(page: Page, stepId: CompletedAssemblyStep, stepCount: number) {
  const entry = await waitForRegistryState(
    page,
    stepId,
    (registryEntry) =>
      registryEntry.currentStep === stepId &&
      registryEntry.stepCount === stepCount &&
      registryEntry.completedSteps.includes(stepId)
  );
  assert(entry, `${stepId} QA registry should be present`);
  assert.equal(entry.currentStep, stepId, `${stepId} should be the current step`);
  assert.equal(entry.stepCount, stepCount, `${stepId} should advance the step counter`);
  assert.equal(entry.completedSteps.includes(stepId), true, `${stepId} should be recorded`);
  return entry;
}

async function waitForRoomQaStep(page: Page, stepId: CompletedRoomSetupStep, stepCount: number) {
  const entry = await waitForRegistryState(
    page,
    `${stepId} room`,
    (registryEntry) =>
      registryEntry.currentStep === stepId &&
      registryEntry.roomCurrentStep === stepId &&
      registryEntry.roomStepCount === stepCount &&
      registryEntry.completedRoomSteps.includes(stepId)
  );
  assert(entry, `${stepId} room QA registry should be present`);
  assert.equal(entry.currentStep, stepId, `${stepId} should be the current flow step`);
  assert.equal(entry.roomCurrentStep, stepId, `${stepId} should be the current room step`);
  assert.equal(entry.roomStepCount, stepCount, `${stepId} should advance the room step counter`);
  assert.equal(entry.completedRoomSteps.includes(stepId), true, `${stepId} should be recorded`);
  return entry;
}

async function waitForKeyboardSwitchQa(page: Page, switchProfile: string, minEvents: number) {
  const entry = await waitForRegistryState(
    page,
    `${switchProfile} keyboard switch`,
    (registryEntry) =>
      registryEntry.keyboardSwitchProfile === switchProfile &&
      (registryEntry.keyboardSwitchEvents?.length ?? 0) >= minEvents &&
      registryEntry.keyboardSwitchEvents?.includes(`keyboard-switch-${switchProfile}-press`) === true
  );
  assert(entry, `${switchProfile} keyboard switch QA registry should be present`);
  return entry;
}

async function waitForSavedQa(page: Page) {
  const entry = await waitForRegistryState(
    page,
    "saved",
    (registryEntry) =>
      registryEntry.checklistComplete === true &&
      registryEntry.flowComplete === true &&
      registryEntry.savedPayload?.currentStep === "room-lighting-set" &&
      registryEntry.savedPayload.completedSteps.length === EXPECTED_ASSEMBLY_STEPS.length &&
      registryEntry.savedPayload.totalSteps === EXPECTED_ASSEMBLY_STEPS.length &&
      registryEntry.savedPayload.roomSetup.completedSteps.length === EXPECTED_ROOM_SETUP_STEPS.length &&
      registryEntry.savedPayload.roomSetup.totalSteps === EXPECTED_ROOM_SETUP_STEPS.length &&
      registryEntry.savedPayload.pcSystem.stateMachineComplete === true &&
      registryEntry.savedPayload.pcSystem.compatibilityStatus === "pass" &&
      registryEntry.savedPayload.pcSystem.physicalFitStatus === "pass"
  );
  assert(entry, "saved QA registry should be present");
  return entry;
}

async function clickQaButton(page: Page, testId: string) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 20_000) {
    const queued = await page
      .evaluate((targetTestId) => {
        const element = document.querySelector(`[data-testid="${targetTestId}"]`);
        if (!(element instanceof HTMLButtonElement)) return false;
        if (element.disabled) return false;
        element.click();
        return true;
      }, testId)
      .catch(async (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("Execution context was destroyed")) {
          return false;
        }
        return page
          .locator(`[data-testid="${testId}"]`)
          .click({ force: true, timeout: 1_000 })
          .then(() => true);
      });

    if (queued) {
      await page.waitForTimeout(40);
      return;
    }
    await sleep(60);
  }

  const diagnostics = await page.evaluate(() => ({
    bodyText: document.body.innerText.slice(0, 1200),
    testIds: Array.from(document.querySelectorAll("[data-testid]"))
      .map((element) => element.getAttribute("data-testid"))
      .filter((value): value is string => Boolean(value))
      .slice(0, 240)
  }));

  throw new Error(`${testId} QA button was not found: ${JSON.stringify(diagnostics)}`);
}

async function captureCanvasMetrics(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="pc-assembly-canvas"] canvas');
    if (!(canvas instanceof HTMLCanvasElement) || canvas.width < 1 || canvas.height < 1) {
      return null;
    }

    const sampleWidth = 180;
    const sampleHeight = 140;
    const sample = document.createElement("canvas");
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const buckets = new Set<string>();
    const luminanceValues: number[] = [];
    let alphaTotal = 0;
    let brightPixels = 0;
    let clippedPixels = 0;
    let visiblePixels = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      const red = pixels[index] ?? 0;
      const green = pixels[index + 1] ?? 0;
      const blue = pixels[index + 2] ?? 0;
      const alpha = pixels[index + 3] ?? 0;
      alphaTotal += alpha;
      if (alpha <= 8) continue;
      visiblePixels += 1;
      buckets.add(`${Math.floor(red / 20)}:${Math.floor(green / 20)}:${Math.floor(blue / 20)}`);
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      if (luminance > 205) brightPixels += 1;
      if (luminance > 230) clippedPixels += 1;
      luminanceValues.push(luminance);
    }

    const mean = luminanceValues.reduce((sum, value) => sum + value, 0) / Math.max(1, luminanceValues.length);
    const variance =
      luminanceValues.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, luminanceValues.length);

    return {
      width: canvas.width,
      height: canvas.height,
      uniqueColorBuckets: buckets.size,
      luminanceStdDev: Math.sqrt(variance),
      meanAlpha: alphaTotal / (sampleWidth * sampleHeight),
      brightPixelRatio: brightPixels / Math.max(1, visiblePixels),
      clippedHighlightRatio: clippedPixels / Math.max(1, visiblePixels)
    } satisfies CanvasMetrics;
  }) as Promise<CanvasMetrics | null>;
}

async function captureSettledCanvasMetrics(page: Page, label: string, settleMs: number) {
  await page.waitForTimeout(settleMs);
  const metrics = await captureCanvasMetrics(page);
  assert(metrics, `${label} canvas metrics should be readable`);
  return metrics;
}

async function main() {
  verifyMeshyBuildKitOutputs();
  const baseUrl = new URL(getArg("base-url", DEFAULT_BASE_URL));
  const child = await maybeStartDevServer(baseUrl);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1360, height: 860 }, deviceScaleFactor: 1 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    (window as Window & { __DESKTERIORONLINE_DISABLE_LOADING_OVERLAY__?: boolean }).__DESKTERIORONLINE_DISABLE_LOADING_OVERLAY__ =
      true;
    (window as Window & { __DESKTERIORONLINE_DISABLE_PC_AUDIO__?: boolean }).__DESKTERIORONLINE_DISABLE_PC_AUDIO__ = true;
  });

  try {
    logQa("opening interactive workbench route");
    await page.goto(new URL(PC_ASSEMBLY_QA_PATH, baseUrl).toString(), {
      waitUntil: "domcontentloaded",
      timeout: 120_000
    });
    await page.addStyleTag({
      content:
        '[role="status"][aria-busy="true"]{display:none!important;pointer-events:none!important} nav.fixed{pointer-events:none!important}'
    });
    await page.waitForSelector('[data-testid="pc-assembly-canvas"] canvas', {
      state: "attached",
      timeout: 120_000
    });
    await page.waitForFunction(
      () =>
        Boolean(
          (window as Window & { __DESKTERIORONLINE_PC_ASSEMBLY_QA__?: PcAssemblyQaRegistry })
            .__DESKTERIORONLINE_PC_ASSEMBLY_QA__
        ),
      null,
      { timeout: 30_000 }
    );
    await waitForStableQaRegistry(page);
    logQa("interactive route is ready");

    await clickQaButton(page, `pc-case-${EXPECTED_CASE_ID}`);
    await waitForCaseSelection(page);
    logQa("case selection verified");

    for (const [index, stepId] of EXPECTED_ASSEMBLY_STEPS.entries()) {
      logQa(`assembly step ${index + 1}/${EXPECTED_ASSEMBLY_STEPS.length}: ${stepId}`);
      await clickQaButton(page, `pc-step-${stepId}`);
      await waitForQaStep(page, stepId, index + 1);
    }
    logQa("assembly steps verified");

    for (const [index, stepId] of EXPECTED_ROOM_SETUP_STEPS.entries()) {
      logQa(`room setup step ${index + 1}/${EXPECTED_ROOM_SETUP_STEPS.length}: ${stepId}`);
      await clickQaButton(page, `room-step-${stepId}`);
      await waitForRoomQaStep(page, stepId, index + 1);
    }
    logQa("room setup steps verified");

    await clickQaButton(page, "keyboard-switch-option-clicky-blue");
    await clickQaButton(page, "keyboard-switch-test-press");
    await waitForKeyboardSwitchQa(page, "clicky-blue", 1);
    logQa("keyboard switch profile and synthesized clicky audio verified");

    await clickQaButton(page, "pc-assembly-save-state");
    const finalEntry = await waitForSavedQa(page);
    logQa("saved payload verified");
    const brunoSurfaceMaterialQa = await waitForBrunoSurfaceMaterialQa(page);
    logQa(
      `Bruno surface ORM runtime verified: roles=${brunoSurfaceMaterialQa.loadedRoles.join(",")}, enhanced=${brunoSurfaceMaterialQa.enhancedMaterialNames.length}, uv2Ready=${brunoSurfaceMaterialQa.aoUv2ReadyMeshCount}, uv2Patched=${brunoSurfaceMaterialQa.uv2PatchedMeshCount}`
    );
    const brunoFurnitureMaterialQa = await waitForBrunoFurnitureMaterialQa(page);
    logQa(
      `Bruno furniture ORM runtime verified: roles=${brunoFurnitureMaterialQa.loadedRoles.join(",")}, enhanced=${brunoFurnitureMaterialQa.enhancedMaterialNames.length}, uv2Ready=${brunoFurnitureMaterialQa.aoUv2ReadyMeshCount}, uv2Patched=${brunoFurnitureMaterialQa.uv2PatchedMeshCount}`
    );

    logQa("capturing interactive canvas metrics");
    const metrics = await captureSettledCanvasMetrics(
      page,
      "PC assembly",
      2_500
    );
    logQa(
      `interactive canvas metrics: ${metrics.width}x${metrics.height}, buckets=${metrics.uniqueColorBuckets}, luma=${metrics.luminanceStdDev.toFixed(2)}, bright=${metrics.brightPixelRatio.toFixed(3)}, clipped=${metrics.clippedHighlightRatio.toFixed(3)}`
    );
    assert.ok(metrics.width >= 800 && metrics.height >= 500, "PC assembly canvas should render at workbench scale");
    assert.ok(
      metrics.uniqueColorBuckets >= 18,
      `PC assembly canvas should preserve visible material variation; uniqueColorBuckets=${metrics.uniqueColorBuckets}`
    );
    assert.ok(
      metrics.luminanceStdDev >= 12,
      `PC assembly canvas should not be visually flat; luminanceStdDev=${metrics.luminanceStdDev.toFixed(2)}`
    );
    assert.ok(metrics.meanAlpha >= 240, `PC assembly canvas should be opaque; meanAlpha=${metrics.meanAlpha.toFixed(1)}`);
    assert.equal(pageErrors.length, 0, `page errors should be absent: ${pageErrors.join(" / ")}`);

    assert.equal(finalEntry.savedPayload?.mode, "pc-assembly-workbench", "saved payload should identify PC assembly mode");
    assert.equal(finalEntry.selectedCaseId, EXPECTED_CASE_ID, "QA registry should preserve selected case");
    assert.equal(finalEntry.savedPayload?.selectedCase.id, EXPECTED_CASE_ID, "saved payload should preserve selected case");
    assert.equal(finalEntry.currentStep, "room-lighting-set", "QA registry should preserve final room setup step");
    assert.equal(finalEntry.stepCount, EXPECTED_ASSEMBLY_STEPS.length, "QA registry should include every assembly step");
    assert.equal(finalEntry.totalSteps, EXPECTED_ASSEMBLY_STEPS.length, "QA registry should expose total assembly steps");
    assert.equal(finalEntry.roomStepCount, EXPECTED_ROOM_SETUP_STEPS.length, "QA registry should include every room setup step");
    assert.equal(finalEntry.totalRoomSteps, EXPECTED_ROOM_SETUP_STEPS.length, "QA registry should expose total room setup steps");
    assert.deepEqual(finalEntry.completedSteps, [...EXPECTED_ASSEMBLY_STEPS], "completed steps should preserve exact assembly order");
    assert.deepEqual(
      finalEntry.completedRoomSteps,
      [...EXPECTED_ROOM_SETUP_STEPS],
      "completed room steps should preserve exact setup order"
    );
    assert.equal(finalEntry.savedPayload?.currentStep, "room-lighting-set", "saved payload should preserve final room step");
    assert.deepEqual(
      finalEntry.savedPayload?.completedSteps,
      [...EXPECTED_ASSEMBLY_STEPS],
      "saved payload should preserve exact assembly order"
    );
    assert.deepEqual(
      finalEntry.savedPayload?.roomSetup.completedSteps,
      [...EXPECTED_ROOM_SETUP_STEPS],
      "saved payload should preserve exact room setup order"
    );
    assert.equal(finalEntry.savedPayload?.totalSteps, EXPECTED_ASSEMBLY_STEPS.length, "saved payload should include total steps");
    assert.equal(
      finalEntry.savedPayload?.roomSetup.totalSteps,
      EXPECTED_ROOM_SETUP_STEPS.length,
      "saved payload should include total room setup steps"
    );
    assert.equal(finalEntry.savedPayload?.components.thermalPasteApplied, true, "saved payload should include thermal application");
    assert.equal(finalEntry.savedPayload?.components.ramInserted, true, "saved payload should include RAM insertion");
    assert.equal(finalEntry.savedPayload?.components.gpuInstalled, true, "saved payload should include GPU installation");
    assert.equal(finalEntry.savedPayload?.components.cablesManaged, true, "saved payload should include cable management");
    assert.equal(finalEntry.savedPayload?.components.firstBootPassed, true, "saved payload should include first boot POST");
    assert.equal(finalEntry.savedPayload?.roomSetup.pcPlacedOnDesk, true, "saved payload should include PC desk placement");
    assert.equal(finalEntry.savedPayload?.roomSetup.deskStyled, true, "saved payload should include desk styling");
    assert.equal(finalEntry.savedPayload?.roomSetup.roomStyled, true, "saved payload should include room styling");
    assert.equal(finalEntry.savedPayload?.roomSetup.brunoSimonMood, true, "saved payload should include room mood completion");
    assert.equal(finalEntry.savedPayload?.quote.parts.length, 9, "saved payload should include all quote parts");
    assert.equal(finalEntry.savedPayload?.quote.productNo, "1336041", "saved payload should preserve Compuzone product number");
    assert.equal(finalEntry.pcSystem.compatibilityStatus, "pass", "QA registry should expose passing compatibility status");
    assert.equal(finalEntry.pcSystem.physicalFitStatus, "pass", "QA registry should expose passing physical fit status");
    assert.equal(finalEntry.pcSystem.stateMachineComplete, true, "QA registry should expose complete assembly state machine");
    assert.ok(finalEntry.pcSystem.compatibilityChecks >= 6, "compatibility engine should expose multiple checks");
    assert.ok(finalEntry.pcSystem.physicalFitChecks >= 6, "physical fit engine should expose multiple checks");
    assert.ok(finalEntry.pcSystem.attachmentAnchors >= 10, "attachment system should expose PC anchors");
    assert.ok(finalEntry.pcSystem.occupiedAttachmentAnchors >= 6, "completed build should occupy core anchors");
    assert.equal(
      finalEntry.savedPayload?.pcSystem.compatibilityStatus,
      "pass",
      "saved payload should keep compatibility status"
    );
    assert.equal(
      finalEntry.savedPayload?.pcSystem.physicalFitStatus,
      "pass",
      "saved payload should keep physical fit status"
    );
    assert.equal(finalEntry.thermalPasteCoverage, 0.74, "thermal paste coverage should remain measurable");
    assert.equal(
      finalEntry.audioEvents.length,
      1 + EXPECTED_ASSEMBLY_STEPS.length + EXPECTED_ROOM_SETUP_STEPS.length,
      "case selection, each assembly step, and each room setup step should register a sound cue"
    );
    assert.equal(
      finalEntry.savedPayload?.interactions.audioEvents.length,
      1 + EXPECTED_ASSEMBLY_STEPS.length + EXPECTED_ROOM_SETUP_STEPS.length,
      "saved payload should keep every sound cue"
    );
    assert.ok(finalEntry.audioEvents.includes("case-choice-confirm"), "case selection sound should be registered");
    assert.ok(finalEntry.audioEvents.includes("ram-latch-click"), "RAM latch sound should be registered");
    assert.ok(finalEntry.audioEvents.includes("thermal-paste-press"), "thermal paste sound should be registered");
    assert.ok(finalEntry.audioEvents.includes("bios-post-beep"), "BIOS POST sound should be registered");
    assert.ok(finalEntry.audioEvents.includes("desk-placement-thud"), "PC desk placement sound should be registered");
    assert.ok(finalEntry.audioEvents.includes("room-light-swell"), "room lighting sound should be registered");
    assert.equal(finalEntry.keyboardSwitchProfile, "clicky-blue", "QA registry should preserve selected keyboard switch profile");
    assert.ok(
      finalEntry.keyboardSwitchEvents?.includes("keyboard-switch-clicky-blue-press"),
      "QA registry should record clicky-blue keyboard press events"
    );
    assert.equal(
      finalEntry.savedPayload?.interactions.keyboardSwitchProfile,
      "clicky-blue",
      "saved payload should preserve selected keyboard switch profile"
    );
    assert.ok(
      finalEntry.savedPayload?.interactions.keyboardSwitchEvents?.includes("keyboard-switch-clicky-blue-press"),
      "saved payload should preserve keyboard switch press events"
    );

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const screenshotPath = path.join(OUTPUT_DIR, "pc-assembly-workbench.png");
    logQa("saving interactive screenshot");
    await page.screenshot({ path: screenshotPath, fullPage: false });
    logQa("interactive screenshot saved");

    await page.setViewportSize({ width: 1600, height: 1060 });
    logQa("promoting completed page to cinematic capture layout");
    await page.addStyleTag({
      content: `
        html, body {
          width: 100vw !important;
          height: 100vh !important;
          overflow: hidden !important;
          background: #05070a !important;
        }
        body > div,
        main {
          width: 100vw !important;
          height: 100vh !important;
          min-height: 100vh !important;
          overflow: hidden !important;
          background: #05070a !important;
        }
        nav,
        header,
        aside,
        main > section > div:first-child > div:first-child:not([data-testid]) {
          display: none !important;
        }
        main > section {
          display: block !important;
          width: 100vw !important;
          height: 100vh !important;
          min-height: 100vh !important;
          max-width: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        main > section > div:first-child {
          position: fixed !important;
          inset: 0 !important;
          width: 100vw !important;
          height: 100vh !important;
          overflow: hidden !important;
          border: 0 !important;
          border-radius: 0 !important;
          background: #05070a !important;
          box-shadow: none !important;
          z-index: 9999 !important;
        }
        [data-testid="pc-assembly-canvas"] {
          width: 100vw !important;
          height: 100vh !important;
          min-height: 100vh !important;
        }
        [data-testid="pc-assembly-canvas"] canvas {
          width: 100vw !important;
          height: 100vh !important;
          display: block !important;
        }
      `
    });
    await page.evaluate(() => {
      document.body.dataset.pcAssemblyCinematicCapture = "1";
      window.dispatchEvent(new Event("resize"));
    });
    await waitForRegistryState(
      page,
      "cinematic final room",
      (entry) =>
        entry.flowComplete === true &&
        entry.stepCount === EXPECTED_ASSEMBLY_STEPS.length &&
        entry.roomStepCount === EXPECTED_ROOM_SETUP_STEPS.length &&
        entry.brunoSimonMood === true,
      30_000
    );
    logQa("cinematic final state verified");
    logQa("capturing cinematic canvas metrics");
    const cinematicMetrics = await captureSettledCanvasMetrics(
      page,
      "cinematic PC assembly",
      7_500
    );
    logQa(
      `cinematic canvas metrics: ${cinematicMetrics.width}x${cinematicMetrics.height}, buckets=${cinematicMetrics.uniqueColorBuckets}, luma=${cinematicMetrics.luminanceStdDev.toFixed(2)}, bright=${cinematicMetrics.brightPixelRatio.toFixed(3)}, clipped=${cinematicMetrics.clippedHighlightRatio.toFixed(3)}`
    );
    assert.ok(
      cinematicMetrics.width >= 1200 && cinematicMetrics.height >= 800,
      `cinematic canvas should render at large screenshot scale; ${cinematicMetrics.width}x${cinematicMetrics.height}`
    );
    assert.ok(
      cinematicMetrics.uniqueColorBuckets >= 26,
      `cinematic room should preserve richer material variation; uniqueColorBuckets=${cinematicMetrics.uniqueColorBuckets}`
    );
    assert.ok(
      cinematicMetrics.luminanceStdDev >= 14,
      `cinematic room should preserve readable warm/cool contrast; luminanceStdDev=${cinematicMetrics.luminanceStdDev.toFixed(2)}`
    );
    assert.ok(
      cinematicMetrics.brightPixelRatio <= 0.12,
      `cinematic room should avoid broad highlight washout; brightPixelRatio=${cinematicMetrics.brightPixelRatio.toFixed(3)}`
    );
    assert.ok(
      cinematicMetrics.clippedHighlightRatio <= 0.055,
      `cinematic room should avoid clipped practical-light glare; clippedHighlightRatio=${cinematicMetrics.clippedHighlightRatio.toFixed(3)}`
    );
    const cinematicScreenshotPath = path.join(OUTPUT_DIR, "pc-assembly-workbench-cinematic.png");
    logQa("saving cinematic screenshot");
    await page.screenshot({ path: cinematicScreenshotPath, fullPage: false });
    logQa("cinematic screenshot saved");

    console.log(
      JSON.stringify(
        {
          route: PC_ASSEMBLY_ROUTE,
          currentStep: finalEntry.currentStep,
          selectedCaseId: finalEntry.selectedCaseId,
          stepCount: finalEntry.stepCount,
          totalSteps: finalEntry.totalSteps,
          roomStepCount: finalEntry.roomStepCount,
          totalRoomSteps: finalEntry.totalRoomSteps,
          thermalPasteCoverage: finalEntry.thermalPasteCoverage,
          audioEvents: finalEntry.audioEvents,
          saved: finalEntry.savedPayload !== null,
          brunoSurfaceOrmConsumed: brunoSurfaceMaterialQa.ktx2PackageConsumed,
          brunoSurfaceOrmRoles: brunoSurfaceMaterialQa.loadedRoles,
          brunoSurfaceEnhancedMaterials: brunoSurfaceMaterialQa.enhancedMaterialNames,
          brunoSurfaceAoUv2ReadyMeshCount: brunoSurfaceMaterialQa.aoUv2ReadyMeshCount,
          brunoSurfaceUv2PatchedMeshCount: brunoSurfaceMaterialQa.uv2PatchedMeshCount,
          brunoFurnitureOrmConsumed: brunoFurnitureMaterialQa.ktx2PackageConsumed,
          brunoFurnitureOrmRoles: brunoFurnitureMaterialQa.loadedRoles,
          brunoFurnitureEnhancedMaterials: brunoFurnitureMaterialQa.enhancedMaterialNames,
          brunoFurnitureAoUv2ReadyMeshCount: brunoFurnitureMaterialQa.aoUv2ReadyMeshCount,
          brunoFurnitureUv2PatchedMeshCount: brunoFurnitureMaterialQa.uv2PatchedMeshCount,
          uniqueColorBuckets: metrics.uniqueColorBuckets,
          luminanceStdDev: Number(metrics.luminanceStdDev.toFixed(2)),
          screenshot: path.relative(REPO_ROOT, screenshotPath),
          cinematicUniqueColorBuckets: cinematicMetrics.uniqueColorBuckets,
          cinematicLuminanceStdDev: Number(cinematicMetrics.luminanceStdDev.toFixed(2)),
          cinematicBrightPixelRatio: Number(cinematicMetrics.brightPixelRatio.toFixed(3)),
          cinematicClippedHighlightRatio: Number(cinematicMetrics.clippedHighlightRatio.toFixed(3)),
          cinematicScreenshot: path.relative(REPO_ROOT, cinematicScreenshotPath)
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
