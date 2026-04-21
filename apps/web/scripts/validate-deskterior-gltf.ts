import { readFile, stat } from "node:fs/promises";
import { validateBytes } from "gltf-validator";
import { curatedDeskteriorAssets } from "./deskterior-curated-assets";

type ValidationMessage = {
  code: string;
  message: string;
  severity: number;
  pointer?: string;
};

type ValidationReport = {
  info?: {
    drawCallCount?: number;
    totalTriangleCount?: number;
    totalVertexCount?: number;
    materialCount?: number;
    extensionsUsed?: string[];
  };
  issues?: {
    numErrors?: number;
    numWarnings?: number;
    numInfos?: number;
    numHints?: number;
    messages?: ValidationMessage[];
  };
};

type ValidationResult = {
  key: string;
  manifestId: string;
  runtimePath: string;
  ok: boolean;
  exists: boolean;
  fileSizeBytes: number | null;
  numErrors: number;
  numWarnings: number;
  numInfos: number;
  numHints: number;
  drawCallCount: number | null;
  totalTriangleCount: number | null;
  totalVertexCount: number | null;
  materialCount: number | null;
  extensionsUsed: string[];
  usesKtx2: boolean;
  budgetViolations: string[];
  messages: ValidationMessage[];
};

type Summary = {
  ok: boolean;
  strictWarnings: boolean;
  requireKtx2: boolean;
  counts: {
    assets: number;
    validated: number;
    missingRuntime: number;
    errors: number;
    warnings: number;
    budgetFailures: number;
    ktx2Assets: number;
  };
  results: ValidationResult[];
};

function parseArgs(argv: string[]) {
  const json = argv.includes("--json");
  const strictWarnings = argv.includes("--strict-warnings");
  const requireKtx2 = argv.includes("--require-ktx2");
  const help = argv.includes("--help");
  const unknownArgs = argv.filter(
    (arg) => !["--json", "--strict-warnings", "--require-ktx2", "--help"].includes(arg)
  );
  return { json, strictWarnings, requireKtx2, help, unknownArgs };
}

function severityLabel(severity: number) {
  switch (severity) {
    case 0:
      return "error";
    case 1:
      return "warning";
    case 2:
      return "info";
    case 3:
      return "hint";
    default:
      return "unknown";
  }
}

