export type ProductAssetCategoryKey =
  | "desk"
  | "shelf"
  | "monitor_arm"
  | "cable_tray"
  | "monitor"
  | "speaker"
  | "keyboard"
  | "mouse"
  | "desk_mat"
  | "pc_case"
  | "psu"
  | "fan"
  | "radiator"
  | "gpu"
  | "motherboard"
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
  desk: {
    key: "desk",
    catalogCategory: "furniture",
    preferredPlacement: "floor",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "place_on_floor", compatibleSurfaces: ["floor"] },
      hardSurface: true,
      expectedSupportSurfaces: ["desktop_top", "desk_edge", "desk_underside"]
    },
    materialTargets: ["desktop slab", "leg or side-panel supports", "frame rails", "cable grommet or tray"],
    repairDirectives: [
      "preserve official tabletop footprint",
      "author desktop_top, desk_edge, and desk_underside support surfaces",
      "keep floor contact points aligned to collider bounds"
    ]
  },
  shelf: {
    key: "shelf",
    catalogCategory: "furniture",
    preferredPlacement: "floor",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "place_on_floor", compatibleSurfaces: ["floor"] },
      hardSurface: true,
      expectedSupportSurfaces: ["shelf_top"]
    },
    materialTargets: ["vertical panels", "shelf boards", "edge bands", "hardware"],
    repairDirectives: ["preserve rectangular shelf levels", "author usable shelf_top support surfaces"]
  },
  monitor_arm: {
    key: "monitor_arm",
    catalogCategory: "electronics",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "edge_clamp", compatibleSurfaces: ["desktop", "desk_edge"] },
      attachments: [{ type: "vesa_mount", patternMm: [75, 100], optional: false }],
      articulation: "monitor_arm"
    },
    materialTargets: ["desk clamp", "arm links", "hinge cylinders", "VESA plate"],
    repairDirectives: ["keep clamp and VESA plate separate", "preserve hinge axes for later articulation"]
  },
  cable_tray: {
    key: "cable_tray",
    catalogCategory: "utility",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "under_desk_mount", compatibleSurfaces: ["desk_underside"] },
      hardSurface: true
    },
    materialTargets: ["tray body", "mounting ears", "screw holes"],
    repairDirectives: ["preserve mounting hole spacing", "keep tray open volume clear"]
  },
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
  psu: {
    key: "psu",
    catalogCategory: "electronics",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "pc_case_psu_bay", compatibleSurfaces: ["psu_bay"] },
      expectedDetails: ["fan_grille", "iec_power_socket", "modular_ports"]
    },
    materialTargets: ["metal box shell", "fan grille", "power socket", "modular cable port panel"],
    repairDirectives: ["preserve PSU rectangular envelope", "keep cable port face identifiable"]
  },
  fan: {
    key: "fan",
    catalogCategory: "electronics",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "pc_case_fan_mount", compatibleSurfaces: ["fan_mount", "radiator_mount"] },
      expectedDetails: ["square frame", "circular hub", "mounting holes"]
    },
    materialTargets: ["fan frame", "hub", "blade ring", "mount holes"],
    repairDirectives: ["preserve 120mm/140mm mounting square", "keep airflow axis explicit"]
  },
  radiator: {
    key: "radiator",
    catalogCategory: "electronics",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "pc_case_radiator_mount", compatibleSurfaces: ["radiator_mount"] },
      expectedDetails: ["fin stack", "end tanks", "fan screw rails"]
    },
    materialTargets: ["fin stack", "end tanks", "screw rails"],
    repairDirectives: ["preserve radiator length and fan spacing", "keep tube ports identifiable"]
  },
  gpu: {
    key: "gpu",
    catalogCategory: "electronics",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "pcie_x16", compatibleSurfaces: ["motherboard_pcie_slot"] },
      expectedDetails: ["pcie_fingers", "cooler_shroud", "display_io_bracket"]
    },
    materialTargets: ["PCB edge", "cooler shroud", "fan discs", "I/O bracket"],
    repairDirectives: ["use CAD proxy for envelope and slots", "defer brand shroud fidelity to Blender/manual pass"]
  },
  motherboard: {
    key: "motherboard",
    catalogCategory: "electronics",
    preferredPlacement: "desktop",
    scaleLocked: true,
    runtimeMetadata: {
      support: { preferredAttachment: "pc_case_motherboard_tray", compatibleSurfaces: ["motherboard_tray"] },
      expectedDetails: ["standoff holes", "CPU socket", "DIMM slots", "M.2 slots", "PCIe slots"]
    },
    materialTargets: ["PCB plane", "CPU socket", "DIMM slots", "PCIe slots", "I/O block"],
    repairDirectives: ["model board envelope and major connector blocks only", "move fine silkscreen/detail to decals or textures"]
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
  if (/monitor\s*arm|모니터\s*암|vesa\s*arm|arm\s*mount/.test(evidence)) return "monitor_arm";
  if (/cable\s*tray|wire\s*tray|케이블\s*트레이|선정리\s*트레이/.test(evidence)) return "cable_tray";
  if (/desk\s*mat|deskmat|매트|synchronize/.test(evidence)) return "desk_mat";
  if (/motherboard|mainboard|메인보드|b650|x670|z790|matx|atx\s*board/.test(evidence)) return "motherboard";
  if (/graphics\s*card|gpu|rtx|radeon|geforce|그래픽카드|그래픽\s*카드/.test(evidence)) return "gpu";
  if (/power\s*supply|psu|파워서플라이|파워\s*서플라이/.test(evidence)) return "psu";
  if (/\b\d{2,3}\s*mm\s*(?:aio\s*)?radiator|radiator(?!\s*mount)|라디에이터|수랭|aio/.test(evidence)) return "radiator";
  if (/\b\d{2,3}\s*mm\s*fan|쿨링팬|케이스\s*팬|시스템\s*팬|case\s*fan|uni\s*fan/.test(evidence)) return "fan";
  if (/pc\s*case|computer\s*case|tower\s*case|chassis|hyte|y70|케이스/.test(evidence)) return "pc_case";
  if (/\bfan\b(?!\s*mount)/.test(evidence)) return "fan";
  if (/monitor|display|screen|모니터|디스플레이|s32|tfg|cpm/.test(evidence)) return "monitor";
  if (/speaker|스피커|reproducer|epic|gravastar|mars/.test(evidence)) return "speaker";
  if (/keyboard|키보드|hatsu|angry\s*miao/.test(evidence)) return "keyboard";
  if (/mouse|마우스|cobra|razer/.test(evidence)) return "mouse";
  if (/audio\s*interface|minifuse|arturia|오디오/.test(evidence)) return "audio_interface";
  if (/lamp|light|lighting|ceiling|hue|조명|방등|인퓨즈/.test(evidence)) return "lighting";
  if (/plant|planter|화분|ivy/.test(evidence)) return "plant";
  if (/desk|table|책상|데스크|fursys|퍼시스/.test(evidence)) return "desk";
  if (/shelf|rack|선반|수납장/.test(evidence)) return "shelf";
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
