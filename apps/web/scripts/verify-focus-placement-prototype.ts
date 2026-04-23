import { createEngine } from "@deskterioronline/engine-core";
import { PlacementKernel } from "@deskterioronline/placement-kernel";
import {
  migrateLegacySceneStoreStateToV2,
  type LegacySceneStoreStateLike,
  type RuntimeAsset,
  type SupportSurface
} from "@deskterioronline/scene-schema";
import { commitRuntimePlacementToStore } from "../src/lib/runtime/runtime-asset-bridge";
import {
  PLAN2SPACE_RUNTIME_DOCUMENT_PATCH_EVENT
} from "../src/lib/runtime/runtime-asset-bridge";
import {
  resolveFocusPlacementAttachmentLabel,
  resolveFocusPlacementEntry,
  resolveFocusPlacementFeedback,
  resolveFocusPlacementStepConfig,
  resolveNextFocusPlacementCandidateIndex,
  resolveFocusPlacementSessionUpdate,
  resolveFocusPlacementWizardState
} from "../src/lib/runtime/focus-placement-session";
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
    },
    {
      id: "clamp-light-1",
      assetId: "p2s_clamp_light",
      catalogItemId: "p2s_clamp_light",
      position: [0.5, 0, 0.3],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      materialId: null,
      product: {
        id: "p2s_clamp_light",
        name: "Clamp Light",
        category: "desk_accessory",
        dimensionsMm: { width: 120, depth: 240, height: 420 },
        pivot: { x: "center", y: "floor", z: "center" },
        collisionProxy: { kind: "box", derivesFrom: "dimensionsMm" },
        lodProfile: { strategy: "single_mesh", levelCount: 1, maxDrawCalls: 4, maxTriangleCount: 4800 },
        textureSet: { workflow: "pbr_metallic_roughness", authored: "procedural", ktx2Ready: false },
        scaleLocked: true
      }
    },
    {
      id: "arm-1",
      assetId: "p2s_monitor_arm",
      catalogItemId: "p2s_monitor_arm",
      position: [2.1, 0, 0.92],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      materialId: null,
      product: {
        id: "p2s_monitor_arm",
        name: "Monitor Arm",
        category: "desk_accessory",
        dimensionsMm: { width: 120, depth: 220, height: 420 },
        pivot: { x: "center", y: "floor", z: "center" },
        collisionProxy: { kind: "box", derivesFrom: "dimensionsMm" },
        lodProfile: { strategy: "single_mesh", levelCount: 1, maxDrawCalls: 6, maxTriangleCount: 9000 },
        textureSet: { workflow: "pbr_metallic_roughness", authored: "procedural", ktx2Ready: false },
        scaleLocked: true
      }
    },
    {
      id: "monitor-1",
      assetId: "p2s_monitor_27",
      catalogItemId: "p2s_monitor_27",
      position: [2.15, 0, 1.04],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      materialId: null,
      product: {
        id: "p2s_monitor_27",
        name: "Monitor",
        category: "monitor",
        dimensionsMm: { width: 612, depth: 190, height: 540 },
        pivot: { x: "center", y: "floor", z: "center" },
        collisionProxy: { kind: "box", derivesFrom: "dimensionsMm" },
        lodProfile: { strategy: "single_mesh", levelCount: 1, maxDrawCalls: 5, maxTriangleCount: 7000 },
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
      },
      {
        id: "desk_edge",
        type: "desk_edge",
        localFrame: {
          originMm: [0, 720, -300],
          tangentU: [1000, 0, 0],
          tangentV: [0, 1000, 0],
          normal: [0, 0, -1000]
        },
        boundsMm: { min: [-600, -40], max: [600, 40] },
        thicknessMm: 32,
        allowedAttachments: ["edge_clamp"]
      },
      {
        id: "desk_underside",
        type: "desk_underside",
        localFrame: {
          originMm: [0, 705, 0],
          tangentU: [1000, 0, 0],
          tangentV: [0, 0, 1000],
          normal: [0, -1000, 0]
        },
        boundsMm: { min: [-540, -220], max: [540, 220] },
        thicknessMm: 32,
        allowedAttachments: ["underside_screw"]
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
  },
  {
    assetId: "p2s_clamp_light",
    units: "mm",
    dimensionsMm: { width: 120, depth: 240, height: 420 },
    scaleLocked: true,
    pivot: { x: "center", y: "floor", z: "center" },
    sourceProvenance: { method: "manual", license: "internal", attributionRequired: false },
    runtime: {
      lods: [{ id: "lod0", level: 0, model: "clamp-light.glb", triangleCount: 4800, drawCallBudget: 4 }],
      proxy: "clamp-light.proxy.glb",
      defaultLod: 0,
      triangleBudget: 4800,
      textureBudgetMb: 12
    },
    colliders: [],
    supportSurfaces: [],
    attachmentPoints: [
      {
        id: "clamp-base",
        type: "edge_clamp",
        localPositionMm: [0, 0, 0],
        localNormal: [0, 0, -1000],
        localTangent: [1000, 0, 0],
        compatibleWith: ["desk_edge", "desk_edge"],
        constraints: {
          requiredThicknessMm: [20, 40],
          minClearanceMm: 30
        }
      }
    ],
    materialVariants: [{ id: "default", label: "Default" }],
    qaStatus: {
      status: "passed",
      measuredBoundsMm: { width: 120, depth: 240, height: 420 },
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
        compatibleWith: ["desk_edge"],
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
  const deskAsset = useSceneStore.getState().assets.find((asset) => asset.id === "desk-1") ?? null;
  const mouseAsset = useSceneStore.getState().assets.find((asset) => asset.id === "mouse-1") ?? null;
  const clampAsset = useSceneStore.getState().assets.find((asset) => asset.id === "clamp-light-1") ?? null;
  const armAsset = useSceneStore.getState().assets.find((asset) => asset.id === "arm-1") ?? null;
  const monitorAsset = useSceneStore.getState().assets.find((asset) => asset.id === "monitor-1") ?? null;
  const deskSurface = runtimeAssets[0]?.supportSurfaces[0] ?? null;
  assert(
    deskAsset && mouseAsset && clampAsset && armAsset && monitorAsset && deskSurface,
    "focus placement smoke requires desk, mouse, clamp, arm, monitor, and support surface fixtures"
  );

  const blockedEntry = resolveFocusPlacementEntry({
    selectedAsset: null,
    selectedRuntimeAsset: null,
    supportAsset: deskAsset,
    supportSurfaces: runtimeAssets[0]?.supportSurfaces ?? []
  });
  assert(
    blockedEntry.availability.enabled === false && blockedEntry.availability.hint.includes("제품"),
    "focus placement should expose a blocked hint when no selected asset is available"
  );

  const readyEntry = resolveFocusPlacementEntry({
    selectedAsset: mouseAsset,
    selectedRuntimeAsset: runtimeAssets.find((asset) => asset.assetId === "p2s_mouse_wireless") ?? null,
    supportAsset: deskAsset,
    supportSurfaces: runtimeAssets[0]?.supportSurfaces ?? []
  });
  assert(
    readyEntry.availability.enabled === true &&
      readyEntry.candidates[0]?.attachmentType === "place_on_surface" &&
      readyEntry.availability.hint.includes("정밀 배치"),
    "focus placement should expose a ready top-surface entry when the selected asset is compatible"
  );

  const mountedEntry = resolveFocusPlacementEntry({
    selectedAsset: clampAsset,
    selectedRuntimeAsset: runtimeAssets.find((asset) => asset.assetId === "p2s_clamp_light") ?? null,
    supportAsset: deskAsset,
    supportSurfaces: runtimeAssets[0]?.supportSurfaces ?? []
  });
  assert(
    mountedEntry.availability.enabled === true &&
      mountedEntry.candidates[0]?.attachmentType === "edge_clamp" &&
      mountedEntry.candidates[0]?.surfaceId === "desk_edge",
    "focus placement should prefer mounted edge candidates when the selected asset advertises edge clamp metadata"
  );
  assert(
    resolveNextFocusPlacementCandidateIndex(mountedEntry.candidates, 0) === 1,
    "focus placement should cycle between multiple surface candidates"
  );
  const mountedStep = resolveFocusPlacementStepConfig(
    mountedEntry.candidates[0]!.attachmentType,
    mountedEntry.candidates[0]!.surfaceType
  );
  assert(
    mountedStep.moveStepMm === 10 && mountedStep.rotateStepMilliDeg === 5000,
      "mounted focus placement should use the mounted snap rule budget"
  );
  const mountedWizardState = resolveFocusPlacementWizardState({
    attachmentType: "edge_clamp",
    localPose: {
      uMm: 140,
      vMm: 8,
      normalOffsetMm: 0,
      rotationMilliDeg: 0
    },
    selectedRuntimeAsset: runtimeAssets.find((asset) => asset.assetId === "p2s_clamp_light") ?? null,
    supportRuntimeAsset: runtimeAssets.find((asset) => asset.assetId === "p2s_desk_oak") ?? null,
    surfaceId: "desk_edge",
    constraintReport: {
      valid: true,
      errors: [],
      warnings: [],
      score: 1
    },
    collisionReport: {
      collided: false,
      collisions: []
    }
  });
  assert(
    mountedWizardState.mode === "default" &&
      mountedWizardState.requirements.some(
        (requirement) =>
          requirement.label === "Surface Thickness" &&
          requirement.value.includes("32 mm / req 20-40 mm") &&
          requirement.tone === "ready"
      ) &&
      mountedWizardState.requirements.some(
        (requirement) =>
          requirement.label === "Clearance" &&
          requirement.value.includes("req 30 mm") &&
          requirement.tone === "info"
      ),
    "mounted focus placement should expose authored thickness and clearance requirements for HUD rendering"
  );
  const wallFixture: SupportSurface = {
    id: "wall_mount",
    type: "wall",
    localFrame: {
      originMm: [0, 1200, -900],
      tangentU: [1000, 0, 0],
      tangentV: [0, 1000, 0],
      normal: [0, 0, 1000]
    },
    boundsMm: { min: [-400, -300], max: [400, 300] },
    allowedAttachments: ["wall_attach"]
  };
  const hybridMountedEntry = resolveFocusPlacementEntry({
    selectedAsset: clampAsset,
    selectedRuntimeAsset: {
      ...runtimeAssets.find((asset) => asset.assetId === "p2s_clamp_light")!,
      attachmentPoints: [
        {
          id: "clamp-base",
          type: "edge_clamp",
          localPositionMm: [0, 0, 0],
          localNormal: [0, 0, -1000],
          localTangent: [1000, 0, 0],
          compatibleWith: ["desk_edge"],
          constraints: { requiredThicknessMm: [20, 40] }
        },
        {
          id: "underdesk-bracket",
          type: "underside_screw",
          localPositionMm: [0, 0, 0],
          localNormal: [0, -1000, 0],
          localTangent: [1000, 0, 0],
          compatibleWith: ["desk_underside"],
          constraints: {}
        },
        {
          id: "wall-plate",
          type: "wall_attach",
          localPositionMm: [0, 0, 0],
          localNormal: [0, 0, 1000],
          localTangent: [1000, 0, 0],
          compatibleWith: ["wall", "wall_mount"],
          constraints: {}
        }
      ]
    },
    supportAsset: deskAsset,
    supportSurfaces: [...(runtimeAssets[0]?.supportSurfaces ?? []), wallFixture]
  });
  assert(
    hybridMountedEntry.candidates.some(
      (candidate) =>
        candidate.attachmentType === "underside_screw" &&
        candidate.surfaceType === "desk_underside" &&
        candidate.enabled
    ),
    "focus placement should surface underside candidates when runtime attachment metadata supports them"
  );
  assert(
    hybridMountedEntry.candidates.some(
      (candidate) =>
        candidate.attachmentType === "wall_attach" &&
        candidate.surfaceType === "wall" &&
        candidate.enabled
    ),
    "focus placement should surface wall-mount candidates when runtime attachment metadata supports them"
  );
  assert(
    resolveFocusPlacementAttachmentLabel("place_on_surface") === "Place On Surface",
    "focus placement should expose a stable attachment label for HUD rendering"
  );
  assert(
    resolveFocusPlacementAttachmentLabel("edge_clamp") === "Edge Clamp",
    "focus placement should expose mounted attachment labels for HUD rendering"
  );
  assert(
    resolveFocusPlacementAttachmentLabel("vesa_mount") === "VESA Mount",
    "focus placement should expose VESA labels for monitor-arm HUD rendering"
  );

  const vesaEntry = resolveFocusPlacementEntry({
    selectedAsset: monitorAsset,
    selectedRuntimeAsset: runtimeAssets.find((asset) => asset.assetId === "p2s_monitor_27") ?? null,
    supportAsset: armAsset,
    supportSurfaces: runtimeAssets.find((asset) => asset.assetId === "p2s_monitor_arm")?.supportSurfaces ?? []
  });
  assert(
    vesaEntry.availability.enabled === true &&
      vesaEntry.availability.hint.includes("모니터암") &&
      vesaEntry.candidates[0]?.attachmentType === "vesa_mount" &&
      vesaEntry.candidates[0]?.surfaceType === "monitor_back",
    "focus placement should surface articulated VESA candidates as a monitor-arm placement entry"
  );
  const vesaStep = resolveFocusPlacementStepConfig(
    vesaEntry.candidates[0]!.attachmentType,
    vesaEntry.candidates[0]!.surfaceType
  );
  assert(
    vesaStep.moveStepMm === 10 && vesaStep.rotateStepMilliDeg === 1000,
    "monitor-arm target pose should use the articulated step budget"
  );
  const monitorWizardState = resolveFocusPlacementWizardState({
    attachmentType: "vesa_mount",
    localPose: {
      uMm: 80,
      vMm: 18,
      normalOffsetMm: 140,
      rotationMilliDeg: 3000
    },
    selectedRuntimeAsset: runtimeAssets.find((asset) => asset.assetId === "p2s_monitor_27") ?? null,
    supportRuntimeAsset: runtimeAssets.find((asset) => asset.assetId === "p2s_monitor_arm") ?? null,
    constraintReport: {
      valid: true,
      errors: [],
      warnings: [],
      score: 1
    },
    collisionReport: {
      collided: false,
      collisions: []
    }
  });
  assert(
    monitorWizardState.mode === "monitor_arm" &&
      monitorWizardState.axisLabels.normal === "Reach" &&
      monitorWizardState.shortcutLines.some((line) => line.includes("PageUp / PageDown")) &&
      monitorWizardState.steps.some((step) => step.id === "target" && step.state === "active") &&
      monitorWizardState.joints.some((joint) => joint.id === "arm_reach" && joint.unit === "mm") &&
      monitorWizardState.requirements.some(
        (requirement) =>
          requirement.label === "VESA" &&
          requirement.value.includes("100x100 -> 100x100") &&
          requirement.tone === "ready"
      ) &&
      monitorWizardState.requirements.some(
        (requirement) =>
          requirement.label === "Arm Reach" &&
          requirement.value.includes("140 mm / 0-260 mm") &&
          requirement.tone === "ready"
      ) &&
      monitorWizardState.clearance === null &&
      monitorWizardState.vesaPatternLabel === "100x100" &&
      monitorWizardState.supportPatternLabel === "100x100",
    "focus placement should expose a monitor-arm wizard model with target pose, authored VESA metadata, and reach requirements"
  );

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
  const readyFeedback = resolveFocusPlacementFeedback(
    nextState.constraintReport ?? null,
    nextState.collisionReport ?? null
  );
  assert(readyFeedback.badgeLabel === "Ready", "valid focus placement should map to a ready HUD state");
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
  const blockedFeedback = resolveFocusPlacementFeedback(
    invalidState.constraintReport ?? null,
    invalidState.collisionReport ?? null
  );
  assert(
    blockedFeedback.badgeLabel === "Blocked" && blockedFeedback.blocked,
    "invalid focus placement should map to a blocked HUD state"
  );
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
