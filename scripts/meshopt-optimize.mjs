#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { NodeIO } from "@gltf-transform/core";
import { dedup, meshopt, prune } from "@gltf-transform/functions";
import {
  EXTMeshGPUInstancing,
  EXTMeshoptCompression,
  EXTTextureAVIF,
  EXTTextureWebP,
  KHRDracoMeshCompression,
  KHRLightsPunctual,
  KHRMaterialsAnisotropy,
  KHRMaterialsClearcoat,
  KHRMaterialsEmissiveStrength,
  KHRMaterialsIOR,
  KHRMaterialsIridescence,
  KHRMaterialsPBRSpecularGlossiness,
  KHRMaterialsSheen,
  KHRMaterialsSpecular,
  KHRMaterialsTransmission,
  KHRMaterialsUnlit,
  KHRMaterialsVariants,
  KHRMaterialsVolume,
  KHRMeshQuantization,
  KHRTextureBasisu,
  KHRTextureTransform,
  KHRXMP
} from "@gltf-transform/extensions";
import draco3d from "draco3dgltf";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";

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
const skipTextures = hasFlag("skip-textures");
const force = hasFlag("force");
const match = getArg("match", "").trim().toLowerCase();
const exclude = getArg("exclude", "").trim().toLowerCase();
const limit = Number(getArg("limit", "0"));
const level = getArg("level", "medium");

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

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

async function createIo() {
  const decoderModule = await draco3d.createDecoderModule();
  const encoderModule = await draco3d.createEncoderModule();
  await MeshoptDecoder.ready;
  await MeshoptEncoder.ready;

  return new NodeIO()
    .registerExtensions([
      EXTMeshGPUInstancing,
      EXTMeshoptCompression,
      EXTTextureAVIF,
      EXTTextureWebP,
      KHRDracoMeshCompression,
      KHRLightsPunctual,
      KHRMaterialsAnisotropy,
      KHRMaterialsClearcoat,
      KHRMaterialsEmissiveStrength,
      KHRMaterialsIOR,
      KHRMaterialsIridescence,
      KHRMaterialsPBRSpecularGlossiness,
      KHRMaterialsSheen,
      KHRMaterialsSpecular,
      KHRMaterialsTransmission,
      KHRMaterialsUnlit,
      KHRMaterialsVariants,
      KHRMaterialsVolume,
      KHRMeshQuantization,
      KHRTextureBasisu,
      KHRTextureTransform,
      KHRXMP
    ])
    .registerDependencies({
      "draco3d.decoder": decoderModule,
      "draco3d.encoder": encoderModule,
      "meshopt.decoder": MeshoptDecoder,
      "meshopt.encoder": MeshoptEncoder
    });
}

async function main() {
  const files = await listAssets(destRoot);
  const filtered = files
    .filter((filePath) => (match ? filePath.toLowerCase().includes(match) : true))
    .filter((filePath) => (exclude ? !filePath.toLowerCase().includes(exclude) : true))
    .sort((left, right) => left.localeCompare(right));
  const targetFiles = limit > 0 ? filtered.slice(0, limit) : filtered;

  if (targetFiles.length === 0) {
    console.log("No GLB/GLTF files found for Meshopt optimization.");
    return;
  }

  const io = await createIo();
  let processed = 0;

  for (const filePath of targetFiles) {
    const beforeSize = await getFileSize(filePath);

    if (dryRun) {
      console.log(`[dry-run] Optimize ${filePath} (${formatBytes(beforeSize)})`);
      continue;
    }

    try {
      const document = await io.read(filePath);
      const root = document.getRoot();
      const alreadyMeshopt = root
        .listExtensionsUsed()
        .some((extension) => extension.extensionName === "EXT_meshopt_compression");
      const hasNonWebpTextures = root.listTextures().some((texture) => texture.getMimeType() !== "image/webp");

      if (!force && alreadyMeshopt) {
        console.log(`Skipped: ${filePath} (already meshopt-compressed)`);
        processed += 1;
        continue;
      }

      await document.transform(
        dedup({ keepUniqueNames: true }),
        prune({ keepLeaves: true }),
        meshopt({
          encoder: MeshoptEncoder,
          level: level === "high" ? "high" : "medium"
        })
      );

      const meshoptExtension = document.createExtension(EXTMeshoptCompression);
      meshoptExtension.setRequired(true);

      if (!skipTextures && hasNonWebpTextures) {
        console.warn(
          `Texture compression skipped for ${filePath}: runtime does not have a portable texture encoder in this environment.`
        );
      }

      await io.write(filePath, document);

      const afterSize = await getFileSize(filePath);
      const delta = beforeSize - afterSize;
      console.log(
        `Optimized: ${filePath} (${formatBytes(beforeSize)} -> ${formatBytes(afterSize)}, saved ${formatBytes(Math.max(delta, 0))}; dedup+prune+meshopt)`
      );
      processed += 1;
    } catch (error) {
      console.warn(`Failed to optimize ${filePath}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Meshopt optimization complete (${processed}/${targetFiles.length}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
