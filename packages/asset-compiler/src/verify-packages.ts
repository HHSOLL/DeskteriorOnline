import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type {
  AssetQaReport,
  AttachmentPoint,
  ColliderDefinition,
  MaterialVariant,
  SupportSurface
} from "@deskterioronline/scene-schema";
import { getPublishedCatalogVariantAssets } from "./catalog-variants";
import { getCuratedDeskteriorAssets } from "./curated-assets";
import { createAssetCompilerPaths } from "./paths";
import type { RuntimePackageCatalog, RuntimePackageDescriptor } from "./types";

type PackageVerificationError = {
  code: string;
  message: string;
  assetKey?: string;
  path?: string;
};

type PublishedRuntimePackageResult = {
  key: string;
  descriptorExists: boolean;
  proxyExists: boolean;
  thumbnailExists: boolean;
  sidecarsValid: boolean;
  fileManifestValid: boolean;
  surfaceInvariantValid: boolean;
  authoringValid: boolean;
  metadataGateValid: boolean;
  commercialReadinessValid: boolean;
};

export type PublishedRuntimePackageSummary = {
  ok: boolean;
  runtimePackageIndexPath: string;
  counts: {
    curatedAssets: number;
    descriptors: number;
    proxyFiles: number;
    thumbnailFiles: number;
    sidecarValidated: number;
    errors: number;
  };
  results: PublishedRuntimePackageResult[];
  errors: PackageVerificationError[];
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function addError(
  errors: PackageVerificationError[],
  code: string,
  message: string,
  details: Omit<PackageVerificationError, "code" | "message"> = {}
) {
  errors.push({ code, message, ...details });
}

function parseVerifyPackagesArgs(argv: string[]) {
  const json = argv.includes("--json");
  const help = argv.includes("--help");
  const unknownArgs = argv.filter((arg) => !["--json", "--help"].includes(arg));
  return { json, help, unknownArgs };
}

function toPublicFilePath(publicRoot: string, publicPath: string | null) {
  if (!isNonEmptyString(publicPath)) {
    return null;
  }
  return path.join(publicRoot, publicPath.replace(/^\//, ""));
}

function deepEqualJson(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isFiniteVector(value: unknown, length: number) {
  return Array.isArray(value) && value.length === length && value.every((entry) => isFiniteNumber(entry));
}

function validateDimensionsContract(
  descriptor: RuntimePackageDescriptor,
  errors: PackageVerificationError[],
  assetKey: string
) {
  let valid = true;
  const descriptorDimensions = descriptor.dimensionsMm;
  const runtimeDimensions = descriptor.runtimeAsset.dimensionsMm;

  if (
    !isPositiveFiniteNumber(descriptorDimensions.width) ||
    !isPositiveFiniteNumber(descriptorDimensions.depth) ||
    !isPositiveFiniteNumber(descriptorDimensions.height)
  ) {
    valid = false;
    addError(errors, "package.dimensions_invalid", `${assetKey} descriptor dimensionsMm must be positive finite millimeters.`, {
      assetKey
    });
  }

  if (!deepEqualJson(descriptorDimensions, runtimeDimensions)) {
    valid = false;
    addError(errors, "package.dimensions_mismatch", `${assetKey} descriptor and runtimeAsset dimensionsMm differ.`, {
      assetKey
    });
  }

  if (descriptor.runtimeAsset.units !== "mm") {
    valid = false;
    addError(errors, "package.units_invalid", `${assetKey} runtimeAsset.units must remain mm.`, { assetKey });
  }

  if (descriptor.scaleLocked !== true || descriptor.runtimeAsset.scaleLocked !== true) {
    valid = false;
    addError(errors, "package.scale_lock_invalid", `${assetKey} descriptor and runtimeAsset must keep scaleLocked=true.`, {
      assetKey
    });
  }

  return valid;
}

function validateColliderContract(
  descriptor: RuntimePackageDescriptor,
  colliders: ColliderDefinition[],
  errors: PackageVerificationError[],
  assetKey: string
) {
  let valid = true;
  if (colliders.length === 0) {
    valid = false;
    addError(errors, "package.collider_missing", `${assetKey} must publish at least one collider sidecar entry.`, {
      assetKey
    });
  }

  for (const collider of colliders) {
    if (!isNonEmptyString(collider.id)) {
      valid = false;
      addError(errors, "package.collider_id_missing", `${assetKey} has a collider without an id.`, { assetKey });
    }

    if (collider.kind === "box") {
      const size = collider.sizeMm;
      if (
        !isPositiveFiniteNumber(size.width) ||
        !isPositiveFiniteNumber(size.depth) ||
        !isPositiveFiniteNumber(size.height) ||
        !isFiniteVector(collider.centerMm, 3)
      ) {
        valid = false;
        addError(errors, "package.collider_box_invalid", `${assetKey} collider ${collider.id} has invalid box dimensions or center.`, {
          assetKey
        });
      }
    } else if (!isNonEmptyString(collider.source)) {
      valid = false;
      addError(errors, "package.collider_source_missing", `${assetKey} collider ${collider.id} is missing a source path.`, {
        assetKey
      });
    }
  }

  const boundsBox = colliders.find(
    (collider): collider is Extract<ColliderDefinition, { kind: "box" }> =>
      collider.kind === "box" && collider.id === "bounds-box"
  );
  if (!boundsBox || !deepEqualJson(boundsBox.sizeMm, descriptor.runtimeAsset.dimensionsMm)) {
    valid = false;
    addError(errors, "package.collider_bounds_missing", `${assetKey} must publish a bounds-box collider derived from dimensionsMm.`, {
      assetKey
    });
  }

  return valid;
}

function validateSupportSurfaceContract(
  descriptor: RuntimePackageDescriptor,
  supportSurfaces: SupportSurface[],
  errors: PackageVerificationError[],
  assetKey: string
) {
  let valid = true;
  const expectedSurfaces = descriptor.supportProfile?.surfaces ?? [];
  if (expectedSurfaces.length > 0 && supportSurfaces.length === 0) {
    valid = false;
    addError(errors, "package.support_surface_missing", `${assetKey} declares a support profile but published no support surfaces.`, {
      assetKey
    });
  }

  const supportSurfaceIds = new Set(supportSurfaces.map((surface) => surface.id));
  for (const expectedSurface of expectedSurfaces) {
    if (!supportSurfaceIds.has(expectedSurface.id)) {
      valid = false;
      addError(errors, "package.support_surface_expected_missing", `${assetKey} is missing expected support surface ${expectedSurface.id}.`, {
        assetKey
      });
    }
  }

  for (const surface of supportSurfaces) {
    const frame = surface.localFrame;
    const bounds = surface.boundsMm;
    if (!isNonEmptyString(surface.id)) {
      valid = false;
      addError(errors, "package.support_surface_id_missing", `${assetKey} has a support surface without an id.`, {
        assetKey
      });
    }
    if (
      !isFiniteVector(frame.originMm, 3) ||
      !isFiniteVector(frame.tangentU, 3) ||
      !isFiniteVector(frame.tangentV, 3) ||
      !isFiniteVector(frame.normal, 3)
    ) {
      valid = false;
      addError(errors, "package.support_surface_frame_invalid", `${assetKey} support surface ${surface.id} has an invalid localFrame.`, {
        assetKey
      });
    }
    if (
      !isFiniteVector(bounds.min, 2) ||
      !isFiniteVector(bounds.max, 2) ||
      bounds.min[0] >= bounds.max[0] ||
      bounds.min[1] >= bounds.max[1]
    ) {
      valid = false;
      addError(errors, "package.support_surface_bounds_invalid", `${assetKey} support surface ${surface.id} has invalid boundsMm.`, {
        assetKey
      });
    }
    if (!Array.isArray(surface.allowedAttachments) || surface.allowedAttachments.length === 0) {
      valid = false;
      addError(
        errors,
        "package.support_surface_attachment_missing",
        `${assetKey} support surface ${surface.id} must declare allowedAttachments.`,
        { assetKey }
      );
    }
  }

  return valid;
}

function validateAttachmentPointContract(
  descriptor: RuntimePackageDescriptor,
  attachmentPoints: AttachmentPoint[],
  errors: PackageVerificationError[],
  assetKey: string
) {
  let valid = true;
  for (const point of attachmentPoints) {
    if (!isNonEmptyString(point.id)) {
      valid = false;
      addError(errors, "package.attachment_point_id_missing", `${assetKey} has an attachment point without an id.`, {
        assetKey
      });
    }
    if (
      !isFiniteVector(point.localPositionMm, 3) ||
      !isFiniteVector(point.localNormal, 3) ||
      !isFiniteVector(point.localTangent, 3)
    ) {
      valid = false;
      addError(errors, "package.attachment_point_frame_invalid", `${assetKey} attachment point ${point.id} has invalid local vectors.`, {
        assetKey
      });
    }
    if (!Array.isArray(point.compatibleWith) || point.compatibleWith.length === 0) {
      valid = false;
      addError(
        errors,
        "package.attachment_point_compatibility_missing",
        `${assetKey} attachment point ${point.id} must declare compatibleWith targets.`,
        { assetKey }
      );
    }
    if (!point.constraints || typeof point.constraints !== "object") {
      valid = false;
      addError(errors, "package.attachment_point_constraints_missing", `${assetKey} attachment point ${point.id} is missing constraints.`, {
        assetKey
      });
    }
  }

  if (descriptor.authoring.attachmentPoints.mode === "manual_required" && attachmentPoints.length === 0) {
    valid = false;
    addError(errors, "package.attachment_point_required_missing", `${assetKey} requires authored attachment points for commercial placement.`, {
      assetKey
    });
  }

  return valid;
}

function validateRuntimeMetadataGate(
  descriptor: RuntimePackageDescriptor,
  colliders: ColliderDefinition[],
  supportSurfaces: SupportSurface[],
  attachmentPoints: AttachmentPoint[],
  errors: PackageVerificationError[],
  assetKey: string
) {
  const commercial = descriptor.runtimeAsset.commercialReadiness ?? descriptor.commercialReadiness;
  let valid = true;

  if (!validateDimensionsContract(descriptor, errors, assetKey)) valid = false;
  if (!validateColliderContract(descriptor, colliders, errors, assetKey)) valid = false;
  if (!validateSupportSurfaceContract(descriptor, supportSurfaces, errors, assetKey)) valid = false;
  if (!validateAttachmentPointContract(descriptor, attachmentPoints, errors, assetKey)) valid = false;

  if (!isNonEmptyString(descriptor.label) || !isNonEmptyString(descriptor.key) || !isNonEmptyString(descriptor.manifestId)) {
    valid = false;
    addError(errors, "package.catalog_identity_missing", `${assetKey} descriptor catalog identity is incomplete.`, {
      assetKey
    });
  }

  if (!isNonEmptyString(descriptor.runtimeAsset.productId)) {
    valid = false;
    addError(errors, "package.product_id_missing", `${assetKey} runtimeAsset.productId is required for catalog traceability.`, {
      assetKey
    });
  }

  if (
    !descriptor.runtimeAsset.sourceProvenance ||
    !isNonEmptyString(descriptor.runtimeAsset.sourceProvenance.manufacturer) ||
    !isNonEmptyString(descriptor.runtimeAsset.sourceProvenance.license)
  ) {
    valid = false;
    addError(errors, "package.source_provenance_missing", `${assetKey} runtimeAsset source provenance must include manufacturer and license.`, {
      assetKey
    });
  }

  if (!commercial || !isNonEmptyString(commercial.sku) || !isNonEmptyString(commercial.manufacturer)) {
    valid = false;
    addError(errors, "package.commercial_metadata_missing", `${assetKey} must publish sku and manufacturer metadata.`, {
      assetKey
    });
  }

  return valid;
}

function validateSidecarParity(
  descriptor: RuntimePackageDescriptor,
  colliders: ColliderDefinition[],
  supportSurfaces: SupportSurface[],
  attachmentPoints: AttachmentPoint[],
  materialVariants: MaterialVariant[],
  qaReport: AssetQaReport,
  errors: PackageVerificationError[],
  assetKey: string
) {
  let sidecarsValid = true;

  const checks = [
    ["colliders", colliders, descriptor.runtimeAsset.colliders],
    ["support surfaces", supportSurfaces, descriptor.runtimeAsset.supportSurfaces],
    ["attachment points", attachmentPoints, descriptor.runtimeAsset.attachmentPoints],
    ["material variants", materialVariants, descriptor.runtimeAsset.materialVariants],
    ["qa report", qaReport, descriptor.runtimeAsset.qaStatus]
  ] as const;

  for (const [label, sidecar, embedded] of checks) {
    if (!deepEqualJson(sidecar, embedded)) {
      sidecarsValid = false;
      addError(errors, "package.sidecar_mismatch", `${assetKey} ${label} sidecar does not match embedded runtimeAsset content.`, {
        assetKey
      });
    }
  }

  return sidecarsValid;
}

function validateFileManifest(
  descriptor: RuntimePackageDescriptor,
  existence: {
    sourceBlend: boolean;
    runtimeModel: boolean;
    proxyModel: boolean;
    colliders: boolean;
    supportSurfaces: boolean;
    attachmentPoints: boolean;
    materialVariants: boolean;
    qaReport: boolean;
    thumbnail: boolean;
  },
  errors: PackageVerificationError[],
  assetKey: string
) {
  let fileManifestValid = true;
  const checks = [
    ["sourceBlend", existence.sourceBlend],
    ["runtimeModel", existence.runtimeModel],
    ["proxyModel", existence.proxyModel],
    ["colliders", existence.colliders],
    ["supportSurfaces", existence.supportSurfaces],
    ["attachmentPoints", existence.attachmentPoints],
    ["materialVariants", existence.materialVariants],
    ["qaReport", existence.qaReport],
    ["thumbnail", existence.thumbnail]
  ] as const;

  for (const [field, exists] of checks) {
    if (descriptor.files[field].exists !== exists) {
      fileManifestValid = false;
      addError(
        errors,
        "package.file_manifest_mismatch",
        `${assetKey} descriptor.files.${field}.exists does not match actual file presence.`,
        { assetKey }
      );
    }
  }

  if (descriptor.runtime.proxyPath !== descriptor.runtimeAsset.runtime.proxy) {
    fileManifestValid = false;
    addError(errors, "package.proxy_contract_mismatch", `${assetKey} runtime proxy path is inconsistent between descriptor and runtimeAsset.`, {
      assetKey
    });
  }

  return fileManifestValid;
}

function validateSurfaceInvariants(
  descriptor: RuntimePackageDescriptor,
  supportSurfaces: SupportSurface[],
  errors: PackageVerificationError[],
  assetKey: string
) {
  let surfaceInvariantValid = true;
  for (const surface of supportSurfaces) {
    if (surface.localFrame.originMm[1] > descriptor.runtimeAsset.dimensionsMm.height) {
      surfaceInvariantValid = false;
      addError(
        errors,
        "package.surface_out_of_bounds",
        `${assetKey} support surface ${surface.id} exceeds asset height (${surface.localFrame.originMm[1]}mm > ${descriptor.runtimeAsset.dimensionsMm.height}mm).`,
        { assetKey }
      );
    }
  }
  return surfaceInvariantValid;
}

function validateAttachmentAuthoring(
  descriptor: RuntimePackageDescriptor,
  attachmentPoints: AttachmentPoint[],
  errors: PackageVerificationError[],
  assetKey: string
) {
  const mode = descriptor.authoring.attachmentPoints.mode;
  if (mode === "none" && attachmentPoints.length > 0) {
    addError(errors, "package.attachment_authoring_unexpected", `${assetKey} declares attachment authoring mode=none but generated attachment points are present.`, {
      assetKey
    });
    return false;
  }
  if (mode === "manual_required" && attachmentPoints.length === 0) {
    addError(errors, "package.attachment_authoring_missing", `${assetKey} requires manual attachment authoring but no attachment points were published.`, {
      assetKey
    });
    return false;
  }
  return true;
}

function validateCommercialReadiness(
  descriptor: RuntimePackageDescriptor,
  indexEntry: RuntimePackageCatalog["assets"][number],
  errors: PackageVerificationError[],
  assetKey: string
) {
  const descriptorReadiness = descriptor.commercialReadiness;
  const runtimeReadiness = descriptor.runtimeAsset.commercialReadiness;
  if (!descriptorReadiness || !runtimeReadiness) {
    addError(errors, "package.commercial_readiness_missing", `${assetKey} is missing commercial readiness metadata.`, {
      assetKey
    });
    return false;
  }

  let valid = true;
  if (!deepEqualJson(descriptorReadiness, runtimeReadiness)) {
    valid = false;
    addError(
      errors,
      "package.commercial_readiness_mismatch",
      `${assetKey} commercial readiness differs between descriptor and runtimeAsset.`,
      { assetKey }
    );
  }
  if (!isNonEmptyString(runtimeReadiness.sku) || !isNonEmptyString(runtimeReadiness.manufacturer)) {
    valid = false;
    addError(errors, "package.commercial_identity_missing", `${assetKey} is missing sku/manufacturer metadata.`, {
      assetKey
    });
  }
  if (
    indexEntry.commercialTier !== runtimeReadiness.tier ||
    indexEntry.sku !== runtimeReadiness.sku ||
    indexEntry.manufacturer !== runtimeReadiness.manufacturer ||
    indexEntry.releaseEligible !== runtimeReadiness.releaseEligible
  ) {
    valid = false;
    addError(
      errors,
      "package.commercial_index_mismatch",
      `${assetKey} runtime package index does not match descriptor commercial metadata.`,
      { assetKey }
    );
  }
  if (runtimeReadiness.tier === "hero_sku") {
    const requiredReferenceImages = runtimeReadiness.referencePack.referenceImages.filter((image) => image.required);
    if (requiredReferenceImages.length < 4) {
      valid = false;
      addError(
        errors,
        "package.hero_reference_pack_incomplete",
        `${assetKey} hero SKU requires front/side/top/material references before release.`,
        { assetKey }
      );
    }
    if (!runtimeReadiness.releaseEligible) {
      valid = false;
      addError(errors, "package.hero_release_not_eligible", `${assetKey} hero SKU is not release eligible.`, {
        assetKey
      });
    }
  }

  return valid;
}

export async function buildPublishedRuntimePackageSummary(): Promise<PublishedRuntimePackageSummary> {
  const paths = createAssetCompilerPaths();
  const curatedAssets = getCuratedDeskteriorAssets(paths);
  const catalogVariantAssets = await getPublishedCatalogVariantAssets(paths, curatedAssets);
  const runtimePackageAssets = [...curatedAssets, ...catalogVariantAssets];
  const errors: PackageVerificationError[] = [];
  const results: PublishedRuntimePackageResult[] = [];

  const indexRaw = await readFile(paths.runtimePackageIndexPath, "utf8");
  const index = JSON.parse(indexRaw) as RuntimePackageCatalog;
  if (index.schemaVersion !== "asset-package-index-alpha-v2") {
    addError(errors, "package.index_schema_invalid", "runtime package index schema version should match the alpha contract.", {
      path: paths.runtimePackageIndexPath
    });
  }
  if (index.assets.length !== runtimePackageAssets.length) {
    addError(
      errors,
      "package.index_count_invalid",
      `runtime package index should include ${runtimePackageAssets.length} runtime packages, found ${index.assets.length}.`,
      { path: paths.runtimePackageIndexPath }
    );
  }

  const expectedRuntimeJsonFiles = new Set<string>();
  const expectedThumbnailFiles = new Set<string>();
  let descriptors = 0;
  let proxyFiles = 0;
  let thumbnailFiles = 0;
  let sidecarValidated = 0;

  for (const asset of runtimePackageAssets) {
    expectedRuntimeJsonFiles.add(`${asset.key}.json`);
    expectedRuntimeJsonFiles.add(`${asset.key}.colliders.json`);
    expectedRuntimeJsonFiles.add(`${asset.key}.support-surfaces.json`);
    expectedRuntimeJsonFiles.add(`${asset.key}.attachment-points.json`);
    expectedRuntimeJsonFiles.add(`${asset.key}.material-variants.json`);
    expectedRuntimeJsonFiles.add(`${asset.key}.qa-report.json`);
    if (asset.thumbnailPublicPath?.startsWith("/assets/catalog/thumbnails/")) {
      expectedThumbnailFiles.add(path.basename(asset.thumbnailPublicPath));
    } else {
      expectedThumbnailFiles.add(`${asset.key}.webp`);
    }

    const result: PublishedRuntimePackageResult = {
      key: asset.key,
      descriptorExists: false,
      proxyExists: false,
      thumbnailExists: false,
      sidecarsValid: false,
      fileManifestValid: false,
      surfaceInvariantValid: false,
      authoringValid: false,
      metadataGateValid: false,
      commercialReadinessValid: false
    };

    const entry = index.assets.find((candidate) => candidate.key === asset.key);
    if (!entry) {
      addError(errors, "package.index_missing_asset", `runtime package index is missing ${asset.key}.`, {
        assetKey: asset.key,
        path: paths.runtimePackageIndexPath
      });
      results.push(result);
      continue;
    }

    if (entry.packagePath !== `/assets/catalog/runtime-packages/${asset.key}.json`) {
      addError(errors, "package.index_path_mismatch", `${asset.key} packagePath does not match the published descriptor convention.`, {
        assetKey: asset.key,
        path: paths.runtimePackageIndexPath
      });
    }
    if ((entry.packageKind ?? "curated_asset") !== (asset.packageKind ?? "curated_asset")) {
      addError(errors, "package.index_kind_mismatch", `${asset.key} packageKind does not match expected package source.`, {
        assetKey: asset.key,
        path: paths.runtimePackageIndexPath
      });
    }

    const descriptorPath = path.join(paths.publicRoot, entry.packagePath.replace(/^\//, ""));
    const descriptorExists = await fileExists(descriptorPath);
    result.descriptorExists = descriptorExists;
    if (!descriptorExists) {
      addError(errors, "package.descriptor_missing", `runtime package descriptor is missing for ${asset.key}.`, {
        assetKey: asset.key,
        path: descriptorPath
      });
      results.push(result);
      continue;
    }

    descriptors += 1;
    const descriptor = JSON.parse(await readFile(descriptorPath, "utf8")) as RuntimePackageDescriptor;
    if (descriptor.schemaVersion !== "asset-package-alpha-v2") {
      addError(errors, "package.descriptor_schema_invalid", `${asset.key} descriptor schema version must match the alpha contract.`, {
        assetKey: asset.key,
        path: descriptorPath
      });
    }
    if (descriptor.manifestId !== asset.manifestId || descriptor.assetId !== asset.expectedAssetId) {
      addError(errors, "package.descriptor_identity_invalid", `${asset.key} descriptor identity fields do not match curated metadata.`, {
        assetKey: asset.key,
        path: descriptorPath
      });
    }
    result.commercialReadinessValid = validateCommercialReadiness(descriptor, entry, errors, asset.key);

    const sourceBlendPath = path.join(paths.repoRoot, descriptor.files.sourceBlend.path ?? "");
    const runtimeModelPath = toPublicFilePath(paths.publicRoot, descriptor.files.runtimeModel.path);
    const proxyPath = toPublicFilePath(paths.publicRoot, descriptor.files.proxyModel.path);
    const collidersPath = toPublicFilePath(paths.publicRoot, descriptor.runtime.collidersPath);
    const supportSurfacesPath = toPublicFilePath(paths.publicRoot, descriptor.runtime.supportSurfacesPath);
    const attachmentPointsPath = toPublicFilePath(paths.publicRoot, descriptor.runtime.attachmentPointsPath);
    const materialVariantsPath = toPublicFilePath(paths.publicRoot, descriptor.runtime.materialVariantsPath);
    const qaReportPath = toPublicFilePath(paths.publicRoot, descriptor.runtime.qaReportPath);
    const thumbnailPath = toPublicFilePath(paths.publicRoot, descriptor.runtime.thumbnailPath);

    const [
      sourceBlendExists,
      runtimeModelExists,
      proxyExists,
      collidersExists,
      supportSurfacesExists,
      attachmentPointsExists,
      materialVariantsExists,
      qaReportExists,
      thumbnailExists
    ] = await Promise.all([
      fileExists(sourceBlendPath),
      runtimeModelPath ? fileExists(runtimeModelPath) : Promise.resolve(false),
      proxyPath ? fileExists(proxyPath) : Promise.resolve(false),
      collidersPath ? fileExists(collidersPath) : Promise.resolve(false),
      supportSurfacesPath ? fileExists(supportSurfacesPath) : Promise.resolve(false),
      attachmentPointsPath ? fileExists(attachmentPointsPath) : Promise.resolve(false),
      materialVariantsPath ? fileExists(materialVariantsPath) : Promise.resolve(false),
      qaReportPath ? fileExists(qaReportPath) : Promise.resolve(false),
      thumbnailPath ? fileExists(thumbnailPath) : Promise.resolve(false)
    ]);

    result.proxyExists = proxyExists;
    result.thumbnailExists = thumbnailExists;
    if (proxyExists) proxyFiles += 1;
    if (thumbnailExists) thumbnailFiles += 1;

    result.fileManifestValid = validateFileManifest(
      descriptor,
      {
        sourceBlend: sourceBlendExists,
        runtimeModel: runtimeModelExists,
        proxyModel: proxyExists,
        colliders: collidersExists,
        supportSurfaces: supportSurfacesExists,
        attachmentPoints: attachmentPointsExists,
        materialVariants: materialVariantsExists,
        qaReport: qaReportExists,
        thumbnail: thumbnailExists
      },
      errors,
      asset.key
    );

    if (
      !collidersPath ||
      !supportSurfacesPath ||
      !attachmentPointsPath ||
      !materialVariantsPath ||
      !qaReportPath ||
      !collidersExists ||
      !supportSurfacesExists ||
      !attachmentPointsExists ||
      !materialVariantsExists ||
      !qaReportExists
    ) {
      addError(errors, "package.sidecar_missing", `${asset.key} published sidecar set is incomplete.`, {
        assetKey: asset.key
      });
      results.push(result);
      continue;
    }

    const [colliders, supportSurfaces, attachmentPoints, materialVariants, qaReport] = await Promise.all([
      readFile(collidersPath, "utf8").then((value) => JSON.parse(value) as ColliderDefinition[]),
      readFile(supportSurfacesPath, "utf8").then((value) => JSON.parse(value) as SupportSurface[]),
      readFile(attachmentPointsPath, "utf8").then((value) => JSON.parse(value) as AttachmentPoint[]),
      readFile(materialVariantsPath, "utf8").then((value) => JSON.parse(value) as MaterialVariant[]),
      readFile(qaReportPath, "utf8").then((value) => JSON.parse(value) as AssetQaReport)
    ]);

    result.sidecarsValid = validateSidecarParity(
      descriptor,
      colliders,
      supportSurfaces,
      attachmentPoints,
      materialVariants,
      qaReport,
      errors,
      asset.key
    );
    result.surfaceInvariantValid = validateSurfaceInvariants(descriptor, supportSurfaces, errors, asset.key);
    result.authoringValid = validateAttachmentAuthoring(descriptor, attachmentPoints, errors, asset.key);
    result.metadataGateValid = validateRuntimeMetadataGate(
      descriptor,
      colliders,
      supportSurfaces,
      attachmentPoints,
      errors,
      asset.key
    );

    if (
      entry.surfaceCount !== supportSurfaces.length ||
      entry.attachmentPointCount !== attachmentPoints.length ||
      entry.materialVariantCount !== materialVariants.length
    ) {
      addError(errors, "package.index_count_mismatch", `${asset.key} index counts do not match published sidecars.`, {
        assetKey: asset.key,
        path: paths.runtimePackageIndexPath
      });
    }

    if (result.sidecarsValid) {
      sidecarValidated += 1;
    }
    results.push(result);
  }

  const actualRuntimeJsonFiles = (await readdir(paths.runtimePackageDir).catch(() => [] as string[])).filter((entry) =>
    entry.endsWith(".json")
  );
  for (const expectedFileName of expectedRuntimeJsonFiles) {
    if (!actualRuntimeJsonFiles.includes(expectedFileName)) {
      addError(errors, "package.runtime_json_missing", `${expectedFileName} is missing from the runtime package directory.`, {
        path: path.join(paths.runtimePackageDir, expectedFileName)
      });
    }
  }
  for (const unexpectedFileName of actualRuntimeJsonFiles) {
    if (!expectedRuntimeJsonFiles.has(unexpectedFileName)) {
      addError(errors, "package.runtime_json_unexpected", `${unexpectedFileName} should not remain in the runtime package directory.`, {
        path: path.join(paths.runtimePackageDir, unexpectedFileName)
      });
    }
  }

  const actualThumbnailFiles = (await readdir(paths.thumbnailDir).catch(() => [] as string[])).filter(
    (entry) => entry.startsWith("p2s_") && entry.endsWith(".webp")
  );
  for (const expectedFileName of expectedThumbnailFiles) {
    if (!actualThumbnailFiles.includes(expectedFileName)) {
      addError(errors, "package.thumbnail_missing", `${expectedFileName} is missing from the thumbnail directory.`, {
        path: path.join(paths.thumbnailDir, expectedFileName)
      });
    }
  }
  for (const unexpectedFileName of actualThumbnailFiles) {
    if (!expectedThumbnailFiles.has(unexpectedFileName)) {
      addError(errors, "package.thumbnail_unexpected", `${unexpectedFileName} should not remain in the thumbnail directory.`, {
        path: path.join(paths.thumbnailDir, unexpectedFileName)
      });
    }
  }

  return {
    ok: errors.length === 0,
    runtimePackageIndexPath: paths.runtimePackageIndexPath,
    counts: {
      curatedAssets: runtimePackageAssets.length,
      descriptors,
      proxyFiles,
      thumbnailFiles,
      sidecarValidated,
      errors: errors.length
    },
    results,
    errors
  };
}

export function printPublishedRuntimePackageSummary(summary: PublishedRuntimePackageSummary) {
  console.log("Asset Compiler Published Package Verification");
  console.log(`Status: ${summary.ok ? "PASS" : "FAIL"}`);
  console.log(`Runtime package index: ${summary.runtimePackageIndexPath}`);
  console.log("");
  console.log("Counts:");
  console.log(`- Curated assets: ${summary.counts.curatedAssets}`);
  console.log(`- Descriptors found: ${summary.counts.descriptors}/${summary.counts.curatedAssets}`);
  console.log(`- Proxy files found: ${summary.counts.proxyFiles}/${summary.counts.curatedAssets}`);
  console.log(`- Thumbnail files found: ${summary.counts.thumbnailFiles}/${summary.counts.curatedAssets}`);
  console.log(`- Sidecars validated: ${summary.counts.sidecarValidated}/${summary.counts.curatedAssets}`);
  console.log(`- Metadata gates valid: ${summary.results.filter((result) => result.metadataGateValid).length}/${summary.counts.curatedAssets}`);
  console.log(`- Errors: ${summary.counts.errors}`);
  console.log("");
  console.log("Packages:");
  for (const result of summary.results) {
    console.log(
      `- ${result.key} | descriptor=${result.descriptorExists ? "ok" : "missing"} | proxy=${result.proxyExists ? "ok" : "missing"} | thumbnail=${result.thumbnailExists ? "ok" : "missing"} | sidecars=${result.sidecarsValid ? "ok" : "fail"} | fileManifest=${result.fileManifestValid ? "ok" : "fail"} | surfaces=${result.surfaceInvariantValid ? "ok" : "fail"} | authoring=${result.authoringValid ? "ok" : "fail"} | metadata=${result.metadataGateValid ? "ok" : "fail"}`
    );
  }
  if (summary.errors.length > 0) {
    console.log("");
    console.log("Errors:");
    for (const [index, error] of summary.errors.entries()) {
      console.log(`${index + 1}. [${error.code}] ${error.message}`);
    }
  } else {
    console.log("");
    console.log("No errors found.");
  }
}

export async function runVerifyPublishedRuntimePackagesCli(argv: string[]) {
  const { json, help, unknownArgs } = parseVerifyPackagesArgs(argv);
  if (help) {
    console.log(
      [
        "Usage: node --import tsx apps/web/scripts/verify-asset-compiler-alpha.ts [options]",
        "",
        "Options:",
        "  --json   Print machine-readable summary JSON",
        "  --help   Show help"
      ].join("\n")
    );
    process.exit(0);
  }
  if (unknownArgs.length > 0) {
    console.error(`Unknown arguments: ${unknownArgs.join(", ")}`);
    process.exit(1);
  }

  const summary = await buildPublishedRuntimePackageSummary();
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printPublishedRuntimePackageSummary(summary);
  }
  process.exit(summary.ok ? 0 : 1);
}
