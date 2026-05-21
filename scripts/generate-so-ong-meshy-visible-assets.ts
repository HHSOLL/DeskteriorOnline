import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  evaluateMeshyBudgetGuard,
  extractAssetProviderJobId,
  extractAssetProviderModelUrl
} from "../apps/worker/src/processors/asset-generation-processor";
import { resolveProductAssetCategoryProfile } from "../apps/worker/src/processors/product-asset-category-profiles";
import { finalizeProductAssetCandidate } from "../apps/worker/src/processors/product-asset-finalizer";
import {
  SO_ONG_VIDEO_VISIBLE_PRODUCTS,
  type SoOngVideoProduct
} from "../apps/web/src/lib/builder/so-ong-video-reference";

type MeshyTaskState = "queued" | "running" | "succeeded" | "failed" | "expired" | "canceled";

type MeshyGenerationReportItem = {
  catalogItemId: string;
  label: string;
  sourceUrl: string;
  referenceImageUrl: string;
  referenceSource: "product_page_or_official" | "reference_photo_fallback";
  taskId?: string;
  modelUrl?: string;
  outputGlb: string;
  outputProxyGlb: string;
  outputThumbnail: string;
  finalizerStatus: string;
  warnings: string[];
  startedAt: string;
  completedAt?: string;
  error?: string;
};

const MODULE_DIR =
  typeof import.meta.dirname === "string" ? import.meta.dirname : path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, "..");
const requireFromWorker = createRequire(path.join(REPO_ROOT, "apps/worker/package.json"));
const sharp = requireFromWorker("sharp") as typeof import("sharp");
const OUTPUT_MODELS_ROOT = path.join(REPO_ROOT, "apps/web/public/assets/models");
const OUTPUT_THUMB_ROOT = path.join(REPO_ROOT, "apps/web/public/assets/catalog/thumbnails");
const REFERENCE_ROOT = path.join(
  REPO_ROOT,
  "assets/references/video-scenes/so-ong-space-2026-05-desk-setup"
);
const MESHY_REFERENCE_IMAGE_ROOT = path.join(REFERENCE_ROOT, "meshy-reference-images");
const MESHY_REPORT_PATH = path.join(REFERENCE_ROOT, "meshy-generation-report.json");
const MESHY_WORK_ROOT = path.join("/tmp", "deskterior-so-ong-meshy");

const DIRECT_REFERENCE_IMAGES: Record<string, string> = {
  p2s_video_so_ong_tfg40q14wp_monitor: "https://photo3.enuri.info/data/images/service/middle/79398000/79398839.jpg",
  p2s_video_so_ong_cpm1610iq_portable_monitor: "https://ai.esmplus.com/camel2/2019/CPM1610IQ/CPM1610IQ_00.jpg",
  p2s_video_so_ong_empathist_stand:
    "https://asset.29cm.co.kr/next-contents/2023/06/08/3f8131682d124d16b336774ba51c4a3e_20230608162823.png",
  p2s_video_so_ong_ivy_planter: "https://ae01.alicdn.com/kf/Sa3c58dda3e84425d8a009573fcfc2237l.jpg",
  p2s_video_so_ong_sml_spacecraft:
    "http://shop.stickymonsterlab.com/design/smlsales/img/product/SS001(1).jpg",
  p2s_video_so_ong_divoom_times_gate:
    "https://divoom.com/cdn/shop/files/ebf94caeef5f4c89422c6c9bb7aa53a8_786ac76e-8737-4c03-ade6-d97192c18bbb.png?v=1775554152",
  p2s_video_so_ong_charging_reel_cable:
    "https://ae01.alicdn.com/kf/S6ecffd6d18c44816803f94738821032fJ.jpg",
  p2s_video_so_ong_square1_power_cube:
    "https://prs.ohousecdn.com/apne2/any/uploads/productions/images/v1-300964412076096.png?w=640&h=640&c=c",
  p2s_video_so_ong_gravastar_mars_pro:
    "https://www.gravastar.com/cdn/shop/files/gravastarmarsprobluetoothspeakerbestdesign.webp?v=1776237811&width=1200",
  p2s_video_so_ong_diecast_car: "https://ae01.alicdn.com/kf/S99ef3169be8442aa91a0aaeaa2523297J.jpg",
  p2s_video_so_ong_arturia_minifuse2:
    "https://medias.arturia.net/cdn-cgi/image/quality=80/images/products/minifuse-2/webstore/white/01.png",
  p2s_video_so_ong_offrame_dual_monitor_riser: "https://cdn.imweb.me/thumbnail/20250914/0ff41eaf2138a.png",
  p2s_video_so_ong_razer_cobra_pro_white:
    "https://medias-p1.phoenix.razer.com/sys-master-phoenix-images-container/h15/h90/9776036315166/240509-cobra-pro-white-2-1500x1000-1.png",
  p2s_video_so_ong_angry_miao_am_hatsu:
    "https://www.yankodesign.com/images/design_news/2021/05/auto-draft/am_hatsu_keyboard_1.jpg",
  p2s_video_so_ong_reproducer_epic5:
    "https://www.reproduceraudiolabs.com/uploads/1/3/2/5/132534932/published/1199691953108760-3gtwgchhiyqjinnntnbv-height640.png?1610123227",
  p2s_video_so_ong_hyte_y70_snow_white:
    "https://cdn11.bigcommerce.com/s-k28u1tc9ki/product_images/attribute_rule_images/82_source_1708009941.jpg"
};

