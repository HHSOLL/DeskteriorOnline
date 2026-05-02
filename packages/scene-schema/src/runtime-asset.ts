import type { AttachmentType } from "./placement";
import type { Vector2Mm, Vector3Mm } from "./primitives";

export type DimensionsMm = {
  width: number;
  depth: number;
  height: number;
};

export type PivotDefinition = {
  x: "left" | "center" | "right";
  y: "floor" | "center" | "top";
  z: "front" | "center" | "back";
};

export type ColliderDefinition =
  | {
      id: string;
      kind: "box";
      sizeMm: DimensionsMm;
      centerMm: Vector3Mm;
    }
  | {
      id: string;
      kind: "convex";
      source: string;
    }
  | {
      id: string;
      kind: "mesh";
      source: string;
    };

export type SurfaceFrame = {
  originMm: Vector3Mm;
  tangentU: Vector3Mm;
  tangentV: Vector3Mm;
  normal: Vector3Mm;
};

export type SupportSurface = {
  id: string;
  type:
    | "floor"
    | "wall"
    | "desktop_top"
    | "shelf_top"
    | "desk_edge"
    | "desk_underside"
    | "monitor_back"
    | "pegboard";
  localFrame: SurfaceFrame;
  boundsMm: {
    min: Vector2Mm;
    max: Vector2Mm;
  };
  loadCapacityKg?: number;
  thicknessMm?: number;
  allowedAttachments: AttachmentType[];
  noPlaceZones?: Array<{
    min: Vector2Mm;
    max: Vector2Mm;
  }>;
  preferredZones?: Array<{
    min: Vector2Mm;
    max: Vector2Mm;
  }>;
};

export type AttachmentPoint = {
  id: string;
  type: AttachmentType;
  localPositionMm: Vector3Mm;
  localNormal: Vector3Mm;
  localTangent: Vector3Mm;
  compatibleWith: string[];
  constraints: {
    minClearanceMm?: number;
    requiredThicknessMm?: [number, number];
    holeDiameterMm?: number;
    vesaPatternMm?: [75, 75] | [100, 100] | [75, 100];
    maxLoadKg?: number;
    allowedRotationDeg?: number[];
  };
};

export type RuntimeLod = {
  id: string;
  level: number;
  model: string;
  triangleCount: number;
  drawCallBudget: number;
  screenCoverageMin?: number;
};

export type MaterialVariant = {
  id: string;
  label: string;
  finishColor?: string | null;
  finishMaterial?: string | null;
  detailNotes?: string | null;
  slotMaterials?: Array<{
    slot: string;
    materialType:
      | "wood"
      | "metal"
      | "plastic"
      | "fabric"
      | "ceramic"
      | "glass"
      | "paper"
      | "foliage"
      | "emissive"
      | "mixed"
      | "unknown";
    textureScaleMm?: [number, number];
    roughness?: number;
    metalness?: number;
    normalIntensity?: number;
    qaStatus?: "pending" | "passed" | "failed" | "waived";
    referenceNote?: string;
  }>;
};

export type ReferenceImageView =
  | "front"
  | "back"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "detail"
  | "material"
  | "scale";

export type ProductReferencePack = {
  sku: string;
  manufacturer: string;
  canonicalProductUrl: string | null;
  dimensionSourceUrl: string | null;
  referenceImages: Array<{
    view: ReferenceImageView;
    url: string;
    required: boolean;
    license: string;
  }>;
  finishReferences: Array<{
    finishId: string;
    label: string;
    sourceUrl: string | null;
    materialType: NonNullable<MaterialVariant["slotMaterials"]>[number]["materialType"];
  }>;
  license: {
    spdx: string;
    label: string;
    requiresAttribution: boolean;
  };
  status:
    | "candidate"
    | "reference_collected"
    | "dimension_verified"
    | "visual_verified"
    | "release_ready";
  notes?: string;
};

export type RuntimeCommercialReadiness = {
  tier: "hero_sku" | "generic_catalog" | "draft";
  sku: string;
  manufacturer: string;
  referencePack: ProductReferencePack;
  visualFidelityScore: number;
  dimensionToleranceMm: number;
  dimensionTolerancePercent: number;
  supportSurfaceToleranceMm?: number;
  footprintToleranceMm?: number;
  materialQaStatus: "pending" | "passed" | "failed" | "waived";
  releaseEligible: boolean;
};

export type ArticulationDefinition = {
  type: "monitor_arm";
  joints: Array<{
    id: string;
    parent: string | null;
    type: "revolute" | "prismatic" | "fixed";
    axis: Vector3Mm;
    limitDeg?: [number, number];
    limitMm?: [number, number];
    defaultValue: number;
  }>;
  endEffector: {
    id: "vesa_plate";
    compatiblePatternsMm: [75, 75] | [100, 100] | "both";
  };
  solver: {
    type: "analytic" | "fabrik" | "ccd_ik";
    iterations: number;
    toleranceMm: number;
  };
};

export type AssetQaReport = {
  status: "passed" | "failed" | "warning";
  measuredBoundsMm: DimensionsMm;
  dimensionErrorMm: DimensionsMm;
  validatorVersion: string;
  commercialFidelity?: {
    referencePackStatus: ProductReferencePack["status"];
    visualFidelityScore: number;
    dimensionToleranceMm: number;
    dimensionTolerancePercent: number;
    supportSurfaceToleranceMm?: number;
    footprintToleranceMm?: number;
    materialQaStatus: RuntimeCommercialReadiness["materialQaStatus"];
    releaseEligible: boolean;
  };
  issues?: Array<{
    code: string;
    severity: "error" | "warning";
    message: string;
  }>;
};

export type RuntimeAsset = {
  assetId: string;
  productId?: string;
  units: "mm";
  dimensionsMm: DimensionsMm;
  scaleLocked: true;
  pivot: PivotDefinition;
  sourceProvenance: {
    method: "manual" | "cad" | "scan" | "api" | "hybrid";
    sourceUrl?: string;
    manufacturer?: string;
    license: string;
    attributionRequired: boolean;
  };
  runtime: {
    lods: RuntimeLod[];
    proxy: string;
    defaultLod: number;
    triangleBudget: number;
    textureBudgetMb: number;
  };
  colliders: ColliderDefinition[];
  supportSurfaces: SupportSurface[];
  attachmentPoints: AttachmentPoint[];
  materialVariants: MaterialVariant[];
  articulation?: ArticulationDefinition;
  commercialReadiness?: RuntimeCommercialReadiness;
  qaStatus: AssetQaReport;
};
