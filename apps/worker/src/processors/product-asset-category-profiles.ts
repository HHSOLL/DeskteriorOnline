export type ProductAssetCategoryKey =
  | "monitor"
  | "speaker"
  | "keyboard"
  | "mouse"
  | "desk_mat"
  | "pc_case"
  | "audio_interface"
  | "lighting"
  | "plant"
  | "furniture"
  | "decor"
  | "generic";

export type ProductAssetCategoryProfile = {
  key: ProductAssetCategoryKey;
  catalogCategory: string;
  preferredPlacement: "floor" | "desktop" | "wall" | "ceiling" | "surface";
  scaleLocked: boolean;
  runtimeMetadata: Record<string, unknown>;
  materialTargets: string[];
  repairDirectives: string[];
};

const PROFILES: Record<ProductAssetCategoryKey, ProductAssetCategoryProfile> = {
  monitor: {
    key: "monitor",
    catalogCategory: "electronics",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "place_on_surface", compatibleSurfaces: ["desktop", "shelf_top"] },
      attachments: [{ type: "vesa_mount", patternMm: [75, 100], optional: true }]
    },
    materialTargets: ["black glass screen", "separate bezel", "plastic or metal rear shell", "stand or VESA interface"],
    repairDirectives: ["preserve thin screen slab", "separate screen material from bezel", "keep stand centered"]
  },
  speaker: {
    key: "speaker",
    catalogCategory: "electronics",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "place_on_surface", compatibleSurfaces: ["desktop", "shelf_top"] },
      acousticFront: { expectedDetails: ["woofer", "tweeter", "front_baffle"] }
    },
    materialTargets: ["cabinet finish", "black front baffle", "woofer rubber", "tweeter dome", "feet or spikes"],
    repairDirectives: ["front face must remain visually identifiable", "keep circular drivers visible"]
  },
  keyboard: {
    key: "keyboard",
    catalogCategory: "utility",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "place_on_surface", compatibleSurfaces: ["desktop", "shelf_top"] },
      footprintPriority: "high"
    },
    materialTargets: ["base shell", "individual key clusters", "rubber feet"],
    repairDirectives: ["preserve low profile footprint", "avoid fused key plane when reference shows separated keys"]
  },
  mouse: {
    key: "mouse",
    catalogCategory: "utility",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "place_on_surface", compatibleSurfaces: ["desktop", "desk_mat", "shelf_top"] },
      footprintPriority: "high"
    },
    materialTargets: ["top shell", "side grip", "scroll wheel", "glide feet"],
    repairDirectives: ["preserve asymmetric ergonomic silhouette if present", "keep wheel and button grooves visible"]
  },
  desk_mat: {
    key: "desk_mat",
    catalogCategory: "utility",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "place_on_surface", compatibleSurfaces: ["desktop"] },
      thinSurface: true
    },
    materialTargets: ["woven fabric top", "stitched edge", "rubber underside"],
    repairDirectives: ["preserve exact rectangular footprint", "keep thickness low", "avoid inflated soft geometry"]
  },
  pc_case: {
    key: "pc_case",
    catalogCategory: "electronics",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "place_on_surface", compatibleSurfaces: ["desktop", "floor"] },
      expectedDetails: ["glass_panel", "case_frame", "fan_stack"]
    },
    materialTargets: ["painted metal frame", "tempered glass", "RGB fans", "internal hardware planes"],
    repairDirectives: ["keep transparent glass panels separated", "do not collapse case into a solid cube"]
  },
  audio_interface: {
    key: "audio_interface",
    catalogCategory: "electronics",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "place_on_surface", compatibleSurfaces: ["desktop", "shelf_top"] },
      expectedDetails: ["front_ports", "control_knobs"]
    },
    materialTargets: ["metal faceplate", "black knobs", "input ports", "printed labels"],
    repairDirectives: ["front control face must be visible", "preserve shallow rectangular form"]
  },
  lighting: {
    key: "lighting",
    catalogCategory: "lighting",
    preferredPlacement: "ceiling",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "ceiling_attach", compatibleSurfaces: ["ceiling"] },
      lightEmitter: { type: "area", enabledByDefault: true }
    },
    materialTargets: ["diffuser", "metal or plastic trim", "emissive panel"],
    repairDirectives: ["separate diffuser from housing", "preserve shallow ceiling-mounted silhouette"]
  },
  plant: {
    key: "plant",
    catalogCategory: "plants",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "place_on_surface", compatibleSurfaces: ["desktop", "shelf_top"] }
    },
    materialTargets: ["pot", "leaf clusters", "soil or inner insert"],
    repairDirectives: ["keep pot and foliage separate", "avoid single blob foliage"]
  },
  furniture: {
    key: "furniture",
    catalogCategory: "furniture",
    preferredPlacement: "floor",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "place_on_floor", compatibleSurfaces: ["floor"] },
      footprintPriority: "high"
    },
    materialTargets: ["primary body", "legs or panels", "hardware", "edge bands"],
    repairDirectives: ["preserve official footprint", "keep support contact points on floor"]
  },
  decor: {
    key: "decor",
    catalogCategory: "decor",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "place_on_surface", compatibleSurfaces: ["desktop", "shelf_top"] }
    },
    materialTargets: ["primary shell", "detail accents"],
    repairDirectives: ["preserve recognizable silhouette", "separate high-contrast detail areas"]
  },
  generic: {
    key: "generic",
    catalogCategory: "custom",
    preferredPlacement: "surface",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "place_on_surface", compatibleSurfaces: ["desktop", "shelf_top", "floor"] }
    },
    materialTargets: ["primary material zones", "visible controls or detail accents"],
    repairDirectives: ["preserve product silhouette", "align pivot to floor center"]
  }
};

function matchEvidence(evidence: string): ProductAssetCategoryKey {
  if (/monitor|display|screen|모니터|디스플레이|s32|tfg|cpm/.test(evidence)) return "monitor";
  if (/speaker|스피커|reproducer|epic|gravastar|mars/.test(evidence)) return "speaker";
  if (/keyboard|키보드|hatsu|angry\s*miao/.test(evidence)) return "keyboard";
  if (/mouse|마우스|cobra|razer/.test(evidence)) return "mouse";
  if (/mat|desk\s*mat|deskmat|매트|synchronize/.test(evidence)) return "desk_mat";
  if (/pc\s*case|case|hyte|y70|케이스/.test(evidence)) return "pc_case";
  if (/audio\s*interface|minifuse|arturia|오디오/.test(evidence)) return "audio_interface";
  if (/lamp|light|lighting|ceiling|hue|조명|방등|인퓨즈/.test(evidence)) return "lighting";
  if (/plant|planter|화분|ivy/.test(evidence)) return "plant";
  if (/desk|table|chair|shelf|책상|의자|선반|fursys|퍼시스/.test(evidence)) return "furniture";
  if (/figure|clock|diecast|spacecraft|cat|spray|switch|피규어|시계/.test(evidence)) return "decor";
  return "generic";
}

export function resolveProductAssetCategoryProfile(input: {
  title?: string | null;
  sku?: string | null;
  manufacturer?: string | null;
  categoryHint?: string | null;
}) {
  const evidence = [input.categoryHint, input.title, input.sku, input.manufacturer].filter(Boolean).join(" ").toLowerCase();
  return PROFILES[matchEvidence(evidence)];
}
