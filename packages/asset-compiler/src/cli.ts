import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { createAssetCompilerPaths } from "./paths";
import { writeAssetIngestDraft } from "./ingest";
import { publishCuratedRuntimePackages } from "./publish";

const execFileAsync = promisify(execFile);

async function runNodeProcess(args: string[], cwd: string) {
  const result = await execFileAsync(process.execPath, args, {
    cwd,
    maxBuffer: 1024 * 1024 * 32
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

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
      "  compile     export + sync + publish alpha runtime packages",
      "  validate    run existing GLTF validation stage",
      "  optimize    run existing optimize stage",
      "  verify      run existing curated pipeline verification stage",
      "  publish     emit alpha runtime package descriptors and catalog index",
      "  help        show this help"
    ].join("\n")
  );
}

export async function runAssetCompilerCli(argv: string[]) {
  const { command, rest } = parseAssetCompilerArgs(argv);
  const paths = createAssetCompilerPaths();
  const repoRoot = paths.repoRoot;
  const script = (name: string) => path.join(paths.webScriptDir, name);

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
    case "compile":
      await runNodeProcess(["--import", "tsx", script("export-deskterior-runtime.ts"), ...rest], repoRoot);
      await runNodeProcess(["--import", "tsx", script("sync-deskterior-catalog.ts"), ...rest], repoRoot);
      await runNodeProcess(["--import", "tsx", script("verify-deskterior-pipeline.ts"), ...rest], repoRoot);
      {
        const summary = await publishCuratedRuntimePackages();
        if (!summary.ok) {
          summary.errors.forEach((error) => console.error(`asset:publish error: ${error}`));
          process.exit(1);
        }
        console.log(
          `Asset compiler publish: PASS (${summary.packageCount} package descriptors at ${summary.catalogPath})`
        );
      }
      return;
    case "validate":
      await runNodeProcess(["--import", "tsx", script("validate-deskterior-gltf.ts"), ...rest], repoRoot);
      return;
    case "optimize":
      await runNodeProcess(["--import", "tsx", script("optimize-deskterior-runtime.ts"), ...rest], repoRoot);
      return;
    case "verify":
      await runNodeProcess(["--import", "tsx", script("verify-deskterior-pipeline.ts"), ...rest], repoRoot);
      return;
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
