import { createEngine } from "@deskterioronline/engine-core";
import { ThreeRendererAdapter } from "@deskterioronline/renderer-three";
import {
  migrateLegacySceneStoreStateToV2,
  type LegacySceneStoreStateLike
} from "@deskterioronline/scene-schema";

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
      materialId: "oak-natural"
    },
    {
      id: "desk-2",
      assetId: "p2s_desk_oak",
      catalogItemId: "p2s_desk_oak",
      position: [2.4, 0, 1.1],
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
    id: "verify-runtime-renderer-adapter",
    version: 2
  });
  const engine = createEngine(document);
  const adapter = new ThreeRendererAdapter();

  const initialSync = adapter.syncRuntimeScene(engine.runtimeScene);
  assert(initialSync.syncedCount === 2, `expected initial sync count 2, received ${initialSync.syncedCount}`);

  const handle = adapter.getObjectHandle("desk-1");
  assert(handle, "renderer adapter should create an object handle");
  assert(handle.matrix?.length === 16, "renderer adapter should store a 4x4 matrix");
  assert(handle.materialId === "oak-natural", "renderer adapter should retain object material assignment");
  assert(adapter.materials.get("desk-1") === "oak-natural", "material registry should mirror object material assignment");

  const batch = adapter.batches.get("p2s_desk_oak:default");
  assert(batch, "renderer adapter should create an instance batch");
  assert(batch.objectIds.length === 2, "instance batch should contain both desks");
  const initialDeskX = adapter.getObjectHandle("desk-1")?.matrix?.[12] ?? 0;

  const previousVersion = handle.version;
  engine.beginObjectPreview("desk-1");
  engine.previewObjectTransform("desk-1", {
    position: [1.85, 0, 1.4]
  });
  const dirtySync = adapter.syncRuntimeScene(engine.runtimeScene);
  assert(dirtySync.syncedCount >= 1, "dirty runtime sync should process at least one object");
  assert((adapter.getObjectHandle("desk-1")?.version ?? 0) > previousVersion, "dirty sync should bump object version");
  assert(engine.runtimeScene.dirtyObjectIds.size === 0, "renderer sync should consume dirty runtime ids");

  const assetSwapDocument = migrateLegacySceneStoreStateToV2(
    {
      ...legacyState,
      assets: [
        {
          id: "desk-1",
          assetId: "p2s_desk_lamp_glow",
          catalogItemId: "p2s_desk_lamp_glow",
          position: [1.85, 0, 1.4],
          rotation: [0, 0.2, 0],
          scale: [1, 1, 1],
          materialId: "lamp-brass"
        },
        legacyState.assets[1]!
      ]
    },
    {
      id: "verify-runtime-renderer-adapter",
      version: 2
    }
  );

  const generationBeforeAssetSwap = engine.runtimeScene.generation;
  engine.syncDocument(assetSwapDocument);
  const assetSwapSync = adapter.syncRuntimeScene(engine.runtimeScene);
  assert(engine.runtimeScene.generation === generationBeforeAssetSwap, "same-room asset swap should not force a structural generation bump");
  assert(assetSwapSync.syncedCount >= 1, "asset swap should resync at least one renderer object");
  assert(adapter.getObjectHandle("desk-1")?.assetHandle.assetId === "p2s_desk_lamp_glow", "renderer object handle should refresh asset binding on incremental sync");
  assert(adapter.batches.get("p2s_desk_lamp_glow:default")?.objectIds.includes("desk-1"), "asset-swapped object should move into the new batch");
  assert(adapter.batches.get("p2s_desk_oak:default")?.objectIds.includes("desk-1") !== true, "asset-swapped object should leave the previous batch");

  const replacementDocument = migrateLegacySceneStoreStateToV2(
    {
      ...legacyState,
      assets: [
        {
          id: "desk-1",
          assetId: "p2s_desk_oak",
          catalogItemId: "p2s_desk_oak",
          position: [1.8, 0, 1.55],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          materialId: null
        }
      ]
    },
    {
      id: "verify-runtime-renderer-adapter",
      version: 2
    }
  );

  engine.replaceDocument(replacementDocument);
  const replacedSync = adapter.syncRuntimeScene(engine.runtimeScene);
  assert(replacedSync.syncedCount >= 1, "scene replacement should force a renderer resync");
  assert(adapter.getObjectHandle("desk-2") === null, "renderer adapter should dispose stale object handles");
  assert(adapter.batches.get("p2s_desk_oak:default")?.objectIds.length === 1, "instance batch should shrink after object removal");
  assert((adapter.getObjectHandle("desk-1")?.matrix?.[12] ?? 0) > initialDeskX, "renderer adapter should refresh matrix after document replacement");

  console.log("runtime renderer adapter ok");
  console.log(
    JSON.stringify(
      {
        initialSync,
        dirtySync,
        assetSwapSync,
        replacedSync,
        batchSize: adapter.batches.get("p2s_desk_oak:default")?.objectIds.length ?? 0,
        desk1Version: adapter.getObjectHandle("desk-1")?.version ?? 0
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-runtime-renderer-adapter] failed");
  console.error(error);
  process.exitCode = 1;
}
