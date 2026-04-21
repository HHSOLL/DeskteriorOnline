export type RuntimeTextureSet = {
  map: string;
  roughnessMap: string;
  normalMap: string;
  bumpMap: string;
};

export type RoomShellTexturePreset = RuntimeTextureSet & {
  topColor: string;
  color?: string;
  roughness: number;
  bumpScale: number;
  normalScale: number;
  envMapIntensity?: number;
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

export const WALL_TEXTURE_PRESETS: RoomShellTexturePreset[] = [
  {
    topColor: "#d8d1c8",
    map: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_rough_2k.jpg",
    normalMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_disp_2k.png",
    bumpMap: "/assets/textures/white_plaster_02_2k.blend/textures/white_plaster_02_disp_2k.png",
    color: "#f3f2ef",
    roughness: 0.85,
    bumpScale: 0.012,
    normalScale: 0.3,
    envMapIntensity: 0.5
  },
  {
    topColor: "#babcc0",
    map: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_diff_2k.jpg",
    roughnessMap: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
    normalMap: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
    bumpMap: "/assets/textures/painted_plaster_wall_2k.blend/textures/painted_plaster_wall_disp_2k.png",
    color: "#e0e0e0",
    roughness: 0.7,
    bumpScale: 0.012,
    normalScale: 0.3,
    envMapIntensity: 0.4
  },
  {
    topColor: "#6a6865",
    map: "/assets/textures/concrete_wall_007_2k.blend/textures/concrete_wall_007_diff_2k.jpg",
    roughnessMap: "/assets/textures/concrete_wall_007_2k.blend/textures/concrete_wall_007_disp_2k.png",
    normalMap: "/assets/textures/concrete_wall_007_2k.blend/textures/concrete_wall_007_disp_2k.png",
    bumpMap: "/assets/textures/concrete_wall_007_2k.blend/textures/concrete_wall_007_disp_2k.png",
    color: "#333333",
    roughness: 0.92,
    bumpScale: 0.015,
    normalScale: 0.35,
    envMapIntensity: 0.25
  },
  {
    topColor: "#c8c7c2",
    map: "/assets/textures/grey_plaster_02/grey_plaster_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/grey_plaster_02/grey_plaster_02_rough_2k.jpg",
    normalMap: "/assets/textures/grey_plaster_02/grey_plaster_02_disp_2k.jpg",
    bumpMap: "/assets/textures/grey_plaster_02/grey_plaster_02_disp_2k.jpg",
    color: "#dad7d1",
    roughness: 0.82,
    bumpScale: 0.012,
    normalScale: 0.26,
    envMapIntensity: 0.42
  },
  {
    topColor: "#9d9892",
    map: "/assets/textures/concrete_layers_02/concrete_layers_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/concrete_layers_02/concrete_layers_02_rough_2k.jpg",
    normalMap: "/assets/textures/concrete_layers_02/concrete_layers_02_disp_2k.jpg",
    bumpMap: "/assets/textures/concrete_layers_02/concrete_layers_02_disp_2k.jpg",
    color: "#cbc6be",
    roughness: 0.88,
    bumpScale: 0.013,
    normalScale: 0.3,
    envMapIntensity: 0.34
  },
  {
    topColor: "#b08a62",
    map: "/assets/textures/oak_veneer_01/oak_veneer_01_diff_2k.jpg",
    roughnessMap: "/assets/textures/oak_veneer_01/oak_veneer_01_rough_2k.jpg",
    normalMap: "/assets/textures/oak_veneer_01/oak_veneer_01_disp_2k.jpg",
    bumpMap: "/assets/textures/oak_veneer_01/oak_veneer_01_disp_2k.jpg",
    color: "#c89c72",
    roughness: 0.66,
    bumpScale: 0.01,
    normalScale: 0.24,
    envMapIntensity: 0.5
  },
  {
    topColor: "#8f6c52",
    map: "/assets/textures/kitchen_wood/kitchen_wood_diff_2k.jpg",
    roughnessMap: "/assets/textures/kitchen_wood/kitchen_wood_rough_2k.jpg",
    normalMap: "/assets/textures/kitchen_wood/kitchen_wood_disp_2k.jpg",
    bumpMap: "/assets/textures/kitchen_wood/kitchen_wood_disp_2k.jpg",
    color: "#9f7755",
    roughness: 0.62,
    bumpScale: 0.01,
    normalScale: 0.22,
    envMapIntensity: 0.46
  }
];

export const FLOOR_TEXTURE_PRESETS: RoomShellTexturePreset[] = [
  {
    topColor: "#b79a75",
    map: "/assets/textures/weathered_brown_planks_2k.blend/textures/weathered_brown_planks_diff_2k.jpg",
    roughnessMap: "/assets/textures/weathered_brown_planks_2k.blend/textures/weathered_brown_planks_rough_2k.jpg",
    normalMap: "/assets/textures/weathered_brown_planks_2k.blend/textures/weathered_brown_planks_disp_2k.png",
    bumpMap: "/assets/textures/weathered_brown_planks_2k.blend/textures/weathered_brown_planks_disp_2k.png",
    roughness: 0.7,
    bumpScale: 0.012,
    normalScale: 0.35
  },
  {
    topColor: "#8f8479",
    map: "/assets/textures/concrete_floor_worn_001_2k.blend/textures/concrete_floor_worn_001_diff_2k.jpg",
    roughnessMap: "/assets/textures/concrete_floor_worn_001_2k.blend/textures/concrete_floor_worn_001_rough_2k.jpg",
    normalMap: "/assets/textures/concrete_floor_worn_001_2k.blend/textures/concrete_floor_worn_001_disp_2k.png",
    bumpMap: "/assets/textures/concrete_floor_worn_001_2k.blend/textures/concrete_floor_worn_001_disp_2k.png",
    roughness: 0.9,
    bumpScale: 0.015,
    normalScale: 0.35
  },
  {
    topColor: "#cbc4ba",
    map: "/assets/textures/marble_01_2k.blend/textures/marble_01_diff_2k.jpg",
    roughnessMap: "/assets/textures/marble_01_2k.blend/textures/marble_01_rough_2k.jpg",
    normalMap: "/assets/textures/marble_01_2k.blend/textures/marble_01_disp_2k.png",
    bumpMap: "/assets/textures/marble_01_2k.blend/textures/marble_01_disp_2k.png",
    roughness: 0.5,
    bumpScale: 0.01,
    normalScale: 0.3
  },
  {
    topColor: "#b89e7e",
    map: "/assets/textures/laminate_floor_02/laminate_floor_02_diff_2k.jpg",
    roughnessMap: "/assets/textures/laminate_floor_02/laminate_floor_02_rough_2k.jpg",
    normalMap: "/assets/textures/laminate_floor_02/laminate_floor_02_disp_2k.jpg",
    bumpMap: "/assets/textures/laminate_floor_02/laminate_floor_02_disp_2k.jpg",
    roughness: 0.62,
    bumpScale: 0.011,
    normalScale: 0.28
  },
  {
    topColor: "#9f7b58",
    map: "/assets/textures/wood_floor/wood_floor_diff_2k.jpg",
    roughnessMap: "/assets/textures/wood_floor/wood_floor_rough_2k.jpg",
    normalMap: "/assets/textures/wood_floor/wood_floor_disp_2k.jpg",
    bumpMap: "/assets/textures/wood_floor/wood_floor_disp_2k.jpg",
    roughness: 0.64,
    bumpScale: 0.012,
    normalScale: 0.3
  },
  {
    topColor: "#8b6543",
    map: "/assets/textures/linoleum_brown/linoleum_brown_diff_2k.jpg",
    roughnessMap: "/assets/textures/linoleum_brown/linoleum_brown_rough_2k.jpg",
    normalMap: "/assets/textures/linoleum_brown/linoleum_brown_disp_2k.jpg",
    bumpMap: "/assets/textures/linoleum_brown/linoleum_brown_disp_2k.jpg",
    roughness: 0.76,
    bumpScale: 0.008,
    normalScale: 0.2
  },
  {
    topColor: "#d7d0c5",
    map: "/assets/textures/terrazzo_tiles/terrazzo_tiles_diff_2k.jpg",
    roughnessMap: "/assets/textures/terrazzo_tiles/terrazzo_tiles_rough_2k.jpg",
    normalMap: "/assets/textures/terrazzo_tiles/terrazzo_tiles_disp_2k.jpg",
    bumpMap: "/assets/textures/terrazzo_tiles/terrazzo_tiles_disp_2k.jpg",
    roughness: 0.56,
    bumpScale: 0.006,
    normalScale: 0.16
  },
  {
    topColor: "#adb0b2",
    map: "/assets/textures/anti_skid_tiles/anti_skid_tiles_diff_2k.jpg",
    roughnessMap: "/assets/textures/anti_skid_tiles/anti_skid_tiles_rough_2k.jpg",
    normalMap: "/assets/textures/anti_skid_tiles/anti_skid_tiles_disp_2k.jpg",
    bumpMap: "/assets/textures/anti_skid_tiles/anti_skid_tiles_disp_2k.jpg",
    roughness: 0.78,
    bumpScale: 0.008,
    normalScale: 0.2
  },
  {
    topColor: "#6f6258",
    map: "/assets/textures/dirty_carpet/dirty_carpet_diff_2k.jpg",
    roughnessMap: "/assets/textures/dirty_carpet/dirty_carpet_rough_2k.jpg",
    normalMap: "/assets/textures/dirty_carpet/dirty_carpet_disp_2k.jpg",
    bumpMap: "/assets/textures/dirty_carpet/dirty_carpet_disp_2k.jpg",
    roughness: 0.9,
    bumpScale: 0.012,
    normalScale: 0.24
  }
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
  const presets = [...WALL_TEXTURE_PRESETS, ...FLOOR_TEXTURE_PRESETS];

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
