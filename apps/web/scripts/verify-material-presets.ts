import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { builderFloorFinishes, builderWallFinishes } from "../src/lib/builder/templates";
import {
  FLOOR_TEXTURE_PRESETS,
  MAX_COMMERCIAL_FLOOR_TEXTURE_PRESETS,
  MAX_COMMERCIAL_WALL_TEXTURE_PRESETS,
  WALL_TEXTURE_PRESETS,
  resolveRoomShellTextureDefaultExposure,
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

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
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
  assert.equal(
    finish.useCategory,
    preset?.useCategory,
    "wall finish useCategory should come from the texture preset contract"
  );
  assert.equal(
    finish.defaultExposure,
    preset ? resolveRoomShellTextureDefaultExposure(preset.useCategory) : undefined,
    "wall finish default exposure should come from the texture preset contract"
  );
  assert.equal(
    finish.previewThumbnail,
    preset?.previewThumbnail,
    "wall finish preview thumbnail should come from the texture preset contract"
  );
});

builderFloorFinishes.forEach((finish) => {
  const preset = FLOOR_TEXTURE_PRESETS[finish.id];
  assert.equal(finish.name, preset?.name, "floor finish name should come from the texture preset contract");
  assert.equal(finish.category, preset?.category, "floor finish category should come from the texture preset contract");
  assert.equal(
    finish.useCategory,
    preset?.useCategory,
    "floor finish useCategory should come from the texture preset contract"
  );
  assert.equal(
    finish.defaultExposure,
    preset ? resolveRoomShellTextureDefaultExposure(preset.useCategory) : undefined,
    "floor finish default exposure should come from the texture preset contract"
  );
  assert.equal(
    finish.previewThumbnail,
    preset?.previewThumbnail,
    "floor finish preview thumbnail should come from the texture preset contract"
  );
});

const defaultWallPresets = WALL_TEXTURE_PRESETS.filter((preset) => preset.useCategory === "commercial_default");
const defaultFloorPresets = FLOOR_TEXTURE_PRESETS.filter((preset) => preset.useCategory === "commercial_default");
const defaultWallGridFinishes = builderWallFinishes.filter((finish) => finish.defaultExposure === "default");
const expectedDefaultWallIds = [
  "matte-white-paint",
  "warm-white-paint",
  "beige-plaster",
  "light-grey-plaster",
  "greige-clean-plaster",
  "light-oak-wall-panel",
  "clean-subtle-concrete"
].sort();

assert(
  defaultWallPresets.length >= 5,
  "at least five wall presets should be clean commercial defaults"
);
assert(
  defaultFloorPresets.length >= 4,
  "floor presets should expose multiple clean commercial defaults"
);
assert.deepEqual(
  defaultWallGridFinishes.map((finish) => WALL_TEXTURE_PRESETS[finish.id]?.id).sort(),
  expectedDefaultWallIds,
  "default wall grid should expose only the clean commercial wall presets"
);
assert.equal(
  defaultWallGridFinishes.some((finish) => /acoustic felt panel/i.test(finish.name)),
  false,
  "Acoustic Felt Panel must never appear in the default wall grid"
);
assert.equal(WALL_TEXTURE_PRESETS[0]?.id, "matte-white-paint", "default wall must be a clean matte paint");
assert.equal(FLOOR_TEXTURE_PRESETS[0]?.id, "light-oak-boards", "default floor must be clean light oak boards");

assertNoForbiddenDefaultNames(
  defaultWallPresets,
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
assert.equal(
  WALL_TEXTURE_PRESETS.find((preset) => preset.id === "acoustic-felt-panel")?.useCategory,
  "commercial_option",
  "Acoustic Felt Panel must remain an advanced commercial option"
);
assert(
  FLOOR_TEXTURE_PRESETS.some((preset) => preset.id === "subtle-terrazzo-floor"),
  "floor presets should include a subtle terrazzo option"
);

const qualitySummary = summarizeRoomShellTextureQuality();
assert.equal(qualitySummary.commercialReady, true, "room shell texture summary should remain commercial ready");

const builderStyleSource = readSource("src/features/builder/steps/BuilderStyleStep.tsx");
assert.match(
  builderStyleSource,
  /defaultWallPalette\s*=\s*useMemo\([\s\S]*defaultExposure === "default"/,
  "BuilderStyleStep should derive the default wall grid from defaultExposure only"
);
assert.equal(
  /WALL_TEXTURE_PRESETS/.test(builderStyleSource),
  false,
  "BuilderStyleStep must not blindly expose WALL_TEXTURE_PRESETS"
);

const renderQualitySource = readSource("src/lib/scene/render-quality.ts");
assert.match(
  renderQualitySource,
  /if \(isBuilderPreview\)[\s\S]*enableContactShadows:\s*false/,
  "builder-preview render quality should disable contact shadows"
);
assert.match(
  renderQualitySource,
  /if \(isBuilderPreview\)[\s\S]*enableShadows:\s*false/,
  "builder-preview render quality should disable dynamic shadows"
);
const sceneEnvironmentSource = readSource("src/components/canvas/core/SceneEnvironment.tsx");
assert.match(
  sceneEnvironmentSource,
  /quality\.enableContactShadows\s*\?/,
  "SceneEnvironment should only render ContactShadows when the render-quality policy allows it"
);
const proceduralWallSource = readSource("src/components/canvas/features/ProceduralWall.tsx");
const proceduralFloorSource = readSource("src/components/canvas/features/ProceduralFloor.tsx");
assert.match(
  proceduralWallSource,
  /useRetainedTextureSet/,
  "wall texture swaps should retain the previous material while the next texture set loads"
);
assert.match(
  proceduralFloorSource,
  /useRetainedTextureSet/,
  "floor texture swaps should retain the previous material while the next texture set loads"
);

console.log("[verify:material-presets] PASS");
