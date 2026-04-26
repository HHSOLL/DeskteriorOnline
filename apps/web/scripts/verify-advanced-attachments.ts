import { readFileSync } from "node:fs";
import path from "node:path";
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

function loadPublishedRuntimeAsset(assetKey: string): RuntimeAsset {
  const descriptorPath = path.resolve(
    process.cwd(),
    "public",
    "assets",
    "catalog",
    "runtime-packages",
    `${assetKey}.json`
  );
  const descriptor = JSON.parse(readFileSync(descriptorPath, "utf8")) as {
    runtimeAsset?: RuntimeAsset;
  };
  assert(descriptor.runtimeAsset, `${assetKey} published runtime package is missing runtimeAsset`);
  return descriptor.runtimeAsset;
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
    },
    {
      id: "tray-1",
      assetId: "p2s_under_desk_tray_mount",
      catalogItemId: "p2s_under_desk_tray_mount",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    },
    {
      id: "cable-1",
      assetId: "p2s_cable_route",
      catalogItemId: "p2s_cable_route",
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
        id: "desktop_top",
        type: "desktop_top",
        localFrame: {
          originMm: [0, 740, 0],
          tangentU: [1000, 0, 0],
          tangentV: [0, 0, 1000],
          normal: [0, 1000, 0]
        },
        boundsMm: { min: [-650, -300], max: [650, 300] },
        allowedAttachments: ["place_on_surface", "cable_route"]
      },
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
      },
      {
        id: "desk_underside",
        type: "desk_underside",
        localFrame: {
          originMm: [0, 700, 0],
          tangentU: [1000, 0, 0],
          tangentV: [0, 0, 1000],
          normal: [0, -1000, 0]
        },
        boundsMm: { min: [-650, -280], max: [650, 280] },
        thicknessMm: 40,
        allowedAttachments: ["underside_screw"],
        noPlaceZones: [{ min: [-260, -180], max: [260, 180] }]
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
    assetId: "p2s_under_desk_tray_mount",
    units: "mm",
    dimensionsMm: { width: 300, depth: 120, height: 70 },
    scaleLocked: true,
    pivot: { x: "center", y: "floor", z: "center" },
    sourceProvenance: { method: "manual", license: "internal", attributionRequired: false },
    runtime: {
      lods: [{ id: "lod0", level: 0, model: "tray.glb", triangleCount: 5000, drawCallBudget: 4 }],
      proxy: "tray.proxy.glb",
      defaultLod: 0,
      triangleBudget: 5000,
      textureBudgetMb: 8
    },
    colliders: [],
    supportSurfaces: [],
    attachmentPoints: [
      {
        id: "underside-screw-rail",
        type: "underside_screw",
        localPositionMm: [0, 70, 0],
        localNormal: [0, 1000, 0],
        localTangent: [1000, 0, 0],
        compatibleWith: ["desk_underside"],
        constraints: {
          minClearanceMm: 80,
          requiredThicknessMm: [20, 60]
        }
      }
    ],
    materialVariants: [{ id: "default", label: "Default" }],
    qaStatus: {
      status: "passed",
      measuredBoundsMm: { width: 300, depth: 120, height: 70 },
      dimensionErrorMm: { width: 0, depth: 0, height: 0 },
      validatorVersion: "alpha"
    }
  },
  {
    assetId: "p2s_cable_route",
    units: "mm",
    dimensionsMm: { width: 20, depth: 20, height: 12 },
    scaleLocked: true,
    pivot: { x: "center", y: "floor", z: "center" },
    sourceProvenance: { method: "manual", license: "internal", attributionRequired: false },
    runtime: {
      lods: [{ id: "lod0", level: 0, model: "cable.glb", triangleCount: 1000, drawCallBudget: 1 }],
      proxy: "cable.proxy.glb",
      defaultLod: 0,
      triangleBudget: 1000,
      textureBudgetMb: 2
    },
    colliders: [],
    supportSurfaces: [],
    attachmentPoints: [
      {
        id: "desktop-cable-route",
        type: "cable_route",
        localPositionMm: [0, 0, 0],
        localNormal: [0, 1000, 0],
        localTangent: [1000, 0, 0],
        compatibleWith: ["desktop_top"],
        constraints: {
          minClearanceMm: 5
        }
      }
    ],
    materialVariants: [{ id: "default", label: "Default" }],
    qaStatus: {
      status: "passed",
      measuredBoundsMm: { width: 20, depth: 20, height: 12 },
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
    uMm: 900,
    vMm: 80,
    normalOffsetMm: 0,
    rotationMilliDeg: 0
  });
  assert(
    edgeClampState.constraintReport?.valid === true &&
      edgeClampState.activeCandidate?.localPose.uMm === 600 &&
      edgeClampState.activeCandidate.localPose.vMm === 20,
    "monitor arm edge clamp should clamp to the authored edge and pass support thickness validation"
  );
  edgeClampTransaction.commit();

  const noThicknessRuntimeAssets = runtimeAssets.map((asset) =>
    asset.assetId === "p2s_desk_oak"
      ? {
          ...asset,
          supportSurfaces: asset.supportSurfaces.map((surface) =>
            surface.id === "back_edge"
              ? {
                  ...surface,
                  thicknessMm: undefined
                }
              : surface
          )
        }
      : asset
  );
  const noThicknessEngine = createEngine(document, noThicknessRuntimeAssets);
  const noThicknessKernel = new PlacementKernel(noThicknessEngine);
  const noThicknessTransaction = noThicknessKernel.begin({
    objectId: "arm-1",
    supportObjectId: "desk-1",
    attachmentType: "edge_clamp"
  });
  const noThicknessState = noThicknessTransaction.update({
    uMm: 140,
    vMm: 8,
    normalOffsetMm: 0,
    rotationMilliDeg: 0
  });
  assert(
    noThicknessState.constraintReport?.errors.some(
      (issue) => issue.code === "SURFACE_THICKNESS_MISSING"
    ),
    "edge clamp validation should fail when the support surface has no authored thickness"
  );

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
    vesaCommitted.mode === "surface_local" &&
      vesaCommitted.attachmentType === "vesa_mount" &&
      vesaCommitted.surfaceId === "vesa_plate",
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

  const trayTransaction = kernel.begin({
    objectId: "tray-1",
    supportObjectId: "desk-1",
    attachmentType: "underside_screw"
  });
  const trayState = trayTransaction.update({
    uMm: 430,
    vMm: 0,
    normalOffsetMm: 90,
    rotationMilliDeg: 0
  });
  assert(
    trayState.constraintReport?.valid === true,
    "under-desk tray should pass underside screw thickness and knee-clearance validation"
  );
  const trayCommitted = trayTransaction.commit();
  assert(
    trayCommitted.mode === "surface_local" &&
      trayCommitted.attachmentType === "underside_screw" &&
      trayCommitted.surfaceId === "desk_underside",
    "under-desk tray should persist the underside screw relation"
  );

  const kneeBlockedTransaction = kernel.begin({
    objectId: "tray-1",
    supportObjectId: "desk-1",
    attachmentType: "underside_screw"
  });
  const kneeBlockedState = kneeBlockedTransaction.update({
    uMm: 0,
    vMm: 0,
    normalOffsetMm: 40,
    rotationMilliDeg: 0
  });
  assert(
    kneeBlockedState.constraintReport?.errors.some(
      (issue) => issue.code === "KNEE_CLEARANCE_INSUFFICIENT" || issue.code === "KNEE_ZONE_OVERLAP"
    ),
    "under-desk tray should be rejected when it violates knee clearance"
  );

  const movedDeskDocument = migrateLegacySceneStoreStateToV2(
    {
      ...state,
      assets: [
        {
          id: "desk-rotated",
          assetId: "p2s_desk_oak",
          catalogItemId: "p2s_desk_oak",
          position: [2, 0, 1],
          rotation: [0, Math.PI / 2, 0],
          scale: [1, 1, 1]
        },
        {
          id: "tray-rotated",
          assetId: "p2s_under_desk_tray_mount",
          catalogItemId: "p2s_under_desk_tray_mount",
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        }
      ]
    },
    {
      id: "verify-rotated-surface-relation",
      version: 2
    }
  );
  const movedDeskEngine = createEngine(movedDeskDocument, runtimeAssets);
  const movedDeskKernel = new PlacementKernel(movedDeskEngine);
  const movedTrayTransaction = movedDeskKernel.begin({
    objectId: "tray-rotated",
    supportObjectId: "desk-rotated",
    attachmentType: "underside_screw"
  });
  const movedTrayState = movedTrayTransaction.update({
    uMm: 430,
    vMm: 0,
    normalOffsetMm: 90,
    rotationMilliDeg: 0
  });
  assert(movedTrayState.constraintReport?.valid === true, "rotated desk tray placement should remain valid");
  const movedTrayPreview = movedTrayTransaction.previewWorldTransform();
  assert(
    movedTrayPreview?.world.positionMm &&
      Math.abs(movedTrayPreview.world.positionMm[0] - 2000) <= 2 &&
      Math.abs(movedTrayPreview.world.positionMm[2] - 570) <= 2,
    "surface-local preview should follow the moved and rotated desk relation"
  );
  const movedTrayCommitted = movedTrayTransaction.commit();
  assert(
    movedTrayCommitted.mode === "surface_local" &&
      movedTrayCommitted.supportObjectId === "desk-rotated",
    "surface-local commit should persist the support relation after desk move/rotate"
  );

  const cableTransaction = kernel.begin({
    objectId: "cable-1",
    supportObjectId: "desk-1",
    surfaceId: "desktop_top",
    attachmentType: "cable_route"
  });
  const cableState = cableTransaction.update({
    localPose: {
      uMm: -500,
      vMm: 240,
      normalOffsetMm: 10,
      rotationMilliDeg: 0
    },
    cableRoute: {
      waypoints: [
        { uMm: -500, vMm: 240, normalOffsetMm: 10 },
        { uMm: -120, vMm: 240, normalOffsetMm: 10 },
        { uMm: 260, vMm: 120, normalOffsetMm: 10 }
      ],
      bendRadiusMm: 30,
      slackMm: 90
    }
  });
  assert(cableState.constraintReport?.valid === true, "valid desktop cable route should pass validation");
  const cableCommitted = cableTransaction.commit();
  assert(
    cableCommitted.mode === "surface_local" &&
      cableCommitted.attachmentType === "cable_route" &&
      cableCommitted.cableRoute?.waypoints.length === 3,
    "cable route placement should persist route waypoint data"
  );

  const invalidCableTransaction = kernel.begin({
    objectId: "cable-1",
    supportObjectId: "desk-1",
    surfaceId: "desktop_top",
    attachmentType: "cable_route"
  });
  const invalidCableState = invalidCableTransaction.update({
    localPose: {
      uMm: 0,
      vMm: 0,
      normalOffsetMm: 10,
      rotationMilliDeg: 0
    },
    cableRoute: {
      waypoints: [
        { uMm: -500, vMm: 240 },
        { uMm: 900, vMm: 240 }
      ],
      bendRadiusMm: -1
    }
  });
  assert(
    invalidCableState.constraintReport?.errors.some(
      (issue) =>
        issue.code === "CABLE_ROUTE_WAYPOINT_OUT_OF_BOUNDS" ||
        issue.code === "CABLE_ROUTE_BEND_RADIUS_INVALID"
    ),
    "invalid cable route geometry should be rejected before commit"
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

  const publishedDesk = loadPublishedRuntimeAsset("p2s_desk_oak");
  const publishedTray = loadPublishedRuntimeAsset("p2s_under_desk_tray_mount");
  assert(
    publishedDesk.supportSurfaces.some(
      (surface) =>
        surface.id === "desk-underside" &&
        surface.type === "desk_underside" &&
        surface.allowedAttachments.includes("underside_screw")
    ),
    "published desk package must include an underside screw-compatible support surface"
  );
  assert(
    publishedTray.attachmentPoints.some(
      (point) =>
        point.type === "underside_screw" &&
        (point.compatibleWith.includes("desk-underside") ||
          point.compatibleWith.includes("desk_underside"))
    ),
    "published under-desk tray package must include a compatible underside_screw attachment point"
  );

  const publishedState: LegacySceneStoreStateLike = {
    ...state,
    assets: [
      {
        id: "desk-published",
        assetId: publishedDesk.assetId,
        catalogItemId: publishedDesk.assetId,
        position: [1.6, 0, 1.2],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      },
      {
        id: "tray-published",
        assetId: publishedTray.assetId,
        catalogItemId: publishedTray.assetId,
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }
    ]
  };
  const publishedDocument = migrateLegacySceneStoreStateToV2(publishedState, {
    id: "verify-published-under-desk-attachment",
    version: 2
  });
  const publishedEngine = createEngine(publishedDocument, [publishedDesk, publishedTray]);
  const publishedKernel = new PlacementKernel(publishedEngine);
  const publishedTrayTransaction = publishedKernel.begin({
    objectId: "tray-published",
    supportObjectId: "desk-published",
    attachmentType: "underside_screw"
  });
  const publishedTrayState = publishedTrayTransaction.update({
    uMm: 0,
    vMm: 0,
    normalOffsetMm: 90,
    rotationMilliDeg: 0
  });
  assert(
    publishedTrayState.constraintReport?.valid === true,
    "published under-desk tray must pass real desk_underside attachment validation"
  );
  const publishedTrayCommitted = publishedTrayTransaction.commit();
  assert(
    publishedTrayCommitted.mode === "surface_local" &&
      publishedTrayCommitted.attachmentType === "underside_screw" &&
      publishedTrayCommitted.supportObjectId === "desk-published" &&
      publishedTrayCommitted.surfaceId === "desk-underside",
    "published under-desk tray commit must persist the desk underside attachment relation"
  );

  console.log("advanced attachments ok");
  console.log(
    JSON.stringify(
      {
        edgeClampValid: edgeClampState.constraintReport?.valid ?? false,
        vesaValid: vesaState.constraintReport?.valid ?? false,
        vesaPlacement: vesaCommitted,
        localUnderDeskTrayValid: trayState.constraintReport?.valid ?? false,
        localUnderDeskTrayPlacement: trayCommitted,
        movedRotatedDeskPlacement: movedTrayCommitted,
        cableRoutePlacement: cableCommitted,
        publishedUnderDeskTrayValid: publishedTrayState.constraintReport?.valid ?? false,
        publishedUnderDeskTrayPlacement: publishedTrayCommitted,
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
