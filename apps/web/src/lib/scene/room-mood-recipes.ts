import { builderCeilingFinishes } from "../builder/templates";
import {
  CEILING_TEXTURE_PRESETS,
  FLOOR_TEXTURE_PRESETS,
  WALL_TEXTURE_PRESETS
} from "../textures/room-shell-textures";
import type { LightingPresetId } from "./lighting-presets";

export type RoomMoodRecipeId =
  | "clean-gallery"
  | "warm-studio"
  | "soft-lounge"
  | "walnut-media";

export type RoomMoodRecipe = {
  id: RoomMoodRecipeId;
  label: string;
  description: string;
  wallPresetId: string;
  floorPresetId: string;
  ceilingFinishId: number;
  lightingPresetId: LightingPresetId;
};

export type RoomMoodRecipeApplication = {
  id: RoomMoodRecipeId;
  label: string;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  ceilingMaterialIndex: number;
  lightingPresetId: LightingPresetId;
};

export const ROOM_MOOD_RECIPES: RoomMoodRecipe[] = [
  {
    id: "clean-gallery",
    label: "Clean Gallery",
    description: "Matte wall / light oak / neutral light",
    wallPresetId: "matte-white-paint",
    floorPresetId: "light-oak-boards",
    ceilingFinishId: 0,
    lightingPresetId: "neutral-studio"
  },
  {
    id: "warm-studio",
    label: "Warm Studio",
    description: "Warm paint / laminate / home light",
    wallPresetId: "warm-white-paint",
    floorPresetId: "warm-laminate",
    ceilingFinishId: 1,
    lightingPresetId: "home-reference"
  },
  {
    id: "soft-lounge",
    label: "Soft Lounge",
    description: "Beige plaster / natural oak / evening light",
    wallPresetId: "beige-plaster",
    floorPresetId: "natural-oak-boards",
    ceilingFinishId: 1,
    lightingPresetId: "soft-evening"
  },
  {
    id: "walnut-media",
    label: "Walnut Media",
    description: "Walnut wall / walnut floor / warm beam",
    wallPresetId: "walnut-accent-wall",
    floorPresetId: "walnut-boards",
    ceilingFinishId: 3,
    lightingPresetId: "home-reference"
  }
];

function resolveTexturePresetIndex(
  presets: readonly { id: string }[],
  presetId: string,
  label: string
) {
  const index = presets.findIndex((preset) => preset.id === presetId);
  if (index < 0) {
    throw new Error(`Unknown ${label} texture preset: ${presetId}`);
  }
  return index;
}

export function resolveRoomMoodRecipeApplication(
  recipe: RoomMoodRecipe
): RoomMoodRecipeApplication {
  const ceilingExists = builderCeilingFinishes.some((finish) => finish.id === recipe.ceilingFinishId);
  if (!ceilingExists) {
    throw new Error(`Unknown ceiling finish id: ${recipe.ceilingFinishId}`);
  }

  return {
    id: recipe.id,
    label: recipe.label,
    wallMaterialIndex: resolveTexturePresetIndex(WALL_TEXTURE_PRESETS, recipe.wallPresetId, "wall"),
    floorMaterialIndex: resolveTexturePresetIndex(FLOOR_TEXTURE_PRESETS, recipe.floorPresetId, "floor"),
    ceilingMaterialIndex: recipe.ceilingFinishId,
    lightingPresetId: recipe.lightingPresetId
  };
}

export function getRoomMoodRecipeSwatches(recipe: RoomMoodRecipe) {
  const application = resolveRoomMoodRecipeApplication(recipe);
  return [
    WALL_TEXTURE_PRESETS[application.wallMaterialIndex]?.topColor ?? "#f1eee8",
    FLOOR_TEXTURE_PRESETS[application.floorMaterialIndex]?.topColor ?? "#d9b884",
    CEILING_TEXTURE_PRESETS[application.ceilingMaterialIndex]?.topColor ?? "#f1eee8"
  ] as const;
}
