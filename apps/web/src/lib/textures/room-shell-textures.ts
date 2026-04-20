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
