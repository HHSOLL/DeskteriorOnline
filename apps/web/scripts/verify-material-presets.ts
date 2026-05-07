import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { builderFloorFinishes, builderWallFinishes } from "../src/lib/builder/templates";
import {
  FLOOR_TEXTURE_PRESETS,
  MAX_COMMERCIAL_FLOOR_TEXTURE_PRESETS,
  MAX_COMMERCIAL_WALL_TEXTURE_PRESETS,
  WALL_TEXTURE_PRESETS,
  summarizeRoomShellTextureQuality,
  type RoomShellTexturePreset
} from "../src/lib/textures/room-shell-textures";

function assertPublicAssetExists(pathValue: string, label: string) {
  assert.equal(
    existsSync(join(process.cwd(), "public", pathValue.replace(/^\//, ""))),
    true,
    `${label} should exist: ${pathValue}`
  );
}

function assertTexturePresetAssetsExist(preset: RoomShellTexturePreset) {
  assertPublicAssetExists(preset.map, `${preset.id} base color`);
  assertPublicAssetExists(preset.roughnessMap, `${preset.id} roughness`);
  assertPublicAssetExists(preset.normalMap, `${preset.id} normal`);
  assertPublicAssetExists(preset.bumpMap, `${preset.id} bump`);
  assertPublicAssetExists(preset.previewThumbnail, `${preset.id} thumbnail`);
}

function assertNoForbiddenDefaultNames(
  presets: readonly RoomShellTexturePreset[],
  forbiddenPattern: RegExp,
  label: string
) {
  presets.forEach((preset) => {
    assert.equal(
      forbiddenPattern.test(`${preset.id} ${preset.name} ${preset.category}`),
      false,
      `${label} default preset should not read as damaged/dirty: ${preset.name}`
    );
  });
}

assert(
  WALL_TEXTURE_PRESETS.length <= MAX_COMMERCIAL_WALL_TEXTURE_PRESETS,
  "wall presets should stay within the commercial preset budget"
);
assert(
  FLOOR_TEXTURE_PRESETS.length <= MAX_COMMERCIAL_FLOOR_TEXTURE_PRESETS,
  "floor presets should stay within the commercial preset budget"
);

[...WALL_TEXTURE_PRESETS, ...FLOOR_TEXTURE_PRESETS].forEach(assertTexturePresetAssetsExist);

assert.equal(builderWallFinishes.length, WALL_TEXTURE_PRESETS.length, "builder wall finishes must mirror wall presets");
assert.equal(builderFloorFinishes.length, FLOOR_TEXTURE_PRESETS.length, "builder floor finishes must mirror floor presets");

builderWallFinishes.forEach((finish) => {
  const preset = WALL_TEXTURE_PRESETS[finish.id];
  assert.equal(finish.name, preset?.name, "wall finish name should come from the texture preset contract");
  assert.equal(finish.category, preset?.category, "wall finish category should come from the texture preset contract");
});

builderFloorFinishes.forEach((finish) => {
  const preset = FLOOR_TEXTURE_PRESETS[finish.id];
  assert.equal(finish.name, preset?.name, "floor finish name should come from the texture preset contract");
  assert.equal(finish.category, preset?.category, "floor finish category should come from the texture preset contract");
});

const defaultWallPresets = WALL_TEXTURE_PRESETS.filter((preset) => preset.useCategory === "commercial_default");
const defaultFloorPresets = FLOOR_TEXTURE_PRESETS.filter((preset) => preset.useCategory === "commercial_default");

assert(
  defaultWallPresets.length >= 5,
  "at least five wall presets should be clean commercial defaults"
);
assert(
  defaultFloorPresets.length >= 4,
  "floor presets should expose multiple clean commercial defaults"
);
assert.equal(WALL_TEXTURE_PRESETS[0]?.id, "matte-white-paint", "default wall must be a clean matte paint");
assert.equal(FLOOR_TEXTURE_PRESETS[0]?.id, "light-oak-boards", "default floor must be clean light oak boards");

assertNoForbiddenDefaultNames(
  WALL_TEXTURE_PRESETS.slice(0, 5),
  /dirty|worn|damaged|mold|mould|stain|peel|dark|industrial/i,
  "wall"
);
assertNoForbiddenDefaultNames(
  defaultFloorPresets,
  /dirty|damaged|mold|mould|stain|peel|black carpet|cork/i,
  "floor"
);

assert(
  WALL_TEXTURE_PRESETS.some((preset) => preset.id === "walnut-accent-wall"),
  "wall presets should include a walnut/dark wood accent option"
);
assert(
  FLOOR_TEXTURE_PRESETS.some((preset) => preset.id === "subtle-terrazzo-floor"),
  "floor presets should include a subtle terrazzo option"
);

const qualitySummary = summarizeRoomShellTextureQuality();
assert.equal(qualitySummary.commercialReady, true, "room shell texture summary should remain commercial ready");

console.log("[verify:material-presets] PASS");
