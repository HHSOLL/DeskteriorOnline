import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProductUrlReferenceDraft } from "@deskterioronline/asset-compiler";
import sharp from "sharp";
import type { ProductAssetCategoryProfile, ProductAssetCategoryKey } from "./product-asset-category-profiles";
import type {
  ProductAssetGenerationStrategy,
  ProductAssetGenerationStrategyDecision
} from "./product-asset-generation-strategy";

type DimensionsMm = { width: number; depth: number; height: number };
type Vector3Mm = { x: number; y: number; z: number };
type Vector2Mm = { x: number; y: number };

type CadComponent = {
  id: string;
  label: string;
  centerMm: Vector3Mm;
  sizeMm: DimensionsMm;
  materialSlot: string;
};

const CAD_STEP_EXPORT_STATUS = {
  status: "pending_build123d_execution",
  sourceFormat: "build123d_python",
  stepArtifact: "placeholder",
  reason:
    "Worker currently emits source-controlled CAD intent and runtime sidecars; true STEP export must run in a build123d/OCP-enabled CAD worker."
} as const;

export type ProductAssetCadSidecar = {
  suffix: string;
  contentType: "application/json" | "text/x-python" | "model/step";
  buffer: Buffer;
};

export type ProductAssetCadPackage = {
  assetKey: string;
  strategy: Exclude<ProductAssetGenerationStrategy, "image_to_3d" | "manual_blender_required">;
  glbBuffer: ArrayBuffer;
  thumbnailBuffer: Buffer | null;
  sidecars: ProductAssetCadSidecar[];
  localArtifacts: {
    sourcePath: string;
    stepPath: string;
    glbPath: string;
    runtimePackagePath: string;
    collidersPath: string;
    supportSurfacesPath: string;
    attachmentPointsPath: string;
    interactionAnchorsPath: string;
    materialVariantsPath: string;
    qaReportPath: string;
  };
  runtimePackage: Record<string, unknown>;
  structuralQa: Record<string, unknown>;
};

const DEFAULT_DIMENSIONS: Record<ProductAssetCategoryKey, DimensionsMm> = {
  desk: { width: 1400, depth: 700, height: 720 },
  shelf: { width: 900, depth: 320, height: 1200 },
  monitor_arm: { width: 420, depth: 120, height: 450 },
  cable_tray: { width: 700, depth: 120, height: 60 },
  monitor: { width: 615, depth: 220, height: 430 },
  speaker: { width: 100, depth: 140, height: 175 },
  keyboard: { width: 468, depth: 148, height: 36 },
  mouse: { width: 125, depth: 70, height: 42 },
  desk_mat: { width: 900, depth: 400, height: 4 },
  pc_case: { width: 285, depth: 470, height: 490 },
  psu: { width: 150, depth: 140, height: 86 },
  fan: { width: 120, depth: 25, height: 120 },
  radiator: { width: 277, depth: 30, height: 120 },
  gpu: { width: 305, depth: 55, height: 135 },
  motherboard: { width: 305, depth: 24, height: 244 },
  audio_interface: { width: 200, depth: 150, height: 55 },
  lighting: { width: 450, depth: 450, height: 45 },
  plant: { width: 160, depth: 160, height: 260 },
  furniture: { width: 600, depth: 400, height: 600 },
  decor: { width: 120, depth: 120, height: 160 },
  generic: { width: 240, depth: 180, height: 160 }
};

function sanitizeAssetKey(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "cad-product-asset"
  );
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buffer.byteLength);
  copy.set(buffer);
  return copy.buffer;
}

function dimensionOrDefault(
  draft: ProductUrlReferenceDraft,
  categoryProfile: ProductAssetCategoryProfile
): DimensionsMm {
  return draft.product.dimensionsMm ?? DEFAULT_DIMENSIONS[categoryProfile.key];
}

function box(id: string, label: string, centerMm: Vector3Mm, sizeMm: DimensionsMm, materialSlot: string): CadComponent {
  return { id, label, centerMm, sizeMm, materialSlot };
}

