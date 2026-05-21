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

type MeshyRoomDecorReport = {
  schemaVersion: "meshy-room-decor-asset-v1";
  generatedAt: string;
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

const CATALOG_ITEM_ID = "p2s_meshy_pastel_mascot_stack";
const LABEL = "Meshy Pastel Mascot Stack";
const DIMENSIONS_MM = { width: 180, depth: 120, height: 150 };
const PROMPT = [
  "A single original web-ready GLB asset for a cozy isometric creator room.",
  "Design a compact pyramid stack of small rounded vinyl desk mascot figures on a low display base.",
  "Soft toy-like shapes, pastel mint coral yellow blue lavender colors, glossy plastic with PBR roughness variation.",
  "Readable from an isometric camera as shelf decor, Bruno-Simon-inspired diorama mood but no copied character, no logo, no text.",
  "One clean object only, upright on the floor plane, centered pivot, no room, no shelf, no background, no hands, no packaging.",
  "Add small bevels and material separation so it catches warm and cool room lighting."
].join(" ");

const OUTPUT_MODELS_ROOT = path.join(REPO_ROOT, "apps/web/public/assets/models");
const OUTPUT_THUMB_ROOT = path.join(REPO_ROOT, "apps/web/public/assets/catalog/thumbnails");
const REFERENCE_ROOT = path.join(REPO_ROOT, "assets/references/meshy-room-decor");
const REPORT_PATH = path.join(REFERENCE_ROOT, "meshy-room-decor-report.json");
const RAW_OUTPUT_ROOT = path.join("/tmp", "deskterior-meshy-room-decor", CATALOG_ITEM_ID);

const DEFAULT_TEXT_TO_3D_TASK_COST = 30;
const DEFAULT_MAX_BUDGET_PER_JOB = 60;
let reservedMeshySceneBudget = 0;

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

function reserveMeshySceneBudget(label: string) {
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
    reservedBudget: reservedMeshySceneBudget,
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

  reservedMeshySceneBudget += status.estimatedBudgetUse;
  return status.estimatedBudgetUse;
}

async function postMeshyTextTask(payload: Record<string, unknown>) {
  reserveMeshySceneBudget(`text-to-3d ${typeof payload.mode === "string" ? payload.mode : "task"}`);
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
    sourceUrl: "https://docs.meshy.ai/en/api/text-to-3d",
    product: {
      title: LABEL,
      sku: CATALOG_ITEM_ID,
      manufacturer: "Meshy text-to-3D prototype",
      dimensionsMm: DIMENSIONS_MM,
      finishColor: "Pastel multicolor",
      finishMaterial: "PBR glossy vinyl plastic"
    },
    referenceImages: [],
    extraction: {
      dimensionSource: "text_prompt_visual_estimate_pending_qa",
      warnings: ["TEXT_TO_3D_PROTOTYPE_REQUIRES_HUMAN_VISUAL_QA"]
    },
    generation: {
      provider: "meshy",
      mode: "text-to-3d",
      prompt: PROMPT
    }
  };
}

async function createFallbackThumbnail() {
  const svg = `
    <svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="48" fill="#f5f1e8"/>
      <ellipse cx="256" cy="386" rx="154" ry="36" fill="#c8b8a4" opacity="0.35"/>
      <rect x="152" y="330" width="208" height="34" rx="12" fill="#c8945f"/>
      <circle cx="256" cy="174" r="48" fill="#98d9cf"/>
      <circle cx="202" cy="238" r="50" fill="#f0a5a8"/>
      <circle cx="310" cy="238" r="50" fill="#f4d06f"/>
      <circle cx="154" cy="304" r="46" fill="#aeb8ee"/>
      <circle cx="256" cy="306" r="50" fill="#e8c3f2"/>
      <circle cx="356" cy="304" r="46" fill="#7fcf8c"/>
    </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();
}

async function finalizeForCatalog(sourceGlb: Buffer) {
  const profile = resolveProductAssetCategoryProfile({
    title: LABEL,
    sku: CATALOG_ITEM_ID,
    manufacturer: "Meshy",
    categoryHint: "decor"
  });
  return finalizeProductAssetCandidate({
    jobId: `meshy-room-decor-${CATALOG_ITEM_ID}`,
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
    preview_task_id: previewTaskId,
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
  const report: MeshyRoomDecorReport = {
    schemaVersion: "meshy-room-decor-asset-v1",
    generatedAt: new Date().toISOString(),
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
    budget: {
      ...budget,
      reservedEstimate: reservedMeshySceneBudget
    }
  };
  await writeFile(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log(`Meshy room decor asset saved: ${outputs.outputGlb}`);
  console.log(`Thumbnail saved: ${outputs.outputThumbnail}`);
  console.log(`Report saved: ${REPORT_PATH}`);
  console.log(`Reserved budget estimate: ${reservedMeshySceneBudget}`);
}

if (!existsSync(path.join(REPO_ROOT, "apps/worker/.env.local")) && !process.env.MESHY_API_KEY) {
  console.error("MESHY_API_KEY is required in the environment or apps/worker/.env.local.");
  process.exitCode = 1;
} else {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
