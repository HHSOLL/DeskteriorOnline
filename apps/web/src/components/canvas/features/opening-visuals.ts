import * as THREE from "three";

export type DoorVariant = "single" | "double" | "french";
export type WindowVariant = "single" | "wide";

export type OpeningVisualFeature =
  | "frame"
  | "casing"
  | "molding"
  | "threshold"
  | "sill"
  | "slab"
  | "handle"
  | "glass"
  | "mullion";

export type OpeningRendererPathKey = "builder" | "editor" | "shared";

type DoorVisualMetadata = {
  type: "door";
  assetPath: string;
  pivotNames: string[];
  openRotations: number[];
  expectedFeatures: readonly OpeningVisualFeature[];
  fallbackNodeNames: readonly string[];
};

type WindowVisualMetadata = {
  type: "window";
  assetPath: string;
  expectedFeatures: readonly OpeningVisualFeature[];
  fallbackNodeNames: readonly string[];
};

export const OPENING_RENDERER_PATHS: Record<OpeningRendererPathKey, readonly string[]> = {
  builder: ["BuilderPreviewPane", "SceneViewport", "InteractiveDoors"],
  editor: ["ProjectEditorViewport", "CanvasHost", "SceneViewport", "InteractiveDoors"],
  shared: ["ReadOnlyViewerViewport", "CanvasHost", "SceneViewport", "InteractiveDoors"]
} as const;

export const DOOR_VISUALS: Record<DoorVariant, DoorVisualMetadata> = {
  single: {
    type: "door",
    assetPath: "/assets/models/p2s_opening_door_single/p2s_opening_door_single.glb",
    pivotNames: ["DoorLeafPivot"],
    openRotations: [-Math.PI / 2.35],
    expectedFeatures: ["frame", "casing", "molding", "threshold", "slab", "handle"],
    fallbackNodeNames: ["DoorLeafPivot", "DoorLeafPanel", "DoorPlate", "DoorKnobExterior", "DoorKnobInterior"]
  },
  double: {
    type: "door",
    assetPath: "/assets/models/p2s_opening_door_double/p2s_opening_door_double.glb",
    pivotNames: ["DoorLeafLeftPivot", "DoorLeafRightPivot"],
    openRotations: [-Math.PI / 2.5, Math.PI / 2.5],
    expectedFeatures: ["frame", "casing", "molding", "threshold", "slab", "handle"],
    fallbackNodeNames: [
      "DoorLeafLeftPivot",
      "DoorLeafRightPivot",
      "DoorLeafLeftPanel",
      "DoorLeafRightPanel",
      "DoorHandleLeftPlate",
      "DoorHandleRightPlate"
    ]
  },
  french: {
    type: "door",
    assetPath: "/assets/models/p2s_opening_door_french/p2s_opening_door_french.glb",
    pivotNames: ["DoorLeafLeftPivot", "DoorLeafRightPivot"],
    openRotations: [-Math.PI / 2.7, Math.PI / 2.7],
    expectedFeatures: ["frame", "casing", "molding", "threshold", "slab", "handle", "glass", "mullion"],
    fallbackNodeNames: [
      "DoorLeafLeftPivot",
      "DoorLeafRightPivot",
      "DoorLeafLeftGlass",
      "DoorLeafRightGlass",
      "DoorLeafLeftMullion",
      "DoorLeafRightMullion"
    ]
  }
};

export const WINDOW_VISUALS: Record<WindowVariant, WindowVisualMetadata> = {
  single: {
    type: "window",
    assetPath: "/assets/models/p2s_opening_window_single/p2s_opening_window_single.glb",
    expectedFeatures: ["frame", "casing", "molding", "sill", "glass", "mullion"],
    fallbackNodeNames: ["WindowOuterFrame", "WindowInnerFrame", "WindowGlass", "WindowMullionCenter"]
  },
  wide: {
    type: "window",
    assetPath: "/assets/models/p2s_opening_window_wide/p2s_opening_window_wide.glb",
    expectedFeatures: ["frame", "casing", "molding", "sill", "glass", "mullion"],
    fallbackNodeNames: [
      "WindowOuterFrame",
      "WindowInnerFrame",
      "WindowGlassLeft",
      "WindowGlassRight",
      "WindowMullionLeft",
      "WindowMullionRight"
    ]
  }
};

