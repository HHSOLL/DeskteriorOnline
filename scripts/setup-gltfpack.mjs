#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const GLTFPACK_RELEASE = "v1.1";
const args = process.argv.slice(2);
const force = args.includes("--force");
const check = args.includes("--check");

function resolveAssetName() {
  if (process.platform === "darwin" && process.arch === "arm64") {
    return "gltfpack-macos.zip";
  }
  if (process.platform === "darwin" && process.arch === "x64") {
    return "gltfpack-macos-intel.zip";
  }
  if (process.platform === "linux" && process.arch === "x64") {
    return "gltfpack-ubuntu.zip";
  }
  if (process.platform === "win32" && process.arch === "x64") {
    return "gltfpack-windows.zip";
  }

  throw new Error(`Unsupported platform for repo-local gltfpack setup: ${process.platform} ${process.arch}`);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureExecutable(filePath) {
  if (process.platform !== "win32") {
    await fs.chmod(filePath, 0o755);
  }
}

async function main() {
  const scriptFile = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(scriptFile);
  const repoRoot = path.resolve(scriptDir, "..");
  const assetName = resolveAssetName();
  const downloadUrl = `https://github.com/zeux/meshoptimizer/releases/download/${GLTFPACK_RELEASE}/${assetName}`;
  const installRoot = path.join(repoRoot, ".tools", "gltfpack");
  const versionDir = path.join(installRoot, GLTFPACK_RELEASE);
  const currentDir = path.join(installRoot, "current");
  const binaryName = process.platform === "win32" ? "gltfpack.exe" : "gltfpack";
  const binaryPath = path.join(versionDir, binaryName);
  const archivePath = path.join(versionDir, assetName);

  if (check) {
    console.log(
      JSON.stringify(
        {
          release: GLTFPACK_RELEASE,
          binaryPath,
          installed: await exists(binaryPath)
        },
        null,
        2
      )
    );
    return;
  }

  await fs.mkdir(versionDir, { recursive: true });

  if (force || !(await exists(binaryPath))) {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download ${downloadUrl}: ${response.status} ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(archivePath, buffer);
    execFileSync("unzip", ["-o", archivePath, "-d", versionDir], {
      cwd: repoRoot,
      stdio: "pipe"
    });
    await ensureExecutable(binaryPath);
    await fs.rm(archivePath, { force: true });
  }

  await fs.rm(currentDir, { recursive: true, force: true });
  await fs.symlink(versionDir, currentDir, "dir");

  console.log(
    JSON.stringify(
      {
        release: GLTFPACK_RELEASE,
        binaryPath: path.join(currentDir, binaryName),
        downloadUrl
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
