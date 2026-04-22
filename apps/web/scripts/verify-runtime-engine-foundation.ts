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
      materialId: null,
      roomId: "room-1",
      roomType: "other",
      label: "Engine Test Room"
    }
  ],
  ceilings: [],
  rooms: [],
  cameraAnchors: [],
  navGraph: {
    nodes: [],
    edges: []
  },
  assets: [
    {
      id: "desk-1",
      assetId: "p2s_desk_oak",
      catalogItemId: "p2s_desk_oak",
      position: [1.8, 0, 1.2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      materialId: null
    },
    {
      id: "lamp-1",
      assetId: "p2s_desk_lamp_glow",
      catalogItemId: "p2s_desk_lamp_glow",
      anchorType: "desk_surface",
      supportAssetId: "desk-1",
      position: [1.55, 0.74, 1.04],
      rotation: [0, 0.2, 0],
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
    id: "verify-runtime-engine",
    version: 2
  });
  const engine = createEngine(document);
  const sourceLampPlacement = JSON.stringify(
    engine.runtimeScene.sourceDocument.objects.find((object) => object.id === "lamp-1")?.placement
  );

  engine.previewObjectTransform("lamp-1", {
    position: [1.9, 0.84, 1.1]
  });

  assert(
    JSON.stringify(engine.runtimeScene.sourceDocument.objects.find((object) => object.id === "lamp-1")?.placement) ===
      sourceLampPlacement,
    "preview should not mutate source SceneDocument"
  );
  assert(engine.buildDocumentPatch().length === 0, "preview should not emit SceneDocument patches");

  engine.commitObjectPreview("lamp-1");
  const patches = engine.buildDocumentPatch();
  assert(patches.length === 1, `expected one patch after commit, received ${patches.length}`);
  assert(patches[0]?.objectId === "lamp-1", "lamp patch missing");

  const exported = engine.exportDocument();
  const exportedLamp = exported.objects.find((object) => object.id === "lamp-1");
  assert(exportedLamp?.placement.mode === "world", "committed preview should export as world placement");

  console.log("runtime engine foundation ok");
  console.log(
    JSON.stringify(
      {
        sceneId: exported.id,
        patchCount: patches.length,
        lampPlacement: exportedLamp?.placement
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-runtime-engine-foundation] failed");
  console.error(error);
  process.exitCode = 1;
}
