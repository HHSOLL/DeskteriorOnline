import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createAssetCompilerPaths } from "./paths";
import { getCuratedDeskteriorAssets } from "./curated-assets";
import type {
  PublishRuntimePackagesSummary,
  RuntimePackageCatalog,
  RuntimePackageDescriptor
} from "./types";

type ManifestEntry = Record<string, unknown> & {
  id?: unknown;
  label?: unknown;
  assetId?: unknown;
  dimensionsMm?: unknown;
  scaleLocked?: unknown;
  supportProfile?: unknown;
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

function normalizeSupportProfile(value: unknown) {
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
          ? [surface.margin[0], surface.margin[1]] as [number, number]
          : undefined;

      return [
        {
          id: surface.id,
          anchorTypes: surface.anchorTypes.filter((entry): entry is "desk_surface" | "shelf_surface" | "furniture_surface" =>
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

export async function publishCuratedRuntimePackages(): Promise<PublishRuntimePackagesSummary> {
  const paths = createAssetCompilerPaths();
  const errors: string[] = [];
  const generatedAt = new Date().toISOString();
  const curatedAssets = getCuratedDeskteriorAssets(paths);

  const manifestRaw = await readFile(paths.manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw) as ManifestEntry[];
  const manifestById = new Map<string, ManifestEntry>();

  for (const entry of manifest) {
    if (isNonEmptyString(entry.id) && !manifestById.has(entry.id)) {
      manifestById.set(entry.id, entry);
    }
  }

  await mkdir(paths.runtimePackageDir, { recursive: true });

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

    const supportProfile = normalizeSupportProfile(entry.supportProfile);
    const warnings: string[] = [];
    if (asset.supportProfileExpectation && !supportProfile) {
      warnings.push("supportProfile is missing from manifest entry");
    }

    const descriptor: RuntimePackageDescriptor = {
      schemaVersion: "asset-package-alpha-v1",
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
      runtime: {
        lods: [
          {
            level: 0,
            path: asset.expectedAssetId
          }
        ],
        proxyPath: null,
        collidersPath: null,
        supportSurfacesEmbedded: Boolean(supportProfile),
        attachmentPointsPath: null,
        qaReportEmbedded: true
      },
      qa: {
        status: warnings.length > 0 ? "warning" : "passed",
        warnings
      }
    };

    packages.push(descriptor);
    const packageFilePath = path.join(paths.runtimePackageDir, `${asset.key}.json`);
    await writeFile(packageFilePath, `${JSON.stringify(descriptor, null, 2)}\n`, "utf8");
  }

  const catalog: RuntimePackageCatalog = {
    schemaVersion: "asset-package-index-alpha-v1",
    generatedAt,
    assets: packages.map((entry) => ({
      key: entry.key,
      manifestId: entry.manifestId,
      label: entry.label,
      assetId: entry.assetId,
      packagePath: `/assets/catalog/runtime-packages/${entry.key}.json`
    }))
  };

  await writeFile(paths.runtimePackageIndexPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

  return {
    ok: errors.length === 0,
    generatedAt,
    catalogPath: paths.runtimePackageIndexPath,
    packageDirectory: paths.runtimePackageDir,
    packageCount: catalog.assets.length,
    packages: catalog.assets,
    errors
  };
}
