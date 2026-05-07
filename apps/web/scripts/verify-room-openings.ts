import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { migrateLegacySceneStoreStateToV2, type LegacySceneStoreStateLike } from "@deskterioronline/scene-schema";
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

[
  "p2s_opening_door_single/p2s_opening_door_single.glb",
  "p2s_opening_door_double/p2s_opening_door_double.glb",
  "p2s_opening_door_french/p2s_opening_door_french.glb",
  "p2s_opening_window_single/p2s_opening_window_single.glb",
  "p2s_opening_window_wide/p2s_opening_window_wide.glb"
].forEach((assetPath) => {
  assert.equal(
    existsSync(join(process.cwd(), "public/assets/models", assetPath)),
    true,
    `${assetPath} should exist for non-placeholder opening visuals`
  );
});

console.log("[verify:room-openings] PASS");
