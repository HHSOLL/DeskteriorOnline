import { createEngine } from "@deskterioronline/engine-core";
import { PlacementKernel } from "@deskterioronline/placement-kernel";
import {
  migrateLegacySceneStoreStateToV2,
  type LegacySceneStoreStateLike,
  type RuntimeAsset
} from "@deskterioronline/scene-schema";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const state: LegacySceneStoreStateLike = {
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
      },
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
      scale: [1, 1, 1]
    },
    {
      id: "mouse-1",
      assetId: "p2s_mouse_wireless",
      catalogItemId: "p2s_mouse_wireless",
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
      },
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
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
  const document = migrateLegacySceneStoreStateToV2(state, {
    id: "verify-placement-kernel",
    version: 2
  });
  const runtimeAssets: RuntimeAsset[] = [
    {
      assetId: "p2s_desk_oak",
      units: "mm" as const,
      dimensionsMm: { width: 1600, depth: 700, height: 740 },
      scaleLocked: true as const,
      pivot: { x: "center" as const, y: "floor" as const, z: "center" as const },
      sourceProvenance: { method: "manual" as const, license: "internal", attributionRequired: false },
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
          type: "desktop_top" as const,
          localFrame: {
            originMm: [0, 740, 0] as [number, number, number],
            tangentU: [1, 0, 0] as [number, number, number],
            tangentV: [0, 0, 1] as [number, number, number],
            normal: [0, 1, 0] as [number, number, number]
          },
          boundsMm: { min: [-600, -300] as [number, number], max: [600, 300] as [number, number] },
          allowedAttachments: ["place_on_surface"]
        }
      ],
      attachmentPoints: [],
      materialVariants: [{ id: "default", label: "Default" }],
      qaStatus: {
        status: "passed" as const,
        measuredBoundsMm: { width: 1600, depth: 700, height: 740 },
        dimensionErrorMm: { width: 0, depth: 0, height: 0 },
        validatorVersion: "alpha"
      }
    }
  ];

  const engine = createEngine(document, runtimeAssets);
  const kernel = new PlacementKernel(engine);
  const transaction = kernel.begin({
    objectId: "mouse-1",
    supportObjectId: "desk-1",
    surfaceId: "desktop_top",
    attachmentType: "place_on_surface"
  });

  assert(transaction.getState().activeCandidate?.supportObjectId === "desk-1", "placement should start on desk");

  transaction.update({
    uMm: 260,
    vMm: 120,
    normalOffsetMm: 0,
    rotationMilliDeg: 12000
  });
  const previewPlacement = transaction.previewWorldTransform();
  assert(previewPlacement?.mode === "world", "preview should expose world placement while dragging");
  const committed = transaction.commit();
  assert(committed.mode === "surface_local", "placement commit should persist a surface-local placement");

  const patches = engine.buildDocumentPatch();
  assert(patches.length === 1, `expected one placement patch, received ${patches.length}`);
  assert(patches[0]?.nextPlacement.mode === "surface_local", "patch should keep surface-local placement");

  console.log("placement kernel foundation ok");
  console.log(JSON.stringify({ patchCount: patches.length, nextPlacement: patches[0]?.nextPlacement }, null, 2));
} catch (error) {
  console.error("[verify-placement-kernel-foundation] failed");
  console.error(error);
  process.exitCode = 1;
}
