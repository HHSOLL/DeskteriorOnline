import type { ProductAssetCategoryProfile, ProductAssetCategoryKey } from "./product-asset-category-profiles";

export type ProductAssetGenerationStrategy =
  | "cad_parametric"
  | "procedural_template"
  | "library_step_part"
  | "image_to_3d"
  | "hybrid_cad_blender"
  | "manual_blender_required";

export type ProductAssetGenerationStrategyDecision = {
  strategy: ProductAssetGenerationStrategy;
  reason: string;
  providerAllowed: boolean;
  cadFirst: boolean;
  manualReviewRequired: boolean;
  expectedArtifacts: string[];
  qaTargets: {
    maxDimensionToleranceMm: number;
    maxDimensionTolerancePercent: number;
    requiresSupportSurfaces: boolean;
    requiresColliders: boolean;
    requiresAttachmentAnchors: boolean;
    requiresInteractionAnchors: boolean;
    requiresMaterialSlots: boolean;
    requiresMultiViewRenderReview: boolean;
  };
};

const CAD_ARTIFACTS = [
  "build123d_python_source",
  "step_primary",
  "runtime_glb",
  "runtime_package_json",
  "colliders_json",
  "support_surfaces_json",
  "attachment_points_json",
  "interaction_anchors_json",
  "material_variants_json",
  "qa_report_json"
];

const IMAGE_TO_3D_ALLOWED: ProductAssetCategoryKey[] = ["plant", "decor", "generic"];

const CAD_PARAMETRIC_CATEGORIES: ProductAssetCategoryKey[] = [
  "desk",
  "shelf",
  "monitor_arm",
  "cable_tray",
  "keyboard",
  "pc_case",
  "psu",
  "fan",
  "radiator"
];

const HYBRID_CATEGORIES: ProductAssetCategoryKey[] = ["monitor", "mouse", "gpu", "motherboard"];

function hasBrandHeroEvidence(evidence: string) {
  return /razer|asus|rog|logitech|logi|corsair|hyte|lian\s*li|angry\s*miao|benq|lg|samsung|abko|앱코|브랜드|hero/.test(
    evidence
  );
}

function hasLibraryStepEvidence(evidence: string) {
  return /official\s*(cad|step|3d)|manufacturer\s*(cad|step|3d)|\bstep\b|cad\s*download|3d\s*model\s*download/.test(evidence);
}

function isDecorSafeForImageTo3d(categoryKey: ProductAssetCategoryKey) {
  return IMAGE_TO_3D_ALLOWED.includes(categoryKey);
}

