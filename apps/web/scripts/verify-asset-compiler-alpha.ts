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
    index.schemaVersion === "asset-package-index-alpha-v2",
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

    assert(descriptor.schemaVersion === "asset-package-alpha-v2", `${asset.key} should use alpha package schema`);
    assert(descriptor.manifestId === asset.manifestId, `${asset.key} should keep manifestId`);
    assert(descriptor.assetId === asset.expectedAssetId, `${asset.key} should keep runtime assetId`);
    assert(
      descriptor.contractMetadata.source.path === asset.contractMetadata.source.path,
      `${asset.key} should keep source path metadata`
    );
    assert(descriptor.runtime.lods[0]?.path === asset.expectedAssetId, `${asset.key} should point lod0 at the runtime GLB`);
    assert(descriptor.runtimeAsset.assetId === asset.expectedAssetId, `${asset.key} should embed runtime asset contract`);
    assert(descriptor.runtimeAsset.scaleLocked === true, `${asset.key} should preserve scaleLocked`);
    assert(descriptor.runtime.collidersPath.endsWith(`${asset.key}.colliders.json`), `${asset.key} colliders path missing`);
    assert(
      descriptor.runtime.supportSurfacesPath.endsWith(`${asset.key}.support-surfaces.json`),
      `${asset.key} support surface path missing`
    );
    assert(
      descriptor.runtime.materialVariantsPath.endsWith(`${asset.key}.material-variants.json`),
      `${asset.key} material variants path missing`
    );
    assert(descriptor.runtime.qaReportPath.endsWith(`${asset.key}.qa-report.json`), `${asset.key} qa report path missing`);

    const collidersPath = path.join(paths.publicRoot, descriptor.runtime.collidersPath.replace(/^\//, ""));
    const supportSurfacesPath = path.join(paths.publicRoot, descriptor.runtime.supportSurfacesPath.replace(/^\//, ""));
    const materialVariantsPath = path.join(paths.publicRoot, descriptor.runtime.materialVariantsPath.replace(/^\//, ""));
    const qaReportPath = path.join(paths.publicRoot, descriptor.runtime.qaReportPath.replace(/^\//, ""));

    assert(await fileExists(collidersPath), `colliders sidecar should exist for ${asset.key}`);
    assert(await fileExists(supportSurfacesPath), `support surfaces sidecar should exist for ${asset.key}`);
    assert(await fileExists(materialVariantsPath), `material variants sidecar should exist for ${asset.key}`);
    assert(await fileExists(qaReportPath), `qa report sidecar should exist for ${asset.key}`);

    assert(descriptor.files.sourceBlend.required === true, `${asset.key} should mark source blend as required`);
    assert(descriptor.files.runtimeModel.required === true, `${asset.key} should mark runtime model as required`);
    assert(descriptor.files.colliders.exists === true, `${asset.key} should mark generated collider sidecar as existing`);
    assert(
      descriptor.runtimeAsset.colliders.length > 0,
      `${asset.key} should embed at least one collider in runtime asset metadata`
    );
    assert(
      descriptor.runtimeAsset.materialVariants.length > 0,
      `${asset.key} should embed material variants in runtime asset metadata`
    );

    const supportSurfaceCount = descriptor.runtimeAsset.supportSurfaces.length;
    assert(
      entry.surfaceCount === supportSurfaceCount,
      `${asset.key} catalog surfaceCount should match runtime asset support surfaces`
    );
    assert(
      entry.materialVariantCount === descriptor.runtimeAsset.materialVariants.length,
      `${asset.key} catalog materialVariantCount should match runtime asset metadata`
    );
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
