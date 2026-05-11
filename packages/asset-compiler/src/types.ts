import type {
  AssetQaReport,
  AttachmentPoint,
  ColliderDefinition,
  DimensionsMm,
  MaterialVariant,
  ProductReferencePack,
  ReferenceImageView,
  RuntimeCommercialReadiness,
  RuntimeAsset,
  SupportSurface
} from "@deskterioronline/scene-schema";

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
    surfaceType?: SupportSurface["type"];
    allowedAttachments?: SupportSurface["allowedAttachments"];
    thicknessMm?: number;
    localFrame?: SupportSurface["localFrame"];
  }>;
};

export type CuratedAttachmentAuthoring = {
  mode: "none" | "manual_required";
  reason: string;
  points?: AttachmentPoint[];
};

export type CommercialAssetFidelityMetadata = RuntimeCommercialReadiness & {
  qaThresholds: {
    minVisualFidelityScore: number;
    maxDimensionToleranceMm: number;
    maxDimensionTolerancePercent: number;
    maxSupportSurfaceToleranceMm: number;
    maxFootprintToleranceMm: number;
  };
};

export type CuratedDeskteriorAsset = {
  key: string;
  packageKind?: "curated_asset" | "catalog_variant";
  baseAssetKey?: string | null;
  thumbnailPublicPath?: string | null;
  catalogEntry?: Record<string, unknown>;
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
  attachmentAuthoring: CuratedAttachmentAuthoring;
  commercialMetadata: CommercialAssetFidelityMetadata;
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
  ingestDraftDir: string;
  runtimePackageDir: string;
  runtimePackageIndexPath: string;
  thumbnailDir: string;
};

export type RuntimePackageIndexEntry = {
  key: string;
  packageKind?: "curated_asset" | "catalog_variant";
  baseAssetKey?: string | null;
  manifestId: string;
  label: string;
  assetId: string;
  packagePath: string;
  runtimeAsset?: RuntimeAsset;
  qaStatus: AssetQaReport["status"];
  warningCount: number;
  surfaceCount: number;
  attachmentPointCount: number;
  materialVariantCount: number;
  commercialTier?: RuntimeCommercialReadiness["tier"];
  sku?: string;
  manufacturer?: string;
  releaseEligible?: boolean;
};

export type RuntimePackageFileRef = {
  path: string | null;
  required: boolean;
  exists: boolean;
};

export type RuntimePackageDescriptor = {
  schemaVersion: "asset-package-alpha-v2";
  generatedAt: string;
  key: string;
  packageKind?: "curated_asset" | "catalog_variant";
  baseAssetKey?: string | null;
  manifestId: string;
  label: string;
  assetId: string;
  sourcePath: string;
  runtimePath: string;
  dimensionsMm: DimensionsMm;
  scaleLocked: boolean;
  contractMetadata: CuratedDeskteriorAsset["contractMetadata"];
  supportProfile: CuratedSupportProfileExpectation | null;
  authoring: {
    attachmentPoints: CuratedAttachmentAuthoring;
  };
  runtimeAsset: RuntimeAsset;
  commercialReadiness: RuntimeCommercialReadiness;
  files: {
    sourceBlend: RuntimePackageFileRef;
    runtimeModel: RuntimePackageFileRef;
    proxyModel: RuntimePackageFileRef;
    colliders: RuntimePackageFileRef;
    supportSurfaces: RuntimePackageFileRef;
    attachmentPoints: RuntimePackageFileRef;
    materialVariants: RuntimePackageFileRef;
    qaReport: RuntimePackageFileRef;
    thumbnail: RuntimePackageFileRef;
  };
  runtime: {
    lods: Array<{
      level: number;
      path: string;
    }>;
    proxyPath: string;
    collidersPath: string;
    supportSurfacesPath: string;
    attachmentPointsPath: string;
    materialVariantsPath: string;
    qaReportPath: string;
    thumbnailPath: string | null;
  };
  qa: {
    status: AssetQaReport["status"];
    warnings: string[];
  };
};

export type RuntimePackageCatalog = {
  schemaVersion: "asset-package-index-alpha-v2";
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

export type AssetIngestDraft = {
  schemaVersion: "asset-ingest-alpha-v1";
  createdAt: string;
  assetKey: string;
  source: {
    inputPath: string;
    detectedKind: "blender" | "cad" | "gltf" | "mesh" | "unknown";
  };
  compile: {
    manifestId: string | null;
    assetId: string | null;
    label: string | null;
    category: string | null;
    dimensionsMm: DimensionsMm | null;
    scaleLocked: true;
  };
  authoring: {
    supportSurfaces: "required-if-placeable" | "unknown";
    attachmentPoints: "required-if-mounted" | "unknown";
    materialVariants: "optional";
  };
  notes: string[];
};

export type AssetIngestSummary = {
  ok: boolean;
  outputPath: string;
  assetKey: string;
};

export type ProductUrlReferenceImage = {
  url: string;
  view: ReferenceImageView;
  source: "json_ld" | "open_graph" | "html_image" | "detail_image";
  score: number;
  localPath?: string | null;
};

export type ProductUrlMaterialSlotHint = {
  slot: string;
  materialType: NonNullable<MaterialVariant["slotMaterials"]>[number]["materialType"];
  label: string;
  evidence: string[];
  qaStatus: "pending";
};

export type ProductUrlReferenceDraft = {
  schemaVersion: "product-url-reference-alpha-v1";
  createdAt: string;
  assetKey: string;
  sourceUrl: string;
  product: {
    title: string | null;
    sku: string | null;
    manufacturer: string | null;
    brand: string | null;
    price: number | null;
    priceCurrency: string | null;
    options: string[];
    dimensionsMm: DimensionsMm | null;
    heightRangeMm: [number, number] | null;
  };
  legalUse: {
    mode: "prototype_reference_only";
    releaseEligible: false;
    license: ProductReferencePack["license"];
    warning: string;
  };
  referencePack: ProductReferencePack;
  referenceImages: ProductUrlReferenceImage[];
  materialHints: ProductUrlMaterialSlotHint[];
  extraction: {
    jsonLdProductFound: boolean;
    openGraphImageFound: boolean;
    htmlImageCount: number;
    selectedImageCount: number;
    dimensionSource: "html_text" | "ocr" | "override" | "not_found";
    ocrAttempted: boolean;
    ocrAvailable: boolean;
    ocrTextSample: string | null;
    warnings: string[];
  };
};

export type ProductUrlReferenceSummary = {
  ok: boolean;
  assetKey: string;
  outputPath: string;
  draft: ProductUrlReferenceDraft;
};
