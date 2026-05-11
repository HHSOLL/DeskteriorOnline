import { runExportCuratedRuntime, parseExportArgs, printExportSummary } from "./export";
import { writeAssetIngestDraft } from "./ingest";
import { runOptimizeCuratedRuntimeCli } from "./optimize";
import { publishCuratedRuntimePackages } from "./publish";
import {
  analyzeProductUrlReference,
  parseProductUrlReferenceArgs,
  printProductUrlReferenceSummary
} from "./product-url-reference";
import { runSyncCuratedCatalogCli } from "./sync";
import { buildCuratedValidationSummary, parseValidateArgs, printValidationSummary } from "./validate";
import { buildCuratedPipelineSummary, printCuratedPipelineSummary } from "./verify";
import {
  buildPublishedRuntimePackageSummary,
  printPublishedRuntimePackageSummary
} from "./verify-packages";

function parseAssetCompilerArgs(argv: string[]) {
  const [command, ...rest] = argv;
  return {
    command: command ?? "help",
    rest
  };
}

function readOption(args: string[], name: string) {
  const prefix = `--${name}=`;
  const inline = args.find((entry) => entry.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const optionIndex = args.findIndex((entry) => entry === `--${name}`);
  if (optionIndex >= 0) {
    return args[optionIndex + 1] ?? null;
  }

  return null;
}

function printHelp() {
  console.log(
    [
      "Usage: node --import tsx apps/web/scripts/asset-compiler.ts <command> [options]",
      "",
      "Commands:",
      "  ingest      scaffold an asset source draft from a source path",
      "  analyze-url scaffold a prototype-only product reference pack from a product URL",
      "  compile     export + sync + verify + validate + publish runtime packages",
      "  validate    run curated GLTF validation stage",
      "  optimize    run curated optimize stage",
      "  verify      run curated pipeline verification stage",
      "  publish     emit runtime package descriptors and catalog index",
      "  help        show this help"
    ].join("\n")
  );
}

export async function runAssetCompilerCli(argv: string[]) {
  const { command, rest } = parseAssetCompilerArgs(argv);

  switch (command) {
    case "ingest": {
      const sourcePath = readOption(rest, "source");
      if (!sourcePath) {
        console.error("asset:ingest requires --source <path>");
        process.exit(1);
      }

      const summary = await writeAssetIngestDraft(sourcePath);
      console.log(
        JSON.stringify(
          {
            ok: summary.ok,
            assetKey: summary.assetKey,
            outputPath: summary.outputPath
          },
          null,
          2
        )
      );
      return;
    }
    case "analyze-url": {
      const args = parseProductUrlReferenceArgs(rest);
      if (args.help) {
        console.log(
          [
            "Usage: node --import tsx apps/web/scripts/asset-compiler.ts analyze-url --url <product-url> [options]",
            "",
            "Options:",
            "  --asset-key <key>              Override generated asset key",
            "  --out <path>                   Write reference pack JSON to a custom path",
            "  --dimensions-mm <WxDxH>        Override official dimensions, for example 1172x590x587",
            "  --height-range-mm <min-max>    Override height range, for example 587-1073",
            "  --download-images              Download selected reference images beside the JSON output",
            "  --ocr-images                   Run local tesseract OCR on selected reference images when available",
            "  --json                         Print machine-readable summary",
            "  --help                         Show help"
          ].join("\n")
        );
        return;
      }
      const summary = await analyzeProductUrlReference(args);
      if (args.json) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        printProductUrlReferenceSummary(summary);
      }
      return;
    }
    case "compile": {
      const exportArgs = parseExportArgs(rest);
      const exportSummary = await runExportCuratedRuntime(exportArgs);
      if (exportArgs.json) {
        console.log(JSON.stringify(exportSummary, null, 2));
      } else {
        printExportSummary(exportSummary);
      }
      if (!exportSummary.ok) {
        process.exit(1);
      }

      await runSyncCuratedCatalogCli();

      const verifySummary = await buildCuratedPipelineSummary();
      printCuratedPipelineSummary(verifySummary);
      if (!verifySummary.ok) {
        process.exit(1);
      }

      const validateArgs = parseValidateArgs(rest);
      const validateSummary = await buildCuratedValidationSummary(
        validateArgs.strictWarnings,
        validateArgs.requireKtx2
      );
      if (validateArgs.json) {
        console.log(JSON.stringify(validateSummary, null, 2));
      } else {
        printValidationSummary(validateSummary);
      }
      if (!validateSummary.ok) {
        process.exit(1);
      }

      const summary = await publishCuratedRuntimePackages();
      if (!summary.ok) {
        summary.errors.forEach((error) => console.error(`asset:publish error: ${error}`));
        process.exit(1);
      }
      const packageSummary = await buildPublishedRuntimePackageSummary();
      printPublishedRuntimePackageSummary(packageSummary);
      if (!packageSummary.ok) {
        process.exit(1);
      }
      console.log(
        `Asset compiler publish: PASS (${summary.packageCount} package descriptors at ${summary.catalogPath})`
      );
      return;
    }
    case "validate": {
      const { json, strictWarnings, requireKtx2, help, unknownArgs } = parseValidateArgs(rest);
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
      const summary = await buildCuratedValidationSummary(strictWarnings, requireKtx2);
      if (json) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        printValidationSummary(summary);
      }
      process.exit(summary.ok ? 0 : 1);
      return;
    }
    case "optimize":
      await runOptimizeCuratedRuntimeCli(rest);
      return;
    case "verify": {
      const summary = await buildCuratedPipelineSummary();
      if (rest.includes("--json")) {
        console.log(JSON.stringify(summary, null, 2));
      } else {
        printCuratedPipelineSummary(summary);
      }
      process.exit(summary.ok ? 0 : 1);
      return;
    }
    case "publish": {
      const summary = await publishCuratedRuntimePackages();
      if (!summary.ok) {
        summary.errors.forEach((error) => console.error(`asset:publish error: ${error}`));
        process.exit(1);
      }
      console.log(
        JSON.stringify(
          {
            ok: summary.ok,
            catalogPath: summary.catalogPath,
            packageDirectory: summary.packageDirectory,
            packageCount: summary.packageCount
          },
          null,
          2
        )
      );
      return;
    }
    case "help":
    case "--help":
    default:
      printHelp();
      if (command !== "help" && command !== "--help") {
        process.exitCode = 1;
      }
  }
}
