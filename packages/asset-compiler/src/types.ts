export type CuratedManifestMetadataField =
  | "brand"
  | "externalUrl"
  | "description"
  | "category"
  | "options";

export type AssetSourceMetadata = {
  kind: "deskterioronline_blender" | "open_source";
  name: string;
  path: string | null;
  url: string | null;
};

export type AssetLicenseMetadata = {
  spdx: string;
  label: string;
  requiresAttribution: boolean;
};

export type AssetPivotMetadata = {
  x: "left" | "center" | "right";
  y: "floor" | "center" | "top";
  z: "front" | "center" | "back";
};

export type AssetCollisionProxyMetadata = {
  kind: "box";
  derivesFrom: "dimensionsMm";
};

export type AssetTextureSetMetadata = {
  workflow: "pbr_metallic_roughness";
  authored: "procedural" | "image_based";
  ktx2Ready: boolean;
};

export type AssetLodProfileMetadata = {
  strategy: "single_mesh" | "manual_lod";
  levelCount: number;
  maxDrawCalls: number;
  maxTriangleCount: number;
};

export type CuratedSupportProfileExpectation = {
  surfaces: Array<{
    id: string;
    anchorTypes: Array<"desk_surface" | "shelf_surface" | "furniture_surface">;
    center: [number, number];
    size: [number, number];
    top: number;
    margin?: [number, number];
  }>;
};

export type CuratedDeskteriorAsset = {
  key: string;
  manifestId: string;
  sourcePath: string;
  runtimePath: string;
  expectedAssetId: string;
  requiredMetadata: CuratedManifestMetadataField[];
  budget: {
    maxFileSizeBytes: number;
    maxDrawCalls: number;
    maxTriangleCount: number;
  };
  supportProfileExpectation?: CuratedSupportProfileExpectation;
  contractMetadata: {
    source: AssetSourceMetadata;
    license: AssetLicenseMetadata;
    pivot: AssetPivotMetadata;
    collisionProxy: AssetCollisionProxyMetadata;
    textureSet: AssetTextureSetMetadata;
    lodProfile: AssetLodProfileMetadata;
  };
  optionsHint?: string;
};

export type AssetCompilerPaths = {
  repoRoot: string;
  appRoot: string;
  publicRoot: string;
  manifestPath: string;
  webScriptDir: string;
  runtimePackageDir: string;
  runtimePackageIndexPath: string;
};

export type RuntimePackageIndexEntry = {
  key: string;
  manifestId: string;
  label: string;
  assetId: string;
  packagePath: string;
};

export type RuntimePackageDescriptor = {
  schemaVersion: "asset-package-alpha-v1";
  generatedAt: string;
  key: string;
  manifestId: string;
  label: string;
  assetId: string;
  sourcePath: string;
  runtimePath: string;
  dimensionsMm: {
    width: number;
    depth: number;
    height: number;
  };
  scaleLocked: boolean;
  contractMetadata: CuratedDeskteriorAsset["contractMetadata"];
  supportProfile: CuratedSupportProfileExpectation | null;
  runtime: {
    lods: Array<{
      level: number;
      path: string;
    }>;
    proxyPath: string | null;
    collidersPath: string | null;
    supportSurfacesEmbedded: boolean;
    attachmentPointsPath: string | null;
    qaReportEmbedded: boolean;
  };
  qa: {
    status: "passed" | "warning";
    warnings: string[];
  };
};

export type RuntimePackageCatalog = {
  schemaVersion: "asset-package-index-alpha-v1";
  generatedAt: string;
  assets: RuntimePackageIndexEntry[];
};

export type PublishRuntimePackagesSummary = {
  ok: boolean;
  generatedAt: string;
  catalogPath: string;
  packageDirectory: string;
  packageCount: number;
  packages: RuntimePackageIndexEntry[];
  errors: string[];
};
