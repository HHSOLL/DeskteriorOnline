import { createEngine } from "@deskterioronline/engine-core";
import { PlacementKernel } from "@deskterioronline/placement-kernel";
import {
  migrateLegacySceneStoreStateToV2,
  type LegacySceneStoreStateLike,
  type RuntimeAsset
} from "@deskterioronline/scene-schema";
import { commitRuntimePlacementToStore } from "../src/lib/runtime/runtime-asset-bridge";
import {
  PLAN2SPACE_RUNTIME_DOCUMENT_PATCH_EVENT
} from "../src/lib/runtime/runtime-asset-bridge";
import { resolveFocusPlacementSessionUpdate } from "../src/lib/runtime/focus-placement-session";
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
            id: "desktop_top",
            anchorTypes: ["desk_surface"],
            center: [0, 0],
            size: [1.2, 0.6],
            top: 0.74,
            margin: [0.04, 0.04]
          }
        ]
      },
      position: [1.6, 0, 1.2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      materialId: null,
      product: {
        id: "p2s_desk_oak",
        name: "Desk",
        category: "desk",
        dimensionsMm: { width: 1600, depth: 700, height: 740 },
        pivot: { x: "center", y: "floor", z: "center" },
        collisionProxy: { kind: "box", derivesFrom: "dimensionsMm" },
        lodProfile: { strategy: "single_mesh", levelCount: 1, maxDrawCalls: 8, maxTriangleCount: 12000 },
        textureSet: { workflow: "pbr_metallic_roughness", authored: "procedural", ktx2Ready: false },
        scaleLocked: true
      }
    },
    {
      id: "mouse-1",
      assetId: "p2s_mouse_wireless",
      catalogItemId: "p2s_mouse_wireless",
      position: [0.2, 0, 0.2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      materialId: null,
      product: {
        id: "p2s_mouse_wireless",
        name: "Mouse",
        category: "desk_accessory",
        dimensionsMm: { width: 84, depth: 126, height: 52 },
        pivot: { x: "center", y: "floor", z: "center" },
        collisionProxy: { kind: "box", derivesFrom: "dimensionsMm" },
        lodProfile: { strategy: "single_mesh", levelCount: 1, maxDrawCalls: 3, maxTriangleCount: 3000 },
        textureSet: { workflow: "pbr_metallic_roughness", authored: "procedural", ktx2Ready: false },
        scaleLocked: true
      }
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
    dimensionsMm: { width: 1600, depth: 700, height: 740 },
    scaleLocked: true,
    pivot: { x: "center", y: "floor", z: "center" },
    sourceProvenance: { method: "manual", license: "internal", attributionRequired: false },
    runtime: {
      lods: [{ id: "lod0", level: 0, model: "desk.glb", triangleCount: 12000, drawCallBudget: 8 }],
      proxy: "desk.proxy.glb",
      defaultLod: 0,
      triangleBudget: 12000,
      textureBudgetMb: 24
    },
    colliders: [],
    supportSurfaces: [
      {
        id: "desktop_top",
        type: "desktop_top",
        localFrame: {
          originMm: [0, 740, 0],
          tangentU: [1000, 0, 0],
          tangentV: [0, 0, 1000],
          normal: [0, 1000, 0]
        },
        boundsMm: { min: [-600, -300], max: [600, 300] },
        allowedAttachments: ["place_on_surface"]
      }
    ],
    attachmentPoints: [],
    materialVariants: [{ id: "default", label: "Default" }],
    qaStatus: {
      status: "passed",
      measuredBoundsMm: { width: 1600, depth: 700, height: 740 },
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

const originalWindow = (globalThis as { window?: unknown }).window;

try {
  const fakeWindow = Object.assign(new EventTarget(), {
    __DESKTERIORONLINE_RUNTIME_LAST_PATCHES__: [] as unknown[]
  });
  (globalThis as { window?: unknown }).window = fakeWindow;
  let patchEventCount: number = 0;
  let lastPatchCount: number = 0;
  fakeWindow.addEventListener(PLAN2SPACE_RUNTIME_DOCUMENT_PATCH_EVENT, (event) => {
    patchEventCount += 1;
    const detail = (event as CustomEvent<{ patchCount?: number }>).detail;
    lastPatchCount = detail?.patchCount ?? 0;
  });

  const document = migrateLegacySceneStoreStateToV2(legacyState, {
    id: "verify-focus-placement",
    version: 2
  });
  const engine = createEngine(document, runtimeAssets);
  const kernel = new PlacementKernel(engine);
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

  const transaction = kernel.begin({
    objectId: "mouse-1",
    supportObjectId: "desk-1",
    surfaceId: "desktop_top",
    attachmentType: "place_on_surface"
  });

  let prematureCommitFailed = false;
  try {
    transaction.commit();
  } catch {
    prematureCommitFailed = true;
  }
  assert(prematureCommitFailed, "focus placement should refuse commit before validation runs");

  const requestedPose = {
    uMm: 183,
    vMm: -92,
    normalOffsetMm: 2,
    rotationMilliDeg: 5375
  };
  const nextState = transaction.update(requestedPose);
  const sessionUpdate = resolveFocusPlacementSessionUpdate(requestedPose, nextState);
  assert(
    sessionUpdate.localPose.uMm === 185 &&
      sessionUpdate.localPose.vMm === -90 &&
      sessionUpdate.localPose.normalOffsetMm === 0 &&
      sessionUpdate.localPose.rotationMilliDeg === 5000,
    "focus placement session should adopt snapped local pose from the kernel"
  );
  const previewPlacement = transaction.previewWorldTransform();
  assert(previewPlacement?.mode === "world", "preview should expose a world transform snapshot");
  assert(
    previewPlacement.world.positionMm[0] === 1785 &&
      previewPlacement.world.positionMm[1] === 740 &&
      previewPlacement.world.positionMm[2] === 1110,
    "preview world transform should follow the focused support surface"
  );
  assert(nextState.constraintReport?.valid === true, "desk-top prototype update should stay valid");
  assert(Number(patchEventCount) === 0, "focus placement should not publish document patches before commit");

  const invalidTransaction = kernel.begin({
    objectId: "mouse-1",
    supportObjectId: "desk-1",
    surfaceId: "desktop_top",
    attachmentType: "place_on_surface"
  });
  const invalidState = invalidTransaction.update({
    uMm: 1000,
    vMm: 0,
    normalOffsetMm: 0,
    rotationMilliDeg: 0
  });
  assert(invalidState.constraintReport?.valid === false, "out-of-bounds candidate should become invalid");
  let invalidCommitFailed = false;
  try {
    invalidTransaction.commit();
  } catch {
    invalidCommitFailed = true;
  }
  assert(invalidCommitFailed, "focus placement should keep invalid candidates from committing");
  invalidTransaction.cancel();
  assert(
    engine.runtimeScene.objectRegistry.get("mouse-1")?.previewTransform === null,
    "cancel should clear runtime preview state"
  );

  transaction.commit();
  const patches = commitRuntimePlacementToStore({
    objectId: "mouse-1",
    engine,
    store: useSceneStore.getState()
  });

  const storedMouse = useSceneStore.getState().assets.find((asset) => asset.id === "mouse-1");
  assert(storedMouse?.placement?.mode === "surface_local", "store should keep surface-local placement");
  assert(storedMouse?.supportAssetId === "desk-1", "surface-local commit should preserve support asset relation");
  assert(storedMouse?.anchorType === "desk_surface", "surface-local commit should resolve desk-surface anchor");
  assert(patches.length === 1, `expected one placement patch, received ${patches.length}`);
  assert(
    Number(patchEventCount) === 1 && Number(lastPatchCount) === 1,
    "focus placement should publish exactly one patch event on commit"
  );

  console.log("focus placement prototype ok");
  console.log(
    JSON.stringify(
      {
        patchCount: patches.length,
        runtimePatchEvents: patchEventCount,
        snappedPose: sessionUpdate.localPose,
        storePlacement: storedMouse?.placement,
        supportAssetId: storedMouse?.supportAssetId,
        anchorType: storedMouse?.anchorType
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-focus-placement-prototype] failed");
  console.error(error);
  process.exitCode = 1;
} finally {
  if (typeof globalThis !== "undefined") {
    if (typeof originalWindow === "undefined") {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  }
}
