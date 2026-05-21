import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import {
  HOME_REFERENCE_LIGHTING,
  LIGHTING_PRESETS,
  inferLightingPresetId
} from "../src/lib/scene/lighting-presets";
import {
  ROOM_MOOD_RECIPES,
  resolveRoomMoodRecipeApplication
} from "../src/lib/scene/room-mood-recipes";
import type { Wall } from "../src/lib/stores/useSceneStore";

const walls: Wall[] = [
  { id: "wall-a", start: [-3, -2], end: [3, -2], thickness: 0.16, height: 2.7 },
  { id: "wall-b", start: [3, -2], end: [3, 2], thickness: 0.16, height: 2.7 },
  { id: "wall-c", start: [3, 2], end: [-3, 2], thickness: 0.16, height: 2.7 },
  { id: "wall-d", start: [-3, 2], end: [-3, -2], thickness: 0.16, height: 2.7 }
];

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

const bounds = computeLightingBoundsMm(walls, 1);
assert.equal(bounds.minXMm, -3000, "lighting bounds should use room wall coordinates in mm");
assert.equal(bounds.maxZMm, 2000, "lighting bounds should preserve room depth in mm");
assert.equal(DEFAULT_LIGHTING_GRID_SNAP_MM, 500, "lighting grid snap should default to 500mm");
assert.equal(HOME_REFERENCE_LIGHTING.accentIntensity, 0.96, "home reference should enable visible warm/cool accent wash");
assert.equal(HOME_REFERENCE_LIGHTING.beamOpacity, 0.24, "home reference should enable visible direct-light beam glow");

const interactiveLightsSource = readSource("src/components/canvas/features/InteractiveLights.tsx");
const sceneLightsSource = readSource("src/components/canvas/effects/Lights.tsx");
const builderInspectorSource = readSource("src/components/editor/BuilderInspectorPanel.tsx");
const projectEditorPageSource = readSource("src/app/(editor)/project/[id]/page.tsx");
const studioBuilderPageSource = readSource("src/app/studio/builder/page.tsx");
const builderStyleStepSource = readSource("src/features/builder/steps/BuilderStyleStep.tsx");
const dioramaWashSource =
  interactiveLightsSource.match(/function DioramaAccentWash[\s\S]*?function IndirectCeilingGlow/)?.[0] ?? "";
