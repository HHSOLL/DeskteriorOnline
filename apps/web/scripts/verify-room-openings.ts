import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { migrateLegacySceneStoreStateToV2, type LegacySceneStoreStateLike } from "@deskterioronline/scene-schema";
import * as THREE from "three";
import {
  createProceduralDoorAsset,
  createProceduralWindowAsset,
  DOOR_VISUALS,
  OPENING_RENDERER_PATHS,
  OPENING_TRIM_NODE_NAMES,
  summarizeOpeningVisual,
  WINDOW_VISUALS
} from "../src/components/canvas/features/opening-visuals";
import {
  getOpeningPlacementIssues,
  normalizeOpenings,
  reassignOpeningToWall
} from "../src/features/builder/logic/openings";
import type { Opening, Wall } from "../src/lib/stores/useSceneStore";

const walls: Wall[] = [
  { id: "wall-a", start: [0, 0], end: [5, 0], thickness: 0.16, height: 2.7 },
  { id: "wall-b", start: [5, 0], end: [5, 4], thickness: 0.16, height: 2.7 }
];

const validOpenings: Opening[] = [
  {
    id: "door-1",
    wallId: "wall-a",
    type: "door",
    offset: 0.55,
    width: 0.92,
    height: 2.1,
    verticalOffset: 0,
    isEntrance: true
  },
  {
    id: "window-1",
    wallId: "wall-b",
    type: "window",
    offset: 1.1,
    width: 1.6,
    height: 1.25,
    sillHeight: 0.9
  }
];

const workspaceRoot = existsSync(join(process.cwd(), "src"))
  ? process.cwd()
  : join(process.cwd(), "apps/web");

function readSource(relativePath: string) {
  return readFileSync(join(workspaceRoot, "src", relativePath), "utf8");
}

function relativeAssetPath(assetPath: string) {
  return assetPath.replace(/^\/assets\/models\//, "");
}

function computeMaterialLuminanceSummary(rootSummarySource: Parameters<typeof summarizeOpeningVisual>[0]) {
  const luminances: number[] = [];

  rootSummarySource.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (
        material instanceof THREE.Material &&
        "color" in material &&
        material.color instanceof THREE.Color
      ) {
        const color = material.color;
        luminances.push(0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b);
      }
    });
  });

  return {
    min: Math.min(...luminances),
    max: Math.max(...luminances)
  };
}

const normalized = normalizeOpenings(validOpenings, walls);
assert.equal(normalized.length, 2, "valid door/window openings should survive normalization");
assert.deepEqual(getOpeningPlacementIssues(normalized, walls), [], "valid openings should not report blocked issues");

const edgeIssues = getOpeningPlacementIssues(
  [{ ...validOpenings[0]!, offset: 0.05 }],
  walls
);
assert.equal(edgeIssues[0]?.code, "EDGE_CLEARANCE", "corner-adjacent openings should be blocked");

const overlapIssues = getOpeningPlacementIssues(
  [
    { ...validOpenings[0]!, id: "door-a", offset: 0.6 },
    { ...validOpenings[0]!, id: "door-b", offset: 0.95 }
  ],
  walls
);
assert.equal(overlapIssues[0]?.code, "OPENING_OVERLAP", "overlapping openings should be rejected");

const reassigned = reassignOpeningToWall(validOpenings[0]!, "wall-b", walls);
assert.equal(reassigned.wallId, "wall-b", "wall selection should move the opening payload to the selected wall");
assert(
  reassigned.offset > 0 && reassigned.offset < 4,
  "wall reassignment should keep a stable relative offset on the new wall"
);

const sceneState: LegacySceneStoreStateLike = {
  scale: 1,
  scaleInfo: { value: 1, source: "user_measure", confidence: 1 },
  walls,
  openings: normalized,
  floors: [
    {
      id: "floor-1",
      outline: [
        [0, 0],
        [5, 0],
        [5, 4],
        [0, 4]
      ],
      materialId: null
    }
  ],
  ceilings: [],
  rooms: [],
  cameraAnchors: [],
  navGraph: { nodes: [], edges: [] },
  assets: [],
  wallMaterialIndex: 0,
  floorMaterialIndex: 0,
  lighting: {
    mode: "direct",
    ambientIntensity: 0.4,
    hemisphereIntensity: 0.4,
    directionalIntensity: 1.2,
    environmentBlur: 0.1,
    accentIntensity: 0.8,
    beamOpacity: 0.2
  }
};

const document = migrateLegacySceneStoreStateToV2(sceneState, {
  id: "verify-room-openings",
  version: 2
});
assert.equal(document.room.openings[0]?.offsetMm, 550, "opening offset must persist as mm");
assert.equal(document.room.openings[1]?.sillHeightMm, 900, "window sill height must persist as mm");
assert.equal(document.room.openings[0]?.isEntrance, true, "entrance door flag should persist");

