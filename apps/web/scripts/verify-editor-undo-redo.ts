import { createEngine } from "@deskterioronline/engine-core";
import { PlacementKernel } from "@deskterioronline/placement-kernel";
import {
  migrateLegacySceneStoreStateToV2,
  type LegacySceneStoreStateLike,
  type RuntimeAsset
} from "@deskterioronline/scene-schema";
import { commitRuntimePlacementToStore } from "../src/lib/runtime/runtime-asset-bridge";
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
      supportProfile: {
        surfaces: [
          {
            id: "desk-top",
            anchorTypes: ["desk_surface", "furniture_surface"],
            center: [0, 0],
            size: [1.33, 0.58],
            top: 0.755,
            margin: [0.08, 0.08]
          }
        ]
      },
      position: [1.6, 0, 1.2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      materialId: null
    },
    {
      id: "mouse-1",
      assetId: "p2s_mouse_wireless",
      catalogItemId: "p2s_mouse_wireless",
      position: [0.28, 0, 0.18],
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

const runtimeAssets: RuntimeAsset[] = [
  {
    assetId: "p2s_desk_oak",
    units: "mm",
    dimensionsMm: { width: 1330, depth: 581, height: 755 },
    scaleLocked: true,
    pivot: { x: "center", y: "floor", z: "center" },
    sourceProvenance: { method: "manual", license: "internal", attributionRequired: false },
    runtime: {
      lods: [{ id: "lod0", level: 0, model: "desk.glb", triangleCount: 2000, drawCallBudget: 16 }],
      proxy: "desk.proxy.glb",
      defaultLod: 0,
      triangleBudget: 2000,
      textureBudgetMb: 24
    },
    colliders: [],
    supportSurfaces: [
      {
        id: "desk-top",
        type: "desktop_top",
        localFrame: {
          originMm: [0, 755, 0],
          tangentU: [1000, 0, 0],
          tangentV: [0, 0, 1000],
          normal: [0, 1000, 0]
        },
        boundsMm: { min: [-585, -210], max: [585, 210] },
        allowedAttachments: ["place_on_surface", "edge_clamp"]
      }
    ],
    attachmentPoints: [],
    materialVariants: [{ id: "default", label: "Default" }],
    qaStatus: {
      status: "passed",
      measuredBoundsMm: { width: 1330, depth: 581, height: 755 },
      dimensionErrorMm: { width: 0, depth: 0, height: 0 },
      validatorVersion: "alpha"
    }
  },
  {
    assetId: "p2s_mouse_wireless",
    units: "mm",
    dimensionsMm: { width: 84, depth: 126, height: 52 },
    scaleLocked: true,
    pivot: { x: "center", y: "floor", z: "center" },
    sourceProvenance: { method: "manual", license: "internal", attributionRequired: false },
    runtime: {
      lods: [{ id: "lod0", level: 0, model: "mouse.glb", triangleCount: 3000, drawCallBudget: 3 }],
      proxy: "mouse.proxy.glb",
      defaultLod: 0,
      triangleBudget: 3000,
      textureBudgetMb: 8
    },
    colliders: [],
    supportSurfaces: [],
    attachmentPoints: [],
    materialVariants: [{ id: "default", label: "Default" }],
    qaStatus: {
      status: "passed",
      measuredBoundsMm: { width: 84, depth: 126, height: 52 },
      dimensionErrorMm: { width: 0, depth: 0, height: 0 },
      validatorVersion: "alpha"
    }
  }
];

try {
  useSceneStore.getState().resetScene();
  useSceneStore.getState().setScene(legacyState as any);
  useSceneStore.getState().initializeHistory("세션 시작");

  const document = migrateLegacySceneStoreStateToV2(legacyState, {
    id: "verify-editor-undo-redo",
    version: 2
  });
  const engine = createEngine(document, runtimeAssets);
  const kernel = new PlacementKernel(engine);

  const transaction = kernel.begin({
    objectId: "mouse-1",
    supportObjectId: "desk-1",
    attachmentType: "place_on_surface",
    surfaceId: "desk-top"
  });

  const transactionState = transaction.update({
    uMm: 120,
    vMm: 40,
    normalOffsetMm: 0,
    rotationMilliDeg: 15000
  });

  assert(transactionState.constraintReport?.valid, "placement transaction should evaluate as valid");
  transaction.commit();
  const patches = commitRuntimePlacementToStore({
    objectId: "mouse-1",
    engine,
    store: useSceneStore.getState()
  });
  assert(patches.length === 1, `expected one patch after placement commit, received ${patches.length}`);
  useSceneStore.getState().recordSnapshot("집중 배치");

  const placed = useSceneStore.getState().assets.find((asset) => asset.id === "mouse-1");
  assert(placed?.placement?.mode === "surface_local", "mouse should be surface_local after commit");
  assert(placed.supportAssetId === "desk-1", "mouse should be anchored to desk after commit");

  useSceneStore.getState().undo();
  const undone = useSceneStore.getState().assets.find((asset) => asset.id === "mouse-1");
  assert(undone?.placement === null, "undo should restore the pre-placement null store snapshot");
  assert(undone.supportAssetId === null, "undo should clear support asset");

  useSceneStore.getState().redo();
  const redone = useSceneStore.getState().assets.find((asset) => asset.id === "mouse-1");
  assert(redone?.placement?.mode === "surface_local", "redo should restore surface placement");
  assert(redone.supportAssetId === "desk-1", "redo should restore support asset");

  console.log("editor undo/redo ok");
  console.log(
    JSON.stringify(
      {
        snapshots: useSceneStore.getState().versionHistory.snapshots.length,
        currentIndex: useSceneStore.getState().versionHistory.currentIndex,
        placement: redone?.placement
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-editor-undo-redo] failed");
  console.error(error);
  process.exitCode = 1;
}