const REFERENCE_PHOTO_FALLBACKS: Record<string, string> = {
  p2s_video_so_ong_zionworks_synchronize_mat: path.join(
    OUTPUT_THUMB_ROOT,
    "p2s_video_so_ong_zionworks_synchronize_mat.webp"
  )
};

function loadEnv() {
  for (const file of [
    path.join(REPO_ROOT, ".env"),
    path.join(REPO_ROOT, ".env.local"),
    path.join(REPO_ROOT, "apps/worker/.env"),
    path.join(REPO_ROOT, "apps/worker/.env.local"),
    path.join(REPO_ROOT, "apps/web/.env"),
    path.join(REPO_ROOT, "apps/web/.env.local")
  ]) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

function parseArgs() {
  const ids = new Set<string>();
  let limit: number | null = null;
  let force = false;
  let startAfter: string | null = null;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--ids=")) {
      for (const id of arg.slice("--ids=".length).split(",")) {
        if (id.trim()) ids.add(id.trim());
      }
    } else if (arg.startsWith("--limit=")) {
      limit = Math.max(1, Number.parseInt(arg.slice("--limit=".length), 10));
    } else if (arg === "--force") {
      force = true;
    } else if (arg.startsWith("--start-after=")) {
      startAfter = arg.slice("--start-after=".length).trim() || null;
    }
  }
  return { ids, limit, force, startAfter };
}

function selectedProducts() {
  const args = parseArgs();
  let seenStart = args.startAfter === null;
  let products = [...SO_ONG_VIDEO_VISIBLE_PRODUCTS].filter((product) => {
    if (args.ids.size > 0 && !args.ids.has(product.catalogItemId)) return false;
    if (!seenStart) {
      if (product.catalogItemId === args.startAfter) seenStart = true;
      return false;
    }
    return true;
  });
  if (args.limit !== null) products = products.slice(0, args.limit);
  return { products, force: args.force };
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

let reservedMeshySceneBudget = 0;

function parseOptionalBudgetNumber(name: string) {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") return undefined;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number.`);
  return parsed;
}

function parseMeshySceneBudgetPolicy() {
  const value = process.env.MESHY_SCENE_BUDGET_MODE ?? process.env.MESHY_BUDGET_MODE ?? "required";
  return value === "optional" ? "optional" : "required";
}

function reserveMeshySceneBudget(label: string) {
  const status = evaluateMeshyBudgetGuard({
    policy: parseMeshySceneBudgetPolicy(),
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
        ? "Set MESHY_BUDGET_REMAINING and MESHY_BUDGET_COST_PER_TASK before running this script, or set MESHY_BUDGET_MODE=optional only when an external account-level limit is already enforced."
        : `estimated ${status.estimatedBudgetUse} token/credit units with ${Math.max(
            0,
            status.availableBudget
          )} available after reserve`;
    throw new Error(`${status.reason ?? "MESHY_BUDGET_BLOCKED"}: ${label} blocked before Meshy request; ${detail}`);
  }

  reservedMeshySceneBudget += status.estimatedBudgetUse;
}

async function fetchReferencePng(input: { product: SoOngVideoProduct; referenceUrl: string; source: string }) {
  let raw: Buffer;
  if (/^https?:\/\//i.test(input.referenceUrl)) {
    const response = await fetch(input.referenceUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
      },
      cache: "no-store"
    });
    if (!response.ok) {
      throw new Error(`Reference image fetch failed (${response.status}) for ${input.product.catalogItemId}.`);
    }
    raw = Buffer.from(await response.arrayBuffer());
  } else {
    raw = await readFile(input.referenceUrl);
  }

  const png = await sharp(raw)
    .resize({
      width: 1280,
      height: 1280,
      fit: "inside",
      withoutEnlargement: true
    })
    .flatten({ background: "#ffffff" })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await mkdir(MESHY_REFERENCE_IMAGE_ROOT, { recursive: true });
  const referencePath = path.join(MESHY_REFERENCE_IMAGE_ROOT, `${input.product.catalogItemId}.png`);
  await writeFile(referencePath, png);

  return {
    dataUri: `data:image/png;base64,${png.toString("base64")}`,
    path: referencePath
  };
}