export const OPENING_TRIM_NODE_NAMES = {
  door: [
    "DoorJambLeft",
    "DoorJambRight",
    "DoorJambHead",
    "DoorCasingFrontLeft",
    "DoorCasingFrontRight",
    "DoorCasingFrontHead",
    "DoorCasingBackLeft",
    "DoorCasingBackRight",
    "DoorCasingBackHead",
    "DoorThreshold"
  ],
  window: [
    "WindowJambLeft",
    "WindowJambRight",
    "WindowJambHead",
    "WindowJambSill",
    "WindowCasingFrontLeft",
    "WindowCasingFrontRight",
    "WindowCasingFrontHead",
    "WindowCasingFrontBottom",
    "WindowCasingBackLeft",
    "WindowCasingBackRight",
    "WindowCasingBackHead",
    "WindowCasingBackBottom",
    "WindowInteriorSill"
  ]
} as const;

function addNamedMesh(
  parent: THREE.Object3D,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number]
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(position[0], position[1], position[2]);
  parent.add(mesh);
  return mesh;
}

function createDoorMaterials() {
  return {
    slab: new THREE.MeshStandardMaterial({
      color: "#7c5a3f",
      roughness: 0.54,
      metalness: 0.08
    }),
    inset: new THREE.MeshStandardMaterial({
      color: "#cdb497",
      roughness: 0.66,
      metalness: 0.02
    }),
    hardware: new THREE.MeshStandardMaterial({
      color: "#9a7746",
      roughness: 0.28,
      metalness: 0.9
    }),
    glass: new THREE.MeshStandardMaterial({
      color: "#c7deee",
      roughness: 0.08,
      metalness: 0.02,
      transparent: true,
      opacity: 0.34
    })
  };
}

function createWindowMaterials() {
  return {
    frame: new THREE.MeshStandardMaterial({
      color: "#6c655c",
      roughness: 0.58,
      metalness: 0.12
    }),
    frameAccent: new THREE.MeshStandardMaterial({
      color: "#d1c3b2",
      roughness: 0.72,
      metalness: 0.02
    }),
    glass: new THREE.MeshStandardMaterial({
      color: "#c3dceb",
      roughness: 0.06,
      metalness: 0.02,
      transparent: true,
      opacity: 0.3
    })
  };
}

export function resolveDoorVariant(width: number): DoorVariant {
  if (width >= 1.52) return "french";
  if (width >= 1.16) return "double";
  return "single";
}

export function resolveWindowVariant(width: number): WindowVariant {
  return width >= 2.08 ? "wide" : "single";
}

function createDoorLeaf(
  parent: THREE.Object3D,
  options: {
    pivotName: string;
    panelName: string;
    width: number;
    x: number;
    hinge: "left" | "right";
    includeGlass: boolean;
    handlePrefix: string;
  }
) {
  const { slab, inset, hardware, glass } = createDoorMaterials();
  const pivot = new THREE.Group();
  pivot.name = options.pivotName;
  pivot.position.set(options.x, 0, 0);
  parent.add(pivot);

  const leafDepth = 0.1;
  const frameInset = Math.max(0.08, options.width * 0.12);
  const panelX = options.hinge === "left" ? options.width / 2 : -options.width / 2;
  addNamedMesh(
    pivot,
    options.panelName,
    new THREE.BoxGeometry(options.width, 2.06, leafDepth),
    slab,
    [panelX, 1.03, 0]
  );
  addNamedMesh(
    pivot,
    `${options.panelName}Inset`,
    new THREE.BoxGeometry(options.width - frameInset * 2, 1.52, leafDepth * 0.28),
    inset,
    [panelX, 1.04, leafDepth * 0.38]
  );

  if (options.includeGlass) {
    addNamedMesh(
      pivot,
      `${options.panelName.replace("Panel", "Glass")}`,
      new THREE.BoxGeometry(options.width - frameInset * 1.7, 0.72, leafDepth * 0.18),
      glass,
      [panelX, 1.52, leafDepth * 0.18]
    );
    addNamedMesh(
      pivot,
      `${options.panelName.replace("Panel", "Mullion")}`,
      new THREE.BoxGeometry(0.045, 0.76, leafDepth * 0.2),
      inset,
      [panelX, 1.52, leafDepth * 0.22]
    );
  }

  const handleSide = options.hinge === "left" ? 1 : -1;
  const handleCenterX = panelX + handleSide * (options.width / 2 - 0.08);
  addNamedMesh(
    pivot,
    `${options.handlePrefix}Plate`,
    new THREE.BoxGeometry(0.035, 0.2, 0.012),
    hardware,
    [handleCenterX, 1.03, 0.042]
  );
  addNamedMesh(
    pivot,
    `${options.handlePrefix}KnobExterior`,
    new THREE.SphereGeometry(0.026, 18, 18),
    hardware,
    [handleCenterX + handleSide * 0.018, 1.03, 0.068]
  );
  addNamedMesh(
    pivot,
    `${options.handlePrefix}KnobInterior`,
    new THREE.SphereGeometry(0.026, 18, 18),
    hardware,
    [handleCenterX + handleSide * 0.018, 1.03, -0.068]
  );
}

