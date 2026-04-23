import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import type {
  AssetQaReport,
  AttachmentPoint,
  ColliderDefinition,
  MaterialVariant,
  RuntimeAsset,
  SupportSurface
} from "@deskterioronline/scene-schema";
import { createAssetCompilerPaths } from "./paths";
import { getCuratedDeskteriorAssets } from "./curated-assets";
import type {
  CuratedDeskteriorAsset,
  CuratedSupportProfileExpectation,
  PublishRuntimePackagesSummary,
  RuntimePackageCatalog,
  RuntimePackageDescriptor,
  RuntimePackageFileRef
} from "./types";

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
          ...(margin ? { margin } : {})
        }
      ];
    })
  };
}

function ensureContractMetadata(
  entry: ManifestEntry,
  asset: CuratedDeskteriorAsset,
  errors: string[]
) {
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

function buildSupportSurfaces(supportProfile: CuratedSupportProfileExpectation | null): SupportSurface[] {
  if (!supportProfile) {
    return [];
  }

  return supportProfile.surfaces.map((surface) => {
    const marginX = surface.margin?.[0] ?? 0;
    const marginY = surface.margin?.[1] ?? 0;
    return {
      id: surface.id,
      type: resolveSupportSurfaceType(surface.anchorTypes),
      localFrame: {
        originMm: [
          Math.round(surface.center[0] * 1000),
          Math.round(surface.top * 1000),
          Math.round(surface.center[1] * 1000)
        ],
        tangentU: [1, 0, 0],
        tangentV: [0, 0, 1],
        normal: [0, 1, 0]
      },
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
      allowedAttachments: resolveAllowedAttachments(surface.anchorTypes)
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
  const finishColor = isNonEmptyString(entry.finishColor) ? entry.finishColor : null;
  const finishMaterial = isNonEmptyString(entry.finishMaterial) ? entry.finishMaterial : null;
  const detailNotes = isNonEmptyString(entry.detailNotes) ? entry.detailNotes : null;

  return [
    {
      id: "default",
      label,
      finishColor,
      finishMaterial,
      detailNotes
    }
  ];
}

function buildAttachmentPoints(): AttachmentPoint[] {
  return [];
}

function buildQaReport(
  dimensionsMm: RuntimeAsset["dimensionsMm"],
  warnings: string[],
  validatorVersion: string
): AssetQaReport {
  return {
    status: warnings.length > 0 ? "warning" : "passed",
    measuredBoundsMm: dimensionsMm,
    dimensionErrorMm: {
      width: 0,
      depth: 0,
      height: 0
    },
    validatorVersion,
    ...(warnings.length > 0
      ? {
          issues: warnings.map((message) => ({
            code: "ALPHA_WARNING",
            severity: "warning" as const,
            message
          }))
        }
      : {})
  };
}

function publicCatalogPath(fileName: string) {
  return `/assets/catalog/runtime-packages/${fileName}`;
}

function buildFileRef(path: string | null, required: boolean, exists: boolean): RuntimePackageFileRef {
  return {
    path,
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
    dimensionsMm: qaStatus.measuredBoundsMm,
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

export async function publishCuratedRuntimePackages(): Promise<PublishRuntimePackagesSummary> {
  const paths = createAssetCompilerPaths();
  const errors: string[] = [];
  const generatedAt = new Date().toISOString();
  const curatedAssets = getCuratedDeskteriorAssets(paths);
  const validatorVersion = "asset-compiler-alpha-v2";

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

    const supportSurfaces = buildSupportSurfaces(supportProfile);
    const colliders = buildColliders(dimensionsMm);
    const attachmentPoints = buildAttachmentPoints();
    const materialVariants = buildMaterialVariants(entry);

    const proxyPublicPath = `/assets/models/${asset.key}/${asset.key}.proxy.glb`;
    const proxyLocalPath = asset.runtimePath.replace(/\.glb$/i, ".proxy.glb");
    const proxyExists = await fileExists(proxyLocalPath);
    const thumbnailPublicPath = `/assets/catalog/thumbnails/${asset.key}.webp`;
    const thumbnailLocalPath = `${paths.publicRoot}${thumbnailPublicPath}`;
    const thumbnailExists = await fileExists(thumbnailLocalPath);

    const warnings: string[] = [];
    if (!proxyExists) {
      warnings.push("proxy model is missing; lod0 fallback will be used");
    }
    if (!thumbnailExists) {
      warnings.push("thumbnail is missing from runtime package");
    }
    if (!asset.contractMetadata.textureSet.ktx2Ready) {
      warnings.push("texture set is not yet marked KTX2-ready");
    }

    const qaReport = buildQaReport(dimensionsMm, warnings, validatorVersion);
    const runtimeAsset = buildRuntimeAsset(
      entry,
      asset,
      supportSurfaces,
      colliders,
      attachmentPoints,
      materialVariants,
      qaReport,
      proxyExists ? proxyPublicPath : asset.expectedAssetId
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
      runtimeAsset,
      files: {
        sourceBlend: buildFileRef(asset.contractMetadata.source.path ?? asset.sourcePath, true, sourceExists),
        runtimeModel: buildFileRef(asset.expectedAssetId, true, runtimeExists),
        proxyModel: buildFileRef(proxyPublicPath, false, proxyExists),
        colliders: buildFileRef(collidersPath, true, true),
        supportSurfaces: buildFileRef(supportSurfacesPath, true, true),
        attachmentPoints: buildFileRef(attachmentPointsPath, true, true),
        materialVariants: buildFileRef(materialVariantsPath, true, true),
        qaReport: buildFileRef(qaReportPath, true, true),
        thumbnail: buildFileRef(thumbnailPublicPath, false, thumbnailExists)
      },
      runtime: {
        lods: [
          {
            level: 0,
            path: asset.expectedAssetId
          }
        ],
        proxyPath: proxyExists ? proxyPublicPath : asset.expectedAssetId,
        collidersPath,
        supportSurfacesPath,
        attachmentPointsPath,
        materialVariantsPath,
        qaReportPath,
        thumbnailPath: thumbnailExists ? thumbnailPublicPath : null
      },
      qa: {
        status: qaReport.status,
        warnings
      }
    };

    packages.push(descriptor);

    pendingOutputs.push(
      {
        filePath: `${paths.runtimePackageDir}/${asset.key}.json`,
        content: stringifyJson(descriptor)
      },
      {
        filePath: `${paths.runtimePackageDir}/${asset.key}.colliders.json`,
        content: stringifyJson(colliders)
      },
      {
        filePath: `${paths.runtimePackageDir}/${asset.key}.support-surfaces.json`,
        content: stringifyJson(supportSurfaces)
      },
      {
        filePath: `${paths.runtimePackageDir}/${asset.key}.attachment-points.json`,
        content: stringifyJson(attachmentPoints)
      },
      {
        filePath: `${paths.runtimePackageDir}/${asset.key}.material-variants.json`,
        content: stringifyJson(materialVariants)
      },
      {
        filePath: `${paths.runtimePackageDir}/${asset.key}.qa-report.json`,
        content: stringifyJson(qaReport)
      }
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