export function resolveProductAssetGenerationStrategy(input: {
  categoryProfile: ProductAssetCategoryProfile;
  title?: string | null;
  sku?: string | null;
  manufacturer?: string | null;
  categoryHint?: string | null;
}): ProductAssetGenerationStrategyDecision {
  const evidence = [input.categoryHint, input.title, input.sku, input.manufacturer].filter(Boolean).join(" ").toLowerCase();
  const categoryKey = input.categoryProfile.key;

  if (hasLibraryStepEvidence(evidence)) {
    return {
      strategy: "library_step_part",
      reason:
        "Product evidence points to an official CAD/STEP source; use that as the primary artifact and regenerate runtime GLB/sidecars from it.",
      providerAllowed: false,
      cadFirst: true,
      manualReviewRequired: true,
      expectedArtifacts: CAD_ARTIFACTS,
      qaTargets: {
        maxDimensionToleranceMm: 5,
        maxDimensionTolerancePercent: 1,
        requiresSupportSurfaces: ["desk", "shelf"].includes(categoryKey),
        requiresColliders: true,
        requiresAttachmentAnchors: ["monitor_arm", "cable_tray", "pc_case", "psu", "fan", "radiator", "gpu", "motherboard"].includes(
          categoryKey
        ),
        requiresInteractionAnchors: categoryKey === "keyboard",
        requiresMaterialSlots: true,
        requiresMultiViewRenderReview: true
      }
    };
  }

  if (hasBrandHeroEvidence(evidence) && ["decor", "generic"].includes(categoryKey)) {
    return {
      strategy: "manual_blender_required",
      reason:
        "Brand/SKU hero fidelity cannot be solved by image-to-3D or generic CAD; create a private reference brief and require licensed/manual asset work.",
      providerAllowed: false,
      cadFirst: false,
      manualReviewRequired: true,
      expectedArtifacts: ["manual_asset_brief", "reference_pack", "license_review"],
      qaTargets: {
        maxDimensionToleranceMm: 5,
        maxDimensionTolerancePercent: 1,
        requiresSupportSurfaces: false,
        requiresColliders: true,
        requiresAttachmentAnchors: false,
        requiresInteractionAnchors: false,
        requiresMaterialSlots: true,
        requiresMultiViewRenderReview: true
      }
    };
  }

  if (isDecorSafeForImageTo3d(categoryKey)) {
    return {
      strategy: "image_to_3d",
      reason: "Organic/decor category where approximate silhouette matters more than exact structure.",
      providerAllowed: true,
      cadFirst: false,
      manualReviewRequired: true,
      expectedArtifacts: ["provider_glb", "finalized_glb", "thumbnail", "qa_report"],
      qaTargets: {
        maxDimensionToleranceMm: 25,
        maxDimensionTolerancePercent: 5,
        requiresSupportSurfaces: false,
        requiresColliders: true,
        requiresAttachmentAnchors: false,
        requiresInteractionAnchors: false,
        requiresMaterialSlots: true,
        requiresMultiViewRenderReview: true
      }
    };
  }

  if (CAD_PARAMETRIC_CATEGORIES.includes(categoryKey)) {
    return {
      strategy: "cad_parametric",
      reason:
        "Hard-surface product with dimensions, repeated structure, flat planes, slots, or mounting anchors that should be source-controlled as CAD before runtime GLB export.",
      providerAllowed: false,
      cadFirst: true,
      manualReviewRequired: false,
      expectedArtifacts: CAD_ARTIFACTS,
      qaTargets: {
        maxDimensionToleranceMm: 5,
        maxDimensionTolerancePercent: 1,
        requiresSupportSurfaces: ["desk", "shelf"].includes(categoryKey),
        requiresColliders: true,
        requiresAttachmentAnchors: ["monitor_arm", "cable_tray", "pc_case", "psu", "fan", "radiator"].includes(categoryKey),
        requiresInteractionAnchors: categoryKey === "keyboard",
        requiresMaterialSlots: true,
        requiresMultiViewRenderReview: true
      }
    };
  }

  if (HYBRID_CATEGORIES.includes(categoryKey)) {
    return {
      strategy: "hybrid_cad_blender",
      reason:
        "Product needs CAD-controlled envelope/anchors but requires Blender material, decal, sculpt, or manual detail pass for consumer-product fidelity.",
      providerAllowed: false,
      cadFirst: true,
      manualReviewRequired: true,
      expectedArtifacts: CAD_ARTIFACTS,
      qaTargets: {
        maxDimensionToleranceMm: 5,
        maxDimensionTolerancePercent: 1,
        requiresSupportSurfaces: false,
        requiresColliders: true,
        requiresAttachmentAnchors: ["monitor", "gpu", "motherboard"].includes(categoryKey),
        requiresInteractionAnchors: categoryKey === "mouse",
        requiresMaterialSlots: true,
        requiresMultiViewRenderReview: true
      }
    };
  }

  if (hasBrandHeroEvidence(evidence)) {
    return {
      strategy: "manual_blender_required",
      reason:
        "Brand/SKU hero fidelity cannot be solved by image-to-3D or generic CAD; create a private reference brief and require licensed/manual asset work.",
      providerAllowed: false,
      cadFirst: false,
      manualReviewRequired: true,
      expectedArtifacts: ["manual_asset_brief", "reference_pack", "license_review"],
      qaTargets: {
        maxDimensionToleranceMm: 5,
        maxDimensionTolerancePercent: 1,
        requiresSupportSurfaces: false,
        requiresColliders: true,
        requiresAttachmentAnchors: false,
        requiresInteractionAnchors: false,
        requiresMaterialSlots: true,
        requiresMultiViewRenderReview: true
      }
    };
  }

  return {
    strategy: "procedural_template",
    reason:
      "Non-decor hard-surface item without enough product-specific evidence; use a private procedural template and keep it review-blocked.",
    providerAllowed: false,
    cadFirst: true,
    manualReviewRequired: true,
    expectedArtifacts: CAD_ARTIFACTS,
    qaTargets: {
      maxDimensionToleranceMm: 10,
      maxDimensionTolerancePercent: 2,
      requiresSupportSurfaces: false,
      requiresColliders: true,
      requiresAttachmentAnchors: false,
      requiresInteractionAnchors: false,
      requiresMaterialSlots: true,
      requiresMultiViewRenderReview: true
    }
  };
}

export function strategyUsesProvider(decision: ProductAssetGenerationStrategyDecision) {
  return decision.strategy === "image_to_3d" && decision.providerAllowed;
}
