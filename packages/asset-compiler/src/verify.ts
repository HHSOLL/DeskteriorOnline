import { access, readFile, stat } from "node:fs/promises";
import { createAssetCompilerPaths } from "./paths";
import { getCuratedDeskteriorAssets } from "./curated-assets";

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

export type VerificationSummary = {
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
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

function parseVerifyArgs(argv: string[]) {
  const json = argv.includes("--json");
  const help = argv.includes("--help");
  const unknownArgs = argv.filter((arg) => !["--json", "--help"].includes(arg));
  return { json, help, unknownArgs };
}

export async function buildCuratedPipelineSummary(): Promise<VerificationSummary> {
  const paths = createAssetCompilerPaths();
  const curatedAssets = getCuratedDeskteriorAssets(paths);
  const errors: VerificationError[] = [];
  const results: CuratedAssetResult[] = [];
  const manifestRaw = await readFile(paths.manifestPath, "utf8");
  const parsed = JSON.parse(manifestRaw) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Manifest root value must be a JSON array.");
  }

  const manifestEntries = parsed as ManifestEntry[];
  let duplicateManifestIds = 0;
  const counts = new Map<string, number>();
  for (const entry of manifestEntries) {
    if (!entry || typeof entry !== "object") continue;
    if (!isNonEmptyString(entry.id)) continue;
    counts.set(entry.id, (counts.get(entry.id) ?? 0) + 1);
  }
  for (const [id, count] of counts.entries()) {
    if (count > 1) {
      duplicateManifestIds += 1;
      createError(errors, "manifest.duplicate_id", `Manifest contains duplicate id "${id}" (${count} entries).`, {
        manifestId: id,
        path: paths.manifestPath
      });
    }
  }

  const manifestById = new Map<string, ManifestEntry[]>();
  for (const entry of manifestEntries) {
    if (!entry || typeof entry !== "object" || !isNonEmptyString(entry.id)) continue;
    const bucket = manifestById.get(entry.id) ?? [];
    bucket.push(entry);
    manifestById.set(entry.id, bucket);
  }

  let sourceFilesFound = 0;
  let runtimeFilesFound = 0;
  let freshRuntimeFiles = 0;
  let curatedManifestEntriesValid = 0;
  let curatedSupportProfilesValid = 0;

  for (const asset of curatedAssets) {
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
    if (sourceExists) sourceFilesFound += 1;
    else createError(errors, "asset.source_missing", "Curated source .blend file is missing.", { assetKey: asset.key, path: asset.sourcePath });

    const runtimeExists = await fileExists(asset.runtimePath);
    result.runtimeExists = runtimeExists;
    if (runtimeExists) runtimeFilesFound += 1;
    else createError(errors, "asset.runtime_missing", "Curated runtime .glb file is missing.", { assetKey: asset.key, path: asset.runtimePath });

    if (sourceExists && runtimeExists) {
      const [sourceStat, runtimeStat] = await Promise.all([stat(asset.sourcePath), stat(asset.runtimePath)]);
      if (runtimeStat.mtimeMs >= sourceStat.mtimeMs) {
        result.runtimeFresh = true;
        freshRuntimeFiles += 1;
      } else {
        createError(errors, "asset.runtime_stale", "Runtime .glb is older than its source .blend.", { assetKey: asset.key, path: asset.runtimePath });
      }
    }

    const derivedAssetId = `/${asset.runtimePath.replace(`${paths.publicRoot}/`, "").split("/").join("/")}`;
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
        path: paths.manifestPath
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
        path: paths.manifestPath
      });
    }

    let metadataValid = true;
    for (const field of asset.requiredMetadata) {
      if (!isNonEmptyString(entry[field])) {
        metadataValid = false;
        createError(errors, "manifest.required_metadata_missing", `Manifest field "${field}" must be a non-empty string.`, {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: paths.manifestPath
        });
      }
    }

    if (!isObjectRecord(entry.dimensionsMm)) {
      metadataValid = false;
      createError(errors, "manifest.curated_physical_metadata_missing", 'Manifest field "dimensionsMm" must be an object.', {
        assetKey: asset.key,
        manifestId: asset.manifestId,
        path: paths.manifestPath
      });
    } else {
      for (const dimension of ["width", "depth", "height"] as const) {
        if (!isPositiveNumber(entry.dimensionsMm[dimension])) {
          metadataValid = false;
          createError(errors, "manifest.curated_physical_metadata_invalid", `Manifest field "dimensionsMm.${dimension}" must be positive.`, {
            assetKey: asset.key,
            manifestId: asset.manifestId,
            path: paths.manifestPath
          });
        }
      }
    }

    for (const field of ["finishColor", "finishMaterial", "detailNotes"] as const) {
      if (!isNonEmptyString(entry[field])) {
        metadataValid = false;
        createError(errors, "manifest.curated_physical_metadata_missing", `Manifest field "${field}" must be non-empty.`, {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: paths.manifestPath
        });
      }
    }

    if (entry.scaleLocked !== true) {
      metadataValid = false;
      createError(errors, "manifest.curated_physical_metadata_invalid", 'Manifest field "scaleLocked" must be true.', {
        assetKey: asset.key,
        manifestId: asset.manifestId,
        path: paths.manifestPath
      });
    }

    for (const field of ["source", "license", "pivot", "collisionProxy", "textureSet", "lodProfile"] as const) {
      if (JSON.stringify(entry[field]) !== JSON.stringify(asset.contractMetadata[field])) {
        metadataValid = false;
        createError(errors, "manifest.contract_metadata_invalid", `Manifest field "${field}" must match curated contract metadata.`, {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: paths.manifestPath
        });
      }
    }

    result.metadataValid = metadataValid;
    if (metadataValid) curatedManifestEntriesValid += 1;

    if (asset.supportProfileExpectation) {
      if (JSON.stringify(entry.supportProfile) === JSON.stringify(asset.supportProfileExpectation)) {
        result.supportProfileValid = true;
        curatedSupportProfilesValid += 1;
      } else {
        createError(errors, "manifest.support_profile_invalid", "Manifest supportProfile must match curated support profile expectation.", {
          assetKey: asset.key,
          manifestId: asset.manifestId,
          path: paths.manifestPath
        });
      }
    } else if (entry.supportProfile === undefined || entry.supportProfile === null) {
      curatedSupportProfilesValid += 1;
    }

    if (!asset.optionsHint || (isNonEmptyString(entry.options) && entry.options.includes(asset.optionsHint))) {
      result.optionsHintValid = true;
    } else {
      createError(errors, "manifest.options_hint_missing", "Manifest options field must include the curated options hint.", {
        assetKey: asset.key,
        manifestId: asset.manifestId,
        path: paths.manifestPath
      });
    }

    if (asset.attachmentAuthoring.mode === "manual_required") {
      createError(errors, "asset.attachment_authoring_missing", "Curated asset requires attachment authoring before publish.", {
        assetKey: asset.key,
        manifestId: asset.manifestId
      });
    }

    results.push(result);
  }

  return {
    ok: errors.length === 0,
    counts: {
      curatedAssets: curatedAssets.length,
      manifestEntries: manifestEntries.length,
      sourceFilesFound,
      runtimeFilesFound,
      freshRuntimeFiles,
      curatedManifestEntriesValid,
      curatedSupportProfilesValid,
      duplicateManifestIds,
      errors: errors.length
    },
    manifestPath: paths.manifestPath,
    curatedAssets: results,
    errors
  };
}

