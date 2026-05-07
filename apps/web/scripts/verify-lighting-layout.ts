import assert from "node:assert/strict";
import { buildPublicScenePayload } from "../src/lib/server/public-scenes";
import { SaveVersionSchema, buildSceneDocumentBootstrapFromSavePayload } from "../src/lib/server/project-versions";
import {
  DEFAULT_LIGHTING_GRID_SNAP_MM,
  computeLightingBoundsMm,
  createDefaultDirectLightingFixtures,
  normalizeLightingFixtures,
  resolveLightingFixtureColor,
  resolveLightingPositionMmFromNormalized,
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
assert.equal(DEFAULT_LIGHTING_GRID_SNAP_MM, 500, "lighting grid snap should default to 500mm");

function isSnappedToGrid(valueMm: number) {
  return Number.isInteger(valueMm / DEFAULT_LIGHTING_GRID_SNAP_MM);
}

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

const snappedFromNormalized = resolveLightingPositionMmFromNormalized(0.61, 0.18, bounds);
assert.deepEqual(
  snappedFromNormalized,
  [500, bounds.ceilingHeightMm, -1500],
  "arbitrary normalized positions should snap to the 500mm lighting grid"
);

const movedFixture = normalizeLightingFixtures(
  [
    {
      ...threeFixtures[0]!,
      positionMm: [640, bounds.ceilingHeightMm, -1260],
      beamRadiusMm: 1400,
      spread: 0.72,
      colorTemperature: "cool"
    }
  ],
  bounds
);
assert.deepEqual(
  movedFixture[0]?.positionMm,
  [500, bounds.ceilingHeightMm, -1500],
  "arbitrary direct-light positions should snap before they are saved"
);
assert.equal(movedFixture[0]?.beamRadiusMm, 1400, "beam radius should persist");
assert.equal(movedFixture[0]?.spread, 0.72, "spread should persist");
assert.equal(resolveLightingFixtureColor("cool"), "#dceaff", "cool color temperature should map to a renderer color");

const fallbackFixtures = resolveLightingFixtures([], bounds, 4);
assert.equal(fallbackFixtures.length, 4, "empty direct layout should resolve to a persisted default count when requested");
fallbackFixtures.forEach((fixture, index) => {
  assert.ok(isSnappedToGrid(fixture.positionMm[0]), `fallback fixture ${index + 1} X should snap to 500mm`);
  assert.ok(isSnappedToGrid(fixture.positionMm[2]), `fallback fixture ${index + 1} Z should snap to 500mm`);
});

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

function buildLightingSavePayload(fixtures: ReturnType<typeof normalizeLightingFixtures>) {
  return {
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
      mode: "direct" as const,
      ambientIntensity: 0.34,
      hemisphereIntensity: 0.44,
      directionalIntensity: 1.16,
      environmentBlur: 0.18,
      accentIntensity: 0.96,
      beamOpacity: 0.24,
      fixtures
    }
  };
}

const countOptions = [1, 2, 3, 4, 6] as const;
countOptions.forEach((count) => {
  const fixtures = createDefaultDirectLightingFixtures(bounds, count, {
    colorTemperature: count % 2 === 0 ? "warm" : "neutral"
  });
  const savePayload = buildLightingSavePayload(fixtures);
  const bootstrap = buildSceneDocumentBootstrapFromSavePayload(savePayload);
  const savedFixtures = bootstrap.document.lighting.fixtures;

  assert.equal(savedFixtures.length, count, `${count} direct fixtures should persist through the scene payload`);
  savedFixtures.forEach((fixture, index) => {
    assert.ok(
      isSnappedToGrid(fixture.positionMm[0]),
      `${count} fixture layout should snap fixture ${index + 1} X to ${DEFAULT_LIGHTING_GRID_SNAP_MM}mm`
    );
    assert.ok(
      isSnappedToGrid(fixture.positionMm[2]),
      `${count} fixture layout should snap fixture ${index + 1} Z to ${DEFAULT_LIGHTING_GRID_SNAP_MM}mm`
    );
  });

  const publicPayload = buildPublicScenePayload({
    sharedProject: {
      id: `share-${count}`,
      token: `lighting-${count}`,
      project_id: `project-${count}`,
      project_version_id: `version-${count}`,
      permissions: "view",
      expires_at: null,
      preview_meta: null
    },
    project: {
      id: `project-${count}`,
      name: `Lighting ${count}`,
      description: null,
      thumbnail_path: null
    },
    versionRow: {
      id: `version-${count}`,
      version: count,
      message: `lighting-${count}`,
      customization: {
        sceneDocument: bootstrap.document
      }
    }
  });

  assert.deepEqual(
    publicPayload.sceneBootstrap?.document.lighting.fixtures,
    savedFixtures,
    `${count} direct fixtures should roundtrip through the shared payload without losing snapped positions`
  );
});

const bootstrap = buildSceneDocumentBootstrapFromSavePayload(buildLightingSavePayload(movedFixture));
assert.deepEqual(
  bootstrap.document.lighting.fixtures,
  movedFixture,
  "scene payload lighting fixtures should keep snapped mm coordinates"
);
assert.deepEqual(
  buildPublicScenePayload({
    sharedProject: {
      id: "share-verify-lighting-layout",
      token: "verify-lighting-layout",
      project_id: "project-verify-lighting-layout",
      project_version_id: "version-verify-lighting-layout",
      permissions: "view",
      expires_at: null,
      preview_meta: null
    },
    project: {
      id: "project-verify-lighting-layout",
      name: "Lighting Verify",
      description: null,
      thumbnail_path: null
    },
    versionRow: {
      id: "version-verify-lighting-layout",
      version: 1,
      message: "verify-lighting-layout",
      customization: {
        sceneDocument: bootstrap.document
      }
    }
  }).sceneBootstrap?.document.lighting.fixtures,
  movedFixture,
  "shared payload lighting fixtures should keep snapped mm coordinates"
);

SaveVersionSchema.parse({
  ...buildLightingSavePayload(movedFixture),
  lighting: {
    ...buildLightingSavePayload(movedFixture).lighting,
    fixtures: movedFixture
  }
});

console.log("[verify:lighting-layout] PASS");
