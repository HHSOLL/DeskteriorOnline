import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { curatedDeskteriorAssets } from "./deskterior-curated-assets";
import { normalizeAssetSupportProfile } from "../src/lib/scene/support-profiles";

type ManifestEntry = Record<string, unknown> & {
  id?: unknown;
  assetId?: unknown;
  brand?: unknown;
  externalUrl?: unknown;
  description?: unknown;
  category?: unknown;
  options?: unknown;
  dimensionsMm?: unknown;
  finishColor?: unknown;
  finishMaterial?: unknown;
  detailNotes?: unknown;
  scaleLocked?: unknown;
  source?: unknown;
  license?: unknown;
  pivot?: unknown;
  collisionProxy?: unknown;
  textureSet?: unknown;
  lodProfile?: unknown;
  supportProfile?: unknown;
};

type VerificationError = {
  code: string;
  message: string;
  assetKey?: string;
  manifestId?: string;
  path?: string;
};

type CuratedAssetResult = {
  key: string;
  manifestId: string;
  sourcePath: string;
  runtimePath: string;
  expectedAssetId: string;
  sourceExists: boolean;
  runtimeExists: boolean;
  runtimeFresh: boolean;
  manifestEntryExists: boolean;
  manifestAssetIdMatches: boolean;
  metadataValid: boolean;
  supportProfileValid: boolean;
  optionsHintValid: boolean;
};

type Summary = {
  ok: boolean;
  counts: {
    curatedAssets: number;
    manifestEntries: number;
    sourceFilesFound: number;
    runtimeFilesFound: number;
    freshRuntimeFiles: number;
    curatedManifestEntriesValid: number;
    curatedSupportProfilesValid: number;
    duplicateManifestIds: number;
    errors: number;
  };
  manifestPath: string;
  curatedAssets: CuratedAssetResult[];
  errors: VerificationError[];
};

const scriptFile = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptFile);
const appRoot = path.resolve(scriptDir, "..");
const publicRoot = path.join(appRoot, "public");
const manifestPath = path.join(publicRoot, "assets", "catalog", "manifest.json");

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isWithinTolerance(actual: number, expected: number, tolerance = 0.005) {
  return Math.abs(actual - expected) <= tolerance;
}