function buildMeshyPrompt(product: SoOngVideoProduct) {
  const dimensions = `${product.dimensionsMm.width}mm W x ${product.dimensionsMm.depth}mm D x ${product.dimensionsMm.height}mm H`;
  return [
    `Create a single clean GLB model of ${product.label}.`,
    `Brand: ${product.brand}. Official or reference dimensions: ${dimensions}.`,
    `Visible role in the desk setup: ${product.videoRole}.`,
    `Finish: ${product.finishColor}. Materials: ${product.finishMaterial}.`,
    "Use the provided product-only reference image as the source of truth.",
    "Do not include table, room, hands, packaging, text background, or unrelated props.",
    "Preserve hard-surface silhouette, panel seams, display glass, buttons, ports, feet, and material split zones.",
    "Make it suitable for web realtime rendering with PBR-style materials."
  ].join(" ");
}

function buildMeshyTextPrompt(product: SoOngVideoProduct) {
  const prompt = [
    product.label,
    product.videoRole,
    product.finishColor,
    product.finishMaterial,
    "single product only, hard surface, clean real product proportions, no room, no table, no hands, no packaging"
  ].join(". ");
  return prompt.slice(0, 600);
}

async function postMeshyTask(input: { imageDataUri: string; prompt: string }) {
  reserveMeshySceneBudget("image-to-3d task");
  const apiUrl = requireEnv("MESHY_API_URL");
  const apiKey = requireEnv("MESHY_API_KEY");
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      image_url: input.imageDataUri,
      enable_pbr: true,
      should_remesh: true,
      should_texture: true,
      target_polycount: 100000,
      target_formats: ["glb"],
      texture_prompt: input.prompt
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data && typeof data === "object" && "message" in data
        ? String((data as Record<string, unknown>).message)
        : `Meshy request failed (${response.status}).`
    );
  }
  const directUrl = extractAssetProviderModelUrl(data);
  const taskId = extractAssetProviderJobId(data);
  if (!directUrl && !taskId) {
    throw new Error(`Meshy did not return a task id or GLB URL: ${JSON.stringify(data).slice(0, 500)}`);
  }
  return { taskId: taskId ?? null, modelUrl: directUrl ?? null };
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

async function pollMeshyTask(taskId: string) {
  const statusUrlTemplate = requireEnv("MESHY_STATUS_URL");
  const apiKey = requireEnv("MESHY_API_KEY");
  const pollIntervalMs = Number.parseInt(process.env.ASSET_GENERATION_POLL_INTERVAL_MS ?? "5000", 10);
  const maxPolls = Number.parseInt(process.env.ASSET_GENERATION_MAX_POLLS ?? "120", 10);

  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    const statusUrl = statusUrlTemplate.includes("{id}")
      ? statusUrlTemplate.replace("{id}", taskId)
      : `${statusUrlTemplate.replace(/\/$/, "")}/${taskId}`;
    const response = await fetch(statusUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`Meshy status request failed (${response.status}): ${JSON.stringify(data).slice(0, 300)}`);
    }
    const modelUrl = extractAssetProviderModelUrl(data);
    if (modelUrl) return modelUrl;
    const state =
      typeof data === "object" && data && "status" in data ? String((data as Record<string, unknown>).status) : "";
    if (["FAILED", "failed", "CANCELED", "canceled", "EXPIRED", "expired"].includes(state)) {
      const taskError =
        data && typeof data === "object" && "task_error" in data
          ? JSON.stringify((data as Record<string, unknown>).task_error)
          : "";
      throw new Error(`Meshy task ${taskId} ended with status ${state}${taskError ? `: ${taskError}` : ""}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Meshy task ${taskId} timed out.`);
}

