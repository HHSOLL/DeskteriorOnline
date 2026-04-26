import type { RuntimeAsset } from "@deskterioronline/scene-schema";

import runtimePackageIndex from "../../../public/assets/catalog/runtime-packages.json";

type RuntimePackageIndexEntryLike = {
  manifestId: string;
  assetId: string;
  runtimeAsset?: RuntimeAsset;
};

type RuntimePackageIndexLike = {
  assets?: RuntimePackageIndexEntryLike[];
};

const RUNTIME_PACKAGE_DESCRIPTORS = ((runtimePackageIndex as unknown as RuntimePackageIndexLike).assets ?? []).filter(
  (descriptor): descriptor is RuntimePackageIndexEntryLike & { runtimeAsset: RuntimeAsset } =>
    Boolean(descriptor.runtimeAsset)
);

const runtimePackagesByManifestId = new Map(
  RUNTIME_PACKAGE_DESCRIPTORS.map((descriptor) => [descriptor.manifestId, descriptor])
);
const runtimePackagesByAssetId = new Map(
  RUNTIME_PACKAGE_DESCRIPTORS.map((descriptor) => [descriptor.assetId, descriptor])
);

export function resolvePublishedRuntimeAsset(input: {
  catalogItemId?: string | null;
  assetId: string;
}): RuntimeAsset | null {
  const descriptor =
    (input.catalogItemId ? runtimePackagesByManifestId.get(input.catalogItemId) : null) ??
    runtimePackagesByAssetId.get(input.assetId) ??
    null;

  if (!descriptor) {
    return null;
  }

  return descriptor.runtimeAsset;
}