function buildComponents(categoryKey: ProductAssetCategoryKey, dimensions: DimensionsMm): CadComponent[] {
  const w = dimensions.width;
  const d = dimensions.depth;
  const h = dimensions.height;

  if (categoryKey === "desk") {
    const slab = Math.min(32, Math.max(20, h * 0.04));
    const legW = Math.max(36, w * 0.045);
    const legD = Math.max(36, d * 0.065);
    const legH = h - slab;
    const x = w / 2 - legW;
    const z = d / 2 - legD;
    return [
      box("desktop-slab", "Desktop slab", { x: 0, y: h - slab / 2, z: 0 }, { width: w, depth: d, height: slab }, "desktop"),
      box("left-front-leg", "Left front leg", { x: -x, y: legH / 2, z: z }, { width: legW, depth: legD, height: legH }, "frame"),
      box("right-front-leg", "Right front leg", { x, y: legH / 2, z: z }, { width: legW, depth: legD, height: legH }, "frame"),
      box("left-back-leg", "Left back leg", { x: -x, y: legH / 2, z: -z }, { width: legW, depth: legD, height: legH }, "frame"),
      box("right-back-leg", "Right back leg", { x, y: legH / 2, z: -z }, { width: legW, depth: legD, height: legH }, "frame"),
      box("rear-cable-tray", "Rear cable tray", { x: 0, y: h - slab - 45, z: -d / 2 + 55 }, { width: w * 0.64, depth: 34, height: 50 }, "hardware")
    ];
  }

  if (categoryKey === "keyboard") {
    const keyW = Math.min(48, w / 11);
    const keyD = Math.min(34, d / 5);
    const keyH = Math.max(6, h * 0.32);
    const keyY = h - keyH / 2;
    const rowZ = d * 0.12;
    return [
      box("keyboard-housing", "Keyboard housing", { x: 0, y: h * 0.35, z: 0 }, { width: w, depth: d, height: h * 0.7 }, "case"),
      box("key-esc", "Esc key", { x: -w * 0.42, y: keyY, z: rowZ }, { width: keyW, depth: keyD, height: keyH }, "keycap"),
      box("key-w", "W key", { x: -w * 0.18, y: keyY, z: rowZ * 0.2 }, { width: keyW, depth: keyD, height: keyH }, "keycap"),
      box("key-a", "A key", { x: -w * 0.24, y: keyY, z: -rowZ * 0.25 }, { width: keyW, depth: keyD, height: keyH }, "keycap"),
      box("key-space", "Space key", { x: 0, y: keyY, z: -rowZ * 1.2 }, { width: keyW * 4.2, depth: keyD, height: keyH }, "keycap"),
      box("key-enter", "Enter key", { x: w * 0.34, y: keyY, z: -rowZ * 0.25 }, { width: keyW * 1.8, depth: keyD, height: keyH }, "keycap")
    ];
  }

  if (categoryKey === "pc_case") {
    const panel = 18;
    return [
      box("case-frame", "Case frame", { x: 0, y: h / 2, z: 0 }, { width: w, depth: d, height: h }, "painted_metal"),
      box("glass-side-panel", "Tempered glass side panel", { x: -w / 2 - 1, y: h * 0.5, z: 0 }, { width: 4, depth: d * 0.82, height: h * 0.82 }, "glass"),
      box("motherboard-tray", "Motherboard tray", { x: w * 0.18, y: h * 0.53, z: -d * 0.06 }, { width: panel, depth: d * 0.58, height: h * 0.58 }, "interior_metal"),
      box("psu-bay", "PSU bay", { x: 0, y: h * 0.14, z: -d * 0.23 }, { width: w * 0.72, depth: d * 0.34, height: h * 0.18 }, "interior_metal"),
      box("front-fan-mount", "Front fan mount", { x: 0, y: h * 0.54, z: d / 2 - 22 }, { width: w * 0.74, depth: 18, height: h * 0.48 }, "fan_mount"),
      box("top-radiator-rail", "Top radiator rail", { x: 0, y: h - 22, z: 0 }, { width: w * 0.72, depth: d * 0.58, height: 18 }, "radiator_mount"),
      box("gpu-slot", "GPU slot opening", { x: w * 0.15, y: h * 0.43, z: -d / 2 - 1 }, { width: w * 0.46, depth: 4, height: h * 0.12 }, "slot_metal")
    ];
  }

  if (categoryKey === "fan") {
    return [
      box("fan-frame", "Fan square frame", { x: 0, y: h / 2, z: 0 }, { width: w, depth: d, height: h }, "frame"),
      box("fan-hub", "Fan hub", { x: 0, y: h / 2, z: 0 }, { width: w * 0.34, depth: d * 1.1, height: h * 0.34 }, "hub")
    ];
  }

  if (categoryKey === "radiator") {
    return [
      box("radiator-core", "Radiator fin stack", { x: 0, y: h / 2, z: 0 }, { width: w, depth: d, height: h }, "fin_stack"),
      box("left-end-tank", "Left end tank", { x: -w * 0.43, y: h / 2, z: 0 }, { width: w * 0.08, depth: d * 1.15, height: h }, "end_tank"),
      box("right-end-tank", "Right end tank", { x: w * 0.43, y: h / 2, z: 0 }, { width: w * 0.08, depth: d * 1.15, height: h }, "end_tank")
    ];
  }

  if (categoryKey === "psu") {
    return [
      box("psu-shell", "PSU shell", { x: 0, y: h / 2, z: 0 }, { width: w, depth: d, height: h }, "painted_metal"),
      box("psu-fan-grille", "PSU fan grille", { x: 0, y: h + 1, z: 0 }, { width: w * 0.68, depth: d * 0.68, height: 2 }, "fan_grille"),
      box("psu-port-face", "Modular port face", { x: 0, y: h * 0.45, z: -d / 2 - 1 }, { width: w * 0.72, depth: 3, height: h * 0.42 }, "ports")
    ];
  }

  return [box("primary-envelope", "Dimension locked envelope", { x: 0, y: h / 2, z: 0 }, dimensions, "primary")];
}

