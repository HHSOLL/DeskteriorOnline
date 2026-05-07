export type RuntimeTextureSet = {
  map: string;
  roughnessMap: string;
  normalMap: string;
  bumpMap: string;
};

export type RoomShellTextureSourceResolution = "1k" | "2k" | "4k" | "unknown";
export type RoomShellTextureQualityTier = "commercial_pbr" | "generic_candidate";
export type RoomShellTextureSourceKind = "reference_pbr" | "generic_ai_candidate";
export type RoomShellTextureUseCategory = "commercial_default" | "commercial_option" | "special_industrial";

export type RoomShellTexturePreset = RuntimeTextureSet & {
  id: string;
  name: string;
  category: string;
  useCategory: RoomShellTextureUseCategory;
  topColor: string;
  color?: string;
  roughness: number;
  bumpScale: number;
  normalScale: number;
  envMapIntensity?: number;
  previewThumbnail: string;
  repeatScaleMeters: readonly [number, number];
  rotationRadians: number;
  sourceResolution: RoomShellTextureSourceResolution;
  qualityTier: RoomShellTextureQualityTier;
  sourceKind: RoomShellTextureSourceKind;
  requiresKtx2Runtime: boolean;
  fallbackMaxResolution: "1k";
};

type RoomShellTexturePresetDefinition = RuntimeTextureSet & {
  id?: string;
  name?: string;
  category?: string;
  useCategory?: RoomShellTextureUseCategory;
  topColor: string;
  color?: string;
  roughness: number;
  bumpScale: number;
  normalScale: number;
  envMapIntensity?: number;
  previewThumbnail?: string;
  repeatScaleMeters: readonly [number, number];
  rotationRadians?: number;
  sourceResolution?: RoomShellTextureSourceResolution;
  qualityTier?: RoomShellTextureQualityTier;
  sourceKind?: RoomShellTextureSourceKind;
};

export type RuntimeTextureEncodeTarget = {
  inputPath: string;
  outputPath: string;
  transfer: "srgb" | "linear";
  usage:
    | "base-color"
    | "roughness"
    | "normal"
    | "bump";
};

function defineRoomShellTexturePreset(preset: RoomShellTexturePresetDefinition): RoomShellTexturePreset {
  const sourceKind = preset.sourceKind ?? (preset.map.includes("/ai_") ? "generic_ai_candidate" : "reference_pbr");
  const sourceResolution = preset.sourceResolution ?? inferTextureSourceResolution(preset.map);
  const qualityTier =
    preset.qualityTier ?? (sourceKind === "generic_ai_candidate" ? "generic_candidate" : "commercial_pbr");
  const id = preset.id ?? deriveTexturePresetId(preset.map);

  return {
    ...preset,
    id,
    name: preset.name ?? humanizeTexturePresetId(id),
    category: preset.category ?? "Special",
    useCategory: preset.useCategory ?? "commercial_option",
    previewThumbnail: preset.previewThumbnail ?? preset.map,
    rotationRadians: preset.rotationRadians ?? 0,
    sourceResolution,
    qualityTier,
    sourceKind,
    requiresKtx2Runtime: qualityTier === "commercial_pbr",
    fallbackMaxResolution: "1k"
  };
}

