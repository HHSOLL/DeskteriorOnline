import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createAssetCompilerPaths } from "./paths";
import type { AssetIngestDraft, AssetIngestSummary } from "./types";

function detectSourceKind(sourcePath: string): AssetIngestDraft["source"]["detectedKind"] {
  const extension = path.extname(sourcePath).toLowerCase();
  if (extension === ".blend") return "blender";
  if (extension === ".step" || extension === ".stp") return "cad";
  if (extension === ".glb" || extension === ".gltf") return "gltf";
  if (extension === ".fbx" || extension === ".obj") return "mesh";
  return "unknown";
}

function slugifyAssetKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "asset";
}

export function createAssetIngestDraft(sourcePath: string): AssetIngestDraft {
  const normalizedSourcePath = sourcePath.trim();
  const baseName = path.basename(normalizedSourcePath, path.extname(normalizedSourcePath));
  const assetKey = slugifyAssetKey(baseName);

  return {
    schemaVersion: "asset-ingest-alpha-v1",
    createdAt: new Date().toISOString(),
    assetKey,
    source: {
      inputPath: normalizedSourcePath,
      detectedKind: detectSourceKind(normalizedSourcePath)
    },
    compile: {
      manifestId: null,
      assetId: null,
      label: null,
      category: null,
      dimensionsMm: null,
      scaleLocked: true
    },
    authoring: {
      supportSurfaces: "required-if-placeable",
      attachmentPoints: "required-if-mounted",
      materialVariants: "optional"
    },
    notes: [
      "Fill manifestId, assetId, label, category, and measured dimensions before compile.",
      "Author support surfaces for desks, trays, stands, shelves, and other placeable assets.",
      "Author attachment points before publish for clamp, underside, VESA, wall, or route-driven assets."
    ]
  };
}

export async function writeAssetIngestDraft(sourcePath: string): Promise<AssetIngestSummary> {
  const paths = createAssetCompilerPaths();
  const draft = createAssetIngestDraft(sourcePath);
  const outputDir = path.join(paths.ingestDraftDir, draft.assetKey);
  const outputPath = path.join(outputDir, "source.asset.json");

  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(draft, null, 2)}\n`, "utf8");

  return {
    ok: true,
    outputPath,
    assetKey: draft.assetKey
  };
}