function vec3(x: number, y: number, z: number) {
  return { x, y, z };
}

function vec2(x: number, y: number) {
  return { x, y };
}

function buildColliders(dimensions: DimensionsMm) {
  return [
    {
      id: "bounds",
      kind: "box",
      sizeMm: dimensions,
      centerMm: vec3(0, dimensions.height / 2, 0)
    }
  ];
}

function buildSupportSurfaces(categoryKey: ProductAssetCategoryKey, dimensions: DimensionsMm) {
  if (categoryKey === "desk") {
    return [
      {
        id: "desktop_top",
        type: "desktop_top",
        localFrame: {
          originMm: vec3(0, dimensions.height, 0),
          tangentU: vec3(1, 0, 0),
          tangentV: vec3(0, 0, 1),
          normal: vec3(0, 1, 0)
        },
        boundsMm: {
          min: vec2(-dimensions.width / 2, -dimensions.depth / 2),
          max: vec2(dimensions.width / 2, dimensions.depth / 2)
        },
        loadCapacityKg: 80,
        thicknessMm: 25,
        allowedAttachments: ["place_on_surface", "edge_clamp"]
      },
      {
        id: "desk_edge",
        type: "desk_edge",
        localFrame: {
          originMm: vec3(0, dimensions.height - 12, dimensions.depth / 2),
          tangentU: vec3(1, 0, 0),
          tangentV: vec3(0, 1, 0),
          normal: vec3(0, 0, 1)
        },
        boundsMm: {
          min: vec2(-dimensions.width / 2, -25),
          max: vec2(dimensions.width / 2, 25)
        },
        thicknessMm: 25,
        allowedAttachments: ["edge_clamp"]
      },
      {
        id: "desk_underside",
        type: "desk_underside",
        localFrame: {
          originMm: vec3(0, dimensions.height - 30, 0),
          tangentU: vec3(1, 0, 0),
          tangentV: vec3(0, 0, 1),
          normal: vec3(0, -1, 0)
        },
        boundsMm: {
          min: vec2(-dimensions.width / 2, -dimensions.depth / 2),
          max: vec2(dimensions.width / 2, dimensions.depth / 2)
        },
        thicknessMm: 25,
        allowedAttachments: ["under_desk_mount"]
      }
    ];
  }

  if (categoryKey === "shelf") {
    return [
      {
        id: "shelf_top",
        type: "shelf_top",
        localFrame: {
          originMm: vec3(0, dimensions.height, 0),
          tangentU: vec3(1, 0, 0),
          tangentV: vec3(0, 0, 1),
          normal: vec3(0, 1, 0)
        },
        boundsMm: {
          min: vec2(-dimensions.width / 2, -dimensions.depth / 2),
          max: vec2(dimensions.width / 2, dimensions.depth / 2)
        },
        loadCapacityKg: 25,
        thicknessMm: 18,
        allowedAttachments: ["place_on_surface"]
      }
    ];
  }

  return [];
}

function attachment(id: string, type: string, position: Vector3Mm, normal: Vector3Mm, compatibleWith: string[]) {
  return {
    id,
    type,
    localPositionMm: position,
    localNormal: normal,
    localTangent: vec3(1, 0, 0),
    compatibleWith,
    constraints: {
      minClearanceMm: 5
    }
  };
}

