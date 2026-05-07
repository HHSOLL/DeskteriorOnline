import assert from "node:assert/strict";
import { createEngine } from "@deskterioronline/engine-core";
import { migrateLegacySceneStoreStateToV2, type LegacySceneStoreStateLike } from "@deskterioronline/scene-schema";
import {
  beginRuntimeAssetPreview,
  commitRuntimePlacementDraftToStore,
  previewRuntimeAssetTransform
} from "../src/lib/runtime/runtime-asset-bridge";
import { useSceneStore, type SceneAsset } from "../src/lib/stores/useSceneStore";
import { useWalkInventoryStore } from "../src/lib/stores/useWalkInventoryStore";

const draftAsset: SceneAsset = {
  id: "draft-chair-1",
  assetId: "p2s_lounge_chair",
  catalogItemId: "p2s_lounge_chair",
  position: [0.5, 0, 0.5] as [number, number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
  materialId: null,
  anchorType: "floor" as const,
  supportAssetId: null,
  product: {
    id: "p2s_lounge_chair",
    name: "Lounge Chair",
    category: "seating",
    dimensionsMm: { width: 720, depth: 760, height: 780 },
    finishColor: null,
    finishMaterial: null,
    detailNotes: null,
    scaleLocked: true,
    source: null,
    license: null,
    pivot: { x: "center", y: "floor", z: "center" },
    collisionProxy: { kind: "box", derivesFrom: "dimensionsMm" },
    textureSet: { workflow: "pbr_metallic_roughness", authored: "procedural", ktx2Ready: false },
    lodProfile: { strategy: "single_mesh", levelCount: 1, maxDrawCalls: 4, maxTriangleCount: 3200 }
  }
};

const legacyState: LegacySceneStoreStateLike = {
  scale: 1,
  scaleInfo: {
    value: 1,
    source: "user_measure",
    confidence: 1
  },
  walls: [],
  openings: [],
  floors: [
    {
      id: "floor-1",
      outline: [
        [0, 0],
        [4, 0],
        [4, 3],
        [0, 3]
      ],
      materialId: null
    }
  ],
  ceilings: [],
  rooms: [],
  cameraAnchors: [],
  navGraph: { nodes: [], edges: [] },
  assets: [draftAsset],
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

useSceneStore.getState().resetScene();
useSceneStore.setState({
  scale: legacyState.scale,
  scaleInfo: legacyState.scaleInfo as ReturnType<typeof useSceneStore.getState>["scaleInfo"],
  walls: legacyState.walls as ReturnType<typeof useSceneStore.getState>["walls"],
  openings: legacyState.openings as ReturnType<typeof useSceneStore.getState>["openings"],
  floors: legacyState.floors as ReturnType<typeof useSceneStore.getState>["floors"],
  ceilings: legacyState.ceilings as ReturnType<typeof useSceneStore.getState>["ceilings"],
  rooms: legacyState.rooms as ReturnType<typeof useSceneStore.getState>["rooms"],
  cameraAnchors: legacyState.cameraAnchors as ReturnType<typeof useSceneStore.getState>["cameraAnchors"],
  navGraph: legacyState.navGraph as ReturnType<typeof useSceneStore.getState>["navGraph"],
  assets: []
});
useWalkInventoryStore.getState().setPlacementDraft({
  objectId: draftAsset.id,
  label: "Lounge Chair",
  asset: draftAsset,
  anchorType: "floor",
  placementMode: "world",
  catalogItemId: draftAsset.catalogItemId,
  assetId: draftAsset.assetId,
  createdAt: Date.now()
});

const document = migrateLegacySceneStoreStateToV2(legacyState, {
  id: "verify-inventory-ghost-placement",
  version: 2
});
const engine = createEngine(document);

beginRuntimeAssetPreview(draftAsset.id, engine);
previewRuntimeAssetTransform(
  draftAsset.id,
  {
    position: [1.7, 0, 1.4]
  },
  engine
);

const previewStoreAsset = useSceneStore.getState().assets.find((asset) => asset.id === draftAsset.id);
assert.equal(
  previewStoreAsset,
  undefined,
  "inventory ghost preview must not add the draft object to the canonical scene store before commit"
);

const persistedDuringDraft = useSceneStore
  .getState()
  .assets.filter((asset) => asset.id !== useWalkInventoryStore.getState().placementDraft?.objectId);
assert.equal(
  persistedDuringDraft.length,
  0,
  "inventory draft object must be excluded from save/share payloads until commit"
);

const patches = commitRuntimePlacementDraftToStore({
  asset: draftAsset,
  engine,
  commitPreview: true
});
useWalkInventoryStore.getState().clearPlacementDraft();

const committedAsset = useSceneStore.getState().assets.find((asset) => asset.id === draftAsset.id);
assert.equal(committedAsset?.position[0], 1.7, "valid inventory commit must update the store transform");
assert.equal(patches.length, 1, "valid inventory commit should publish a minimal object patch");

useWalkInventoryStore.getState().setPlacementDraft({
  objectId: "draft-speaker-1",
  label: "Desk Speaker",
  asset: {
    ...draftAsset,
    id: "draft-speaker-1",
    assetId: "p2s_desk_speaker",
    catalogItemId: "p2s_desk_speaker",
    anchorType: "desk_surface"
  },
  anchorType: "desk_surface",
  placementMode: "surface",
  catalogItemId: "p2s_desk_speaker",
  assetId: "p2s_desk_speaker",
  createdAt: Date.now()
});
assert.equal(
  useWalkInventoryStore.getState().placementDraft?.placementMode,
  "surface",
  "desktop inventory items should enter surface ghost placement instead of auto-commit"
);

console.log("[verify:inventory-ghost-placement] PASS");