Object.entries(DOOR_VISUALS).forEach(([variant, metadata]) => {
  assert.equal(
    existsSync(join(workspaceRoot, "public/assets/models", relativeAssetPath(metadata.assetPath))),
    true,
    `${variant} door GLB should exist for authored visuals`
  );
  assert(metadata.expectedFeatures.includes("slab"), `${variant} door metadata should require a slab`);
  assert(metadata.expectedFeatures.includes("handle"), `${variant} door metadata should require a handle`);
  assert(metadata.expectedFeatures.includes("threshold"), `${variant} door metadata should require a threshold`);
  assert.equal(
    metadata.pivotNames.length,
    metadata.openRotations.length,
    `${variant} door pivot metadata should match animation rotations`
  );

  const proceduralRoot = createProceduralDoorAsset(variant as keyof typeof DOOR_VISUALS);
  const summary = summarizeOpeningVisual(proceduralRoot);
  metadata.fallbackNodeNames.forEach((nodeName) => {
    assert(
      summary.nodeNames.includes(nodeName),
      `${variant} door fallback should expose ${nodeName} for visual smoke inspection`
    );
  });
  assert(summary.meshCount >= 4, `${variant} door fallback should contain multiple renderable meshes`);
  if (variant === "french") {
    assert(summary.transparentMeshCount >= 2, "french door fallback should include transparent glass panels");
  }

  const luminance = computeMaterialLuminanceSummary(proceduralRoot);
  assert(
    luminance.min <= 0.32 && luminance.max - luminance.min >= 0.2,
    `${variant} door fallback materials should maintain visible contrast against light walls`
  );
});

Object.entries(WINDOW_VISUALS).forEach(([variant, metadata]) => {
  assert.equal(
    existsSync(join(workspaceRoot, "public/assets/models", relativeAssetPath(metadata.assetPath))),
    true,
    `${variant} window GLB should exist for authored visuals`
  );
  assert(metadata.expectedFeatures.includes("glass"), `${variant} window metadata should require glass`);
  assert(metadata.expectedFeatures.includes("mullion"), `${variant} window metadata should require a mullion`);
  assert(metadata.expectedFeatures.includes("sill"), `${variant} window metadata should require a sill`);

  const proceduralRoot = createProceduralWindowAsset(variant as keyof typeof WINDOW_VISUALS);
  const summary = summarizeOpeningVisual(proceduralRoot);
  metadata.fallbackNodeNames.forEach((nodeName) => {
    assert(
      summary.nodeNames.includes(nodeName),
      `${variant} window fallback should expose ${nodeName} for visual smoke inspection`
    );
  });
  assert(summary.transparentMeshCount >= 1, `${variant} window fallback should include transparent glass`);

  const luminance = computeMaterialLuminanceSummary(proceduralRoot);
  assert(
    luminance.min <= 0.46 && luminance.max - luminance.min >= 0.18,
    `${variant} window fallback materials should maintain contrast against light walls`
  );
});

assert.equal(
  OPENING_TRIM_NODE_NAMES.door.includes("DoorThreshold"),
  true,
  "door trim metadata should expose threshold smoke hooks"
);
assert.equal(
  OPENING_TRIM_NODE_NAMES.window.includes("WindowInteriorSill"),
  true,
  "window trim metadata should expose interior sill smoke hooks"
);

const sceneViewportSource = readSource("components/editor/SceneViewport.tsx");
assert(
  sceneViewportSource.includes('import InteractiveDoors from "../canvas/features/InteractiveDoors";'),
  "SceneViewport should import the shared opening renderer"
);
assert(
  sceneViewportSource.includes("{renderOpeningDecor ? <InteractiveDoors /> : null}"),
  "SceneViewport should mount InteractiveDoors directly"
);

assert.deepEqual(OPENING_RENDERER_PATHS.builder, ["BuilderPreviewPane", "SceneViewport", "InteractiveDoors"]);
assert.deepEqual(OPENING_RENDERER_PATHS.editor, ["ProjectEditorViewport", "CanvasHost", "SceneViewport", "InteractiveDoors"]);
assert.deepEqual(OPENING_RENDERER_PATHS.shared, ["ReadOnlyViewerViewport", "CanvasHost", "SceneViewport", "InteractiveDoors"]);

const builderSource = readSource("features/builder/BuilderPreviewPane.tsx");
assert(
  builderSource.includes('import { SceneViewport } from "../../components/editor/SceneViewport";'),
  "builder preview should render through SceneViewport"
);
const editorViewportSource = readSource("components/editor/ProjectEditorViewport.tsx");
const canvasHostSource = readSource("components/editor/CanvasHost.tsx");
assert(
  editorViewportSource.includes('import { CanvasHost } from "./CanvasHost";'),
  "editor viewport should render through CanvasHost"
);
assert(
  canvasHostSource.includes('import { SceneViewport } from "./SceneViewport";'),
  "CanvasHost should render through SceneViewport"
);

const sharedViewportSource = readSource("components/viewer/ReadOnlyViewerViewport.tsx");
assert(
  sharedViewportSource.includes('import { CanvasHost } from "../editor/CanvasHost";'),
  "shared viewer should render through CanvasHost"
);

const interactiveDoorsSource = readSource("components/canvas/features/InteractiveDoors.tsx");
assert(
  interactiveDoorsSource.includes("OpeningModelErrorBoundary"),
  "InteractiveDoors should guard GLB load failures with an error boundary"
);
assert(
  interactiveDoorsSource.includes("DoorProceduralFallback") &&
    interactiveDoorsSource.includes("WindowProceduralFallback"),
  "InteractiveDoors should expose procedural fallbacks for both door and window visuals"
);
assert(
  interactiveDoorsSource.includes("openingVisual"),
  "InteractiveDoors should attach opening visual metadata for smoke/debug inspection"
);
assert(
  interactiveDoorsSource.includes("OPENING_TRIM_NODE_NAMES"),
  "InteractiveDoors trim should use exported smoke-hook node names"
);

console.log("[verify:room-openings] PASS");
