import { access, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type {
  AssetQaReport,
  AttachmentPoint,
  ColliderDefinition,
  MaterialVariant,
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
  return [
    {
      id: "default",
      label,
      finishColor: isNonEmptyString(entry.finishColor) ? entry.finishColor : null,
      finishMaterial: isNonEmptyString(entry.finishMaterial) ? entry.finishMaterial : null,
      detailNotes: isNonEmptyString(entry.detailNotes) ? entry.detailNotes : null
    }
  ];
}

function buildAttachmentPoints(asset: CuratedDeskteriorAsset, errors: string[]): AttachmentPoint[] {
  const points: AttachmentPoint[] = [];
  if (asset.attachmentAuthoring.mode === "manual_required" && points.length === 0) {
    errors.push(`attachment authoring is required for ${asset.manifestId} but no attachment points were authored`);
  }
  return points;
}

function buildQaReport(
  dimensionsMm: RuntimeAsset["dimensionsMm"],
  validatorVersion: string,
  validationResult: ValidationResult | undefined
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
    ...(issues.length > 0 ? { issues } : {})
  };
}

function publicCatalogPath(fileName: string) {
  return `/assets/catalog/runtime-packages/${fileName}`;
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

  await sharp(Buffer.from(svg)).webp({ quality: 82 }).toFile(thumbnailPath);
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

  for (const asset of curatedAssets) {
    const entry = manifestById.get(asset.manifestId);
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

    const supportProfile = normalizeSupportProfile(entry.supportProfile);
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

    const proxyPublicPath = `/assets/models/${asset.key}/${asset.key}.proxy.glb`;
    const proxyLocalPath = path.join(paths.publicRoot, proxyPublicPath.replace(/^\//, ""));
    const proxyExists = await ensureProxyFile(asset.runtimePath, proxyLocalPath);

    const thumbnailPublicPath = `/assets/catalog/thumbnails/${asset.key}.webp`;
    const thumbnailLocalPath = path.join(paths.thumbnailDir, `${asset.key}.webp`);
    const thumbnailExists = await ensureThumbnailFile(
      thumbnailLocalPath,
      entry.label,
      dimensionsMm,
      asset.key
    );

    const qaReport = buildQaReport(dimensionsMm, validatorVersion, validationByKey.get(asset.key));
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
    expectedThumbnailFiles.add(`${asset.key}.webp`);

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
      manifestId: entry.manifestId,
      label: entry.label,
      assetId: entry.assetId,
      packagePath: `/assets/catalog/runtime-packages/${entry.key}.json`,
      qaStatus: entry.qa.status,
      warningCount: entry.qa.warnings.length,
      surfaceCount: entry.runtimeAsset.supportSurfaces.length,
      attachmentPointCount: entry.runtimeAsset.attachmentPoints.length,
      materialVariantCount: entry.runtimeAsset.materialVariants.length
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
