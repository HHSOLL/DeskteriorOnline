import { access, mkdir, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { getCuratedDeskteriorAssets } from "./curated-assets";
import { createAssetCompilerPaths } from "./paths";

const execFileAsync = promisify(execFile);

export type ExportAssetResult = {
  key: string;
  sourcePath: string;
  runtimePath: string;
  sourceExists: boolean;
  runtimeBeforeExists: boolean;
  runtimeAfterExists: boolean;
  freshBefore: boolean;
  freshAfter: boolean;
  attemptedExport: boolean;
  exported: boolean;
  errors: string[];
};

export type ExportSummary = {
  ok: boolean;
  mode: "export" | "report";
  strict: boolean;
  blenderBin: string;
  globalErrors: string[];
  counts: {
    assets: number;
    sourceFound: number;
    runtimeFoundBefore: number;
    runtimeFoundAfter: number;
    staleBefore: number;
    staleAfter: number;
    exported: number;
    errors: number;
  };
  results: ExportAssetResult[];
};

export type ExportArgs = {
  report: boolean;
  strict: boolean;
  json: boolean;
};

export function parseExportArgs(argv: string[]): ExportArgs {
  const report = argv.includes("--report") || argv.includes("--dry-run");
  const strict = argv.includes("--strict");
  const json = argv.includes("--json");
  const allowed = new Set(["--report", "--dry-run", "--strict", "--json", "--help"]);
  const unknown = argv.filter((arg) => !allowed.has(arg));

  if (argv.includes("--help")) {
    console.log(
      [
        "Usage: node --import tsx apps/web/scripts/export-deskterior-runtime.ts [options]",
        "",
        "Options:",
        "  --report, --dry-run  Validate source/runtime state without exporting",
        "  --strict              Fail when any runtime GLB is still missing after run",
        "  --json                Print machine-readable summary JSON",
        "  --help                Show help"
      ].join("\n")
    );
    process.exit(0);
  }

  if (unknown.length > 0) {
    console.error(`Unknown arguments: ${unknown.join(", ")}`);
    console.error("Run with --help to see supported options.");
    process.exit(1);
  }

  return { report, strict, json };
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isRuntimeFresh(sourcePath: string, runtimePath: string) {
  const [sourceStats, runtimeStats] = await Promise.all([stat(sourcePath), stat(runtimePath)]);
  return runtimeStats.mtimeMs >= sourceStats.mtimeMs;
}

function getBlenderBin() {
  return process.env.BLENDER_BIN?.trim() || "blender";
}

async function validateBlenderBinary(blenderBin: string) {
  try {
    await execFileAsync(blenderBin, ["--version"], { maxBuffer: 1024 * 1024 * 4 });
    return true;
  } catch {
    return false;
  }
}

function escapePythonPath(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

async function exportOneAsset(blenderBin: string, sourcePath: string, runtimePath: string) {
  const outputDir = path.dirname(runtimePath);
  await mkdir(outputDir, { recursive: true });

  const pythonExpr = [
    "import bpy",
    `bpy.ops.export_scene.gltf(filepath='${escapePythonPath(runtimePath)}', export_format='GLB', use_selection=False, export_yup=True, export_apply=True)`
  ].join("; ");

  await execFileAsync(blenderBin, ["-b", sourcePath, "--python-expr", pythonExpr], {
    maxBuffer: 1024 * 1024 * 16
  });
}

function toAssetId(publicRoot: string, runtimePath: string) {
  return `/${path.relative(publicRoot, runtimePath).split(path.sep).join("/")}`;
}

export async function runExportCuratedRuntime(args: ExportArgs): Promise<ExportSummary> {
  const paths = createAssetCompilerPaths();
  const curatedAssets = getCuratedDeskteriorAssets(paths);
  const blenderBin = getBlenderBin();
  const mode: ExportSummary["mode"] = args.report ? "report" : "export";
  const results: ExportAssetResult[] = [];
  let sourceFound = 0;
  let runtimeFoundBefore = 0;
  let runtimeFoundAfter = 0;
  let staleBefore = 0;
  let staleAfter = 0;
  let exported = 0;
  const globalErrors: string[] = [];
  let blenderChecked = false;
  let blenderReady = false;

  for (const asset of curatedAssets) {
    const assetErrors: string[] = [];
    const sourceExists = await fileExists(asset.sourcePath);
    if (sourceExists) {
      sourceFound += 1;
    } else {
      assetErrors.push("missing source .blend");
    }

    const runtimeBeforeExists = await fileExists(asset.runtimePath);
    if (runtimeBeforeExists) {
      runtimeFoundBefore += 1;
    }

    let freshBefore = false;
    if (sourceExists && runtimeBeforeExists) {
      freshBefore = await isRuntimeFresh(asset.sourcePath, asset.runtimePath);
      if (!freshBefore) {
        staleBefore += 1;
      }
    }

    const mappingAssetId = toAssetId(paths.publicRoot, asset.runtimePath);
    if (mappingAssetId !== asset.expectedAssetId) {
      assetErrors.push(`assetId mapping mismatch (${mappingAssetId} != ${asset.expectedAssetId})`);
    }

    let attemptedExport = false;
    let exportSucceeded = false;
    const exportRequired = sourceExists && (!runtimeBeforeExists || !freshBefore);
    if (!args.report && globalErrors.length === 0 && exportRequired) {
      if (!blenderChecked) {
        blenderReady = await validateBlenderBinary(blenderBin);
        blenderChecked = true;
        if (!blenderReady) {
          globalErrors.push(
            `Blender binary not found or not executable: "${blenderBin}". Set BLENDER_BIN or run with --report.`
          );
        }
      }
    }

    if (!args.report && globalErrors.length === 0 && exportRequired) {
      attemptedExport = true;
      try {
        await exportOneAsset(blenderBin, asset.sourcePath, asset.runtimePath);
        exportSucceeded = true;
        exported += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        assetErrors.push(`export failed: ${message}`);
      }
    }

    const runtimeAfterExists = await fileExists(asset.runtimePath);
    if (runtimeAfterExists) {
      runtimeFoundAfter += 1;
    }

    let freshAfter = false;
    if (sourceExists && runtimeAfterExists) {
      freshAfter = await isRuntimeFresh(asset.sourcePath, asset.runtimePath);
      if (!freshAfter) {
        staleAfter += 1;
      }
    }

    results.push({
      key: asset.key,
      sourcePath: asset.sourcePath,
      runtimePath: asset.runtimePath,
      sourceExists,
      runtimeBeforeExists,
      runtimeAfterExists,
      freshBefore,
      freshAfter,
      attemptedExport,
      exported: exportSucceeded,
      errors: assetErrors
    });
  }

  const strictMissingRuntime = args.strict ? results.some((result) => !result.runtimeAfterExists) : false;
  if (strictMissingRuntime) {
    globalErrors.push("strict mode: at least one curated runtime .glb is missing after run");
  }

  const errorCount = globalErrors.length + results.reduce((sum, result) => sum + result.errors.length, 0);

  return {
    ok: errorCount === 0,
    mode,
    strict: args.strict,
    blenderBin,
    globalErrors,
    counts: {
      assets: curatedAssets.length,
      sourceFound,
      runtimeFoundBefore,
      runtimeFoundAfter,
      staleBefore,
      staleAfter,
      exported,
      errors: errorCount
    },
    results
  };
}

export function printExportSummary(summary: ExportSummary) {
  console.log("Deskterior Runtime Export");
  console.log(`Status: ${summary.ok ? "PASS" : "FAIL"}`);
  console.log(`Mode: ${summary.mode}`);
  console.log(`Strict: ${summary.strict ? "on" : "off"}`);
  console.log(`Blender: ${summary.blenderBin}`);
  console.log("");
  console.log("Counts:");
  console.log(`- Assets: ${summary.counts.assets}`);
  console.log(`- Source .blend found: ${summary.counts.sourceFound}/${summary.counts.assets}`);
  console.log(`- Runtime .glb found (before): ${summary.counts.runtimeFoundBefore}/${summary.counts.assets}`);
  console.log(`- Runtime .glb found (after): ${summary.counts.runtimeFoundAfter}/${summary.counts.assets}`);
  console.log(`- Stale runtime (before): ${summary.counts.staleBefore}`);
  console.log(`- Stale runtime (after): ${summary.counts.staleAfter}`);
  console.log(`- Exports succeeded: ${summary.counts.exported}`);
  console.log(`- Errors: ${summary.counts.errors}`);
  console.log("");
  console.log("Assets:");

  for (const result of summary.results) {
    const status = result.errors.length === 0 ? "ok" : "fail";
    console.log(
      `- ${result.key}: ${status} | source=${result.sourceExists ? "ok" : "missing"} | runtime(after)=${
        result.runtimeAfterExists ? "ok" : "missing"
      } | fresh(after)=${result.freshAfter ? "ok" : "stale"} | exported=${result.exported ? "yes" : "no"}`
    );
  }

  const errorLines = [
    ...summary.globalErrors.map((error) => ({ key: "global", message: error })),
    ...summary.results.flatMap((result) => result.errors.map((error) => ({ key: result.key, message: error })))
  ];
  if (errorLines.length > 0) {
    console.log("");
    console.log("Errors:");
    errorLines.forEach((item, index) => {
      console.log(`${index + 1}. [${item.key}] ${item.message}`);
    });
  }
}

export async function runExportCuratedRuntimeCli(argv: string[]) {
  const args = parseExportArgs(argv);
  const summary = await runExportCuratedRuntime(args);
  if (args.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printExportSummary(summary);
  }
  process.exit(summary.ok ? 0 : 1);
}
