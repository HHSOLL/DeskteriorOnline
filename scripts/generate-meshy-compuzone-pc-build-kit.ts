import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  evaluateMeshyBudgetGuard,
  extractAssetProviderJobId,
  extractAssetProviderModelUrl
} from "../apps/worker/src/processors/asset-generation-processor";
import { resolveProductAssetCategoryProfile } from "../apps/worker/src/processors/product-asset-category-profiles";
import { finalizeProductAssetCandidate } from "../apps/worker/src/processors/product-asset-finalizer";

type MeshyCompuzonePcBuildReport = {
  schemaVersion: "meshy-compuzone-pc-build-kit-v1";
  generatedAt: string;
  source: {
    productUrl: string;
    productNo: string;
    listingTitle: string;
    commercialUse: "private_prototype_requires_review";
  };
  asset: {
    catalogItemId: string;
    label: string;
    prompt: string;
    dimensionsMm: { width: number; depth: number; height: number };
    previewTaskId?: string;
    refineTaskId?: string;
    modelUrl?: string;
    outputGlb: string;
    outputProxyGlb: string;
    outputThumbnail: string;
    finalizerStatus: string;
    warnings: string[];
  };
  parts: Array<{
    category: string;
    label: string;
    slot: string;
  }>;
  budget: {
    source: "mesh_balance_api" | "env";
    remaining: number | null;
    costPerTask: number;
    maxBudgetPerJob: number;
    reservedEstimate: number;
  };
};

const MODULE_DIR =
  typeof import.meta.dirname === "string" ? import.meta.dirname : path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, "..");
const requireFromWeb = createRequire(path.join(REPO_ROOT, "apps/web/package.json"));
const sharp = requireFromWeb("sharp") as typeof import("sharp");

const CATALOG_ITEM_ID = "compuzone_p2364w_pc_build_kit";
const LABEL = "Compuzone P2364W White PC Build Kit";
const PRODUCT_URL = "https://www.compuzone.co.kr/product/product_detail.htm?ProductNo=1336041";
const PRODUCT_NO = "1336041";
const LISTING_TITLE = "[컴퓨존] 프리미엄 조립PC_P2364W (9800X3D/5080)";
const DIMENSIONS_MM = { width: 420, depth: 270, height: 390 };
const PARTS = [
  {
    category: "CPU",
    label: "[AMD] 라이젠7 그래니트 9800X3D (8코어/16스레드/4.7GHz/쿨러미포함) [멀티팩]",
    slot: "AM5 CPU socket"
  },
  {
    category: "그래픽카드",
    label: "[ASUS] ROG Astral 지포스 RTX 5080 OC D7 16GB white 인텍앤컴퍼니",
    slot: "PCIe 5.0 x16 slot"
  },
  {
    category: "메인보드",
    label: "[GIGABYTE] B850M AORUS ELITE WIFI6E ICE 피씨디렉트 (AMD B850/M-ATX)",
    slot: "case motherboard tray"
  },
  {
    category: "메모리",
    label: "[에센코어] KLEVV DDR5 PC5-48000 CL30 URBANE V RGB WHITE 서린 [32GB (16GB*2)] (6000)",
    slot: "DDR5 DIMM slots A2/B2"
  },
  {
    category: "SSD",
    label: "[에센코어] KLEVV CRAS C930 M.2 NVMe 2280 [1TB] 히트싱크 PC",
    slot: "M.2 2280 slot"
  },
  {
    category: "케이스",
    label: "[LIAN-LI] O11D MINI V2 FLOW [미들타워] [화이트]",
    slot: "case shell"
  },
  {
    category: "파워",
    label: "[LIAN-LI] EDGE GOLD 1000 ATX3.1 1000W [화이트]",
    slot: "PSU bay"
  },
  {
    category: "케이스쿨러",
    label: "[LIAN-LI] UNI FAN TL Wireless 120 [시스템쿨러/120mm] [1PACK] [화이트]",
    slot: "case fan mount"
  },
  {
    category: "쿨러",
    label: "[LIAN-LI] Hydroshift II LCD-C 360TL [CPU쿨러] [화이트]",
    slot: "CPU cold plate and 360mm radiator mount"
  }
];

const PROMPT = [
  "Private prototype web-ready GLB for a PC assembly simulator.",
  "Make one clean white exploded desktop PC build kit, no logos, trademarks, text, packaging, people, or background.",
  "Include compact white glass case, white M-ATX motherboard, AM5 CPU, 2 white DDR5 RGB sticks, black M.2 SSD, large white triple-fan RTX 5080-class GPU, white PSU, one white 120mm fan, white 360mm AIO radiator with 3 fans and round LCD pump.",
  "Keep parts slightly separated near final slots for isometric assembly reading.",
  "Toy-like bevels, PBR white plastic, frosted glass, brushed metal, subtle cyan/pink RGB, centered pivot, upright floor plane."
].join(" ");