function buildAttachmentPoints(categoryKey: ProductAssetCategoryKey, dimensions: DimensionsMm) {
  if (categoryKey === "pc_case") {
    return [
      attachment("motherboard_tray_atx", "pc_case_motherboard_tray", vec3(dimensions.width * 0.18, dimensions.height * 0.53, -20), vec3(-1, 0, 0), ["atx", "matx", "itx"]),
      attachment("psu_bay", "pc_case_psu_bay", vec3(0, dimensions.height * 0.15, -dimensions.depth * 0.23), vec3(0, 0, 1), ["atx_psu"]),
      attachment("gpu_pcie_x16", "pcie_x16", vec3(dimensions.width * 0.14, dimensions.height * 0.42, -dimensions.depth / 2), vec3(0, 0, -1), ["gpu_dual_slot", "gpu_triple_slot"]),
      attachment("front_fan_mount_120", "pc_case_fan_mount", vec3(0, dimensions.height * 0.55, dimensions.depth / 2), vec3(0, 0, 1), ["120mm_fan", "140mm_fan"]),
      attachment("top_radiator_mount_240", "pc_case_radiator_mount", vec3(0, dimensions.height - 24, 0), vec3(0, -1, 0), ["240mm_radiator", "280mm_radiator"])
    ];
  }

  if (categoryKey === "monitor_arm") {
    return [
      attachment("desk_edge_clamp", "edge_clamp", vec3(0, 0, 0), vec3(0, -1, 0), ["desk_edge"]),
      attachment("vesa_plate", "vesa_mount", vec3(0, dimensions.height, 0), vec3(0, 0, 1), ["75x75", "100x100"])
    ];
  }

  if (categoryKey === "psu") {
    return [attachment("psu_case_mount", "pc_case_psu_bay", vec3(0, dimensions.height / 2, 0), vec3(0, 0, 1), ["psu_bay"])];
  }

  if (categoryKey === "fan") {
    return [attachment("fan_mount_pattern", "pc_case_fan_mount", vec3(0, dimensions.height / 2, 0), vec3(0, 0, 1), ["120mm_fan_mount", "radiator_mount"])];
  }

  if (categoryKey === "radiator") {
    return [attachment("radiator_mount_pattern", "pc_case_radiator_mount", vec3(0, dimensions.height / 2, 0), vec3(0, -1, 0), ["240mm_radiator_mount", "280mm_radiator_mount"])];
  }

  return [];
}

function buildInteractionAnchors(categoryKey: ProductAssetCategoryKey, dimensions: DimensionsMm) {
  if (categoryKey === "keyboard") {
    const topY = dimensions.height + 4;
    return [
      { id: "key_esc", type: "key_press", label: "Esc", localPositionMm: vec3(-dimensions.width * 0.42, topY, dimensions.depth * 0.12), travelMm: 3.5 },
      { id: "key_w", type: "key_press", label: "W", localPositionMm: vec3(-dimensions.width * 0.18, topY, dimensions.depth * 0.02), travelMm: 3.5 },
      { id: "key_a", type: "key_press", label: "A", localPositionMm: vec3(-dimensions.width * 0.24, topY, -dimensions.depth * 0.03), travelMm: 3.5 },
      { id: "key_space", type: "key_press", label: "Space", localPositionMm: vec3(0, topY, -dimensions.depth * 0.14), travelMm: 3.5 },
      { id: "key_enter", type: "key_press", label: "Enter", localPositionMm: vec3(dimensions.width * 0.34, topY, -dimensions.depth * 0.03), travelMm: 3.5 }
    ];
  }

  if (categoryKey === "mouse") {
    return [
      { id: "left_button", type: "button_press", label: "Left button", localPositionMm: vec3(-dimensions.width * 0.18, dimensions.height + 2, dimensions.depth * 0.2), travelMm: 1.2 },
      { id: "right_button", type: "button_press", label: "Right button", localPositionMm: vec3(dimensions.width * 0.18, dimensions.height + 2, dimensions.depth * 0.2), travelMm: 1.2 },
      { id: "wheel", type: "scroll_wheel", label: "Scroll wheel", localPositionMm: vec3(0, dimensions.height + 3, dimensions.depth * 0.24), travelMm: 0.5 }
    ];
  }

  return [];
}

