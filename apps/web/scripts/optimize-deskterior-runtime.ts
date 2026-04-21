import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

async function runNodeProcess(args: string[], cwd: string) {
  const result = await execFileAsync(process.execPath, args, {
    cwd,
    maxBuffer: 1024 * 1024 * 16
  });

  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function parseArgs(argv: string[]) {
  const passthrough: string[] = [];
  const unknown: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (
      [
        "--dry-run",
        "--skip-textures",
        "--force",
        "--native-gltfpack",
        "--gltfpack-probe",
        "--json",
        "--strict-warnings",
        "--require-ktx2",
        "--help"
      ].includes(arg)
    ) {
      passthrough.push(arg);
      continue;
    }

    if (arg === "--level") {
      const value = argv[index + 1];
      if (value === "medium" || value === "high") {
        passthrough.push(arg, value);
        index += 1;
        continue;
      }
      unknown.push(arg, ...(value ? [value] : []));
      index += value ? 1 : 0;
      continue;
    }

    if (arg === "--gltfpack-bin") {
      const value = argv[index + 1];
      if (value && !value.startsWith("--")) {
        passthrough.push(arg, value);
        index += 1;
        continue;
      }
      unknown.push(arg, ...(value ? [value] : []));
      index += value ? 1 : 0;
      continue;
    }

    unknown.push(arg);
  }

  return { passthrough, unknown, help: argv.includes("--help") };
}

async function main() {
  const { passthrough, unknown, help } = parseArgs(process.argv.slice(2));

  if (help) {
    console.log(
      [
        "Usage: node --import tsx apps/web/scripts/optimize-deskterior-runtime.ts [options]",
        "",
        "Options:",
        "  --dry-run          Print the optimize targets without writing",
        "  --skip-textures    Skip the optional texture compression pass",
        "  --force            Re-optimize assets even if meshopt extension already exists",
        "  --level <mode>     Meshopt compression level: medium | high",
        "  --native-gltfpack  Run optional native gltfpack pass after glTF Transform optimize",
        "  --gltfpack-bin     Override gltfpack binary path for --native-gltfpack",
        "  --gltfpack-probe   Print native gltfpack availability and exit",
        "  --strict-warnings  Pass through to post-optimize validation",
        "  --require-ktx2     Pass through to post-optimize validation",
        "  --help             Show help"
      ].join("\n")
    );
    process.exit(0);
  }

  if (unknown.length > 0) {
    console.error(`Unknown arguments: ${unknown.join(", ")}`);
    process.exit(1);
  }

  const scriptFile = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(scriptFile);
  const repoRoot = path.resolve(scriptDir, "../../..");
  const optimizeScript = path.join(repoRoot, "scripts", "meshopt-optimize.mjs");
  const nativeOptimizeScript = path.join(repoRoot, "scripts", "gltfpack-optimize.mjs");
  const validateScript = path.join(scriptDir, "validate-deskterior-gltf.ts");
  const runNativeGltfpack = passthrough.includes("--native-gltfpack");
  const gltfpackProbe = passthrough.includes("--gltfpack-probe");
  const gltfpackBinIndex = passthrough.indexOf("--gltfpack-bin");
  const gltfpackBin =
    gltfpackBinIndex >= 0 ? passthrough[gltfpackBinIndex + 1] ?? null : null;

  const optimizeArgs = [
    optimizeScript,
    "--dest",
    "./apps/web/public/assets/models",
      "--match",
      "p2s_",
      "--exclude",
      "p2s_opening_",
      ...passthrough.filter(
        (arg, index, source) =>
          arg !== "--json" &&
          arg !== "--strict-warnings" &&
          arg !== "--native-gltfpack" &&
          arg !== "--gltfpack-probe" &&
          arg !== "--gltfpack-bin" &&
          source[index - 1] !== "--gltfpack-bin"
      )
  ];

  if (gltfpackProbe) {
    const nativeArgs = [nativeOptimizeScript, "--probe"];
    if (gltfpackBin) {
      nativeArgs.push("--binary", gltfpackBin);
    }

    await runNodeProcess(nativeArgs, repoRoot);
    process.exit(0);
  }

  const validateArgs = ["--import", "tsx", validateScript];
  if (passthrough.includes("--strict-warnings")) {
    validateArgs.push("--strict-warnings");
  }
  if (passthrough.includes("--json")) {
    validateArgs.push("--json");
  }

  await runNodeProcess(optimizeArgs, repoRoot);

  if (runNativeGltfpack) {
    const nativeArgs = [
      nativeOptimizeScript,
      "--dest",
      "./apps/web/public/assets/models",
      "--match",
      "p2s_",
      "--exclude",
      "p2s_opening_"
    ];
    if (passthrough.includes("--dry-run")) {
      nativeArgs.push("--dry-run");
    }
    if (gltfpackBin) {
      nativeArgs.push("--binary", gltfpackBin);
    }

    await runNodeProcess(nativeArgs, repoRoot);
  }

  await runNodeProcess(validateArgs, repoRoot);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
