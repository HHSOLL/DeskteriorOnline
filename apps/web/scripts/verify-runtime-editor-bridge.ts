import { createEngine } from "@deskterioronline/engine-core";
import {
  migrateLegacySceneStoreStateToV2,
  type LegacySceneStoreStateLike
} from "@deskterioronline/scene-schema";
import {
  beginRuntimeAssetPreview,
  commitRuntimeAssetUpdateToStore,
  previewRuntimeAssetTransform
} from "../src/lib/runtime/runtime-asset-bridge";
import { useSceneStore } from "../src/lib/stores/useSceneStore";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const legacyState: LegacySceneStoreStateLike = {
  scale: 1,
  scaleInfo: {
    value: 1,
    source: "user_measure" as const,
    confidence: 1
  },
  walls: [],
  openings: [],
  floors: [
    {
      id: "floor-1",
      outline: [
        [0, 0] as [number, number],
        [4, 0] as [number, number],
        [4, 3] as [number, number],
        [0, 3] as [number, number]
      ],
      materialId: null
    }
  ],
  ceilings: [],
  rooms: [],
  cameraAnchors: [],
  navGraph: { nodes: [], edges: [] },
  assets: [
    {
      id: "desk-1",
      assetId: "p2s_desk_oak",
      catalogItemId: "p2s_desk_oak",
      position: [1.2, 0, 1.1],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      materialId: null
    }
  ],
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

try {
  const document = migrateLegacySceneStoreStateToV2(legacyState, {
    id: "verify-runtime-editor-bridge",
    version: 2
  });
  const engine = createEngine(document);
  const store = useSceneStore.getState();
  store.resetScene();
  useSceneStore.setState({
    walls: legacyState.walls as ReturnType<typeof useSceneStore.getState>["walls"],
    openings: legacyState.openings as ReturnType<typeof useSceneStore.getState>["openings"],
    floors: legacyState.floors as ReturnType<typeof useSceneStore.getState>["floors"],
    ceilings: legacyState.ceilings as ReturnType<typeof useSceneStore.getState>["ceilings"],
    rooms: legacyState.rooms as ReturnType<typeof useSceneStore.getState>["rooms"],
    cameraAnchors: legacyState.cameraAnchors as ReturnType<
      typeof useSceneStore.getState
    >["cameraAnchors"],
    navGraph: legacyState.navGraph as ReturnType<typeof useSceneStore.getState>["navGraph"],
    scale: legacyState.scale,
    scaleInfo: legacyState.scaleInfo as ReturnType<typeof useSceneStore.getState>["scaleInfo"],
    assets: legacyState.assets as ReturnType<typeof useSceneStore.getState>["assets"]
  });

  beginRuntimeAssetPreview("desk-1", engine);
  previewRuntimeAssetTransform(
    "desk-1",
    {
      position: [1.8, 0, 1.6]
    },
    engine
  );

  const storeBeforeCommit = useSceneStore.getState().assets.find((asset) => asset.id === "desk-1");
  assert(storeBeforeCommit?.position[0] === 1.2, "preview should not mutate the store asset");

  const patches = commitRuntimeAssetUpdateToStore({
    objectId: "desk-1",
    updates: {
      position: [1.8, 0, 1.6]
    },
    engine,
    store: useSceneStore.getState()
  });

  const storeAfterCommit = useSceneStore.getState().assets.find((asset) => asset.id === "desk-1");
  assert(storeAfterCommit?.position[0] === 1.8, "commit should update the store asset");
  assert(patches.length === 1, `expected one runtime patch, received ${patches.length}`);
  assert(patches[0]?.objectId === "desk-1", "runtime patch should target the moved asset");

  console.log("runtime editor bridge ok");
  console.log(
    JSON.stringify(
      {
        patchCount: patches.length,
        nextPlacement: patches[0]?.nextPlacement,
        storePosition: storeAfterCommit?.position
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-runtime-editor-bridge] failed");
  console.error(error);
  process.exitCode = 1;
}