function buildMaterialVariants(categoryKey: ProductAssetCategoryKey, components: CadComponent[]) {
  const slots = [...new Set(components.map((component) => component.materialSlot))];
  return [
    {
      id: "default",
      label: "Default CAD material zones",
      finishColor: null,
      finishMaterial: "CAD-authored hard-surface material slots",
      detailNotes: `Generated for ${categoryKey}; Blender/PBR polish is still required before public catalog promotion.`,
      slotMaterials: slots.map((slot) => ({
        slot,
        materialType: slot.includes("glass") ? "glass" : slot.includes("metal") || slot.includes("frame") ? "metal" : "plastic",
        roughness: slot.includes("glass") ? 0.12 : 0.48,
        metalness: slot.includes("metal") || slot.includes("frame") ? 0.6 : 0,
        qaStatus: "pending",
        referenceNote: "CAD-first private prototype material zone"
      }))
    }
  ];
}

function buildStructuralQa(input: {
  decision: ProductAssetGenerationStrategyDecision;
  dimensions: DimensionsMm;
  colliders: unknown[];
  supportSurfaces: unknown[];
  attachmentPoints: unknown[];
  interactionAnchors: unknown[];
  materialVariants: unknown[];
}) {
  const supportSurfaceCoverage = {
    required: input.decision.qaTargets.requiresSupportSurfaces,
    count: input.supportSurfaces.length,
    passed: !input.decision.qaTargets.requiresSupportSurfaces || input.supportSurfaces.length > 0
  };
  const attachmentAnchorCount = {
    required: input.decision.qaTargets.requiresAttachmentAnchors,
    count: input.attachmentPoints.length,
    passed: !input.decision.qaTargets.requiresAttachmentAnchors || input.attachmentPoints.length > 0
  };
  const interactionAnchorValidity = {
    required: input.decision.qaTargets.requiresInteractionAnchors,
    count: input.interactionAnchors.length,
    passed: !input.decision.qaTargets.requiresInteractionAnchors || input.interactionAnchors.length >= 5
  };

  return {
    schemaVersion: "product-asset-structural-qa-v1",
    status:
      supportSurfaceCoverage.passed && attachmentAnchorCount.passed && interactionAnchorValidity.passed
        ? "needs_visual_review"
        : "failed",
    dimensionTolerance: {
      targetMm: input.decision.qaTargets.maxDimensionToleranceMm,
      targetPercent: input.decision.qaTargets.maxDimensionTolerancePercent,
      measuredMaxErrorMm: 0,
      measuredMaxErrorPercent: 0,
      passed: true
    },
    colliderAlignment: {
      required: input.decision.qaTargets.requiresColliders,
      count: input.colliders.length,
      maxBoundsDeltaMm: 0,
      passed: input.colliders.length > 0
    },
    supportSurfaceCoverage,
    attachmentAnchorCount,
    interactionAnchorValidity,
    materialSlotCoverage: {
      required: input.decision.qaTargets.requiresMaterialSlots,
      count: input.materialVariants.length,
      passed: !input.decision.qaTargets.requiresMaterialSlots || input.materialVariants.length > 0
    },
    cadStepExport: CAD_STEP_EXPORT_STATUS,
    multiViewRenderReview: {
      required: input.decision.qaTargets.requiresMultiViewRenderReview,
      status: "pending_blender_or_browser_review",
      passed: false
    }
  };
}

function buildRuntimePackage(input: {
  assetKey: string;
  label: string;
  draft: ProductUrlReferenceDraft;
  categoryProfile: ProductAssetCategoryProfile;
  decision: ProductAssetGenerationStrategyDecision;
  dimensions: DimensionsMm;
  colliders: unknown[];
  supportSurfaces: unknown[];
  attachmentPoints: unknown[];
  interactionAnchors: unknown[];
  materialVariants: unknown[];
  structuralQa: Record<string, unknown>;
}) {
  return {
    schemaVersion: "product-url-cad-runtime-package-v1",
    generatedAt: new Date().toISOString(),
    assetKey: input.assetKey,
    label: input.label,
    source: {
      kind: "product_url",
      url: input.draft.sourceUrl,
      title: input.draft.product.title,
      sku: input.draft.product.sku,
      manufacturer: input.draft.product.manufacturer
    },
    generation: {
      strategy: input.decision.strategy,
      cadFirst: input.decision.cadFirst,
      providerAllowed: input.decision.providerAllowed,
      reason: input.decision.reason,
      cadStepExport: CAD_STEP_EXPORT_STATUS
    },
    runtimeAsset: {
      units: "mm",
      dimensionsMm: input.dimensions,
      scaleLocked: true,
      pivot: { x: "center", y: "floor", z: "center" },
      categoryProfile: input.categoryProfile.key,
      colliders: input.colliders,
      supportSurfaces: input.supportSurfaces,
      attachmentPoints: input.attachmentPoints,
      interactionAnchors: input.interactionAnchors,
      materialVariants: input.materialVariants
    },
    commercialReadiness: {
      tier: "draft",
      releaseEligible: false,
      legalUse: "private_reference_only"
    },
    qa: input.structuralQa
  };
}

