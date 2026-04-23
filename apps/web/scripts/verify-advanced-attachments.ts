import { createEngine } from "@deskterioronline/engine-core";
import { MonitorArmSolver, PlacementKernel } from "@deskterioronline/placement-kernel";
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
      position: [1.6, 0, 1.2],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    },
    {
      id: "arm-1",
      assetId: "p2s_monitor_arm",
      catalogItemId: "p2s_monitor_arm",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    },
    {
      id: "monitor-1",
      assetId: "p2s_monitor_27",
      catalogItemId: "p2s_monitor_27",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    },
    {
      id: "monitor-2",
      assetId: "p2s_monitor_24",
      catalogItemId: "p2s_monitor_24",
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
        id: "back_edge",
        type: "desk_edge",
        localFrame: {
          originMm: [0, 700, -280],
          tangentU: [1000, 0, 0],
          tangentV: [0, 1000, 0],
          normal: [0, 0, -1000]
        },
        boundsMm: { min: [-600, -20], max: [600, 20] },
        thicknessMm: 40,
        allowedAttachments: ["edge_clamp"]
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
    assetId: "p2s_monitor_arm",
    units: "mm",
    dimensionsMm: { width: 120, depth: 220, height: 420 },
    scaleLocked: true,
    pivot: { x: "center", y: "floor", z: "center" },
    sourceProvenance: { method: "manual", license: "internal", attributionRequired: false },
    runtime: {
      lods: [{ id: "lod0", level: 0, model: "arm.glb", triangleCount: 12000, drawCallBudget: 8 }],
      proxy: "arm.proxy.glb",
      defaultLod: 0,
      triangleBudget: 12000,
      textureBudgetMb: 24
    },
    colliders: [],
    supportSurfaces: [
      {
        id: "vesa_plate",
        type: "monitor_back",
        localFrame: {
          originMm: [0, 420, 0],
          tangentU: [1000, 0, 0],
          tangentV: [0, 1000, 0],
          normal: [0, 0, -1000]
        },
        boundsMm: { min: [-60, -60], max: [60, 60] },
        allowedAttachments: ["vesa_mount"]
      }
    ],
    attachmentPoints: [
      {
        id: "edge-clamp-base",
        type: "edge_clamp",
        localPositionMm: [0, 0, 0],
        localNormal: [0, 0, -1000],
        localTangent: [1000, 0, 0],
        compatibleWith: ["back_edge", "desk_edge"],
        constraints: {
          requiredThicknessMm: [20, 60]
        }
      }
    ],
    materialVariants: [{ id: "default", label: "Default" }],
    articulation: {
      type: "monitor_arm",
      joints: [
        {
          id: "base_pan",
          parent: null,
          type: "revolute",
          axis: [0, 1000, 0],
          limitDeg: [-90, 90],
          defaultValue: 0
        },
        {
          id: "arm_reach",
          parent: "base_pan",
          type: "prismatic",
          axis: [0, 0, 1000],
          limitMm: [0, 260],
          defaultValue: 140
        },
        {
          id: "head_tilt",
          parent: "arm_reach",
          type: "revolute",
          axis: [1000, 0, 0],
          limitDeg: [-25, 35],
          defaultValue: 0
        }
      ],
      endEffector: {
        id: "vesa_plate",
        compatiblePatternsMm: [100, 100]
      },
      solver: {
        type: "analytic",
        iterations: 1,
        toleranceMm: 5
      }
    },
    qaStatus: {
      status: "passed",
      measuredBoundsMm: { width: 120, depth: 220, height: 420 },
      dimensionErrorMm: { width: 0, depth: 0, height: 0 },
      validatorVersion: "alpha"
    }
  },
  {
    assetId: "p2s_monitor_27",
    units: "mm",
    dimensionsMm: { width: 612, depth: 190, height: 540 },
    scaleLocked: true,
    pivot: { x: "center", y: "floor", z: "center" },
    sourceProvenance: { method: "manual", license: "internal", attributionRequired: false },
    runtime: {
      lods: [{ id: "lod0", level: 0, model: "monitor.glb", triangleCount: 9000, drawCallBudget: 5 }],
      proxy: "monitor.proxy.glb",
      defaultLod: 0,
      triangleBudget: 9000,
      textureBudgetMb: 16
    },
    colliders: [],
    supportSurfaces: [],
    attachmentPoints: [
      {
        id: "vesa_100_plate",
        type: "vesa_mount",
        localPositionMm: [0, 270, -20],
        localNormal: [0, 0, -1000],
        localTangent: [1000, 0, 0],
        compatibleWith: ["vesa_plate", "monitor_back"],
        constraints: {
          vesaPatternMm: [100, 100]
        }
      }
    ],
    materialVariants: [{ id: "default", label: "Default" }],
    qaStatus: {
      status: "passed",
      measuredBoundsMm: { width: 612, depth: 190, height: 540 },
      dimensionErrorMm: { width: 0, depth: 0, height: 0 },
      validatorVersion: "alpha"
    }
  },
  {
    assetId: "p2s_monitor_24",
    units: "mm",
    dimensionsMm: { width: 545, depth: 170, height: 500 },
    scaleLocked: true,
    pivot: { x: "center", y: "floor", z: "center" },
    sourceProvenance: { method: "manual", license: "internal", attributionRequired: false },
    runtime: {
      lods: [{ id: "lod0", level: 0, model: "monitor-small.glb", triangleCount: 7000, drawCallBudget: 4 }],
      proxy: "monitor-small.proxy.glb",
      defaultLod: 0,
      triangleBudget: 7000,
      textureBudgetMb: 12
    },
    colliders: [],
    supportSurfaces: [],
    attachmentPoints: [
      {
        id: "vesa_75_plate",
        type: "vesa_mount",
        localPositionMm: [0, 250, -20],
        localNormal: [0, 0, -1000],
        localTangent: [1000, 0, 0],
        compatibleWith: ["vesa_plate", "monitor_back"],
        constraints: {
          vesaPatternMm: [75, 75]
        }
      }
    ],
    materialVariants: [{ id: "default", label: "Default" }],
    qaStatus: {
      status: "passed",
      measuredBoundsMm: { width: 545, depth: 170, height: 500 },
      dimensionErrorMm: { width: 0, depth: 0, height: 0 },
      validatorVersion: "alpha"
    }
  }
];

