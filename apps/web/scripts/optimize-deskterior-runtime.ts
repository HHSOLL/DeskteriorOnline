import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

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
  const validateScript = path.join(scriptDir, "validate-deskterior-gltf.ts");

  const optimizeArgs = [
    optimizeScript,
    "--dest",
    "./apps/web/public/assets/models",
      "--match",
      "p2s_",
      "--exclude",
      "p2s_opening_",
      ...passthrough.filter((arg) => arg !== "--json" && arg !== "--strict-warnings")
  ];

  const validateArgs = ["--import", "tsx", validateScript];
  if (passthrough.includes("--strict-warnings")) {
    validateArgs.push("--strict-warnings");
  }
  if (passthrough.includes("--json")) {
    validateArgs.push("--json");
  }

  await execFileAsync(process.execPath, optimizeArgs, {
    cwd: repoRoot,
    maxBuffer: 1024 * 1024 * 16,
    stdio: "inherit"
  } as never);

  await execFileAsync(process.execPath, validateArgs, {
    cwd: repoRoot,
    maxBuffer: 1024 * 1024 * 16,
    stdio: "inherit"
  } as never);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
