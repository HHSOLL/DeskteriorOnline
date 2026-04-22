import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  createAssetCompilerPaths,
  getCuratedDeskteriorAssets,
  type RuntimePackageCatalog,
  type RuntimePackageDescriptor
} from "@deskterioronline/asset-compiler";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const paths = createAssetCompilerPaths();
  const curatedAssets = getCuratedDeskteriorAssets(paths);
  const indexRaw = await readFile(paths.runtimePackageIndexPath, "utf8");
  const index = JSON.parse(indexRaw) as RuntimePackageCatalog;

  assert(
    index.schemaVersion === "asset-package-index-alpha-v1",
    "runtime package index schema version should match the alpha contract"
  );
  assert(
    index.assets.length === curatedAssets.length,
    `runtime package index should include ${curatedAssets.length} curated assets`
  );

  for (const asset of curatedAssets) {
    const entry = index.assets.find((candidate) => candidate.key === asset.key);
    assert(entry, `runtime package index is missing ${asset.key}`);
    assert(
      entry.packagePath === `/assets/catalog/runtime-packages/${asset.key}.json`,
      `runtime package path should match the published descriptor path for ${asset.key}`
    );

    const packagePath = path.join(paths.publicRoot, entry.packagePath.replace(/^\//, ""));
    assert(await fileExists(packagePath), `runtime package descriptor file is missing for ${asset.key}`);

    const descriptorRaw = await readFile(packagePath, "utf8");
    const descriptor = JSON.parse(descriptorRaw) as RuntimePackageDescriptor;

    assert(descriptor.schemaVersion === "asset-package-alpha-v1", `${asset.key} should use alpha package schema`);
    assert(descriptor.manifestId === asset.manifestId, `${asset.key} should keep manifestId`);
    assert(descriptor.assetId === asset.expectedAssetId, `${asset.key} should keep runtime assetId`);
    assert(descriptor.contractMetadata.source.path === asset.contractMetadata.source.path, `${asset.key} should keep source path metadata`);
    assert(descriptor.runtime.lods[0]?.path === asset.expectedAssetId, `${asset.key} should point lod0 at the runtime GLB`);
  }

  console.log("asset compiler alpha ok");
  console.log(
    JSON.stringify(
      {
        packageCount: index.assets.length,
        firstPackage: index.assets[0] ?? null
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[verify-asset-compiler-alpha] failed");
  console.error(error);
  process.exitCode = 1;
});