async function pollMeshyTextTask(taskId: string) {
  const apiUrl = process.env.MESHY_TEXT_TO_3D_API_URL ?? "https://api.meshy.ai/openapi/v2/text-to-3d";
  const apiKey = requireEnv("MESHY_API_KEY");
  const pollIntervalMs = Number.parseInt(process.env.ASSET_GENERATION_POLL_INTERVAL_MS ?? "5000", 10);
  const configuredMaxPolls = Number.parseInt(
    process.env.MESHY_TEXT_TO_3D_MAX_POLLS ?? process.env.ASSET_GENERATION_MAX_POLLS ?? "180",
    10
  );
  const maxPolls = Math.max(120, configuredMaxPolls);

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

async function runMeshyGenerationWithRetry(input: { imageDataUri: string; prompt: string }) {
  if (process.env.MESHY_SCENE_SKIP_IMAGE_TO_3D === "1") {
    throw new Error("IMAGE_TO_3D_SKIPPED_BY_ENV");
  }
  const maxAttempts = Number.parseInt(process.env.MESHY_SCENE_TASK_ATTEMPTS ?? "3", 10);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
    try {
      const task = await postMeshyTask(input);
      const modelUrl = task.modelUrl ?? (task.taskId ? await pollMeshyTask(task.taskId) : null);
      if (!modelUrl) throw new Error("MESHY_MODEL_URL_MISSING");
      return { taskId: task.taskId ?? undefined, modelUrl };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable = /service_unavailable|temporarily unavailable|429|timeout|timed out|fetch failed/i.test(message);
      if (attempt >= maxAttempts || !retryable) throw error;
      await new Promise((resolve) => setTimeout(resolve, 8000 * attempt));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function runMeshyTextFallback(input: { product: SoOngVideoProduct; imageDataUri: string }) {
  const previewTaskId = await postMeshyTextTask({
    mode: "preview",
    prompt: buildMeshyTextPrompt(input.product),
    ai_model: "meshy-6",
    model_type: "standard",
    should_remesh: false,
    target_formats: ["glb"],
    symmetry_mode: "auto",
    auto_size: false
  });
  const preview = await pollMeshyTextTask(previewTaskId);

  if (process.env.MESHY_SCENE_SKIP_TEXT_REFINE === "1") {
    return {
      taskId: previewTaskId,
      modelUrl: preview.modelUrl,
      warnings: ["TEXT_REFINE_SKIPPED_BY_ENV_USING_PREVIEW"]
    };
  }

  try {
    const refineTaskId = await postMeshyTextTask({
      mode: "refine",
      preview_task_id: previewTaskId,
      ai_model: "meshy-6",
      enable_pbr: true,
      texture_image_url: input.imageDataUri,
      remove_lighting: true,
      target_formats: ["glb"],
      auto_size: false
    });
    const refined = await pollMeshyTextTask(refineTaskId);
    return {
      taskId: refineTaskId,
      modelUrl: refined.modelUrl,
      fallbackFromPreviewTaskId: previewTaskId,
      warnings: [] as string[]
    };
  } catch (error) {
    return {
      taskId: previewTaskId,
      modelUrl: preview.modelUrl,
      warnings: [
        `TEXT_REFINE_FAILED_USING_PREVIEW: ${error instanceof Error ? error.message : String(error)}`
      ]
    };
  }
}

function buildReferencePack(product: SoOngVideoProduct, referenceImagePath: string) {
  return {
    sourceUrl: product.sourceUrl,
    product: {
      title: product.label,
      sku: product.catalogItemId,
      manufacturer: product.brand,
      dimensionsMm: product.dimensionsMm,
      finishColor: product.finishColor,
      finishMaterial: product.finishMaterial
    },
    referenceImages: [
      {
        url: referenceImagePath,
        view: "front",
        source: "product_image",
        score: 240
      }
    ],
    extraction: {
      dimensionSource: product.dimensionConfidence,
      warnings: []
    }
  };
}

async function finalizeForScene(input: {
  product: SoOngVideoProduct;
  sourceGlb: Buffer;
  referenceImagePath: string;
}) {
  const profile = resolveProductAssetCategoryProfile({
    title: input.product.label,
    manufacturer: input.product.brand,
    categoryHint: input.product.catalogCategory
  });
  const finalized = await finalizeProductAssetCandidate({
    jobId: `so-ong-meshy-${input.product.catalogItemId}`,
    candidateIndex: 0,
    fileName: input.product.label,
    buffer: input.sourceGlb.buffer.slice(
      input.sourceGlb.byteOffset,
      input.sourceGlb.byteOffset + input.sourceGlb.byteLength
    ),
    dimensionsMm: input.product.dimensionsMm,
    referencePack: buildReferencePack(input.product, input.referenceImagePath),
    categoryProfile: profile
  });
  return finalized;
}

async function copyOutputs(input: {
  product: SoOngVideoProduct;
  finalGlb: ArrayBuffer;
  thumbnailBuffer: Buffer | null;
}) {
  const modelDir = path.join(OUTPUT_MODELS_ROOT, input.product.catalogItemId);
  await mkdir(modelDir, { recursive: true });
  const outputGlb = path.join(modelDir, `${input.product.catalogItemId}.glb`);
  const outputProxyGlb = path.join(modelDir, `${input.product.catalogItemId}.proxy.glb`);
  const outputThumbnail = path.join(OUTPUT_THUMB_ROOT, `${input.product.catalogItemId}.webp`);

  const finalBuffer = Buffer.from(input.finalGlb);
  await Promise.all([writeFile(outputGlb, finalBuffer), writeFile(outputProxyGlb, finalBuffer)]);

  if (input.thumbnailBuffer) {
    await writeFile(outputThumbnail, input.thumbnailBuffer);
  } else {
    const referencePath = path.join(MESHY_REFERENCE_IMAGE_ROOT, `${input.product.catalogItemId}.png`);
    const fallbackThumb = await sharp(await readFile(referencePath))
      .resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .webp({ quality: 86 })
      .toBuffer();
    await writeFile(outputThumbnail, fallbackThumb);
  }

  return { outputGlb, outputProxyGlb, outputThumbnail };
}

async function processProduct(product: SoOngVideoProduct, force: boolean): Promise<MeshyGenerationReportItem> {
  const startedAt = new Date().toISOString();
  const outputGlb = path.join(OUTPUT_MODELS_ROOT, product.catalogItemId, `${product.catalogItemId}.glb`);
  const outputProxyGlb = path.join(OUTPUT_MODELS_ROOT, product.catalogItemId, `${product.catalogItemId}.proxy.glb`);
  const outputThumbnail = path.join(OUTPUT_THUMB_ROOT, `${product.catalogItemId}.webp`);
  const referenceImageUrl = DIRECT_REFERENCE_IMAGES[product.catalogItemId] ?? REFERENCE_PHOTO_FALLBACKS[product.catalogItemId];
  const referenceSource: MeshyGenerationReportItem["referenceSource"] = DIRECT_REFERENCE_IMAGES[product.catalogItemId]
    ? "product_page_or_official"
    : "reference_photo_fallback";

  if (!referenceImageUrl) {
    return {
      catalogItemId: product.catalogItemId,
      label: product.label,
      sourceUrl: product.sourceUrl,
      referenceImageUrl: "",
      referenceSource,
      outputGlb,
      outputProxyGlb,
      outputThumbnail,
      finalizerStatus: "skipped",
      warnings: [],
      startedAt,
      error: "REFERENCE_IMAGE_MISSING"
    };
  }

  try {
    if (!force && existsSync(outputGlb) && existsSync(outputThumbnail)) {
      return {
        catalogItemId: product.catalogItemId,
        label: product.label,
        sourceUrl: product.sourceUrl,
        referenceImageUrl,
        referenceSource,
        outputGlb,
        outputProxyGlb,
        outputThumbnail,
        finalizerStatus: "already_exists",
        warnings: ["SKIPPED_EXISTING_ASSET"],
        startedAt,
        completedAt: new Date().toISOString()
      };
    }

    const reference = await fetchReferencePng({
      product,
      referenceUrl: referenceImageUrl,
      source: referenceSource
    });
    let task: { taskId?: string; modelUrl: string; fallbackFromPreviewTaskId?: string; warnings?: string[] };
    try {
      task = await runMeshyGenerationWithRetry({
        imageDataUri: reference.dataUri,
        prompt: buildMeshyPrompt(product)
      });
    } catch (error) {
      console.warn(
        `  image-to-3D unavailable for ${product.catalogItemId}; using text-to-3D refine fallback: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      task = await runMeshyTextFallback({ product, imageDataUri: reference.dataUri });
    }

    const generatedGlb = await downloadModel(task.modelUrl);
    const rawDir = path.join(MESHY_WORK_ROOT, product.catalogItemId);
    await mkdir(rawDir, { recursive: true });
    await writeFile(path.join(rawDir, "meshy-raw.glb"), generatedGlb);

    const finalized = await finalizeForScene({
      product,
      sourceGlb: generatedGlb,
      referenceImagePath: reference.path
    });
    const outputs = await copyOutputs({
      product,
      finalGlb: finalized.buffer,
      thumbnailBuffer: finalized.thumbnailBuffer
    });

    return {
      catalogItemId: product.catalogItemId,
      label: product.label,
      sourceUrl: product.sourceUrl,
      referenceImageUrl,
      referenceSource,
      taskId: task.taskId,
      modelUrl: task.modelUrl,
      outputGlb: outputs.outputGlb,
      outputProxyGlb: outputs.outputProxyGlb,
      outputThumbnail: outputs.outputThumbnail,
      finalizerStatus: finalized.report.status,
      warnings: [...(task.warnings ?? []), ...finalized.report.warnings],
      startedAt,
      completedAt: new Date().toISOString()
    };
  } catch (error) {
    return {
      catalogItemId: product.catalogItemId,
      label: product.label,
      sourceUrl: product.sourceUrl,
      referenceImageUrl,
      referenceSource,
      outputGlb,
      outputProxyGlb,
      outputThumbnail,
      finalizerStatus: "failed",
      warnings: [],
      startedAt,
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function main() {
  loadEnv();
  requireEnv("MESHY_API_URL");
  requireEnv("MESHY_API_KEY");
  requireEnv("MESHY_STATUS_URL");
  const { products, force } = selectedProducts();
  await mkdir(REFERENCE_ROOT, { recursive: true });
  const existingReport = existsSync(MESHY_REPORT_PATH)
    ? JSON.parse(await readFile(MESHY_REPORT_PATH, "utf8"))
    : null;
  const reportById = new Map<string, MeshyGenerationReportItem>();
  for (const item of existingReport?.items ?? []) {
    if (item && typeof item.catalogItemId === "string") {
      reportById.set(item.catalogItemId, item);
    }
  }

  for (const [index, product] of products.entries()) {
    console.log(`[${index + 1}/${products.length}] Meshy generating ${product.catalogItemId}`);
    const item = await processProduct(product, force);
    reportById.set(item.catalogItemId, item);
    const report = [...reportById.values()].sort((left, right) =>
      left.catalogItemId.localeCompare(right.catalogItemId)
    );
    await writeFile(
      MESHY_REPORT_PATH,
      JSON.stringify(
        {
          schemaVersion: "so-ong-meshy-generation-report-v1",
          generatedAt: new Date().toISOString(),
          itemCount: report.length,
          generatedCount: report.filter((entry) => !entry.error && entry.finalizerStatus !== "already_exists").length,
          skippedExistingCount: report.filter((entry) => entry.finalizerStatus === "already_exists").length,
          failedCount: report.filter((entry) => entry.error).length,
          items: report
        },
        null,
        2
      )
    );
    if (item.error) {
      console.error(`  failed: ${item.error}`);
    } else if (item.finalizerStatus === "already_exists") {
      console.log(`  skipped existing: ${item.outputGlb}`);
    } else {
      console.log(`  saved: ${item.outputGlb}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
