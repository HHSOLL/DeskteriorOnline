#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { execFileSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";

const args = process.argv.slice(2);

function hasFlag(name) {
  return args.includes(`--${name}`);
}

function getArg(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) return fallback;
  return value;
}

const destRoot = getArg("dest", "apps/web/public/assets/models");
const dryRun = hasFlag("dry-run");
const probe = hasFlag("probe");
const skipInstancing = hasFlag("skip-instancing");
const keepExtras = !hasFlag("drop-extras");
const match = getArg("match", "").trim().toLowerCase();
const exclude = getArg("exclude", "").trim().toLowerCase();
const limit = Number(getArg("limit", "0"));
const explicitBinary = getArg("binary", process.env.GLTFPACK_BIN ?? "");
const repoRoot = process.cwd();

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveBinaryPath() {
  const candidates = [];
  if (explicitBinary) {
    candidates.push(explicitBinary);
  }

  const localBin = path.join(
    repoRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "gltfpack.cmd" : "gltfpack"
  );
  candidates.push(localBin);

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return path.resolve(candidate);
    }
  }

  try {
    const lookupCommand = process.platform === "win32" ? "where" : "which";
    const resolved = execFileSync(lookupCommand, ["gltfpack"], {
      encoding: "utf8"
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);
    if (resolved) {
      return resolved;
    }
  } catch {
    return null;
  }

  return null;
}

async function listAssets(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      const inner = await fs.readdir(fullPath, { withFileTypes: true });
      for (const innerEntry of inner) {
        if (!innerEntry.isFile()) continue;
        if (!innerEntry.name.endsWith(".glb") && !innerEntry.name.endsWith(".gltf")) continue;
        files.push(path.join(fullPath, innerEntry.name));
      }
      continue;
    }

    if (entry.isFile() && (entry.name.endsWith(".glb") || entry.name.endsWith(".gltf"))) {
      files.push(fullPath);
    }
  }

  return files;
}

async function getFileSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size;
}

function buildGltfpackArgs(inputPath, outputPath) {
  const nativeArgs = ["-i", inputPath, "-o", outputPath, "-cc", "-kn", "-km"];
  if (!skipInstancing) {
    nativeArgs.push("-mi");
  }
  if (keepExtras) {
    nativeArgs.push("-ke");
  }
  return nativeArgs;
}

async function probeBinary(binaryPath) {
  if (!binaryPath) {
    console.log(
      JSON.stringify(
        {
          status: "unavailable",
          binary: explicitBinary || null,
          hint: "Install gltfpack native binary or set GLTFPACK_BIN."
        },
        null,
        2
      )
    );
    return;
  }

  let helpPreview = "";
  try {
    helpPreview = execFileSync(binaryPath, ["-h"], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 4
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? "";
  } catch (error) {
    helpPreview =
      error instanceof Error && "stdout" in error && typeof error.stdout === "string"
        ? error.stdout.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? ""
        : "";
  }

  console.log(
    JSON.stringify(
      {
        status: "available",
        binary: binaryPath,
        helpPreview
      },
      null,
      2
    )
  );
}

async function main() {
  const binaryPath = await resolveBinaryPath();

  if (probe) {
    await probeBinary(binaryPath);
    return;
  }

  if (!binaryPath) {
    console.error(
      "gltfpack binary not found. Install a native gltfpack build or set GLTFPACK_BIN=/absolute/path/to/gltfpack."
    );
    process.exit(1);
  }

  const files = await listAssets(destRoot);
  const filtered = files
    .filter((filePath) => (match ? filePath.toLowerCase().includes(match) : true))
    .filter((filePath) => (exclude ? !filePath.toLowerCase().includes(exclude) : true))
    .sort((left, right) => left.localeCompare(right));
  const targetFiles = limit > 0 ? filtered.slice(0, limit) : filtered;

  if (targetFiles.length === 0) {
    console.log("No GLB/GLTF files found for gltfpack optimization.");
    return;
  }

  for (const filePath of targetFiles) {
    const beforeSize = await getFileSize(filePath);
    const parsedPath = path.parse(filePath);
    const outputPath = path.join(
      parsedPath.dir,
      `${parsedPath.name}.gltfpack.tmp${parsedPath.ext}`
    );
    const nativeArgs = buildGltfpackArgs(filePath, outputPath);

    if (dryRun) {
      console.log(`[dry-run] gltfpack ${filePath} (${formatBytes(beforeSize)}) :: ${nativeArgs.join(" ")}`);
      continue;
    }

    try {
      execFileSync(binaryPath, nativeArgs, {
        cwd: repoRoot,
        stdio: "pipe",
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 16
      });

      await fs.rename(outputPath, filePath);
      const afterSize = await getFileSize(filePath);
      const delta = beforeSize - afterSize;
      console.log(
        `Native gltfpack: ${filePath} (${formatBytes(beforeSize)} -> ${formatBytes(afterSize)}, saved ${formatBytes(Math.max(delta, 0))}; ${skipInstancing ? "no -mi" : "-mi"} ${keepExtras ? "+ke" : ""})`
      );
    } catch (error) {
      await fs.rm(outputPath, { force: true });
      const message =
        error instanceof Error && "stderr" in error && typeof error.stderr === "string"
          ? error.stderr.trim() || error.message
          : error instanceof Error
            ? error.message
            : String(error);
      console.warn(`Failed to native-optimize ${filePath}: ${message}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
