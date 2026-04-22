import { createEngine } from "@deskterioronline/engine-core";
import {
  migrateLegacySceneStoreStateToV2,
  type LegacySceneStoreStateLike
} from "@deskterioronline/scene-schema";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const baseState: LegacySceneStoreStateLike = {
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
  const initialDocument = migrateLegacySceneStoreStateToV2(baseState, {
    id: "verify-runtime-engine-document-sync",
    version: 2
  });
  const engine = createEngine(initialDocument);
  const originalSceneRef = engine.runtimeScene;
  const originalGeneration = engine.runtimeScene.generation;

  const addedDocument = migrateLegacySceneStoreStateToV2(
    {
      ...baseState,
      assets: [
        {
          ...baseState.assets[0]!,
          materialId: "oak-dark"
        },
        {
          id: "lamp-1",
          assetId: "p2s_desk_lamp_glow",
          catalogItemId: "p2s_desk_lamp_glow",
          position: [1.55, 0.74, 1.04],
          rotation: [0, 0.2, 0],
          scale: [1, 1, 1],
          materialId: "lamp-brass"
        }
      ]
    },
    {
      id: "verify-runtime-engine-document-sync",
      version: 2
    }
  );

  engine.syncDocument(addedDocument);
  assert(engine.runtimeScene === originalSceneRef, "syncDocument should preserve runtimeScene reference");
  assert(engine.runtimeScene.generation === originalGeneration + 1, "structural add should bump scene generation");
  assert(engine.runtimeScene.objectRegistry.size === 2, "added object should appear in runtime registry");
  assert(engine.runtimeScene.objectRegistry.get("desk-1")?.materialId === "oak-dark", "updated material should sync into runtime object");
  assert(engine.runtimeScene.objectRegistry.get("lamp-1")?.assetId === "p2s_desk_lamp_glow", "new object should sync into runtime scene");
  engine.runtimeScene.selectionState.selectedObjectId = "lamp-1";
  engine.runtimeScene.hoverState.hoveredObjectId = "lamp-1";

  const visibilityDocument = migrateLegacySceneStoreStateToV2(
    {
      ...baseState,
      assets: [
        {
          ...baseState.assets[0]!,
          materialId: "oak-dark",
          visible: false
        },
        {
          id: "lamp-1",
          assetId: "p2s_desk_lamp_glow",
          catalogItemId: "p2s_desk_lamp_glow",
          position: [1.55, 0.74, 1.04],
          rotation: [0, 0.2, 0],
          scale: [1, 1, 1],
          materialId: "lamp-brass"
        }
      ]
    },
    {
      id: "verify-runtime-engine-document-sync",
      version: 2
    }
  );

  const generationBeforeVisibilitySync = engine.runtimeScene.generation;
  engine.syncDocument(visibilityDocument);
  assert(engine.runtimeScene.generation === generationBeforeVisibilitySync, "visibility toggle should not bump scene generation");
  assert(engine.runtimeScene.objectRegistry.get("desk-1")?.visible === false, "visibility toggle should sync into runtime object");
  assert(engine.runtimeScene.dirtyObjectIds.has("desk-1"), "visibility toggle should mark the object dirty for renderer sync");

  const removedDocument = migrateLegacySceneStoreStateToV2(
    {
      ...baseState,
      assets: [
        {
          ...baseState.assets[0]!,
          position: [1.8, 0, 1.4],
          materialId: "oak-dark"
        }
      ]
    },
    {
      id: "verify-runtime-engine-document-sync",
      version: 2
    }
  );

  engine.syncDocument(removedDocument);
  assert(engine.runtimeScene === originalSceneRef, "syncDocument should continue to preserve runtimeScene reference");
  assert(Number(engine.runtimeScene.objectRegistry.size) === 1, "removed object should disappear from runtime registry");
  assert(engine.runtimeScene.objectRegistry.get("lamp-1") === undefined, "removed object should not remain in runtime registry");
  assert(engine.runtimeScene.objectRegistry.get("desk-1")?.placement.mode === "world", "remaining object placement should stay canonical");
  assert(engine.runtimeScene.dirtyObjectIds.has("desk-1"), "updated object should be marked dirty for renderer sync");
  assert(engine.runtimeScene.selectionState.selectedObjectId === null, "removed selected object should clear runtime selection state");
  assert(engine.runtimeScene.hoverState.hoveredObjectId === null, "removed hovered object should clear runtime hover state");

  console.log("runtime engine document sync ok");
  console.log(
    JSON.stringify(
      {
        generation: engine.runtimeScene.generation,
        objectCount: engine.runtimeScene.objectRegistry.size,
        deskMaterial: engine.runtimeScene.objectRegistry.get("desk-1")?.materialId ?? null,
        deskVisible: engine.runtimeScene.objectRegistry.get("desk-1")?.visible ?? null
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-runtime-engine-document-sync] failed");
  console.error(error);
  process.exitCode = 1;
}