const OUTPUT_MODELS_ROOT = path.join(REPO_ROOT, "apps/web/public/assets/models");
const OUTPUT_THUMB_ROOT = path.join(REPO_ROOT, "apps/web/public/assets/catalog/thumbnails");
const REFERENCE_ROOT = path.join(REPO_ROOT, "assets/references/compuzone-p2364w-pc-build");
const REPORT_PATH = path.join(REFERENCE_ROOT, "meshy-compuzone-pc-build-kit-report.json");
const RAW_OUTPUT_ROOT = path.join("/tmp", "deskterior-meshy-compuzone-pc-build", CATALOG_ITEM_ID);

const DEFAULT_TEXT_TO_3D_TASK_COST = 30;
const DEFAULT_MAX_BUDGET_PER_JOB = 60;
let reservedMeshyBudget = 0;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function parseOptionalBudgetNumber(name: string) {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number.`);
  return parsed;
}

async function loadWorkerEnv() {
  const envPath = path.join(REPO_ROOT, "apps/worker/.env.local");
  if (!existsSync(envPath)) return;
  const source = await readFile(envPath, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] ??= value;
  }
}

async function fetchMeshyBalance() {
  const apiKey = requireEnv("MESHY_API_KEY");
  const response = await fetch("https://api.meshy.ai/openapi/v1/balance", {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store"
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Meshy balance request failed (${response.status}).`);
  }
  const balance = data && typeof data === "object" && "balance" in data ? Number(data.balance) : NaN;
  if (!Number.isFinite(balance)) {
    throw new Error(`Meshy balance response did not include a finite balance: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return balance;
}

async function prepareBudgetDefaults() {
  const envRemaining =
    parseOptionalBudgetNumber("MESHY_SCENE_BUDGET_REMAINING") ?? parseOptionalBudgetNumber("MESHY_BUDGET_REMAINING");
  const costPerTask =
    parseOptionalBudgetNumber("MESHY_SCENE_BUDGET_COST_PER_TASK") ??
    parseOptionalBudgetNumber("MESHY_BUDGET_COST_PER_TASK") ??
    DEFAULT_TEXT_TO_3D_TASK_COST;
  const maxBudgetPerJob =
    parseOptionalBudgetNumber("MESHY_SCENE_MAX_BUDGET_PER_JOB") ??
    parseOptionalBudgetNumber("MESHY_MAX_BUDGET_PER_JOB") ??
    DEFAULT_MAX_BUDGET_PER_JOB;

  if (envRemaining !== undefined) {
    process.env.MESHY_SCENE_BUDGET_REMAINING = String(envRemaining);
    process.env.MESHY_SCENE_BUDGET_COST_PER_TASK = String(costPerTask);
    process.env.MESHY_SCENE_MAX_BUDGET_PER_JOB = String(maxBudgetPerJob);
    return { source: "env" as const, remaining: envRemaining, costPerTask, maxBudgetPerJob };
  }

  const balance = await fetchMeshyBalance();
  process.env.MESHY_SCENE_BUDGET_REMAINING = String(balance);
  process.env.MESHY_SCENE_BUDGET_COST_PER_TASK = String(costPerTask);
  process.env.MESHY_SCENE_MAX_BUDGET_PER_JOB = String(maxBudgetPerJob);
  return { source: "mesh_balance_api" as const, remaining: balance, costPerTask, maxBudgetPerJob };
}

function reserveMeshyBudget(label: string) {
  const status = evaluateMeshyBudgetGuard({
    policy: process.env.MESHY_SCENE_BUDGET_MODE === "optional" ? "optional" : "required",
    remainingBudget:
      parseOptionalBudgetNumber("MESHY_SCENE_BUDGET_REMAINING") ??
      parseOptionalBudgetNumber("MESHY_BUDGET_REMAINING"),
    reserveBudget:
      parseOptionalBudgetNumber("MESHY_SCENE_BUDGET_RESERVE") ?? parseOptionalBudgetNumber("MESHY_BUDGET_RESERVE"),
    costPerTask:
      parseOptionalBudgetNumber("MESHY_SCENE_BUDGET_COST_PER_TASK") ??
      parseOptionalBudgetNumber("MESHY_BUDGET_COST_PER_TASK"),
    maxBudgetPerJob:
      parseOptionalBudgetNumber("MESHY_SCENE_MAX_BUDGET_PER_JOB") ??
      parseOptionalBudgetNumber("MESHY_MAX_BUDGET_PER_JOB"),
    reservedBudget: reservedMeshyBudget,
    requestCount: 1,
    attemptsPerRequest: 1
  });

  if (!status.allowed) {
    const detail =
      status.availableBudget === null
        ? "Set Meshy budget env or allow the script to read the Meshy balance API before POST."
        : `estimated ${status.estimatedBudgetUse} credit units with ${Math.max(
            0,
            status.availableBudget
          )} available after reserve`;
    throw new Error(`${status.reason ?? "MESHY_BUDGET_BLOCKED"}: ${label} blocked before Meshy request; ${detail}`);
  }

  reservedMeshyBudget += status.estimatedBudgetUse;
  return status.estimatedBudgetUse;
}

async function postMeshyTextTask(payload: Record<string, unknown>) {
  reserveMeshyBudget(`text-to-3d ${typeof payload.mode === "string" ? payload.mode : "task"}`);
  const apiUrl = process.env.MESHY_TEXT_TO_3D_API_URL ?? "https://api.meshy.ai/openapi/v2/text-to-3d";
  const apiKey = requireEnv("MESHY_API_KEY");
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Meshy text-to-3D request failed (${response.status}): ${JSON.stringify(data).slice(0, 400)}`);
  }
  const taskId = extractAssetProviderJobId(data);
  if (!taskId) throw new Error(`Meshy text-to-3D did not return a task id: ${JSON.stringify(data).slice(0, 400)}`);
  return taskId;
}