function sortStrings(values: readonly string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function formatMeters(value: number) {
  return `${value.toFixed(3)} m`;
}

function toAssetId(runtimePath: string) {
  return `/${path.relative(publicRoot, runtimePath).split(path.sep).join("/")}`;
}

function createError(
  errors: VerificationError[],
  code: string,
  message: string,
  details: Omit<VerificationError, "code" | "message"> = {}
) {
  errors.push({ code, message, ...details });
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv: string[]) {
  const json = argv.includes("--json");
  const help = argv.includes("--help");
  const unknownArgs = argv.filter((arg) => !["--json", "--help"].includes(arg));
  return { json, help, unknownArgs };
}

async function buildSummary(): Promise<Summary> {
  const errors: VerificationError[] = [];
  const results: CuratedAssetResult[] = [];

  let manifestEntries: ManifestEntry[] = [];
  let duplicateManifestIds = 0;

  let manifestRaw: string | null = null;
  try {
    manifestRaw = await readFile(manifestPath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    createError(errors, "manifest.read_failed", `Failed to read manifest: ${message}`, { path: manifestPath });
  }

  if (manifestRaw !== null) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(manifestRaw);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      createError(errors, "manifest.invalid_json", `Manifest is not valid JSON: ${message}`, { path: manifestPath });
    }

    if (parsed !== undefined && !Array.isArray(parsed)) {
      createError(errors, "manifest.not_array", "Manifest root value must be a JSON array.", { path: manifestPath });
    }

    if (Array.isArray(parsed)) {
      manifestEntries = parsed as ManifestEntry[];
      const counts = new Map<string, number>();
      for (const entry of manifestEntries) {
        if (!entry || typeof entry !== "object") {
          continue;
        }
        const id = entry.id;
        if (!isNonEmptyString(id)) {
          continue;
        }
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }

      for (const [id, count] of counts.entries()) {
        if (count > 1) {
          duplicateManifestIds += 1;
          createError(
            errors,
            "manifest.duplicate_id",
            `Manifest contains duplicate id "${id}" (${count} entries).`,
            { manifestId: id, path: manifestPath }
          );
        }
      }
    }
  }

  const manifestById = new Map<string, ManifestEntry[]>();
  for (const entry of manifestEntries) {
    if (!entry || typeof entry !== "object" || !isNonEmptyString(entry.id)) {
      continue;
    }
    const bucket = manifestById.get(entry.id) ?? [];
    bucket.push(entry);
    manifestById.set(entry.id, bucket);
  }

  let sourceFilesFound = 0;
  let runtimeFilesFound = 0;
  let freshRuntimeFiles = 0;
  let curatedManifestEntriesValid = 0;
  let curatedSupportProfilesValid = 0;

  for (const asset of curatedDeskteriorAssets) {
    const result: CuratedAssetResult = {
      key: asset.key,
      manifestId: asset.manifestId,
      sourcePath: asset.sourcePath,
      runtimePath: asset.runtimePath,
      expectedAssetId: asset.expectedAssetId,
      sourceExists: false,
      runtimeExists: false,
      runtimeFresh: false,
      manifestEntryExists: false,
      manifestAssetIdMatches: false,
      metadataValid: false,
      supportProfileValid: asset.supportProfileExpectation ? false : true,
      optionsHintValid: asset.optionsHint ? false : true
    };

    const sourceExists = await fileExists(asset.sourcePath);
    result.sourceExists = sourceExists;
    if (sourceExists) {
      sourceFilesFound += 1;
    } else {
      createError(errors, "asset.source_missing", "Curated source .blend file is missing.", {
        assetKey: asset.key,
        path: asset.sourcePath
      });
    }

    const runtimeExists = await fileExists(asset.runtimePath);
    result.runtimeExists = runtimeExists;
    if (runtimeExists) {
      runtimeFilesFound += 1;
    } else {
      createError(errors, "asset.runtime_missing", "Curated runtime .glb file is missing.", {
        assetKey: asset.key,
        path: asset.runtimePath
      });
    }

    if (sourceExists && runtimeExists) {
      const [sourceStat, runtimeStat] = await Promise.all([stat(asset.sourcePath), stat(asset.runtimePath)]);
      if (runtimeStat.mtimeMs >= sourceStat.mtimeMs) {
        result.runtimeFresh = true;
        freshRuntimeFiles += 1;
      } else {
        createError(errors, "asset.runtime_stale", "Runtime .glb is older than its source .blend.", {
          assetKey: asset.key,
          path: asset.runtimePath
        });
      }
    }

    const derivedAssetId = toAssetId(asset.runtimePath);
    if (derivedAssetId !== asset.expectedAssetId) {
      createError(errors, "asset.mapping_mismatch", "Expected assetId does not match the runtime file path.", {
        assetKey: asset.key,
        manifestId: asset.manifestId,
        path: asset.runtimePath
      });
    }

    const matchingEntries = manifestById.get(asset.manifestId) ?? [];
    if (matchingEntries.length === 0) {
      createError(errors, "manifest.curated_missing", "Curated manifest entry is missing.", {
        assetKey: asset.key,
        manifestId: asset.manifestId,
        path: manifestPath
      });
      results.push(result);
      continue;
    }

    result.manifestEntryExists = true;
    const entry = matchingEntries[0];
    if (entry.assetId === asset.expectedAssetId) {
      result.manifestAssetIdMatches = true;
    } else {
      createError(errors, "manifest.asset_id_mismatch", "Manifest assetId does not match the curated runtime path.", {
        assetKey: asset.key,
        manifestId: asset.manifestId,
        path: manifestPath
      });
    }

    let metadataValid = true;
    for (const field of asset.requiredMetadata) {
      if (!isNonEmptyString(entry[field])) {
        metadataValid = false;
        createError(errors, "manifest.required_metadata_missing", `Manifest field "${field}" must be a non-empty string.`, {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: manifestPath
        });
      }
    }

    const dimensionsMm = entry.dimensionsMm;
    if (!isObjectRecord(dimensionsMm)) {
      metadataValid = false;
      createError(
        errors,
        "manifest.curated_physical_metadata_missing",
        'Manifest field "dimensionsMm" must be an object with positive width/depth/height values for curated assets.',
        {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: manifestPath
        }
      );
    } else {
      for (const dimension of ["width", "depth", "height"] as const) {
        if (!isPositiveNumber(dimensionsMm[dimension])) {
          metadataValid = false;
          createError(
            errors,
            "manifest.curated_physical_metadata_invalid",
            `Manifest field "dimensionsMm.${dimension}" must be a positive number for curated assets.`,
            {
              assetKey: asset.key,
              manifestId: asset.manifestId,
              path: manifestPath
            }
          );
        }
      }
    }

    for (const field of ["finishColor", "finishMaterial", "detailNotes"] as const) {
      if (!isNonEmptyString(entry[field])) {
        metadataValid = false;
        createError(
          errors,
          "manifest.curated_physical_metadata_missing",
          `Manifest field "${field}" must be a non-empty string for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
    }

    if (entry.scaleLocked !== true) {
      metadataValid = false;
      createError(
        errors,
        "manifest.curated_physical_metadata_invalid",
        'Manifest field "scaleLocked" must be true for curated assets.',
        {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: manifestPath
        }
      );
    }

    const source = entry.source;
    if (!isObjectRecord(source)) {
      metadataValid = false;
      createError(
        errors,
        "manifest.contract_metadata_missing",
        'Manifest field "source" must be an object for curated assets.',
        {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: manifestPath
        }
      );
    } else {
      const expectedSource = asset.contractMetadata.source;
      if (source.kind !== expectedSource.kind) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "source.kind" must be "${expectedSource.kind}" for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
      if (!isNonEmptyString(source.name) || source.name !== expectedSource.name) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "source.name" must be "${expectedSource.name}" for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
      if (!isNonEmptyString(source.path) || source.path !== expectedSource.path) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "source.path" must be "${expectedSource.path}" for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
    }

    const license = entry.license;
    if (!isObjectRecord(license)) {
      metadataValid = false;
      createError(
        errors,
        "manifest.contract_metadata_missing",
        'Manifest field "license" must be an object for curated assets.',
        {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: manifestPath
        }
      );
    } else {
      const expectedLicense = asset.contractMetadata.license;
      if (!isNonEmptyString(license.spdx) || license.spdx !== expectedLicense.spdx) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "license.spdx" must be "${expectedLicense.spdx}" for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
      if (!isNonEmptyString(license.label) || license.label !== expectedLicense.label) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "license.label" must be "${expectedLicense.label}" for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
      if (!isBoolean(license.requiresAttribution) || license.requiresAttribution !== expectedLicense.requiresAttribution) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "license.requiresAttribution" must be ${String(expectedLicense.requiresAttribution)} for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
    }

    const pivot = entry.pivot;
    if (!isObjectRecord(pivot)) {
      metadataValid = false;
      createError(
        errors,
        "manifest.contract_metadata_missing",
        'Manifest field "pivot" must be an object for curated assets.',
        {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: manifestPath
        }
      );
    } else {
      const expectedPivot = asset.contractMetadata.pivot;
      for (const axis of ["x", "y", "z"] as const) {
        if (!isNonEmptyString(pivot[axis]) || pivot[axis] !== expectedPivot[axis]) {
          metadataValid = false;
          createError(
            errors,
            "manifest.contract_metadata_invalid",
            `Manifest field "pivot.${axis}" must be "${expectedPivot[axis]}" for curated assets.`,
            {
              assetKey: asset.key,
              manifestId: asset.manifestId,
              path: manifestPath
            }
          );
        }
      }
    }

    const collisionProxy = entry.collisionProxy;
    if (!isObjectRecord(collisionProxy)) {
      metadataValid = false;
      createError(
        errors,
        "manifest.contract_metadata_missing",
        'Manifest field "collisionProxy" must be an object for curated assets.',
        {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: manifestPath
        }
      );
    } else {
      const expectedCollisionProxy = asset.contractMetadata.collisionProxy;
      if (collisionProxy.kind !== expectedCollisionProxy.kind) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "collisionProxy.kind" must be "${expectedCollisionProxy.kind}" for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
      if (collisionProxy.derivesFrom !== expectedCollisionProxy.derivesFrom) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "collisionProxy.derivesFrom" must be "${expectedCollisionProxy.derivesFrom}" for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
    }

    const textureSet = entry.textureSet;
    if (!isObjectRecord(textureSet)) {
      metadataValid = false;
      createError(
        errors,
        "manifest.contract_metadata_missing",
        'Manifest field "textureSet" must be an object for curated assets.',
        {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: manifestPath
        }
      );
    } else {
      const expectedTextureSet = asset.contractMetadata.textureSet;
      if (textureSet.workflow !== expectedTextureSet.workflow) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "textureSet.workflow" must be "${expectedTextureSet.workflow}" for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
      if (textureSet.authored !== expectedTextureSet.authored) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "textureSet.authored" must be "${expectedTextureSet.authored}" for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
      if (!isBoolean(textureSet.ktx2Ready) || textureSet.ktx2Ready !== expectedTextureSet.ktx2Ready) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "textureSet.ktx2Ready" must be ${String(expectedTextureSet.ktx2Ready)} for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
    }

    const lodProfile = entry.lodProfile;
    if (!isObjectRecord(lodProfile)) {
      metadataValid = false;
      createError(
        errors,
        "manifest.contract_metadata_missing",
        'Manifest field "lodProfile" must be an object for curated assets.',
        {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: manifestPath
        }
      );
    } else {
      const expectedLodProfile = asset.contractMetadata.lodProfile;
      if (lodProfile.strategy !== expectedLodProfile.strategy) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "lodProfile.strategy" must be "${expectedLodProfile.strategy}" for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
      if (!isPositiveInteger(lodProfile.levelCount) || lodProfile.levelCount !== expectedLodProfile.levelCount) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "lodProfile.levelCount" must be ${expectedLodProfile.levelCount} for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
      if (
        !isPositiveInteger(lodProfile.maxDrawCalls) ||
        lodProfile.maxDrawCalls !== expectedLodProfile.maxDrawCalls
      ) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "lodProfile.maxDrawCalls" must be ${expectedLodProfile.maxDrawCalls} for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
      if (
        !isPositiveInteger(lodProfile.maxTriangleCount) ||
        lodProfile.maxTriangleCount !== expectedLodProfile.maxTriangleCount
      ) {
        metadataValid = false;
        createError(
          errors,
          "manifest.contract_metadata_invalid",
          `Manifest field "lodProfile.maxTriangleCount" must be ${expectedLodProfile.maxTriangleCount} for curated assets.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
    }

    result.metadataValid = metadataValid;

    let supportProfileValid = asset.supportProfileExpectation ? false : true;
    if (asset.supportProfileExpectation) {
      const actualSupportProfile = normalizeAssetSupportProfile(entry.supportProfile);
      if (!actualSupportProfile) {
        createError(
          errors,
          "manifest.support_profile_missing",
          'Manifest field "supportProfile" must be a valid support surface object for this curated asset.',
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      } else {
        supportProfileValid = true;
        const expectedSurfaces = asset.supportProfileExpectation.surfaces;
        const actualSurfaces = actualSupportProfile.surfaces;

        if (actualSurfaces.length !== expectedSurfaces.length) {
          supportProfileValid = false;
          createError(
            errors,
            "manifest.support_profile_surface_count_mismatch",
            `Manifest supportProfile must contain ${expectedSurfaces.length} surface(s) for this curated asset.`,
            {
              assetKey: asset.key,
              manifestId: asset.manifestId,
              path: manifestPath
            }
          );
        }

        const expectedSurfaceIds = new Set(expectedSurfaces.map((surface) => surface.id));
        for (const actualSurface of actualSurfaces) {
          if (!expectedSurfaceIds.has(actualSurface.id)) {
            supportProfileValid = false;
            createError(
              errors,
              "manifest.support_profile_unexpected_surface",
              `Manifest supportProfile contains unexpected surface "${actualSurface.id}".`,
              {
                assetKey: asset.key,
                manifestId: asset.manifestId,
                path: manifestPath
              }
            );
          }
        }

        for (const expectedSurface of expectedSurfaces) {
          const actualSurface = actualSurfaces.find((surface) => surface.id === expectedSurface.id);
          if (!actualSurface) {
            supportProfileValid = false;
            createError(
              errors,
              "manifest.support_profile_surface_missing",
              `Manifest supportProfile is missing required surface "${expectedSurface.id}".`,
              {
                assetKey: asset.key,
                manifestId: asset.manifestId,
                path: manifestPath
              }
            );
            continue;
          }

          const expectedAnchorTypes = sortStrings(expectedSurface.anchorTypes);
          const actualAnchorTypes = sortStrings(actualSurface.anchorTypes);
          if (expectedAnchorTypes.join("|") !== actualAnchorTypes.join("|")) {
            supportProfileValid = false;
            createError(
              errors,
              "manifest.support_profile_anchor_types_mismatch",
              `Surface "${expectedSurface.id}" anchorTypes must be ${expectedAnchorTypes.join(", ")}.`,
              {
                assetKey: asset.key,
                manifestId: asset.manifestId,
                path: manifestPath
              }
            );
          }

          for (const [index, axis] of ["x", "z"].entries()) {
            if (!isWithinTolerance(actualSurface.center[index], expectedSurface.center[index])) {
              supportProfileValid = false;
              createError(
                errors,
                "manifest.support_profile_center_mismatch",
                `Surface "${expectedSurface.id}" center.${axis} must be ${formatMeters(expectedSurface.center[index])}.`,
                {
                  assetKey: asset.key,
                  manifestId: asset.manifestId,
                  path: manifestPath
                }
              );
            }
          }

          for (const [index, axis] of ["width", "depth"].entries()) {
            if (!isPositiveNumber(actualSurface.size[index])) {
              supportProfileValid = false;
              createError(
                errors,
                "manifest.support_profile_size_invalid",
                `Surface "${expectedSurface.id}" size.${axis} must be a positive number.`,
                {
                  assetKey: asset.key,
                  manifestId: asset.manifestId,
                  path: manifestPath
                }
              );
            } else if (!isWithinTolerance(actualSurface.size[index], expectedSurface.size[index])) {
              supportProfileValid = false;
              createError(
                errors,
                "manifest.support_profile_size_mismatch",
                `Surface "${expectedSurface.id}" size.${axis} must be ${formatMeters(expectedSurface.size[index])}.`,
                {
                  assetKey: asset.key,
                  manifestId: asset.manifestId,
                  path: manifestPath
                }
              );
            }
          }

          if (!isNonNegativeNumber(actualSurface.top) || !isWithinTolerance(actualSurface.top, expectedSurface.top)) {
            supportProfileValid = false;
            createError(
              errors,
              "manifest.support_profile_top_mismatch",
              `Surface "${expectedSurface.id}" top must be ${formatMeters(expectedSurface.top)}.`,
              {
                assetKey: asset.key,
                manifestId: asset.manifestId,
                path: manifestPath
              }
            );
          }

          const expectedMargin = expectedSurface.margin;
          if (expectedMargin) {
            if (!actualSurface.margin || actualSurface.margin.length < 2) {
              supportProfileValid = false;
              createError(
                errors,
                "manifest.support_profile_margin_missing",
                `Surface "${expectedSurface.id}" margin must be defined for this curated asset.`,
                {
                  assetKey: asset.key,
                  manifestId: asset.manifestId,
                  path: manifestPath
                }
              );
            } else {
              for (const [index, axis] of ["x", "z"].entries()) {
                if (
                  !isNonNegativeNumber(actualSurface.margin[index]) ||
                  !isWithinTolerance(actualSurface.margin[index], expectedMargin[index])
                ) {
                  supportProfileValid = false;
                  createError(
                    errors,
                    "manifest.support_profile_margin_mismatch",
                    `Surface "${expectedSurface.id}" margin.${axis} must be ${formatMeters(expectedMargin[index])}.`,
                    {
                      assetKey: asset.key,
                      manifestId: asset.manifestId,
                      path: manifestPath
                    }
                  );
                }
              }
            }
          }
        }
      }
    }

    result.supportProfileValid = supportProfileValid;
    if (supportProfileValid) {
      curatedSupportProfilesValid += 1;
    }

    if (asset.optionsHint) {
      const options = entry.options;
      if (isNonEmptyString(options) && options.includes(asset.optionsHint)) {
        result.optionsHintValid = true;
      } else {
        createError(
          errors,
          "manifest.options_hint_missing",
          `Manifest options must include "${asset.optionsHint}" for this curated asset.`,
          {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: manifestPath
          }
        );
      }
    }

    if (
      result.manifestEntryExists &&
      result.manifestAssetIdMatches &&
      result.metadataValid &&
      result.supportProfileValid &&
      result.optionsHintValid
    ) {
      curatedManifestEntriesValid += 1;
    }

    results.push(result);
  }

  return {
    ok: errors.length === 0,
    counts: {
      curatedAssets: curatedDeskteriorAssets.length,
      manifestEntries: manifestEntries.length,
      sourceFilesFound,
      runtimeFilesFound,
      freshRuntimeFiles,
      curatedManifestEntriesValid,
      curatedSupportProfilesValid,
      duplicateManifestIds,
      errors: errors.length
    },
    manifestPath,
    curatedAssets: results,
    errors
  };
}

function printHumanReadable(summary: Summary) {
  console.log("Deskterior Pipeline Verification");
  console.log(`Status: ${summary.ok ? "PASS" : "FAIL"}`);
  console.log(`Manifest: ${summary.manifestPath}`);
  console.log("");
  console.log("Counts:");
  console.log(`- Curated assets checked: ${summary.counts.curatedAssets}`);
  console.log(`- Manifest entries: ${summary.counts.manifestEntries}`);
  console.log(`- Source .blend files found: ${summary.counts.sourceFilesFound}/${summary.counts.curatedAssets}`);
  console.log(`- Runtime .glb files found: ${summary.counts.runtimeFilesFound}/${summary.counts.curatedAssets}`);
  console.log(`- Fresh runtime exports: ${summary.counts.freshRuntimeFiles}/${summary.counts.curatedAssets}`);
  console.log(
    `- Curated manifest entries valid: ${summary.counts.curatedManifestEntriesValid}/${summary.counts.curatedAssets}`
  );
  console.log(
    `- Curated support profiles valid: ${summary.counts.curatedSupportProfilesValid}/${summary.counts.curatedAssets}`
  );
  console.log(`- Duplicate manifest ids: ${summary.counts.duplicateManifestIds}`);
  console.log(`- Errors: ${summary.counts.errors}`);
  console.log("");
  console.log("Curated assets:");
  for (const asset of summary.curatedAssets) {
    console.log(
      `- ${asset.key} -> ${asset.manifestId} | source=${asset.sourceExists ? "ok" : "missing"} | runtime=${
        asset.runtimeExists ? "ok" : "missing"
      } | fresh=${asset.runtimeFresh ? "ok" : "fail"} | manifest=${asset.manifestEntryExists ? "ok" : "missing"} | assetId=${
        asset.manifestAssetIdMatches ? "ok" : "fail"
      } | metadata=${asset.metadataValid ? "ok" : "fail"} | supportProfile=${
        asset.supportProfileValid ? "ok" : "fail"
      } | optionsHint=${asset.optionsHintValid ? "ok" : "fail"}`
    );
  }

  if (summary.errors.length === 0) {
    console.log("");
    console.log("No errors found.");
    return;
  }

  console.log("");
  console.log("Errors:");
  summary.errors.forEach((error, index) => {
    const context = [error.assetKey, error.manifestId, error.path].filter(Boolean).join(" | ");
    console.log(`${index + 1}. [${error.code}] ${error.message}${context ? ` (${context})` : ""}`);
  });
}

async function main() {
  const { json, help, unknownArgs } = parseArgs(process.argv.slice(2));

  if (help) {
    console.log("Usage: node --import tsx apps/web/scripts/verify-deskterior-pipeline.ts [--json]");
    process.exit(0);
  }

  if (unknownArgs.length > 0) {
    console.error(`Unknown arguments: ${unknownArgs.join(", ")}`);
    console.error("Usage: node --import tsx apps/web/scripts/verify-deskterior-pipeline.ts [--json]");
    process.exit(1);
  }

  const summary = await buildSummary();

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printHumanReadable(summary);
  }

  process.exit(summary.ok ? 0 : 1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