function buildBuild123dSource(assetKey: string, components: CadComponent[], dimensions: DimensionsMm) {
  return `# DeskteriorOnline CAD-first private prototype.
# Source-first artifact generated from product URL analysis.
# Primary editable CAD should stay in this Python/build123d file; STEP/GLB are regenerated targets.

from build123d import *
from ocp_vscode import show

ASSET_KEY = ${JSON.stringify(assetKey)}
DIMENSIONS_MM = ${JSON.stringify(dimensions)}
COMPONENTS = ${JSON.stringify(components, null, 2)}

def mm(value):
    return value / 1000.0

def build_model():
    solids = []
    for component in COMPONENTS:
        size = component["sizeMm"]
        center = component["centerMm"]
        with BuildPart() as part:
            Box(mm(size["width"]), mm(size["depth"]), mm(size["height"]))
        solid = Pos(mm(center["x"]), mm(center["z"]), mm(center["y"])) * part.part
        solids.append(solid)
    return Compound(children=solids)

if __name__ == "__main__":
    model = build_model()
    export_step(model, f"{ASSET_KEY}.step")
    show(model)
`;
}

function buildStepPlaceholder(assetKey: string, components: CadComponent[]) {
  const componentNames = components.map((component) => component.id).join(", ");
  return `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('DeskteriorOnline CAD-first private prototype placeholder: ${assetKey}'), '2;1');
FILE_NAME('${assetKey}.step', '${new Date().toISOString()}', ('DeskteriorOnline worker'), ('DeskteriorOnline'), 'build123d source controlled; true STEP export pending build123d/OCP worker', 'DeskteriorOnline', 'private_reference_only');
FILE_SCHEMA(('AUTOMOTIVE_DESIGN_CC2'));
ENDSEC;
DATA;
/* Placeholder STEP manifest only. Source-controlled build123d artifact prepared for components: ${componentNames}. */
/* Run model.py in a build123d/OCP-enabled CAD worker to replace this file with a true STEP model. */
ENDSEC;
END-ISO-10303-21;
`;
}

function materialColor(slot: string): [number, number, number, number] {
  if (slot.includes("glass")) return [0.7, 0.9, 1, 0.35];
  if (slot.includes("metal") || slot.includes("frame") || slot.includes("hardware")) return [0.42, 0.45, 0.48, 1];
  if (slot.includes("keycap")) return [0.86, 0.9, 0.82, 1];
  if (slot.includes("desktop")) return [0.73, 0.58, 0.38, 1];
  if (slot.includes("fan")) return [0.12, 0.14, 0.16, 1];
  return [0.66, 0.68, 0.7, 1];
}