async function pollMeshyTextTask(taskId: string) {
  const apiUrl = process.env.MESHY_TEXT_TO_3D_API_URL ?? "https://api.meshy.ai/openapi/v2/text-to-3d";
  const apiKey = requireEnv("MESHY_API_KEY");
  const pollIntervalMs = Number.parseInt(process.env.ASSET_GENERATION_POLL_INTERVAL_MS ?? "5000", 10);
  const maxPolls = Math.max(
    120,
    Number.parseInt(process.env.MESHY_TEXT_TO_3D_MAX_POLLS ?? process.env.ASSET_GENERATION_MAX_POLLS ?? "180", 10)
  );

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    const response = await fetch(`${apiUrl.replace(/\/$/, "")}/${taskId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`Meshy text-to-3D status failed (${response.status}): ${JSON.stringify(data).slice(0, 400)}`);
    }
    const modelUrl = extractAssetProviderModelUrl(data);
    if (modelUrl) return { modelUrl, taskId };
    const state =
      typeof data === "object" && data && "status" in data ? String((data as Record<string, unknown>).status) : "";
    if (["FAILED", "failed", "CANCELED", "canceled", "EXPIRED", "expired"].includes(state)) {
      const taskError =
        data && typeof data === "object" && "task_error" in data
          ? JSON.stringify((data as Record<string, unknown>).task_error)
          : "";
      throw new Error(`Meshy text-to-3D task ${taskId} ended with status ${state}${taskError ? `: ${taskError}` : ""}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Meshy text-to-3D task ${taskId} timed out.`);
}

async function downloadModel(modelUrl: string) {
  const response = await fetch(modelUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Meshy GLB download failed (${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 1024) throw new Error("Meshy GLB is unexpectedly small.");
  return buffer;
}

function buildReferencePack() {
  return {
    sourceUrl: PRODUCT_URL,
    product: {
      title: LABEL,
      sku: CATALOG_ITEM_ID,
      manufacturer: "Compuzone estimate private prototype",
      dimensionsMm: DIMENSIONS_MM,
      finishColor: "White",
      finishMaterial: "White PC components, glass, plastic, painted metal"
    },
    referenceImages: [],
    extraction: {
      dimensionSource: "compuzone_listing_plus_user_screenshot_private_prototype",
      warnings: ["BRANDED_SKU_PROTOTYPE_REQUIRES_LICENSE_AND_HUMAN_VISUAL_QA"]
    },
    generation: {
      provider: "meshy",
      mode: "text-to-3d",
      prompt: PROMPT,
      parts: PARTS
    }
  };
}

async function createFallbackThumbnail() {
  const svg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="42" fill="#f5f7fb"/>
      <rect x="112" y="74" width="286" height="348" rx="28" fill="#ffffff" stroke="#cfd8e3" stroke-width="12"/>
      <rect x="144" y="105" width="206" height="278" rx="18" fill="#e9f7ff" stroke="#cbd8e4" stroke-width="8"/>
      <rect x="174" y="144" width="112" height="120" rx="10" fill="#dfe8ef"/>
      <rect x="296" y="158" width="30" height="116" rx="8" fill="#d9f4ff"/>
      <rect x="158" y="288" width="178" height="52" rx="12" fill="#f8fbff" stroke="#b7c4d0" stroke-width="7"/>
      <circle cx="194" cy="314" r="18" fill="#9fe9ff"/>
      <circle cx="250" cy="314" r="18" fill="#ffb6cf"/>
      <circle cx="306" cy="314" r="18" fill="#ffe28a"/>
    </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();
}

async function finalizeForCatalog(sourceGlb: Buffer) {
  const profile = resolveProductAssetCategoryProfile({
    title: LABEL,
    sku: CATALOG_ITEM_ID,
    manufacturer: "Compuzone private prototype",
    categoryHint: "pc_case"
  });
  return finalizeProductAssetCandidate({
    jobId: `meshy-compuzone-pc-build-${CATALOG_ITEM_ID}`,
    candidateIndex: 0,
    fileName: LABEL,
    buffer: sourceGlb.buffer.slice(sourceGlb.byteOffset, sourceGlb.byteOffset + sourceGlb.byteLength),
    dimensionsMm: DIMENSIONS_MM,
    referencePack: buildReferencePack(),
    categoryProfile: profile
  });
}

async function copyOutputs(input: { finalGlb: ArrayBuffer; thumbnailBuffer: Buffer | null }) {
  const modelDir = path.join(OUTPUT_MODELS_ROOT, CATALOG_ITEM_ID);
  await Promise.all([mkdir(modelDir, { recursive: true }), mkdir(OUTPUT_THUMB_ROOT, { recursive: true })]);
  const outputGlb = path.join(modelDir, `${CATALOG_ITEM_ID}.glb`);
  const outputProxyGlb = path.join(modelDir, `${CATALOG_ITEM_ID}.proxy.glb`);
  const outputThumbnail = path.join(OUTPUT_THUMB_ROOT, `${CATALOG_ITEM_ID}.webp`);

  const finalBuffer = Buffer.from(input.finalGlb);
  await Promise.all([writeFile(outputGlb, finalBuffer), writeFile(outputProxyGlb, finalBuffer)]);
  await writeFile(outputThumbnail, input.thumbnailBuffer ?? (await createFallbackThumbnail()));
  return { outputGlb, outputProxyGlb, outputThumbnail };
}

async function generateMeshyAsset() {
  const previewTaskId = await postMeshyTextTask({
    mode: "preview",
    prompt: PROMPT,
    ai_model: "meshy-6",
    model_type: "standard",
    should_remesh: true,
    target_formats: ["glb"],
    symmetry_mode: "auto",
    auto_size: false
  });
  const preview = await pollMeshyTextTask(previewTaskId);

  const refineTaskId = await postMeshyTextTask({
    mode: "refine",
    preview_task_id: preview.taskId,
    ai_model: "meshy-6",
    enable_pbr: true,
    texture_prompt: PROMPT,
    target_formats: ["glb"],
    auto_size: false
  });
  const refined = await pollMeshyTextTask(refineTaskId);
  return { previewTaskId, refineTaskId, modelUrl: refined.modelUrl };
}

async function main() {
  await loadWorkerEnv();
  requireEnv("MESHY_API_KEY");
  const budget = await prepareBudgetDefaults();
  const { previewTaskId, refineTaskId, modelUrl } = await generateMeshyAsset();
  const generatedGlb = await downloadModel(modelUrl);

  await mkdir(RAW_OUTPUT_ROOT, { recursive: true });
  await writeFile(path.join(RAW_OUTPUT_ROOT, "meshy-raw.glb"), generatedGlb);

  const finalized = await finalizeForCatalog(generatedGlb);
  const outputs = await copyOutputs({
    finalGlb: finalized.buffer,
    thumbnailBuffer: finalized.thumbnailBuffer
  });

  await mkdir(REFERENCE_ROOT, { recursive: true });
  const report: MeshyCompuzonePcBuildReport = {
    schemaVersion: "meshy-compuzone-pc-build-kit-v1",
    generatedAt: new Date().toISOString(),
    source: {
      productUrl: PRODUCT_URL,
      productNo: PRODUCT_NO,
      listingTitle: LISTING_TITLE,
      commercialUse: "private_prototype_requires_review"
    },
    asset: {
      catalogItemId: CATALOG_ITEM_ID,
      label: LABEL,
      prompt: PROMPT,
      dimensionsMm: DIMENSIONS_MM,
      previewTaskId,
      refineTaskId,
      modelUrl,
      outputGlb: outputs.outputGlb,
      outputProxyGlb: outputs.outputProxyGlb,
      outputThumbnail: outputs.outputThumbnail,
      finalizerStatus: finalized.report.status,
      warnings: finalized.report.warnings
    },
    parts: PARTS,
    budget: {
      ...budget,
      reservedEstimate: reservedMeshyBudget
    }
  };
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`Meshy Compuzone PC build kit saved: ${outputs.outputGlb}`);
  console.log(`Thumbnail saved: ${outputs.outputThumbnail}`);
  console.log(`Report saved: ${REPORT_PATH}`);
  console.log(`Reserved budget estimate: ${reservedMeshyBudget}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