assert.match(
  dioramaWashSource,
  /name="builder-preview-mood-wash"/,
  "builder preview should keep an identifiable renderer-only warm/cool mood wash"
);
assert.match(
  interactiveLightsSource,
  /const isDioramaPreview = viewMode === "builder-preview";/,
  "builder preview mood wash should stay scoped by the editor view mode"
);
assert.match(
  interactiveLightsSource,
  /isDioramaPreview \? \(\s*<DioramaAccentWash/,
  "builder preview should be the only render path that mounts the mood wash"
);
assert.match(
  interactiveLightsSource,
  /THREE\.NormalBlending/,
  "builder preview mood wash should tint bright walls/floors instead of disappearing into additive white"
);
assert.match(
  interactiveLightsSource,
  /\.filter\(\(fixture\) => fixture\.enabled\)/,
  "direct-light renderer should skip disabled fixtures from the shared fixture payload"
);
assert.match(
  interactiveLightsSource,
  /intensity: fixture\.intensity/,
  "direct-light renderer should consume per-fixture intensity from the shared fixture payload"
);
assert.match(
  interactiveLightsSource,
  /beamRadius: fixture\.beamRadiusMm \/ 1000/,
  "direct-light renderer should consume per-fixture beam radius from the shared fixture payload"
);
assert.match(
  interactiveLightsSource,
  /spread: fixture\.spread/,
  "direct-light renderer should consume per-fixture spread from the shared fixture payload"
);
assert.match(
  dioramaWashSource,
  /Math\.min\(0\.44, accentIntensity \* 0\.42\)/,
  "builder preview warm floor wash should remain strong enough to read on light wood floors"
);
assert.match(
  dioramaWashSource,
  /Math\.min\(0\.5, accentIntensity \* 0\.48\)/,
  "builder preview warm wall wash should remain visible on matte white walls"
);
assert.match(
  dioramaWashSource,
  /Math\.min\(0\.46, accentIntensity \* 0\.44\)/,
  "builder preview cool wall wash should remain visible on matte white walls"
);
assert.doesNotMatch(
  dioramaWashSource,
  /<(?:pointLight|spotLight|directionalLight|ambientLight)\b/,
  "builder preview mood wash must not add dynamic emitters beyond the fixture budget"
);
assert.match(
  sceneLightsSource,
  /const isBuilderPreview = viewMode === "builder-preview";/,
  "builder preview should have an explicit room-diorama lighting profile"
);
assert.match(
  sceneLightsSource,
  /isBuilderPreview \? 0\.78/,
  "builder preview should lower flat ambient light so warm/cool wash remains visible"
);
assert.match(
  sceneLightsSource,
  /isBuilderPreview \? 1\.24/,
  "builder preview should keep a stronger warm key light for diorama contrast"
);
assert.match(
  projectEditorPageSource,
  /computeLightingBoundsMm\(walls, scale\)/,
  "project editor should compute room-aware lighting bounds for inspector fixture controls"
);
assert.match(
  builderInspectorSource,
  /data-testid="editor-lighting-mode-controls"/,
  "editor inspector should expose a direct/indirect lighting mode control"
);
assert.match(
  builderInspectorSource,
  /data-testid="editor-direct-lighting-layout"/,
  "editor inspector should expose persisted direct fixture layout controls"
);
assert.match(
  builderInspectorSource,
  /createDefaultDirectLightingFixtures\(/,
  "editor inspector should regenerate snapped direct fixture layouts by count"
);
assert.match(
  builderInspectorSource,
  /data-testid="editor-lighting-temperature-controls"/,
  "editor inspector should expose direct fixture color-temperature controls"
);
assert.match(
  builderInspectorSource,
  /data-testid="editor-lighting-fixture-detail-controls"/,
  "editor inspector should expose per-fixture direct lighting detail controls"
);
assert.match(
  builderInspectorSource,
  /data-testid="editor-room-mood-recipes"/,
  "editor inspector should expose room mood recipe quick actions"
);
assert.match(
  builderInspectorSource,
  /onApplyRoomMoodRecipe\(application\)/,
  "room mood recipe buttons should apply a combined material and lighting recipe"
);
assert.match(
  projectEditorPageSource,
  /const applyRoomMoodRecipe = useCallback/,
  "project editor should wire room mood recipes through a single existing-state handler"
);
assert.match(
  projectEditorPageSource,
  /setWallMaterialIndex\(recipe\.wallMaterialIndex\)[\s\S]*setFloorMaterialIndex\(recipe\.floorMaterialIndex\)[\s\S]*setCeilingMaterialIndex\(recipe\.ceilingMaterialIndex\)[\s\S]*setLighting\(preset\.settings\)/,
  "room mood recipes should reuse existing material indices and lighting preset settings"
);
assert.match(
  projectEditorPageSource,
  /recordSnapshot\(`무드 레시피 적용: \$\{recipe\.label\}`\)/,
  "room mood recipes should commit one undo snapshot for the combined customization"
);
assert.match(
  builderStyleStepSource,
  /data-testid="builder-room-mood-recipes"/,
  "builder style step should expose room mood recipe quick actions before project creation"
);
assert.match(
  builderStyleStepSource,
  /data-testid=\{`builder-room-mood-recipe-\$\{recipe\.id\}`\}/,
  "builder room mood recipe buttons should have stable QA ids"
);
assert.match(
  builderStyleStepSource,
  /onRoomMoodRecipeApply\(application\)/,
  "builder room mood recipe buttons should apply the resolved recipe application"
);
assert.match(
  studioBuilderPageSource,
  /const handleRoomMoodRecipeApply = useCallback/,
  "studio builder should wire room mood recipes through a single existing-state handler"
);
assert.match(
  studioBuilderPageSource,
  /setWallMaterialIndex\(recipe\.wallMaterialIndex\)[\s\S]*setFloorMaterialIndex\(recipe\.floorMaterialIndex\)[\s\S]*setLightingMode\(resolveBuilderLightingModeForMoodRecipe\(recipe\.lightingPresetId\)\)[\s\S]*setMoodRecipeId\(recipe\.id\)/,
  "builder room mood recipes should reuse material indices and existing builder lighting state"
);
assert.match(
  studioBuilderPageSource,
  /\.\.\.\(builderLightingPresetSettings \?\? \{\}\)/,
  "builder preview lighting should merge existing lighting preset settings for active mood recipes"
);
assert.match(
  studioBuilderPageSource,
  /nextQuery\.set\("mood", moodRecipeId\)/,
  "builder room mood recipe selection should survive URL restore"
);
assert.match(
  studioBuilderPageSource,
  /query\.set\("mood", moodRecipeId\)/,
  "builder room mood recipe selection should survive auth draft return URL generation"
);
assert.match(
  builderInspectorSource,
  /data-testid="editor-lighting-fixture-enabled"/,
  "editor inspector should expose per-fixture enabled toggles"
);
assert.match(
  builderInspectorSource,
  /data-testid="editor-lighting-fixture-intensity"/,
  "editor inspector should expose per-fixture intensity controls"
);
assert.match(
  builderInspectorSource,
  /data-testid="editor-lighting-fixture-beam-radius"/,
  "editor inspector should expose per-fixture beam radius controls"
);
assert.match(
  builderInspectorSource,
  /data-testid="editor-lighting-fixture-spread"/,
  "editor inspector should expose per-fixture spread controls"
);
assert.match(
  builderInspectorSource,
  /resolveLightingPositionMmFromNormalized\(xRatio, zRatio, lightingBoundsMm\)/,
  "editor inspector should map fixture drag positions through the shared snapped lighting grid"
);
assert.match(
  builderInspectorSource,
  /onPointerDown=\{\(event\) => \{/,
  "editor inspector fixture markers should start drag interactions from pointer input"
);
assert.match(
  builderInspectorSource,
  /onPointerMove=\{\(event\) => \{/,
  "editor inspector fixture markers should update saved fixture previews while dragging"
);
assert.match(
  builderInspectorSource,
  /moveDirectFixtureFromPointer\(fixture\.id, event, true\)/,
  "editor inspector fixture drag should commit a lighting snapshot on pointer up"
);
assert.match(
  builderInspectorSource,
  /normalizeLightingFixtures\(nextFixtures, lightingBoundsMm\)/,
  "editor inspector should normalize edited fixtures against room bounds before saving"
);
assert.match(
  builderInspectorSource,
  /patchDirectFixture\(fixture\.id, \{ intensity: Number\(event\.target\.value\) \}\)/,
  "editor inspector intensity control should patch the selected fixture"
);
assert.match(
  builderInspectorSource,
  /patchDirectFixture\(fixture\.id, \{ beamRadiusMm: Number\(event\.target\.value\) \}\)/,
  "editor inspector beam-radius control should patch the selected fixture"
);
assert.match(
  builderInspectorSource,
  /patchDirectFixture\(fixture\.id, \{ spread: Number\(event\.target\.value\) \}\)/,
  "editor inspector spread control should patch the selected fixture"
);

const lightingPresetFields = [
  "ambientIntensity",
  "hemisphereIntensity",
  "directionalIntensity",
  "environmentBlur",
  "accentIntensity",
  "beamOpacity"
] as const;

LIGHTING_PRESETS.forEach((preset) => {
  lightingPresetFields.forEach((field) => {
    assert.equal(
      typeof preset.settings[field],
      "number",
      `${preset.id} lighting preset should define numeric ${field}`
    );
  });
  assert.equal(
    inferLightingPresetId(preset.settings),
    preset.id,
    `${preset.id} lighting preset should be inferable from the full visual lighting snapshot`
  );
});

ROOM_MOOD_RECIPES.forEach((recipe) => {
  const application = resolveRoomMoodRecipeApplication(recipe);
  assert.equal(
    inferLightingPresetId(
      LIGHTING_PRESETS.find((preset) => preset.id === application.lightingPresetId)?.settings ??
        HOME_REFERENCE_LIGHTING
    ),
    application.lightingPresetId,
    `${recipe.id} room mood recipe should target an inferable lighting preset`
  );
});

assert.equal(
  inferLightingPresetId({
    ...HOME_REFERENCE_LIGHTING,
    beamOpacity: HOME_REFERENCE_LIGHTING.beamOpacity + 0.06
  }),
  null,
  "lighting preset inference should treat beam glow as part of the visual mood contract"
);

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

const detailedFixture = normalizeLightingFixtures(
  [
    {
      ...threeFixtures[1]!,
      enabled: false,
      intensity: 1.25,
      beamRadiusMm: 950,
      spread: 0.43
    }
  ],
  bounds
);
assert.equal(detailedFixture[0]?.enabled, false, "per-fixture enabled state should persist");
assert.equal(detailedFixture[0]?.intensity, 1.25, "per-fixture intensity should persist");
assert.equal(detailedFixture[0]?.beamRadiusMm, 950, "per-fixture beam radius should persist");
assert.equal(detailedFixture[0]?.spread, 0.43, "per-fixture spread should persist");

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

const fallbackMoodBootstrap = buildSceneDocumentBootstrapFromSavePayload({
  ...buildLightingSavePayload([]),
  lighting: {
    mode: "direct",
    ambientIntensity: HOME_REFERENCE_LIGHTING.ambientIntensity,
    hemisphereIntensity: HOME_REFERENCE_LIGHTING.hemisphereIntensity,
    directionalIntensity: HOME_REFERENCE_LIGHTING.directionalIntensity,
    environmentBlur: HOME_REFERENCE_LIGHTING.environmentBlur,
    fixtures: []
  }
});
assert.equal(
  fallbackMoodBootstrap.document.lighting.accentIntensity,
  HOME_REFERENCE_LIGHTING.accentIntensity,
  "missing saved accent intensity should restore to the home reference visual mood"
);
assert.equal(
  fallbackMoodBootstrap.document.lighting.beamOpacity,
  HOME_REFERENCE_LIGHTING.beamOpacity,
  "missing saved beam opacity should restore to the home reference visual mood"
);

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
