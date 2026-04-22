import {
  createAssetCompilerPaths,
  getCuratedDeskteriorAssets,
  type CuratedDeskteriorAsset,
  type CuratedManifestMetadataField
} from "@deskterioronline/asset-compiler";

export type { CuratedDeskteriorAsset, CuratedManifestMetadataField };

export const curatedDeskteriorAssets: CuratedDeskteriorAsset[] = getCuratedDeskteriorAssets(
  createAssetCompilerPaths()
);
