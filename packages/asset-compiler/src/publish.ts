import { access, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AssetQaReport,
  AttachmentPoint,
  ColliderDefinition,
  MaterialVariant,
  RuntimeCommercialReadiness,
  RuntimeAsset,
  SupportSurface
} from "@deskterioronline/scene-schema";
import { getCuratedDeskteriorAssets } from "./curated-assets";
import { createAssetCompilerPaths } from "./paths";
import type {
  CuratedDeskteriorAsset,
  CuratedSupportProfileExpectation,
  PublishRuntimePackagesSummary,
  RuntimePackageCatalog,
  RuntimePackageDescriptor,
  RuntimePackageFileRef
} from "./types";
import { getPublishedCatalogVariantAssets } from "./catalog-variants";
import { buildCuratedValidationSummary, type ValidationResult } from "./validate";

type ManifestEntry = Record<string, unknown> & {
  id?: unknown;
  label?: unknown;
  assetId?: unknown;
  brand?: unknown;
  dimensionsMm?: unknown;
  scaleLocked?: unknown;
  finishColor?: unknown;
  finishMaterial?: unknown;
  detailNotes?: unknown;
  source?: unknown;
  license?: unknown;
  pivot?: unknown;
  collisionProxy?: unknown;
  textureSet?: unknown;
  lodProfile?: unknown;
  supportProfile?: unknown;
};