try {
  const document = migrateLegacySceneStoreStateToV2(state, {
    id: "verify-advanced-attachments",
    version: 2
  });
  const engine = createEngine(document, runtimeAssets);
  const kernel = new PlacementKernel(engine);
  const monitorArmSolver = new MonitorArmSolver();

  const edgeClampTransaction = kernel.begin({
    objectId: "arm-1",
    supportObjectId: "desk-1",
    attachmentType: "edge_clamp"
  });
  const edgeClampState = edgeClampTransaction.update({
    uMm: 140,
    vMm: 8,
    normalOffsetMm: 0,
    rotationMilliDeg: 0
  });
  assert(
    edgeClampState.constraintReport?.valid === true,
    "monitor arm edge clamp should pass support thickness validation"
  );
  edgeClampTransaction.commit();

  const vesaTransaction = kernel.begin({
    objectId: "monitor-1",
    supportObjectId: "arm-1",
    attachmentType: "vesa_mount"
  });
  const vesaState = vesaTransaction.update({
    uMm: 80,
    vMm: 18,
    normalOffsetMm: 120,
    rotationMilliDeg: 0
  });
  assert(
    vesaState.constraintReport?.valid === true,
    "vesa-mounted monitor should pass articulated arm compatibility validation"
  );
  const vesaCommitted = vesaTransaction.commit();
  assert(
    vesaCommitted.attachmentType === "vesa_mount" && vesaCommitted.surfaceId === "vesa_plate",
    "vesa-mounted monitor should persist on the monitor-arm end-effector surface"
  );

  const mismatchedPatternTransaction = kernel.begin({
    objectId: "monitor-2",
    supportObjectId: "arm-1",
    attachmentType: "vesa_mount"
  });
  const mismatchedPatternState = mismatchedPatternTransaction.update({
    uMm: 60,
    vMm: 12,
    normalOffsetMm: 120,
    rotationMilliDeg: 0
  });
  assert(
    mismatchedPatternState.constraintReport?.errors.some(
      (issue) => issue.code === "VESA_PATTERN_INCOMPATIBLE"
    ),
    "mismatched monitor patterns should be rejected before commit"
  );

  const articulationReachable = monitorArmSolver.solve(
    runtimeAssets[1]!.articulation!,
    {
      positionMm: [60, 20, 180]
    }
  );
  assert(
    articulationReachable.reachable === true &&
      typeof articulationReachable.joints.base_pan === "number" &&
      typeof articulationReachable.joints.arm_reach === "number",
    "monitor-arm solver should produce reachable joint values for an in-range target"
  );

  const articulationUnreachable = monitorArmSolver.solve(
    runtimeAssets[1]!.articulation!,
    {
      positionMm: [480, 240, 420]
    }
  );
  assert(
    articulationUnreachable.reachable === false &&
      articulationUnreachable.errors.some(
        (issue) => issue.code === "ARTICULATION_TARGET_UNREACHABLE"
      ),
    "monitor-arm solver should flag unreachable targets when joint limits are exceeded"
  );

  console.log("advanced attachments ok");
  console.log(
    JSON.stringify(
      {
        edgeClampValid: edgeClampState.constraintReport?.valid ?? false,
        vesaValid: vesaState.constraintReport?.valid ?? false,
        vesaPlacement: vesaCommitted,
        articulationReachableJoints: articulationReachable.joints,
        articulationUnreachableErrors: articulationUnreachable.errors.map((issue) => issue.code)
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-advanced-attachments] failed");
  console.error(error);
  process.exitCode = 1;
}
