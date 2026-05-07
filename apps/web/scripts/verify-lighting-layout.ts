import assert from "node:assert/strict";
import { migrateLegacySceneStoreStateToV2, type LegacySceneStoreStateLike } from "@deskterioronline/scene-schema";
import { SaveVersionSchema } from "../src/lib/server/project-versions";
import {
  computeLightingBoundsMm,
  createDefaultDirectLightingFixtures,
  normalizeLightingFixtures,
  resolveLightingFixtureColor,
  resolveLightingFixtures
} from "../src/lib/scene/lighting-layout";
import type { Wall } from "../src/lib/stores/useSceneStore";

const walls: Wall[] = [
  { id: "wall-a", start: [-3, -2], end: [3, -2], thickness: 0.16, height: 2.7 },
  { id: "wall-b", start: [3, -2], end: [3, 2], thickness: 0.16, height: 2.7 },
  { id: "wall-c", start: [3, 2], end: [-3, 2], thickness: 0.16, height: 2.7 },
  { id: "wall-d", start: [-3, 2], end: [-3, -2], thickness: 0.16, height: 2.7 }
];

const bounds = computeLightingBoundsMm(walls, 1);
assert.equal(bounds.minXMm, -3000, "lighting bounds should use room wall coordinates in mm");
assert.equal(bounds.maxZMm, 2000, "lighting bounds should preserve room depth in mm");

const oneFixture = createDefaultDirectLightingFixtures(bounds, 1);
const threeFixtures = createDefaultDirectLightingFixtures(bounds, 3);
const sixFixtures = createDefaultDirectLightingFixtures(bounds, 6, {
  colorTemperature: "warm",
  intensity: 0.88
});

assert.equal(oneFixture.length, 1, "direct lighting should support one fixture");
assert.equal(threeFixtures.length, 3, "direct lighting should support three fixtures");
assert.equal(sixFixtures.length, 6, "direct lighting should support six fixtures");
assert.equal(sixFixtures[0]?.colorTemperature, "warm", "fixture template should preserve selected color temperature");
assert.equal(sixFixtures[0]?.intensity, 0.88, "fixture template should preserve selected intensity");

const movedFixture = normalizeLightingFixtures(
  [
    {
      ...threeFixtures[0]!,
      positionMm: [1200, bounds.ceilingHeightMm, -900],
      beamRadiusMm: 1400,
      spread: 0.72,
      colorTemperature: "cool"
    }
  ],
  bounds
);
assert.deepEqual(movedFixture[0]?.positionMm, [1200, bounds.ceilingHeightMm, -900], "moved fixture should persist exact mm position");
assert.equal(movedFixture[0]?.beamRadiusMm, 1400, "beam radius should persist");
assert.equal(movedFixture[0]?.spread, 0.72, "spread should persist");
assert.equal(resolveLightingFixtureColor("cool"), "#dceaff", "cool color temperature should map to a renderer color");

const fallbackFixtures = resolveLightingFixtures([], bounds, 4);
assert.equal(fallbackFixtures.length, 4, "empty direct layout should resolve to a persisted default count when requested");

SaveVersionSchema.parse({
  roomShell: {
    scale: 1,
    walls,
    openings: [],
    floors: [],
    ceilings: [],
    rooms: [],
    cameraAnchors: [],
    navGraph: { nodes: [], edges: [] },
    entranceId: null
  },
  assets: [],
  materials: {
    wallIndex: 0,
    floorIndex: 0
  },
  lighting: {
    mode: "direct",
    ambientIntensity: 0.34,
    hemisphereIntensity: 0.44,
    directionalIntensity: 1.16,
    environmentBlur: 0.18,
    accentIntensity: 0.96,
    beamOpacity: 0.24,
    fixtures: movedFixture
  }
});

const legacyState: LegacySceneStoreStateLike = {
  scale: 1,
  scaleInfo: { value: 1, source: "user_measure", confidence: 1 },
  walls,
  openings: [],
  floors: [],
  ceilings: [],
  rooms: [],
  cameraAnchors: [],
  navGraph: { nodes: [], edges: [] },
  assets: [],
  wallMaterialIndex: 0,
  floorMaterialIndex: 0,
  lighting: {
    mode: "direct",
    ambientIntensity: 0.34,
    hemisphereIntensity: 0.44,
    directionalIntensity: 1.16,
    environmentBlur: 0.18,
    accentIntensity: 0.96,
    beamOpacity: 0.24,
    fixtures: movedFixture
  }
};
const document = migrateLegacySceneStoreStateToV2(legacyState, {
  id: "verify-lighting-layout",
  version: 2
});
const sceneLighting = (document as unknown as { environment?: { lighting?: unknown } }).environment?.lighting;
assert.equal(
  Array.isArray((sceneLighting as { fixtures?: unknown } | undefined)?.fixtures),
  true,
  "scene document lighting payload should preserve fixture arrays for viewer parity"
);

console.log("[verify:lighting-layout] PASS");