type PendingOutput = {
  filePath: string;
  content: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function readDimensionsMm(entry: ManifestEntry, errors: string[], manifestId: string) {
  if (!isObjectRecord(entry.dimensionsMm)) {
    errors.push(`manifest ${manifestId} is missing dimensionsMm`);
    return null;
  }

  const width = entry.dimensionsMm.width;
  const depth = entry.dimensionsMm.depth;
  const height = entry.dimensionsMm.height;

  if (!isPositiveNumber(width) || !isPositiveNumber(depth) || !isPositiveNumber(height)) {
    errors.push(`manifest ${manifestId} has invalid dimensionsMm`);
    return null;
  }

  return { width, depth, height };
}

function normalizeSupportProfile(value: unknown): CuratedSupportProfileExpectation | null {
  if (!isObjectRecord(value) || !Array.isArray(value.surfaces)) {
    return null;
  }

  return {
    surfaces: value.surfaces.flatMap((surface) => {
      if (!isObjectRecord(surface)) {
        return [];
      }
      if (
        !isNonEmptyString(surface.id) ||
        !Array.isArray(surface.anchorTypes) ||
        !Array.isArray(surface.center) ||
        !Array.isArray(surface.size) ||
        typeof surface.top !== "number"
      ) {
        return [];
      }

      const centerX = surface.center[0];
      const centerY = surface.center[1];
      const sizeX = surface.size[0];
      const sizeY = surface.size[1];
      if (
        typeof centerX !== "number" ||
        typeof centerY !== "number" ||
        typeof sizeX !== "number" ||
        typeof sizeY !== "number"
      ) {
        return [];
      }

      const margin =
        Array.isArray(surface.margin) &&
        typeof surface.margin[0] === "number" &&
        typeof surface.margin[1] === "number"
          ? ([surface.margin[0], surface.margin[1]] as [number, number])
          : undefined;

      const localFrame =
        isObjectRecord(surface.localFrame) &&
        Array.isArray(surface.localFrame.originMm) &&
        Array.isArray(surface.localFrame.tangentU) &&
        Array.isArray(surface.localFrame.tangentV) &&
        Array.isArray(surface.localFrame.normal) &&
        surface.localFrame.originMm.length === 3 &&
        surface.localFrame.tangentU.length === 3 &&
        surface.localFrame.tangentV.length === 3 &&
        surface.localFrame.normal.length === 3 &&
        surface.localFrame.originMm.every((entry) => typeof entry === "number") &&
        surface.localFrame.tangentU.every((entry) => typeof entry === "number") &&
        surface.localFrame.tangentV.every((entry) => typeof entry === "number") &&
        surface.localFrame.normal.every((entry) => typeof entry === "number")
          ? {
              originMm: [
                surface.localFrame.originMm[0],
                surface.localFrame.originMm[1],
                surface.localFrame.originMm[2]
              ] as [number, number, number],
              tangentU: [
                surface.localFrame.tangentU[0],
                surface.localFrame.tangentU[1],
                surface.localFrame.tangentU[2]
              ] as [number, number, number],
              tangentV: [
                surface.localFrame.tangentV[0],
                surface.localFrame.tangentV[1],
                surface.localFrame.tangentV[2]
              ] as [number, number, number],
              normal: [
                surface.localFrame.normal[0],
                surface.localFrame.normal[1],
                surface.localFrame.normal[2]
              ] as [number, number, number]
            }
          : undefined;

      const surfaceType =
        surface.surfaceType === "floor" ||
        surface.surfaceType === "wall" ||
        surface.surfaceType === "desktop_top" ||
        surface.surfaceType === "shelf_top" ||
        surface.surfaceType === "desk_edge" ||
        surface.surfaceType === "desk_underside" ||
        surface.surfaceType === "monitor_back" ||
        surface.surfaceType === "pegboard"
          ? surface.surfaceType
          : undefined;

      const allowedAttachments =
        Array.isArray(surface.allowedAttachments) &&
        surface.allowedAttachments.every((entry) => typeof entry === "string")
          ? surface.allowedAttachments.filter(
              (
                entry
              ): entry is
                | "place_on_surface"
                | "edge_clamp"
                | "underside_screw"
                | "vesa_mount"
                | "grommet_hole"
                | "wall_screw"
                | "adhesive_patch"
                | "magnetic_attach"
                | "cable_route"
                | "peg_slot"
                | "wall_attach" =>
                entry === "place_on_surface" ||
                entry === "edge_clamp" ||
                entry === "underside_screw" ||
                entry === "vesa_mount" ||
                entry === "grommet_hole" ||
                entry === "wall_screw" ||
                entry === "adhesive_patch" ||
                entry === "magnetic_attach" ||
                entry === "cable_route" ||
                entry === "peg_slot" ||
                entry === "wall_attach"
            )
          : undefined;

      const thicknessMm =
        typeof surface.thicknessMm === "number" && Number.isFinite(surface.thicknessMm) && surface.thicknessMm > 0
          ? surface.thicknessMm
          : undefined;

      return [
        {
          id: surface.id,
          anchorTypes: surface.anchorTypes.filter(
            (entry): entry is "desk_surface" | "shelf_surface" | "furniture_surface" =>
              entry === "desk_surface" || entry === "shelf_surface" || entry === "furniture_surface"
          ),
          center: [centerX, centerY] as [number, number],
          size: [sizeX, sizeY] as [number, number],
          top: surface.top,
          ...(margin ? { margin } : {}),
          ...(surfaceType ? { surfaceType } : {}),
          ...(allowedAttachments ? { allowedAttachments } : {}),
          ...(thicknessMm ? { thicknessMm } : {}),
          ...(localFrame ? { localFrame } : {})
        }
      ];
    })
  };
}

function ensureContractMetadata(entry: ManifestEntry, asset: CuratedDeskteriorAsset, errors: string[]) {
  const fields = [
    ["source", asset.contractMetadata.source],
    ["license", asset.contractMetadata.license],
    ["pivot", asset.contractMetadata.pivot],
    ["collisionProxy", asset.contractMetadata.collisionProxy],
    ["textureSet", asset.contractMetadata.textureSet],
    ["lodProfile", asset.contractMetadata.lodProfile]
  ] as const;

  for (const [field, expected] of fields) {
    if (JSON.stringify(entry[field]) !== JSON.stringify(expected)) {
      errors.push(`manifest ${asset.manifestId} has mismatched ${field} contract metadata`);
    }
  }
}

function resolveSupportSurfaceType(
  anchorTypes: CuratedSupportProfileExpectation["surfaces"][number]["anchorTypes"]
): SupportSurface["type"] {
  if (anchorTypes.includes("shelf_surface")) {
    return "shelf_top";
  }
  return "desktop_top";
}

function resolveAllowedAttachments(
  anchorTypes: CuratedSupportProfileExpectation["surfaces"][number]["anchorTypes"]
): SupportSurface["allowedAttachments"] {
  const allowed = new Set<SupportSurface["allowedAttachments"][number]>();
  allowed.add("place_on_surface");
  if (anchorTypes.includes("desk_surface") || anchorTypes.includes("furniture_surface")) {
    allowed.add("edge_clamp");
  }
  return [...allowed];
}

function buildSupportSurfaces(
  dimensionsMm: RuntimeAsset["dimensionsMm"],
  supportProfile: CuratedSupportProfileExpectation | null,
  asset: CuratedDeskteriorAsset,
  errors: string[]
): SupportSurface[] {
  if (!supportProfile) {
    return [];
  }

  return supportProfile.surfaces.map((surface) => {
    const topMm = Math.round(surface.top * 1000);
    if (topMm > dimensionsMm.height) {
      errors.push(
        `support surface ${surface.id} on ${asset.manifestId} exceeds asset height (${topMm}mm > ${dimensionsMm.height}mm)`
      );
    }

    const marginX = surface.margin?.[0] ?? 0;
    const marginY = surface.margin?.[1] ?? 0;
    return {
      id: surface.id,
      type: surface.surfaceType ?? resolveSupportSurfaceType(surface.anchorTypes),
      localFrame:
        surface.localFrame ??
        ({
          originMm: [Math.round(surface.center[0] * 1000), topMm, Math.round(surface.center[1] * 1000)],
          tangentU: [1000, 0, 0],
          tangentV: [0, 0, 1000],
          normal: [0, 1000, 0]
        } satisfies SupportSurface["localFrame"]),
      boundsMm: {
        min: [
          Math.round((surface.center[0] - surface.size[0] / 2 + marginX) * 1000),
          Math.round((surface.center[1] - surface.size[1] / 2 + marginY) * 1000)
        ],
        max: [
          Math.round((surface.center[0] + surface.size[0] / 2 - marginX) * 1000),
          Math.round((surface.center[1] + surface.size[1] / 2 - marginY) * 1000)
        ]
      },
      ...(surface.thicknessMm ? { thicknessMm: surface.thicknessMm } : {}),
      allowedAttachments: surface.allowedAttachments ?? resolveAllowedAttachments(surface.anchorTypes)
    };
  });
}

function buildColliders(dimensionsMm: RuntimeAsset["dimensionsMm"]): ColliderDefinition[] {
  return [
    {
      id: "bounds-box",
      kind: "box",
      sizeMm: dimensionsMm,
      centerMm: [0, Math.round(dimensionsMm.height / 2), 0]
    }
  ];
}

function buildMaterialVariants(entry: ManifestEntry): MaterialVariant[] {
  const label = isNonEmptyString(entry.label) ? entry.label : "Default";
  const finishMaterial = isNonEmptyString(entry.finishMaterial) ? entry.finishMaterial : null;
  const normalizedMaterial = finishMaterial?.toLowerCase() ?? "";
  const materialType: NonNullable<MaterialVariant["slotMaterials"]>[number]["materialType"] =
    normalizedMaterial.includes("oak") ||
    normalizedMaterial.includes("walnut") ||
    normalizedMaterial.includes("wood") ||
    normalizedMaterial.includes("veneer")
      ? "wood"
      : normalizedMaterial.includes("steel") ||
          normalizedMaterial.includes("metal") ||
          normalizedMaterial.includes("brass")
        ? "metal"
        : normalizedMaterial.includes("plastic") ||
            normalizedMaterial.includes("acrylic")
          ? "plastic"
          : normalizedMaterial.includes("ceramic")
            ? "ceramic"
            : normalizedMaterial.includes("paper")
              ? "paper"
              : normalizedMaterial.includes("fabric") ||
                  normalizedMaterial.includes("woven")
                ? "fabric"
                : normalizedMaterial.includes("plant") ||
                    normalizedMaterial.includes("foliage")
                  ? "foliage"
                  : "mixed";

  return [
    {
      id: "default",
      label,
      finishColor: isNonEmptyString(entry.finishColor) ? entry.finishColor : null,
      finishMaterial,
      detailNotes: isNonEmptyString(entry.detailNotes) ? entry.detailNotes : null,
      slotMaterials: [
        {
          slot: "default",
          materialType,
          qaStatus: "pending",
          referenceNote: "Slot-level material QA must be replaced with manufacturer finish references before hero SKU release."
        }
      ]
    }
  ];
}

function buildAttachmentPoints(asset: CuratedDeskteriorAsset, errors: string[]): AttachmentPoint[] {
  const points = asset.attachmentAuthoring.points ?? [];
  if (asset.attachmentAuthoring.mode === "manual_required" && points.length === 0) {
    errors.push(`attachment authoring is required for ${asset.manifestId} but no attachment points were authored`);
  }
  return points;
}

function buildQaReport(
  dimensionsMm: RuntimeAsset["dimensionsMm"],
  validatorVersion: string,
  validationResult: ValidationResult | undefined,
  asset: CuratedDeskteriorAsset
): AssetQaReport {
  const issues: NonNullable<AssetQaReport["issues"]> = [];

  if (validationResult) {
    for (const message of validationResult.messages.filter((entry) => entry.severity <= 1)) {
      issues.push({
        code: message.code,
        severity: message.severity === 0 ? "error" : "warning",
        message: message.message
      });
    }
    for (const violation of validationResult.budgetViolations) {
      issues.push({
        code: "BUDGET_VIOLATION",
        severity: "error",
        message: violation
      });
    }
  }

  const commercial = asset.commercialMetadata;
  if (commercial.visualFidelityScore < commercial.qaThresholds.minVisualFidelityScore) {
    issues.push({
      code: "COMMERCIAL_VISUAL_FIDELITY_PENDING",
      severity: commercial.tier === "hero_sku" ? "error" : "warning",
      message: `visual fidelity score ${commercial.visualFidelityScore.toFixed(2)} is below paid-beta threshold ${commercial.qaThresholds.minVisualFidelityScore.toFixed(2)}`
    });
  }
  if (commercial.dimensionToleranceMm > commercial.qaThresholds.maxDimensionToleranceMm) {
    issues.push({
      code: "COMMERCIAL_DIMENSION_TOLERANCE_EXCEEDED",
      severity: "error",
      message: `dimension tolerance ${commercial.dimensionToleranceMm}mm exceeds ${commercial.qaThresholds.maxDimensionToleranceMm}mm`
    });
  }
  if (commercial.dimensionTolerancePercent > commercial.qaThresholds.maxDimensionTolerancePercent) {
    issues.push({
      code: "COMMERCIAL_DIMENSION_PERCENT_EXCEEDED",
      severity: "error",
      message: `dimension tolerance ${commercial.dimensionTolerancePercent}% exceeds ${commercial.qaThresholds.maxDimensionTolerancePercent}%`
    });
  }
  if (
    commercial.supportSurfaceToleranceMm !== undefined &&
    commercial.supportSurfaceToleranceMm > commercial.qaThresholds.maxSupportSurfaceToleranceMm
  ) {
    issues.push({
      code: "COMMERCIAL_SUPPORT_SURFACE_TOLERANCE_EXCEEDED",
      severity: "error",
      message: `support surface tolerance ${commercial.supportSurfaceToleranceMm}mm exceeds ${commercial.qaThresholds.maxSupportSurfaceToleranceMm}mm`
    });
  }
  if (
    commercial.footprintToleranceMm !== undefined &&
    commercial.footprintToleranceMm > commercial.qaThresholds.maxFootprintToleranceMm
  ) {
    issues.push({
      code: "COMMERCIAL_FOOTPRINT_TOLERANCE_EXCEEDED",
      severity: "error",
      message: `footprint tolerance ${commercial.footprintToleranceMm}mm exceeds ${commercial.qaThresholds.maxFootprintToleranceMm}mm`
    });
  }
  if (commercial.materialQaStatus !== "passed") {
    issues.push({
      code: "COMMERCIAL_MATERIAL_QA_PENDING",
      severity: commercial.tier === "hero_sku" ? "error" : "warning",
      message: `slot-level material QA status is ${commercial.materialQaStatus}`
    });
  }
  if (!commercial.releaseEligible) {
    issues.push({
      code: "COMMERCIAL_RELEASE_NOT_ELIGIBLE",
      severity: commercial.tier === "hero_sku" ? "error" : "warning",
      message: "asset is not eligible for actual-SKU paid beta release"
    });
  }

  const hasError = issues.some((issue) => issue.severity === "error");
  const hasWarning = issues.some((issue) => issue.severity === "warning");

  return {
    status: hasError ? "failed" : hasWarning ? "warning" : "passed",
    measuredBoundsMm: dimensionsMm,
    dimensionErrorMm: {
      width: 0,
      depth: 0,
      height: 0
    },
    validatorVersion,
    commercialFidelity: {
      referencePackStatus: commercial.referencePack.status,
      visualFidelityScore: commercial.visualFidelityScore,
      dimensionToleranceMm: commercial.dimensionToleranceMm,
      dimensionTolerancePercent: commercial.dimensionTolerancePercent,
      ...(commercial.supportSurfaceToleranceMm !== undefined
        ? { supportSurfaceToleranceMm: commercial.supportSurfaceToleranceMm }
        : {}),
      ...(commercial.footprintToleranceMm !== undefined
        ? { footprintToleranceMm: commercial.footprintToleranceMm }
        : {}),
      materialQaStatus: commercial.materialQaStatus,
      releaseEligible: commercial.releaseEligible
    },
    ...(issues.length > 0 ? { issues } : {})
  };
}

function publicCatalogPath(fileName: string) {
  return `/assets/catalog/runtime-packages/${fileName}`;
}

function resolveVariantProxyPublicPath(asset: CuratedDeskteriorAsset) {
  if (asset.packageKind !== "catalog_variant") {
    return `/assets/models/${asset.key}/${asset.key}.proxy.glb`;
  }
  if (asset.baseAssetKey && asset.baseAssetKey.startsWith("p2s_")) {
    return `/assets/models/${asset.baseAssetKey}/${asset.baseAssetKey}.proxy.glb`;
  }
  return asset.expectedAssetId;
}

async function ensurePackageProxyFile(asset: CuratedDeskteriorAsset, proxyPublicPath: string, publicRoot: string) {
  const proxyLocalPath = path.join(publicRoot, proxyPublicPath.replace(/^\//, ""));
  if (asset.packageKind === "catalog_variant") {
    if (await fileExists(proxyLocalPath)) {
      return true;
    }
    if (proxyPublicPath !== asset.expectedAssetId) {
      const fallbackPath = path.join(publicRoot, asset.expectedAssetId.replace(/^\//, ""));
      return fileExists(fallbackPath);
    }
    return false;
  }
  return ensureProxyFile(asset.runtimePath, proxyLocalPath);
}

function resolveThumbnailPublicPath(asset: CuratedDeskteriorAsset) {
  return asset.thumbnailPublicPath ?? `/assets/catalog/thumbnails/${asset.key}.webp`;
}

async function ensurePackageThumbnailFile(
  asset: CuratedDeskteriorAsset,
  thumbnailPublicPath: string,
  paths: ReturnType<typeof createAssetCompilerPaths>,
  label: string,
  dimensionsMm: RuntimeAsset["dimensionsMm"]
) {
  const thumbnailLocalPath = path.join(paths.publicRoot, thumbnailPublicPath.replace(/^\//, ""));
  if (asset.thumbnailPublicPath && (await fileExists(thumbnailLocalPath))) {
    return true;
  }
  return ensureThumbnailFile(thumbnailLocalPath, label, dimensionsMm, asset.key);
}

function buildFileRef(pathValue: string | null, required: boolean, exists: boolean): RuntimePackageFileRef {
  return {
    path: pathValue,
    required,
    exists
  };
}

function stringifyJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function toRuntimeCommercialReadiness(
  metadata: CuratedDeskteriorAsset["commercialMetadata"]
): RuntimeCommercialReadiness {
  const { qaThresholds: _qaThresholds, ...runtimeMetadata } = metadata;
  return runtimeMetadata;
}

function buildRuntimeAsset(
  entry: ManifestEntry,
  asset: CuratedDeskteriorAsset,
  dimensionsMm: RuntimeAsset["dimensionsMm"],
  supportSurfaces: SupportSurface[],
  colliders: ColliderDefinition[],
  attachmentPoints: AttachmentPoint[],
  materialVariants: MaterialVariant[],
  qaStatus: AssetQaReport,
  proxyPath: string
): RuntimeAsset {
  return {
    assetId: asset.expectedAssetId,
    productId: asset.manifestId,
    units: "mm",
    dimensionsMm,
    scaleLocked: true,
    pivot: asset.contractMetadata.pivot,
    sourceProvenance: {
      method: asset.contractMetadata.source.kind === "open_source" ? "api" : "manual",
      sourceUrl: asset.contractMetadata.source.url ?? undefined,
      manufacturer: isNonEmptyString(entry.brand) ? entry.brand : undefined,
      license: asset.contractMetadata.license.spdx,
      attributionRequired: asset.contractMetadata.license.requiresAttribution
    },
    runtime: {
      lods: [
        {
          id: "lod0",
          level: 0,
          model: asset.expectedAssetId,
          triangleCount: asset.contractMetadata.lodProfile.maxTriangleCount,
          drawCallBudget: asset.contractMetadata.lodProfile.maxDrawCalls
        }
      ],
      proxy: proxyPath,
      defaultLod: 0,
      triangleBudget: asset.contractMetadata.lodProfile.maxTriangleCount,
      textureBudgetMb: asset.contractMetadata.textureSet.ktx2Ready ? 24 : 48
    },
    colliders,
    supportSurfaces,
    attachmentPoints,
    materialVariants,
    commercialReadiness: toRuntimeCommercialReadiness(asset.commercialMetadata),
    qaStatus
  };
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function colorFromKey(key: string) {
  const palette = [
    ["#171717", "#f59e0b"],
    ["#102a43", "#56b4d3"],
    ["#1f2937", "#f97316"],
    ["#0f172a", "#84cc16"],
    ["#111827", "#f43f5e"]
  ] as const;
  return palette[hashString(key) % palette.length];
}

async function ensureProxyFile(runtimePath: string, proxyPath: string) {
  if (!(await fileExists(proxyPath))) {
    await mkdir(path.dirname(proxyPath), { recursive: true });
    await copyFile(runtimePath, proxyPath);
  }
  return fileExists(proxyPath);
}

async function ensureThumbnailFile(
  thumbnailPath: string,
  label: string,
  dimensionsMm: RuntimeAsset["dimensionsMm"],
  assetKey: string
) {
  if (await fileExists(thumbnailPath)) {
    return true;
  }

  await mkdir(path.dirname(thumbnailPath), { recursive: true });
  const [bg, accent] = colorFromKey(assetKey);
  const svg = `
    <svg width="512" height="384" viewBox="0 0 512 384" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="384" fill="${bg}" />
      <rect x="24" y="24" width="464" height="336" rx="24" fill="none" stroke="${accent}" stroke-width="4" />
      <text x="40" y="88" fill="#f8fafc" font-size="34" font-family="Arial, Helvetica, sans-serif" font-weight="700">${label}</text>
      <text x="40" y="142" fill="#cbd5e1" font-size="20" font-family="Arial, Helvetica, sans-serif">Deskterior Runtime Package</text>
      <text x="40" y="228" fill="${accent}" font-size="52" font-family="Arial, Helvetica, sans-serif" font-weight="700">${dimensionsMm.width} × ${dimensionsMm.depth} × ${dimensionsMm.height}</text>
      <text x="40" y="270" fill="#cbd5e1" font-size="20" font-family="Arial, Helvetica, sans-serif">mm</text>
      <circle cx="430" cy="92" r="34" fill="${accent}" opacity="0.18" />
      <circle cx="452" cy="120" r="12" fill="${accent}" opacity="0.82" />
    </svg>
  `;

  try {
    const sharp = (await import("sharp")).default;
    await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(thumbnailPath);
  } catch {
    const onePixelWebp =
      "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
    await writeFile(thumbnailPath, Buffer.from(onePixelWebp, "base64"));
  }
  return fileExists(thumbnailPath);
}

async function cleanupUnexpectedJsonFiles(directory: string, expectedFileNames: Set<string>) {
  const existing = await readdir(directory).catch(() => [] as string[]);
  await Promise.all(
    existing
      .filter((entry) => entry.endsWith(".json") && !expectedFileNames.has(entry))
      .map((entry) => rm(path.join(directory, entry), { force: true }))
  );
}

async function cleanupUnexpectedThumbnailFiles(directory: string, expectedFileNames: Set<string>) {
  const existing = await readdir(directory).catch(() => [] as string[]);
  await Promise.all(
    existing
      .filter((entry) => entry.startsWith("p2s_") && entry.endsWith(".webp") && !expectedFileNames.has(entry))
      .map((entry) => rm(path.join(directory, entry), { force: true }))
  );
}

export async function publishCuratedRuntimePackages(): Promise<PublishRuntimePackagesSummary> {
  const paths = createAssetCompilerPaths();
  const errors: string[] = [];
  const generatedAt = new Date().toISOString();
  const curatedAssets = getCuratedDeskteriorAssets(paths);
  const catalogVariantAssets = await getPublishedCatalogVariantAssets(paths, curatedAssets);
  const runtimePackageAssets = [...curatedAssets, ...catalogVariantAssets];
  const validatorVersion = "asset-compiler-alpha-v3";
  const validationSummary = await buildCuratedValidationSummary(false, false);
  const validationByKey = new Map(validationSummary.results.map((entry) => [entry.key, entry]));

  const manifestRaw = await readFile(paths.manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw) as ManifestEntry[];
  const manifestById = new Map<string, ManifestEntry>();

  for (const entry of manifest) {
    if (isNonEmptyString(entry.id) && !manifestById.has(entry.id)) {
      manifestById.set(entry.id, entry);
    }
  }

  const pendingOutputs: PendingOutput[] = [];
  const packages: RuntimePackageDescriptor[] = [];
  const expectedRuntimeJsonFiles = new Set<string>();
  const expectedThumbnailFiles = new Set<string>();

  for (const asset of runtimePackageAssets) {
    const entry = (manifestById.get(asset.manifestId) ?? asset.catalogEntry) as ManifestEntry | undefined;
    if (!entry) {
      errors.push(`manifest entry ${asset.manifestId} is missing`);
      continue;
    }
    if (!isNonEmptyString(entry.label)) {
      errors.push(`manifest ${asset.manifestId} is missing label`);
      continue;
    }
    if (!isNonEmptyString(entry.assetId) || entry.assetId !== asset.expectedAssetId) {
      errors.push(`manifest ${asset.manifestId} has mismatched assetId`);
      continue;
    }

    const dimensionsMm = readDimensionsMm(entry, errors, asset.manifestId);
    if (!dimensionsMm) {
      continue;
    }
    if (entry.scaleLocked !== true) {
      errors.push(`manifest ${asset.manifestId} must keep scaleLocked=true`);
      continue;
    }

    ensureContractMetadata(entry, asset, errors);

    const sourceExists = await fileExists(asset.sourcePath);
    if (!sourceExists) {
      errors.push(`source file is missing for ${asset.key}: ${asset.sourcePath}`);
    }
    const runtimeExists = await fileExists(asset.runtimePath);
    if (!runtimeExists) {
      errors.push(`runtime model is missing for ${asset.key}: ${asset.runtimePath}`);
      continue;
    }

    const supportProfile = asset.supportProfileExpectation ?? normalizeSupportProfile(entry.supportProfile);
    if (asset.supportProfileExpectation && !supportProfile) {
      errors.push(`manifest ${asset.manifestId} is missing supportProfile`);
      continue;
    }
    if (
      asset.supportProfileExpectation &&
      JSON.stringify(supportProfile) !== JSON.stringify(asset.supportProfileExpectation)
    ) {
      errors.push(`manifest ${asset.manifestId} has mismatched supportProfile expectation`);
      continue;
    }

    const supportSurfaces = buildSupportSurfaces(dimensionsMm, supportProfile, asset, errors);
    const colliders = buildColliders(dimensionsMm);
    const attachmentPoints = buildAttachmentPoints(asset, errors);
    const materialVariants = buildMaterialVariants(entry);

    const proxyPublicPath = resolveVariantProxyPublicPath(asset);
    const proxyExists = await ensurePackageProxyFile(asset, proxyPublicPath, paths.publicRoot);

    const thumbnailPublicPath = resolveThumbnailPublicPath(asset);
    const thumbnailExists = await ensurePackageThumbnailFile(asset, thumbnailPublicPath, paths, entry.label, dimensionsMm);

    const qaReport = buildQaReport(dimensionsMm, validatorVersion, validationByKey.get(asset.key), asset);
    if (qaReport.status === "failed") {
      errors.push(`qa report failed for ${asset.key}`);
      continue;
    }

    const runtimeAsset = buildRuntimeAsset(
      entry,
      asset,
      dimensionsMm,
      supportSurfaces,
      colliders,
      attachmentPoints,
      materialVariants,
      qaReport,
      proxyPublicPath
    );

    const baseFileName = asset.key;
    const collidersPath = publicCatalogPath(`${baseFileName}.colliders.json`);
    const supportSurfacesPath = publicCatalogPath(`${baseFileName}.support-surfaces.json`);
    const attachmentPointsPath = publicCatalogPath(`${baseFileName}.attachment-points.json`);
    const materialVariantsPath = publicCatalogPath(`${baseFileName}.material-variants.json`);
    const qaReportPath = publicCatalogPath(`${baseFileName}.qa-report.json`);

    const descriptor: RuntimePackageDescriptor = {
      schemaVersion: "asset-package-alpha-v2",
      generatedAt,
      key: asset.key,
      packageKind: asset.packageKind ?? "curated_asset",
      baseAssetKey: asset.baseAssetKey ?? null,
      manifestId: asset.manifestId,
      label: entry.label,
      assetId: asset.expectedAssetId,
      sourcePath: asset.contractMetadata.source.path ?? asset.sourcePath,
      runtimePath: asset.expectedAssetId,
      dimensionsMm,
      scaleLocked: true,
      contractMetadata: asset.contractMetadata,
      supportProfile,
      authoring: {
        attachmentPoints: asset.attachmentAuthoring
      },
      runtimeAsset,
      commercialReadiness: toRuntimeCommercialReadiness(asset.commercialMetadata),
      files: {
        sourceBlend: buildFileRef(asset.contractMetadata.source.path ?? asset.sourcePath, true, sourceExists),
        runtimeModel: buildFileRef(asset.expectedAssetId, true, runtimeExists),
        proxyModel: buildFileRef(proxyPublicPath, true, proxyExists),
        colliders: buildFileRef(collidersPath, true, true),
        supportSurfaces: buildFileRef(supportSurfacesPath, true, true),
        attachmentPoints: buildFileRef(attachmentPointsPath, true, true),
        materialVariants: buildFileRef(materialVariantsPath, true, true),
        qaReport: buildFileRef(qaReportPath, true, true),
        thumbnail: buildFileRef(thumbnailPublicPath, true, thumbnailExists)
      },
      runtime: {
        lods: [{ level: 0, path: asset.expectedAssetId }],
        proxyPath: proxyPublicPath,
        collidersPath,
        supportSurfacesPath,
        attachmentPointsPath,
        materialVariantsPath,
        qaReportPath,
        thumbnailPath: thumbnailPublicPath
      },
      qa: {
        status: qaReport.status,
        warnings: (qaReport.issues ?? []).filter((issue) => issue.severity === "warning").map((issue) => issue.message)
      }
    };

    packages.push(descriptor);

    const fileNames = [
      `${asset.key}.json`,
      `${asset.key}.colliders.json`,
      `${asset.key}.support-surfaces.json`,
      `${asset.key}.attachment-points.json`,
      `${asset.key}.material-variants.json`,
      `${asset.key}.qa-report.json`
    ];
    fileNames.forEach((name) => expectedRuntimeJsonFiles.add(name));
    if (thumbnailPublicPath.startsWith("/assets/catalog/thumbnails/")) {
      expectedThumbnailFiles.add(path.basename(thumbnailPublicPath));
    }

    pendingOutputs.push(
      { filePath: path.join(paths.runtimePackageDir, `${asset.key}.json`), content: stringifyJson(descriptor) },
      { filePath: path.join(paths.runtimePackageDir, `${asset.key}.colliders.json`), content: stringifyJson(colliders) },
      {
        filePath: path.join(paths.runtimePackageDir, `${asset.key}.support-surfaces.json`),
        content: stringifyJson(supportSurfaces)
      },
      {
        filePath: path.join(paths.runtimePackageDir, `${asset.key}.attachment-points.json`),
        content: stringifyJson(attachmentPoints)
      },
      {
        filePath: path.join(paths.runtimePackageDir, `${asset.key}.material-variants.json`),
        content: stringifyJson(materialVariants)
      },
      { filePath: path.join(paths.runtimePackageDir, `${asset.key}.qa-report.json`), content: stringifyJson(qaReport) }
    );
  }

  const catalog: RuntimePackageCatalog = {
    schemaVersion: "asset-package-index-alpha-v2",
    generatedAt,
    assets: packages.map((entry) => ({
      key: entry.key,
      packageKind: entry.packageKind ?? "curated_asset",
      baseAssetKey: entry.baseAssetKey ?? null,
      manifestId: entry.manifestId,
      label: entry.label,
      assetId: entry.assetId,
      packagePath: `/assets/catalog/runtime-packages/${entry.key}.json`,
      runtimeAsset: entry.runtimeAsset,
      qaStatus: entry.qa.status,
      warningCount: entry.qa.warnings.length,
      surfaceCount: entry.runtimeAsset.supportSurfaces.length,
      attachmentPointCount: entry.runtimeAsset.attachmentPoints.length,
      materialVariantCount: entry.runtimeAsset.materialVariants.length,
      commercialTier: entry.runtimeAsset.commercialReadiness?.tier,
      sku: entry.runtimeAsset.commercialReadiness?.sku,
      manufacturer: entry.runtimeAsset.commercialReadiness?.manufacturer,
      releaseEligible: entry.runtimeAsset.commercialReadiness?.releaseEligible
    }))
  };

  if (errors.length > 0) {
    return {
      ok: false,
      generatedAt,
      catalogPath: paths.runtimePackageIndexPath,
      packageDirectory: paths.runtimePackageDir,
      packageCount: catalog.assets.length,
      packages: catalog.assets,
      errors
    };
  }

  await mkdir(paths.runtimePackageDir, { recursive: true });
  await mkdir(paths.thumbnailDir, { recursive: true });
  await cleanupUnexpectedJsonFiles(paths.runtimePackageDir, expectedRuntimeJsonFiles);
  await cleanupUnexpectedThumbnailFiles(paths.thumbnailDir, expectedThumbnailFiles);
  for (const output of pendingOutputs) {
    await writeFile(output.filePath, output.content, "utf8");
  }
  await writeFile(paths.runtimePackageIndexPath, stringifyJson(catalog), "utf8");

  return {
    ok: true,
    generatedAt,
    catalogPath: paths.runtimePackageIndexPath,
    packageDirectory: paths.runtimePackageDir,
    packageCount: catalog.assets.length,
    packages: catalog.assets,
    errors
  };
}
