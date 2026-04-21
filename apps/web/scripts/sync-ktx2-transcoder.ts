import { cp, mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type SyncFileResult = {
  fileName: string;
  status: "copied" | "unchanged" | "stale" | "missing-source";
};

function parseArgs(argv: string[]) {
  const check = argv.includes("--check");
  const json = argv.includes("--json");
  const help = argv.includes("--help");
  const unknownArgs = argv.filter((arg) => !["--check", "--json", "--help"].includes(arg));
  return { check, json, help, unknownArgs };
}

async function fileContentsEqual(sourcePath: string, destinationPath: string) {
  try {
    const [sourceBuffer, destinationBuffer] = await Promise.all([
      readFile(sourcePath),
      readFile(destinationPath)
    ]);
    return sourceBuffer.equals(destinationBuffer);
  } catch {
    return false;
  }
}

async function syncFile(
  sourcePath: string,
  destinationPath: string,
  check: boolean
): Promise<SyncFileResult> {
  try {
    await stat(sourcePath);
  } catch {
    return {
      fileName: path.basename(sourcePath),
      status: "missing-source"
    };
  }

  const isSame = await fileContentsEqual(sourcePath, destinationPath);
  if (isSame) {
    return {
      fileName: path.basename(sourcePath),
      status: "unchanged"
    };
  }

  if (check) {
    return {
      fileName: path.basename(sourcePath),
      status: "stale"
    };
  }

  await cp(sourcePath, destinationPath, { force: true });

  return {
    fileName: path.basename(sourcePath),
    status: "copied"
  };
}

async function main() {
  const { check, json, help, unknownArgs } = parseArgs(process.argv.slice(2));

  if (help) {
    console.log(
      [
        "Usage: node --import tsx apps/web/scripts/sync-ktx2-transcoder.ts [options]",
        "",
        "Options:",
        "  --check   Exit non-zero when the public KTX2 transcoder files are missing or stale",
        "  --json    Print machine-readable summary JSON",
        "  --help    Show help"
      ].join("\n")
    );
    process.exit(0);
  }

  if (unknownArgs.length > 0) {
    console.error(`Unknown arguments: ${unknownArgs.join(", ")}`);
    process.exit(1);
  }

  const scriptFile = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(scriptFile);
  const appRoot = path.resolve(scriptDir, "..");
  const repoRoot = path.resolve(appRoot, "../..");
  const sourceDir = path.join(repoRoot, "node_modules/three/examples/jsm/libs/basis");
  const destinationDir = path.join(appRoot, "public/assets/transcoders/basis");
  const requiredFiles = ["basis_transcoder.js", "basis_transcoder.wasm"];

  await mkdir(destinationDir, { recursive: true });

  const results = await Promise.all(
    requiredFiles.map((fileName) =>
      syncFile(
        path.join(sourceDir, fileName),
        path.join(destinationDir, fileName),
        check
      )
    )
  );

  const ok = results.every((result) => result.status !== "missing-source") &&
    results.every((result) => !check || result.status === "unchanged");

  const summary = {
    ok,
    check,
    sourceDir,
    destinationDir,
    results
  };

  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log("KTX2 Transcoder Sync");
    console.log(`Status: ${ok ? "PASS" : "FAIL"}`);
    console.log(`Mode: ${check ? "check" : "sync"}`);
    console.log(`Source: ${sourceDir}`);
    console.log(`Destination: ${destinationDir}`);
    console.log("");
    results.forEach((result) => {
      console.log(`- ${result.fileName}: ${result.status}`);
    });
  }

  process.exit(ok ? 0 : 1);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