function deriveTexturePresetId(pathValue: string) {
  const filename = pathValue.split("/").pop() ?? "room-shell-texture";
  return filename
    .replace(/\.(png|jpg|jpeg|webp)$/i, "")
    .replace(/_(diff|basecolor|base_color)_(1k|2k|4k)$/i, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function humanizeTexturePresetId(id: string) {
  return id
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function inferTextureSourceResolution(pathValue: string): RoomShellTextureSourceResolution {
  if (/_4k\b/i.test(pathValue)) {
    return "4k";
  }
  if (/_2k\b/i.test(pathValue)) {
    return "2k";
  }
  if (/_1k\b/i.test(pathValue)) {
    return "1k";
  }
  return "unknown";
}

function toKtx2Path(path: string) {
  return path.replace(/\.(png|jpg|jpeg|webp)$/i, ".ktx2");
}

function dedupeTargets(targets: RuntimeTextureEncodeTarget[]) {
  const seen = new Set<string>();
  return targets.filter((target) => {
    if (seen.has(target.inputPath)) {
      return false;
    }
    seen.add(target.inputPath);
    return true;
  });
}

export const ROOM_SHELL_KTX2_ENABLED = process.env.NEXT_PUBLIC_ENABLE_KTX2_TEXTURES === "1";
export const MAX_COMMERCIAL_WALL_TEXTURE_PRESETS = 12;
export const MAX_COMMERCIAL_FLOOR_TEXTURE_PRESETS = 12;

export const WALL_TEXTURE_PRESETS: RoomShellTexturePreset[] = [
  defineRoomShellTexturePreset({
    id: "matte-white-paint",
    name: "Matte White Paint",
    category: "Clean Paint",
    useCategory: "commercial_default",
    topColor: "#f1eee8",
    map: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_rough_2k.jpg",
    normalMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_disp_2k.png",
    bumpMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_disp_2k.png",
    color: "#f2efe8",
    roughness: 0.9,
    bumpScale: 0.008,
    normalScale: 0.18,
    envMapIntensity: 0.42,
    previewThumbnail: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_diff_2k.jpg",
    repeatScaleMeters: [2.4, 2.4]
  }),
  defineRoomShellTexturePreset({
    id: "warm-white-paint",
    name: "Warm White Paint",
    category: "Clean Paint",
    useCategory: "commercial_default",
    topColor: "#dfddd7",
    map: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_diff_2k.jpg",
    roughnessMap: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
    normalMap: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
    bumpMap: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
    color: "#eee9df",
    roughness: 0.82,
    bumpScale: 0.012,
    normalScale: 0.3,
    envMapIntensity: 0.4,
    repeatScaleMeters: [2.2, 2.2]
  }),
  defineRoomShellTexturePreset({
    id: "beige-plaster",
    name: "Beige Plaster",
    category: "Clean Plaster",
    useCategory: "commercial_default",
    topColor: "#ded4c3",
    map: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_rough_2k.jpg",
    normalMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_disp_2k.png",
    bumpMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_disp_2k.png",
    color: "#e2d6c4",
    roughness: 0.88,
    bumpScale: 0.008,
    normalScale: 0.18,
    envMapIntensity: 0.38,
    repeatScaleMeters: [2.4, 2.4]
  }),
  defineRoomShellTexturePreset({
    id: "light-grey-plaster",
    name: "Light Grey Plaster",
    category: "Clean Paint",
    useCategory: "commercial_default",
    topColor: "#c8c7c2",
    map: "/assets/textures/grey_plaster_02/grey_plaster_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/grey_plaster_02/grey_plaster_02_rough_2k.jpg",
    normalMap: "/assets/textures/grey_plaster_02/grey_plaster_02_disp_2k.jpg",
    bumpMap: "/assets/textures/grey_plaster_02/grey_plaster_02_disp_2k.jpg",
    color: "#dad7d1",
    roughness: 0.82,
    bumpScale: 0.012,
    normalScale: 0.26,
    envMapIntensity: 0.42,
    repeatScaleMeters: [2.5, 2.5]
  }),
  defineRoomShellTexturePreset({
    id: "greige-clean-plaster",
    name: "Greige Clean Plaster",
    category: "Clean Plaster",
    useCategory: "commercial_default",
    topColor: "#d4d0c7",
    map: "/assets/textures/grey_plaster_02/grey_plaster_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/grey_plaster_02/grey_plaster_02_rough_2k.jpg",
    normalMap: "/assets/textures/grey_plaster_02/grey_plaster_02_disp_2k.jpg",
    bumpMap: "/assets/textures/grey_plaster_02/grey_plaster_02_disp_2k.jpg",
    color: "#d9d3c9",
    roughness: 0.86,
    bumpScale: 0.01,
    normalScale: 0.22,
    envMapIntensity: 0.38,
    repeatScaleMeters: [2.5, 2.5]
  }),
  defineRoomShellTexturePreset({
    id: "light-oak-wall-panel",
    name: "Light Oak Wall Panel",
    category: "Wood Panel",
    useCategory: "commercial_option",
    topColor: "#b08a62",
    map: "/assets/textures/oak_veneer_01/oak_veneer_01_diff_2k.jpg",
    roughnessMap: "/assets/textures/oak_veneer_01/oak_veneer_01_rough_2k.jpg",
    normalMap: "/assets/textures/oak_veneer_01/oak_veneer_01_disp_2k.jpg",
    bumpMap: "/assets/textures/oak_veneer_01/oak_veneer_01_disp_2k.jpg",
    color: "#c89c72",
    roughness: 0.66,
    bumpScale: 0.01,
    normalScale: 0.24,
    envMapIntensity: 0.5,
    repeatScaleMeters: [1.2, 2.4],
    rotationRadians: Math.PI / 2
  }),
  defineRoomShellTexturePreset({
    id: "walnut-accent-wall",
    name: "Walnut Accent Wall",
    category: "Wood Panel",
    useCategory: "commercial_option",
    topColor: "#8f6c52",
    map: "/assets/textures/kitchen_wood/kitchen_wood_diff_2k.jpg",
    roughnessMap: "/assets/textures/kitchen_wood/kitchen_wood_rough_2k.jpg",
    normalMap: "/assets/textures/kitchen_wood/kitchen_wood_disp_2k.jpg",
    bumpMap: "/assets/textures/kitchen_wood/kitchen_wood_disp_2k.jpg",
    color: "#9f7755",
    roughness: 0.62,
    bumpScale: 0.01,
    normalScale: 0.22,
    envMapIntensity: 0.46,
    repeatScaleMeters: [1.6, 2.6],
    rotationRadians: Math.PI / 2
  }),
  defineRoomShellTexturePreset({
    id: "warm-wood-slat-panel",
    name: "Warm Wood Slat Panel",
    category: "Acoustic Panel",
    useCategory: "commercial_option",
    topColor: "#7d7268",
    map: "/assets/textures/wood_table_worn/wood_table_worn_diff_2k.jpg",
    roughnessMap: "/assets/textures/wood_table_worn/wood_table_worn_rough_2k.jpg",
    normalMap: "/assets/textures/wood_table_worn/wood_table_worn_disp_2k.jpg",
    bumpMap: "/assets/textures/wood_table_worn/wood_table_worn_disp_2k.jpg",
    color: "#a48768",
    roughness: 0.68,
    bumpScale: 0.01,
    normalScale: 0.22,
    envMapIntensity: 0.44,
    repeatScaleMeters: [1.4, 2.2],
    rotationRadians: Math.PI / 2
  }),
  defineRoomShellTexturePreset({
    id: "acoustic-felt-panel",
    name: "Acoustic Felt Panel",
    category: "Acoustic Panel",
    useCategory: "commercial_option",
    topColor: "#7f7770",
    map: "/assets/textures/fabric_leather_01/fabric_leather_01_diff_2k.jpg",
    roughnessMap: "/assets/textures/fabric_leather_01/fabric_leather_01_rough_2k.jpg",
    normalMap: "/assets/textures/fabric_leather_01/fabric_leather_01_disp_2k.jpg",
    bumpMap: "/assets/textures/fabric_leather_01/fabric_leather_01_disp_2k.jpg",
    color: "#9d9388",
    roughness: 0.78,
    bumpScale: 0.008,
    normalScale: 0.18,
    envMapIntensity: 0.36,
    repeatScaleMeters: [1.25, 1.25]
  }),
  defineRoomShellTexturePreset({
    id: "subtle-terrazzo-wall-tile",
    name: "Subtle Terrazzo Wall Tile",
    category: "Special / Tile",
    useCategory: "commercial_option",
    topColor: "#c6c2b7",
    map: "/assets/textures/terrazzo_tiles/terrazzo_tiles_diff_2k.jpg",
    roughnessMap: "/assets/textures/terrazzo_tiles/terrazzo_tiles_rough_2k.jpg",
    normalMap: "/assets/textures/terrazzo_tiles/terrazzo_tiles_disp_2k.jpg",
    bumpMap: "/assets/textures/terrazzo_tiles/terrazzo_tiles_disp_2k.jpg",
    color: "#ddd7cc",
    roughness: 0.64,
    bumpScale: 0.006,
    normalScale: 0.16,
    envMapIntensity: 0.42,
    repeatScaleMeters: [1.8, 1.8]
  })
];

export const FLOOR_TEXTURE_PRESETS: RoomShellTexturePreset[] = [
  defineRoomShellTexturePreset({
    id: "light-oak-boards",
    name: "Light Oak Boards",
    category: "Wood",
    useCategory: "commercial_default",
    topColor: "#9f7b58",
    map: "/assets/textures/wood_floor/wood_floor_diff_2k.jpg",
    roughnessMap: "/assets/textures/wood_floor/wood_floor_rough_2k.jpg",
    normalMap: "/assets/textures/wood_floor/wood_floor_disp_2k.jpg",
    bumpMap: "/assets/textures/wood_floor/wood_floor_disp_2k.jpg",
    roughness: 0.64,
    bumpScale: 0.012,
    normalScale: 0.3,
    previewThumbnail: "/assets/textures/wood_floor/wood_floor_diff_2k.jpg",
    repeatScaleMeters: [2.4, 2.4]
  }),
  defineRoomShellTexturePreset({
    id: "grey-concrete-floor",
    name: "Grey Concrete Floor",
    category: "Concrete",
    useCategory: "commercial_option",
    topColor: "#8f8479",
    map: "/assets/textures/concrete_floor_worn_001_2k.blend/textures/concrete_floor_worn_001_diff_2k.jpg",
    roughnessMap: "/assets/textures/concrete_floor_worn_001_2k.blend/textures/concrete_floor_worn_001_rough_2k.jpg",
    normalMap: "/assets/textures/concrete_floor_worn_001_2k.blend/textures/concrete_floor_worn_001_disp_2k.png",
    bumpMap: "/assets/textures/concrete_floor_worn_001_2k.blend/textures/concrete_floor_worn_001_disp_2k.png",
    roughness: 0.9,
    bumpScale: 0.015,
    normalScale: 0.35,
    repeatScaleMeters: [2.8, 2.8]
  }),
  defineRoomShellTexturePreset({
    id: "beige-stone-tile",
    name: "Beige Stone Tile",
    category: "Tile",
    useCategory: "commercial_default",
    topColor: "#cbc4ba",
    map: "/assets/textures/marble_01_2k.blend/textures/marble_01_diff_2k.jpg",
    roughnessMap: "/assets/textures/marble_01_2k.blend/textures/marble_01_rough_2k.jpg",
    normalMap: "/assets/textures/marble_01_2k.blend/textures/marble_01_disp_2k.png",
    bumpMap: "/assets/textures/marble_01_2k.blend/textures/marble_01_disp_2k.png",
    roughness: 0.5,
    bumpScale: 0.01,
    normalScale: 0.3,
    repeatScaleMeters: [2.4, 2.4],
    rotationRadians: Math.PI / 2
  }),
  defineRoomShellTexturePreset({
    id: "warm-laminate",
    name: "Warm Laminate",
    category: "Wood",
    useCategory: "commercial_default",
    topColor: "#b89e7e",
    map: "/assets/textures/laminate_floor_02/laminate_floor_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/laminate_floor_02/laminate_floor_02_rough_2k.jpg",
    normalMap: "/assets/textures/laminate_floor_02/laminate_floor_02_disp_2k.jpg",
    bumpMap: "/assets/textures/laminate_floor_02/laminate_floor_02_disp_2k.jpg",
    roughness: 0.62,
    bumpScale: 0.011,
    normalScale: 0.28,
    repeatScaleMeters: [2.2, 2.2]
  }),
  defineRoomShellTexturePreset({
    id: "natural-oak-boards",
    name: "Natural Oak Boards",
    category: "Wood",
    useCategory: "commercial_default",
    topColor: "#9f7b58",
    map: "/assets/textures/wood_floor/wood_floor_diff_2k.jpg",
    roughnessMap: "/assets/textures/wood_floor/wood_floor_rough_2k.jpg",
    normalMap: "/assets/textures/wood_floor/wood_floor_disp_2k.jpg",
    bumpMap: "/assets/textures/wood_floor/wood_floor_disp_2k.jpg",
    roughness: 0.64,
    bumpScale: 0.012,
    normalScale: 0.3,
    repeatScaleMeters: [2.4, 2.4]
  }),
  defineRoomShellTexturePreset({
    id: "warm-resilient-floor",
    name: "Warm Resilient Floor",
    category: "Resilient",
    useCategory: "commercial_option",
    topColor: "#8b6543",
    map: "/assets/textures/linoleum_brown/linoleum_brown_diff_2k.jpg",
    roughnessMap: "/assets/textures/linoleum_brown/linoleum_brown_rough_2k.jpg",
    normalMap: "/assets/textures/linoleum_brown/linoleum_brown_disp_2k.jpg",
    bumpMap: "/assets/textures/linoleum_brown/linoleum_brown_disp_2k.jpg",
    roughness: 0.76,
    bumpScale: 0.008,
    normalScale: 0.2,
    repeatScaleMeters: [2, 2]
  }),
  defineRoomShellTexturePreset({
    id: "subtle-terrazzo-floor",
    name: "Subtle Terrazzo Floor",
    category: "Tile",
    useCategory: "commercial_default",
    topColor: "#d7d0c5",
    map: "/assets/textures/terrazzo_tiles/terrazzo_tiles_diff_2k.jpg",
    roughnessMap: "/assets/textures/terrazzo_tiles/terrazzo_tiles_rough_2k.jpg",
    normalMap: "/assets/textures/terrazzo_tiles/terrazzo_tiles_disp_2k.jpg",
    bumpMap: "/assets/textures/terrazzo_tiles/terrazzo_tiles_disp_2k.jpg",
    roughness: 0.56,
    bumpScale: 0.006,
    normalScale: 0.16,
    repeatScaleMeters: [1.8, 1.8]
  }),
  defineRoomShellTexturePreset({
    id: "office-rubber-tile",
    name: "Office Rubber Tile",
    category: "Special / Office",
    useCategory: "commercial_option",
    topColor: "#adb0b2",
    map: "/assets/textures/anti_skid_tiles/anti_skid_tiles_diff_2k.jpg",
    roughnessMap: "/assets/textures/anti_skid_tiles/anti_skid_tiles_rough_2k.jpg",
    normalMap: "/assets/textures/anti_skid_tiles/anti_skid_tiles_disp_2k.jpg",
    bumpMap: "/assets/textures/anti_skid_tiles/anti_skid_tiles_disp_2k.jpg",
    roughness: 0.78,
    bumpScale: 0.008,
    normalScale: 0.2,
    repeatScaleMeters: [1.4, 1.4]
  }),
  defineRoomShellTexturePreset({
    id: "textured-dark-carpet",
    name: "Textured Dark Carpet",
    category: "Special / Carpet",
    useCategory: "special_industrial",
    topColor: "#6f6258",
    map: "/assets/textures/dirty_carpet/dirty_carpet_diff_2k.jpg",
    roughnessMap: "/assets/textures/dirty_carpet/dirty_carpet_rough_2k.jpg",
    normalMap: "/assets/textures/dirty_carpet/dirty_carpet_disp_2k.jpg",
    bumpMap: "/assets/textures/dirty_carpet/dirty_carpet_disp_2k.jpg",
    roughness: 0.9,
    bumpScale: 0.012,
    normalScale: 0.24,
    repeatScaleMeters: [2.1, 2.1]
  }),
  defineRoomShellTexturePreset({
    id: "soft-polished-concrete",
    name: "Soft Polished Concrete",
    category: "Concrete",
    useCategory: "commercial_option",
    topColor: "#8d8880",
    map: "/assets/textures/concrete_layers_02/concrete_layers_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/concrete_layers_02/concrete_layers_02_rough_2k.jpg",
    normalMap: "/assets/textures/concrete_layers_02/concrete_layers_02_disp_2k.jpg",
    bumpMap: "/assets/textures/concrete_layers_02/concrete_layers_02_disp_2k.jpg",
    roughness: 0.86,
    bumpScale: 0.012,
    normalScale: 0.26,
    repeatScaleMeters: [2.8, 2.8]
  }),
  defineRoomShellTexturePreset({
    id: "walnut-boards",
    name: "Walnut Boards",
    category: "Wood",
    useCategory: "commercial_option",
    topColor: "#a27d5f",
    map: "/assets/textures/wood_table_worn/wood_table_worn_diff_2k.jpg",
    roughnessMap: "/assets/textures/wood_table_worn/wood_table_worn_rough_2k.jpg",
    normalMap: "/assets/textures/wood_table_worn/wood_table_worn_disp_2k.jpg",
    bumpMap: "/assets/textures/wood_table_worn/wood_table_worn_disp_2k.jpg",
    roughness: 0.68,
    bumpScale: 0.01,
    normalScale: 0.24,
    repeatScaleMeters: [2.2, 2.2],
    rotationRadians: Math.PI / 2
  })
];

export const CEILING_TEXTURE_PRESETS: RoomShellTexturePreset[] = [
  defineRoomShellTexturePreset({
    topColor: "#f1eee8",
    map: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_rough_2k.jpg",
    normalMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_disp_2k.png",
    bumpMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_disp_2k.png",
    color: "#f2efe8",
    roughness: 0.9,
    bumpScale: 0.008,
    normalScale: 0.18,
    envMapIntensity: 0.34,
    repeatScaleMeters: [2.4, 2.4]
  }),
  defineRoomShellTexturePreset({
    topColor: "#dedbd5",
    map: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_diff_2k.jpg",
    roughnessMap: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
    normalMap: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
    bumpMap: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
    color: "#e6e2da",
    roughness: 0.88,
    bumpScale: 0.007,
    normalScale: 0.16,
    envMapIntensity: 0.3,
    repeatScaleMeters: [2.2, 2.2]
  }),
  defineRoomShellTexturePreset({
    topColor: "#d2cec6",
    map: "/assets/textures/grey_plaster_02/grey_plaster_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/grey_plaster_02/grey_plaster_02_rough_2k.jpg",
    normalMap: "/assets/textures/grey_plaster_02/grey_plaster_02_disp_2k.jpg",
    bumpMap: "/assets/textures/grey_plaster_02/grey_plaster_02_disp_2k.jpg",
    color: "#dedbd2",
    roughness: 0.9,
    bumpScale: 0.008,
    normalScale: 0.16,
    envMapIntensity: 0.28,
    repeatScaleMeters: [2.5, 2.5]
  }),
  defineRoomShellTexturePreset({
    topColor: "#9f9a94",
    map: "/assets/textures/concrete_layers_02/concrete_layers_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/concrete_layers_02/concrete_layers_02_rough_2k.jpg",
    normalMap: "/assets/textures/concrete_layers_02/concrete_layers_02_disp_2k.jpg",
    bumpMap: "/assets/textures/concrete_layers_02/concrete_layers_02_disp_2k.jpg",
    color: "#c9c4bd",
    roughness: 0.92,
    bumpScale: 0.009,
    normalScale: 0.18,
    envMapIntensity: 0.24,
    repeatScaleMeters: [2.8, 2.8]
  })
];

export function resolveRuntimeTextureSet(textureSet: RuntimeTextureSet): RuntimeTextureSet {
  if (!ROOM_SHELL_KTX2_ENABLED) {
    return textureSet;
  }

  return {
    map: toKtx2Path(textureSet.map),
    roughnessMap: toKtx2Path(textureSet.roughnessMap),
    normalMap: toKtx2Path(textureSet.normalMap),
    bumpMap: toKtx2Path(textureSet.bumpMap)
  };
}

export function getRoomShellTextureEncodeTargets() {
  const targets: RuntimeTextureEncodeTarget[] = [];
  const presets = [...WALL_TEXTURE_PRESETS, ...FLOOR_TEXTURE_PRESETS, ...CEILING_TEXTURE_PRESETS];

  presets.forEach((preset) => {
    targets.push(
      {
        inputPath: preset.map,
        outputPath: toKtx2Path(preset.map),
        transfer: "srgb",
        usage: "base-color"
      },
      {
        inputPath: preset.roughnessMap,
        outputPath: toKtx2Path(preset.roughnessMap),
        transfer: "linear",
        usage: "roughness"
      },
      {
        inputPath: preset.normalMap,
        outputPath: toKtx2Path(preset.normalMap),
        transfer: "linear",
        usage: "normal"
      },
      {
        inputPath: preset.bumpMap,
        outputPath: toKtx2Path(preset.bumpMap),
        transfer: "linear",
        usage: "bump"
      }
    );
  });

  return dedupeTargets(targets);
}

export function summarizeRoomShellTextureQuality() {
  const wallCommercialCount = WALL_TEXTURE_PRESETS.filter((preset) => preset.qualityTier === "commercial_pbr").length;
  const floorCommercialCount = FLOOR_TEXTURE_PRESETS.filter((preset) => preset.qualityTier === "commercial_pbr").length;
  const candidateAiTextureCount = [...WALL_TEXTURE_PRESETS, ...FLOOR_TEXTURE_PRESETS].filter(
    (preset) => preset.sourceKind === "generic_ai_candidate"
  ).length;

  return {
    wallPresetCount: WALL_TEXTURE_PRESETS.length,
    floorPresetCount: FLOOR_TEXTURE_PRESETS.length,
    wallCommercialCount,
    floorCommercialCount,
    candidateAiTextureCount,
    wallPresetLimit: MAX_COMMERCIAL_WALL_TEXTURE_PRESETS,
    floorPresetLimit: MAX_COMMERCIAL_FLOOR_TEXTURE_PRESETS,
    commercialReady:
      WALL_TEXTURE_PRESETS.length <= MAX_COMMERCIAL_WALL_TEXTURE_PRESETS &&
      FLOOR_TEXTURE_PRESETS.length <= MAX_COMMERCIAL_FLOOR_TEXTURE_PRESETS &&
      wallCommercialCount > 0 &&
      floorCommercialCount > 0
  };
}