function toSafeCount(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toSafeMetric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatBytes(value: number | null) {
  if (value === null) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

async function validateRuntimeAsset(
  asset: (typeof curatedDeskteriorAssets)[number],
  strictWarnings: boolean,
  requireKtx2: boolean
): Promise<ValidationResult> {
  try {
    const [bytes, fileStats] = await Promise.all([readFile(asset.runtimePath), stat(asset.runtimePath)]);
    const report = (await validateBytes(new Uint8Array(bytes), {
      uri: asset.runtimePath,
      maxIssues: 50,
      writeTimestamp: false
    })) as ValidationReport;
    const issues = report.issues ?? {};
    const numErrors = toSafeCount(issues.numErrors);
    const numWarnings = toSafeCount(issues.numWarnings);
    const numInfos = toSafeCount(issues.numInfos);
    const numHints = toSafeCount(issues.numHints);
    const drawCallCount = toSafeMetric(report.info?.drawCallCount);
    const totalTriangleCount = toSafeMetric(report.info?.totalTriangleCount);
    const extensionsUsed = Array.isArray(report.info?.extensionsUsed)
      ? report.info.extensionsUsed.filter((value): value is string => typeof value === "string")
      : [];
    const usesKtx2 = extensionsUsed.includes("KHR_texture_basisu");
    const budgetViolations: string[] = [];

    if (fileStats.size > asset.budget.maxFileSizeBytes) {
      budgetViolations.push(
        `runtime size ${formatBytes(fileStats.size)} exceeds budget ${formatBytes(asset.budget.maxFileSizeBytes)}`
      );
    }

    if (drawCallCount !== null && drawCallCount > asset.budget.maxDrawCalls) {
      budgetViolations.push(`draw calls ${drawCallCount} exceed budget ${asset.budget.maxDrawCalls}`);
    }

    if (totalTriangleCount !== null && totalTriangleCount > asset.budget.maxTriangleCount) {
      budgetViolations.push(`triangles ${totalTriangleCount} exceed budget ${asset.budget.maxTriangleCount}`);
    }

    if (requireKtx2 && !usesKtx2) {
      budgetViolations.push("missing KHR_texture_basisu extension");
    }

    return {
      key: asset.key,
      manifestId: asset.manifestId,
      runtimePath: asset.runtimePath,
      ok: numErrors === 0 && (!strictWarnings || numWarnings === 0) && budgetViolations.length === 0,
      exists: true,
      fileSizeBytes: fileStats.size,
      numErrors,
      numWarnings,
      numInfos,
      numHints,
      drawCallCount,
      totalTriangleCount,
      totalVertexCount: toSafeMetric(report.info?.totalVertexCount),
      materialCount: toSafeMetric(report.info?.materialCount),
      extensionsUsed,
      usesKtx2,
      budgetViolations,
      messages: Array.isArray(issues.messages) ? issues.messages : []
    };
  } catch (error) {
    return {
      key: asset.key,
      manifestId: asset.manifestId,
      runtimePath: asset.runtimePath,
      ok: false,
      exists: false,
      fileSizeBytes: null,
      numErrors: 1,
      numWarnings: 0,
      numInfos: 0,
      numHints: 0,
      drawCallCount: null,
      totalTriangleCount: null,
      totalVertexCount: null,
      materialCount: null,
      extensionsUsed: [],
      usesKtx2: false,
      budgetViolations: [],
      messages: [
        {
          code: "RUNTIME_MISSING_OR_INVALID",
          message: error instanceof Error ? error.message : String(error),
          severity: 0
        }
      ]
    };
  }
}

async function buildSummary(strictWarnings: boolean, requireKtx2: boolean): Promise<Summary> {
  const results = await Promise.all(
    curatedDeskteriorAssets.map((asset) => validateRuntimeAsset(asset, strictWarnings, requireKtx2))
  );

  return {
    ok: results.every((result) => result.ok),
    strictWarnings,
    requireKtx2,
    counts: {
      assets: curatedDeskteriorAssets.length,
      validated: results.filter((result) => result.exists).length,
      missingRuntime: results.filter((result) => !result.exists).length,
      errors: results.reduce((sum, result) => sum + result.numErrors, 0),
      warnings: results.reduce((sum, result) => sum + result.numWarnings, 0),
      budgetFailures: results.filter((result) => result.budgetViolations.length > 0).length,
      ktx2Assets: results.filter((result) => result.usesKtx2).length
    },
    results
  };
}

function printHumanReadable(summary: Summary) {
  console.log("Deskterior GLTF Validation");
  console.log(`Status: ${summary.ok ? "PASS" : "FAIL"}`);
  console.log(`Strict warnings: ${summary.strictWarnings ? "on" : "off"}`);
  console.log(`KTX2 required: ${summary.requireKtx2 ? "yes" : "no"}`);
  console.log("");
  console.log("Counts:");
  console.log(`- Curated assets: ${summary.counts.assets}`);
  console.log(`- Validated runtime files: ${summary.counts.validated}`);
  console.log(`- Missing runtime files: ${summary.counts.missingRuntime}`);
  console.log(`- Errors: ${summary.counts.errors}`);
  console.log(`- Warnings: ${summary.counts.warnings}`);
  console.log(`- Budget failures: ${summary.counts.budgetFailures}`);
  console.log(`- KTX2 assets: ${summary.counts.ktx2Assets}`);
  console.log("");
  console.log("Assets:");

  for (const result of summary.results) {
    console.log(
      `- ${result.key} -> ${result.manifestId} | status=${result.ok ? "ok" : "fail"} | size=${formatBytes(result.fileSizeBytes)} | errors=${result.numErrors} | warnings=${result.numWarnings} | infos=${result.numInfos} | drawCalls=${result.drawCallCount ?? "-"} | triangles=${result.totalTriangleCount ?? "-"}`
    );

    const surfacedMessages = result.messages.filter((message) => message.severity <= 1).slice(0, 5);
    for (const message of surfacedMessages) {
      const pointer = message.pointer ? ` @ ${message.pointer}` : "";
      console.log(`  • ${severityLabel(message.severity)} ${message.code}${pointer}: ${message.message}`);
    }

    for (const violation of result.budgetViolations) {
      console.log(`  • budget: ${violation}`);
    }
  }
}

async function main() {
  const { json, strictWarnings, requireKtx2, help, unknownArgs } = parseArgs(process.argv.slice(2));

  if (help) {
    console.log(
      [
        "Usage: node --import tsx apps/web/scripts/validate-deskterior-gltf.ts [options]",
        "",
        "Options:",
        "  --json             Print machine-readable summary JSON",
        "  --strict-warnings  Treat warnings as failures",
        "  --require-ktx2     Fail when runtime assets do not use KHR_texture_basisu",
        "  --help             Show help"
      ].join("\n")
    );
    process.exit(0);
  }

  if (unknownArgs.length > 0) {
    console.error(`Unknown arguments: ${unknownArgs.join(", ")}`);
    process.exit(1);
  }

  const summary = await buildSummary(strictWarnings, requireKtx2);

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