export function createProceduralDoorAsset(variant: DoorVariant) {
  const group = new THREE.Group();
  group.name = `ProceduralDoor:${variant}`;
  const width = variant === "single" ? 0.92 : variant === "double" ? 1.4 : 1.6;

  if (variant === "single") {
    createDoorLeaf(group, {
      pivotName: "DoorLeafPivot",
      panelName: "DoorLeafPanel",
      width,
      x: 0,
      hinge: "left",
      includeGlass: false,
      handlePrefix: "Door"
    });
    return group;
  }

  const leafWidth = width / 2;
  createDoorLeaf(group, {
    pivotName: "DoorLeafLeftPivot",
    panelName: "DoorLeafLeftPanel",
    width: leafWidth,
    x: 0,
    hinge: "left",
    includeGlass: variant === "french",
    handlePrefix: "DoorHandleLeft"
  });
  createDoorLeaf(group, {
    pivotName: "DoorLeafRightPivot",
    panelName: "DoorLeafRightPanel",
    width: leafWidth,
    x: width,
    hinge: "right",
    includeGlass: variant === "french",
    handlePrefix: "DoorHandleRight"
  });
  return group;
}

export function createProceduralWindowAsset(variant: WindowVariant) {
  const materials = createWindowMaterials();
  const group = new THREE.Group();
  group.name = `ProceduralWindow:${variant}`;
  const width = variant === "wide" ? 2.4 : 1.8;
  const height = variant === "wide" ? 1.34 : 1.24;
  const depth = 0.12;
  const frameThickness = 0.08;
  const sashThickness = 0.055;

  addNamedMesh(
    group,
    "WindowOuterFrame",
    new THREE.BoxGeometry(width, height, depth),
    materials.frame,
    [width / 2, height / 2, 0]
  );
  addNamedMesh(
    group,
    "WindowInnerFrame",
    new THREE.BoxGeometry(width - frameThickness * 1.35, height - frameThickness * 1.35, depth * 0.55),
    materials.frameAccent,
    [width / 2, height / 2, 0]
  );

  const clearWidth = width - frameThickness * 2.1;
  const clearHeight = height - frameThickness * 2.1;
  const paneCount = variant === "wide" ? 2 : 1;
  const paneGap = 0.03;
  const paneWidth = paneCount === 1 ? clearWidth : (clearWidth - paneGap) / 2;

  for (let index = 0; index < paneCount; index += 1) {
    const paneCenterX = frameThickness + paneWidth / 2 + index * (paneWidth + paneGap);
    const paneName = paneCount === 1 ? "WindowGlass" : index === 0 ? "WindowGlassLeft" : "WindowGlassRight";
    addNamedMesh(
      group,
      paneName,
      new THREE.BoxGeometry(paneWidth, clearHeight, depth * 0.16),
      materials.glass,
      [paneCenterX, height / 2, 0.014]
    );
  }

  const centerMullionHeight = clearHeight;
  if (variant === "wide") {
    const leftX = frameThickness + paneWidth;
    const rightX = frameThickness + paneWidth + paneGap;
    addNamedMesh(
      group,
      "WindowMullionLeft",
      new THREE.BoxGeometry(sashThickness, centerMullionHeight, depth * 0.22),
      materials.frame,
      [leftX, height / 2, 0]
    );
    addNamedMesh(
      group,
      "WindowMullionRight",
      new THREE.BoxGeometry(sashThickness, centerMullionHeight, depth * 0.22),
      materials.frame,
      [rightX, height / 2, 0]
    );
  } else {
    addNamedMesh(
      group,
      "WindowMullionCenter",
      new THREE.BoxGeometry(sashThickness, centerMullionHeight, depth * 0.22),
      materials.frame,
      [width / 2, height / 2, 0]
    );
  }

  const railCount = variant === "wide" ? 3 : 2;
  for (let index = 0; index < railCount; index += 1) {
    const y = frameThickness + (clearHeight / (railCount + 1)) * (index + 1);
    addNamedMesh(
      group,
      `WindowRail${index + 1}`,
      new THREE.BoxGeometry(clearWidth, 0.03, depth * 0.14),
      materials.frameAccent,
      [width / 2, y, 0.01]
    );
  }

  return group;
}

export function summarizeOpeningVisual(root: THREE.Object3D) {
  const nodeNames = new Set<string>();
  let meshCount = 0;
  let transparentMeshCount = 0;

  root.traverse((child) => {
    if (child.name) {
      nodeNames.add(child.name);
    }
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    meshCount += 1;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    if (materials.some((material) => material instanceof THREE.Material && material.transparent)) {
      transparentMeshCount += 1;
    }
  });

  return {
    nodeNames: Array.from(nodeNames).sort(),
    meshCount,
    transparentMeshCount
  };
}
