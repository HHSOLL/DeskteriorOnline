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

export type RuntimeTexturePackageMapRef = {
  role: string;
  sourcePath: string;
  publicPath: string;
  ktx2Path: string | null;
  required: boolean;
  exists: boolean;
  resolution?: [number, number];
  channels?: {
    r: string;
    g: string;
    b: string;
    a: string;
  };
  colorSpace?: string;
};

export type RuntimeTexturePackageMetadata = {
  kind: "packed_orm";
  status: "orm-png-sidecar-ready-ktx2-pending" | "ktx2-ready";
  manifestPath: string;
  sourceManifestPath: string;
  ktx2Ready: boolean;
  ktx2TranscodeAttempted: boolean;
  toktxAvailable: boolean;
  stillRequiresRuntimeKtx2Transcode: boolean;
  stillRequiresFinalUvBake: boolean;
  channels: {
    r: "ambientOcclusion";
    g: "roughness";
    b: "metallic";
    a: "constantOne";
  };
  maps: RuntimeTexturePackageMapRef[];
  promotionBoundary: string;
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
  texturePackageStatus?: RuntimeTexturePackageMetadata["status"];
  texturePackageCount?: number;
  ktx2Ready?: boolean;
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
    texturePackageManifest?: RuntimePackageFileRef;
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
  texturePackages?: RuntimeTexturePackageMetadata[];
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

export type ProductAssetFactoryMaterialPlan = {
  slot: string;
  materialType: NonNullable<MaterialVariant["slotMaterials"]>[number]["materialType"];
  target: string;
  evidence: string[];
  qaStatus: "pending_reference" | "runtime_authored" | "manufacturer_verified";
};

export type ProductAssetFactoryArtifactCheck = {
  id:
    | "source_blend"
    | "runtime_model"
    | "proxy_model"
    | "colliders"
    | "support_surfaces"
    | "attachment_points"
    | "material_variants"
    | "qa_report"
    | "thumbnail";
  label: string;
  path: string;
  required: boolean;
  exists: boolean;
  sizeBytes: number | null;
};

export type ProductAssetFactoryPlan = {
  schemaVersion: "product-asset-factory-plan-alpha-v1";
  generatedAt: string;
  assetKey: string;
  product: ProductUrlReferenceDraft["product"];
  sourceUrl: string;
  referencePackPath: string;
  visibility: {
    mode: "private_prototype";
    catalogExposure: "private_only";
    releaseEligible: false;
    reason: string;
  };
  qualityTargets: {
    targetSimilarityPercent: number;
    minVisualFidelityScore: number;
    maxDimensionToleranceMm: number;
    maxDimensionTolerancePercent: number;
    requireLicensedCadForCommercial: true;
  };
  build: {
    strategy: "blender_procedural_reference_rebuild";
    blenderScriptPath: string;
    outputModelPath: string;
    outputProxyPath: string;
    outputThumbnailPath: string;
    requiredComponents: string[];
    materialSlots: ProductAssetFactoryMaterialPlan[];
  };
  validationGates: string[];
  referenceImages: ProductUrlReferenceImage[];
};

export type ProductAssetFactoryQaReport = {
  schemaVersion: "product-asset-factory-qa-alpha-v1";
  generatedAt: string;
  assetKey: string;
  status: "ready_for_private_use" | "needs_repair" | "blocked";
  privateUseOnly: true;
  releaseEligible: false;
  commercialStatus: "not_eligible_without_license" | "needs_repair" | "blocked";
  scores: {
    privateReadiness: number;
    visualFidelity: number;
    dimensionFidelity: number;
    artifactCompleteness: number;
    materialReferenceReadiness: number;
  };
  dimensionComparison: {
    referenceMm: DimensionsMm | null;
    runtimeMm: DimensionsMm | null;
    errorMm: DimensionsMm | null;
    maxErrorMm: number | null;
    maxErrorPercent: number | null;
    passed: boolean;
  };
  referenceCoverage: {
    imageCount: number;
    views: ReferenceImageView[];
    finishReferenceCount: number;
    status: ProductReferencePack["status"];
  };
  materialCoverage: {
    plannedSlotCount: number;
    runtimeSlotCount: number;
    pendingSlotCount: number;
    qaStatus: RuntimeCommercialReadiness["materialQaStatus"] | "missing";
  };
  artifactChecks: ProductAssetFactoryArtifactCheck[];
  catalogVisibility: {
    runtimePackageFound: boolean;
    runtimeIndexFound: boolean;
    publicReleaseBlocked: boolean;
    releaseEligible: false;
  };
  repairInstructions: string[];
};

export type ProductAssetFactoryPrivateCatalogEntry = {
  schemaVersion: "product-asset-private-catalog-alpha-v1";
  generatedAt: string;
  assetKey: string;
  label: string;
  assetId: string | null;
  thumbnailPath: string | null;
  referencePackPath: string;
  qaReportPath: string;
  visibility: "private_prototype";
  releaseEligible: false;
  restrictions: string[];
};

export type ProductAssetFactorySummary = {
  ok: boolean;
  assetKey: string;
  outputDir: string;
  planPath: string;
  qaReportPath: string;
  repairInstructionsPath: string;
  privateCatalogEntryPath: string;
  plan: ProductAssetFactoryPlan;
  qaReport: ProductAssetFactoryQaReport;
  privateCatalogEntry: ProductAssetFactoryPrivateCatalogEntry;
};