export function printCuratedPipelineSummary(summary: VerificationSummary) {
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
  console.log(`- Curated manifest entries valid: ${summary.counts.curatedManifestEntriesValid}/${summary.counts.curatedAssets}`);
  console.log(`- Curated support profiles valid: ${summary.counts.curatedSupportProfilesValid}/${summary.counts.curatedAssets}`);
  console.log(`- Duplicate manifest ids: ${summary.counts.duplicateManifestIds}`);
  console.log(`- Errors: ${summary.counts.errors}`);
  console.log("");
  console.log("Curated assets:");
  for (const asset of summary.curatedAssets) {
    console.log(
      `- ${asset.key} -> ${asset.manifestId} | source=${asset.sourceExists ? "ok" : "missing"} | runtime=${asset.runtimeExists ? "ok" : "missing"} | fresh=${asset.runtimeFresh ? "ok" : "stale"} | manifest=${asset.manifestEntryExists ? "ok" : "missing"} | assetId=${asset.manifestAssetIdMatches ? "ok" : "mismatch"} | metadata=${asset.metadataValid ? "ok" : "fail"} | supportProfile=${asset.supportProfileValid ? "ok" : "fail"} | optionsHint=${asset.optionsHintValid ? "ok" : "fail"}`
    );
  }
  if (summary.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    for (const [index, error] of summary.errors.entries()) {
      console.log(`${index + 1}. [${error.code}] ${error.message}`);
    }
  } else {
    console.log("");
    console.log("No errors found.");
  }
}

export async function runVerifyCuratedPipelineCli(argv: string[]) {
  const { json, help, unknownArgs } = parseVerifyArgs(argv);
  if (help) {
    console.log(
      [
        "Usage: node --import tsx apps/web/scripts/verify-deskterior-pipeline.ts [options]",
        "",
        "Options:",
        "  --json   Print machine-readable summary JSON",
        "  --help   Show help"
      ].join("\n")
    );
    process.exit(0);
  }
  if (unknownArgs.length > 0) {
    console.error(`Unknown arguments: ${unknownArgs.join(", ")}`);
    process.exit(1);
  }
  const summary = await buildCuratedPipelineSummary();
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printCuratedPipelineSummary(summary);
  }
  process.exit(summary.ok ? 0 : 1);
}