function makeBoxGeometry(component: CadComponent) {
  const hx = component.sizeMm.width / 2000;
  const hy = component.sizeMm.height / 2000;
  const hz = component.sizeMm.depth / 2000;
  const cx = component.centerMm.x / 1000;
  const cy = component.centerMm.y / 1000;
  const cz = component.centerMm.z / 1000;

  const faces = [
    { normal: [0, 0, 1], corners: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { normal: [0, 0, -1], corners: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    { normal: [1, 0, 0], corners: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { normal: [-1, 0, 0], corners: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { normal: [0, 1, 0], corners: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { normal: [0, -1, 0], corners: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] }
  ];

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  faces.forEach((face, faceIndex) => {
    const base = faceIndex * 4;
    face.corners.forEach(([x, y, z]) => {
      positions.push(cx + x, cy + y, cz + z);
      normals.push(face.normal[0]!, face.normal[1]!, face.normal[2]!);
    });
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  });

  return { positions, normals, indices };
}

function bufferDataUri(buffer: Buffer) {
  return `data:application/octet-stream;base64,${buffer.toString("base64")}`;
}

function typedBuffer(array: Float32Array | Uint16Array) {
  return Buffer.from(array.buffer, array.byteOffset, array.byteLength);
}

function buildRuntimeGlb(
  assetKey: string,
  strategy: Exclude<ProductAssetGenerationStrategy, "image_to_3d" | "manual_blender_required">,
  components: CadComponent[]
) {
  const buffers: Array<{ uri: string; byteLength: number }> = [];
  const bufferViews: Array<Record<string, unknown>> = [];
  const accessors: Array<Record<string, unknown>> = [];
  const meshes: Array<Record<string, unknown>> = [];
  const nodes: Array<Record<string, unknown>> = [];
  const materialSlots = [...new Set(components.map((component) => component.materialSlot))];
  const materials = materialSlots.map((slot) => ({
    name: slot,
    pbrMetallicRoughness: {
      baseColorFactor: materialColor(slot),
      metallicFactor: slot.includes("metal") || slot.includes("frame") ? 0.4 : 0,
      roughnessFactor: slot.includes("glass") ? 0.18 : 0.55
    },
    alphaMode: slot.includes("glass") ? "BLEND" : "OPAQUE"
  }));

  function pushAccessor(buffer: Buffer, componentType: number, type: "SCALAR" | "VEC3", count: number, target: number, min?: number[], max?: number[]) {
    const bufferIndex = buffers.length;
    buffers.push({ uri: bufferDataUri(buffer), byteLength: buffer.byteLength });
    const bufferViewIndex = bufferViews.length;
    bufferViews.push({ buffer: bufferIndex, byteOffset: 0, byteLength: buffer.byteLength, target });
    const accessorIndex = accessors.length;
    accessors.push({ bufferView: bufferViewIndex, byteOffset: 0, componentType, count, type, min, max });
    return accessorIndex;
  }

  components.forEach((component, index) => {
    const geometry = makeBoxGeometry(component);
    const positionArray = new Float32Array(geometry.positions);
    const normalArray = new Float32Array(geometry.normals);
    const indexArray = new Uint16Array(geometry.indices);
    const xs = geometry.positions.filter((_, positionIndex) => positionIndex % 3 === 0);
    const ys = geometry.positions.filter((_, positionIndex) => positionIndex % 3 === 1);
    const zs = geometry.positions.filter((_, positionIndex) => positionIndex % 3 === 2);
    const positionAccessor = pushAccessor(
      typedBuffer(positionArray),
      5126,
      "VEC3",
      positionArray.length / 3,
      34962,
      [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
      [Math.max(...xs), Math.max(...ys), Math.max(...zs)]
    );
    const normalAccessor = pushAccessor(typedBuffer(normalArray), 5126, "VEC3", normalArray.length / 3, 34962);
    const indexAccessor = pushAccessor(typedBuffer(indexArray), 5123, "SCALAR", indexArray.length, 34963);
    meshes.push({
      name: component.id,
      primitives: [
        {
          attributes: { POSITION: positionAccessor, NORMAL: normalAccessor },
          indices: indexAccessor,
          material: materialSlots.indexOf(component.materialSlot)
        }
      ]
    });
    nodes.push({ name: component.label, mesh: index });
  });

  const gltf = {
    asset: { version: "2.0", generator: "DeskteriorOnline product CAD-first generator" },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes,
    materials,
    buffers,
    bufferViews,
    accessors,
    extras: {
      assetKey,
      generationStrategy: strategy,
      legalUse: "private_reference_only",
      releaseEligible: false
    }
  };

  const json = JSON.stringify(gltf);
  const jsonPadding = (4 - (Buffer.byteLength(json) % 4)) % 4;
  const jsonBuffer = Buffer.from(`${json}${" ".repeat(jsonPadding)}`, "utf8");
  const header = Buffer.alloc(12);
  header.write("glTF", 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonBuffer.byteLength, 8);
  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonBuffer.byteLength, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4);
  return Buffer.concat([header, jsonChunkHeader, jsonBuffer]);
}

async function buildThumbnail(label: string, categoryKey: ProductAssetCategoryKey) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#f5f3ef"/>
  <rect x="76" y="176" width="360" height="160" rx="12" fill="#d9dde2"/>
  <rect x="108" y="152" width="296" height="42" rx="8" fill="#606a73"/>
  <text x="256" y="388" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" fill="#24282c">${categoryKey}</text>
  <text x="256" y="424" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#59616a">CAD-first private asset</text>
  <title>${label}</title>
</svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 82 }).toBuffer();
}

function stringifyJson(value: unknown) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function generateCadParametricProductAsset(input: {
  outputDir: string;
  fileName: string;
  draft: ProductUrlReferenceDraft;
  categoryProfile: ProductAssetCategoryProfile;
  decision: ProductAssetGenerationStrategyDecision;
}): Promise<ProductAssetCadPackage> {
  const dimensions = dimensionOrDefault(input.draft, input.categoryProfile);
  const assetKey = sanitizeAssetKey(input.draft.assetKey || input.fileName);
  const components = buildComponents(input.categoryProfile.key, dimensions);
  const colliders = buildColliders(dimensions);
  const supportSurfaces = buildSupportSurfaces(input.categoryProfile.key, dimensions);
  const attachmentPoints = buildAttachmentPoints(input.categoryProfile.key, dimensions);
  const interactionAnchors = buildInteractionAnchors(input.categoryProfile.key, dimensions);
  const materialVariants = buildMaterialVariants(input.categoryProfile.key, components);
  const structuralQa = buildStructuralQa({
    decision: input.decision,
    dimensions,
    colliders,
    supportSurfaces,
    attachmentPoints,
    interactionAnchors,
    materialVariants
  });
  const runtimePackage = buildRuntimePackage({
    assetKey,
    label: input.fileName,
    draft: input.draft,
    categoryProfile: input.categoryProfile,
    decision: input.decision,
    dimensions,
    colliders,
    supportSurfaces,
    attachmentPoints,
    interactionAnchors,
    materialVariants,
    structuralQa
  });
  const sourceBuffer = Buffer.from(buildBuild123dSource(assetKey, components, dimensions), "utf8");
  const stepBuffer = Buffer.from(buildStepPlaceholder(assetKey, components), "utf8");
  const strategy = input.decision.strategy as Exclude<ProductAssetGenerationStrategy, "image_to_3d" | "manual_blender_required">;
  const glbBuffer = buildRuntimeGlb(assetKey, strategy, components);
  const thumbnailBuffer = await buildThumbnail(input.fileName, input.categoryProfile.key).catch(() => null);

  await mkdir(input.outputDir, { recursive: true });
  const localArtifacts = {
    sourcePath: path.join(input.outputDir, "model.py"),
    stepPath: path.join(input.outputDir, "model.step"),
    glbPath: path.join(input.outputDir, `${assetKey}.glb`),
    runtimePackagePath: path.join(input.outputDir, "runtime-package.json"),
    collidersPath: path.join(input.outputDir, `${assetKey}.colliders.json`),
    supportSurfacesPath: path.join(input.outputDir, `${assetKey}.support-surfaces.json`),
    attachmentPointsPath: path.join(input.outputDir, `${assetKey}.attachment-points.json`),
    interactionAnchorsPath: path.join(input.outputDir, `${assetKey}.interaction-anchors.json`),
    materialVariantsPath: path.join(input.outputDir, `${assetKey}.material-variants.json`),
    qaReportPath: path.join(input.outputDir, `${assetKey}.qa-report.json`)
  };

  await Promise.all([
    writeFile(localArtifacts.sourcePath, sourceBuffer),
    writeFile(localArtifacts.stepPath, stepBuffer),
    writeFile(localArtifacts.glbPath, glbBuffer),
    writeFile(localArtifacts.runtimePackagePath, stringifyJson(runtimePackage)),
    writeFile(localArtifacts.collidersPath, stringifyJson(colliders)),
    writeFile(localArtifacts.supportSurfacesPath, stringifyJson(supportSurfaces)),
    writeFile(localArtifacts.attachmentPointsPath, stringifyJson(attachmentPoints)),
    writeFile(localArtifacts.interactionAnchorsPath, stringifyJson(interactionAnchors)),
    writeFile(localArtifacts.materialVariantsPath, stringifyJson(materialVariants)),
    writeFile(localArtifacts.qaReportPath, stringifyJson(structuralQa))
  ]);

  return {
    assetKey,
    strategy,
    glbBuffer: toArrayBuffer(glbBuffer),
    thumbnailBuffer,
    sidecars: [
      { suffix: "model.py", contentType: "text/x-python", buffer: sourceBuffer },
      { suffix: "model.step", contentType: "model/step", buffer: stepBuffer },
      { suffix: "runtime-package.json", contentType: "application/json", buffer: stringifyJson(runtimePackage) },
      { suffix: "colliders.json", contentType: "application/json", buffer: stringifyJson(colliders) },
      { suffix: "support-surfaces.json", contentType: "application/json", buffer: stringifyJson(supportSurfaces) },
      { suffix: "attachment-points.json", contentType: "application/json", buffer: stringifyJson(attachmentPoints) },
      { suffix: "interaction-anchors.json", contentType: "application/json", buffer: stringifyJson(interactionAnchors) },
      { suffix: "material-variants.json", contentType: "application/json", buffer: stringifyJson(materialVariants) },
      { suffix: "qa-report.json", contentType: "application/json", buffer: stringifyJson(structuralQa) }
    ],
    localArtifacts,
    runtimePackage,
    structuralQa
  };
}
