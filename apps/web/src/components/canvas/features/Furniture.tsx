"use client";

import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode
} from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { resolveTopViewInteractionPolicy } from "../../../lib/editor/top-view-policy";
import { useGLBAsset } from "../../../lib/loaders/AssetLoader";
import { constrainPlacementToAnchor } from "../../../lib/scene/anchors";
import { normalizeSceneAnchorType } from "../../../lib/scene/anchor-types";
import {
  groupAssetsForInstancing,
  resolveInstancedClusterMembershipKey
} from "../../../lib/scene/asset-instancing";
import {
  resolveAssetLodComplexity,
  resolveAssetLodPlan,
  type AssetLodPlan
} from "../../../lib/scene/asset-lod";
import { scheduleInteractionLatency } from "../../../lib/performance/scene-telemetry";
import { useRuntimeEngine } from "../../../lib/runtime/runtime-engine-context";
import {
  resolveFocusPlacementEntry,
  resolveFocusPlacementFeedback,
  resolveFocusSurfaceLabel
} from "../../../lib/runtime/focus-placement-session";
import { useRuntimeRendererAdapter } from "../../../lib/runtime/runtime-renderer-context";
import {
  applyRuntimeTransformToObject,
  resolveRuntimeAssetTransform,
  resolveRuntimeAssetVisibility
} from "../../../lib/runtime/runtime-render-sync";
import {
  beginRuntimeAssetPreview,
  cancelRuntimeAssetPreview,
  commitRuntimeAssetUpdateToStore,
  previewRuntimeAssetTransform
} from "../../../lib/runtime/runtime-asset-bridge";
import { buildFocusPlacementRequest } from "../../../lib/runtime/focus-placement-launch";
import { useFocusPlacementStore } from "../../../lib/stores/useFocusPlacementStore";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useWalkInventoryStore } from "../../../lib/stores/useWalkInventoryStore";
import {
  useAssetSelector,
  usePublishSelector,
  useSelectionSelector,
  useShellSelector
} from "../../../lib/stores/scene-slices";
import { useInteractionRegistry } from "../interaction/InteractionManager";
import type { SceneAsset } from "../../../lib/stores/useSceneStore";

declare global {
  interface Window {
    __DESKTERIORONLINE_FOCUS_PLACEMENT_AIM_REQUESTS__?: Record<string, unknown>;
    __DESKTERIORONLINE_FORCE_REAL_GLB_TOP_VIEW_QA__?: boolean;
    __DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__?: Record<
      string,
      {
        assetId: string;
        assetKey: string;
        catalogItemId: string | null;
        productName: string | null;
        source:
          | "builder-preview-proxy"
          | "placeholder-fallback"
          | "model-loading-fallback"
          | "real-glb"
          | "real-glb-lod"
          | "lod-proxy";
        viewMode: string;
        topMode: string;
        usesLodProxy: boolean;
      }
    >;
    __DESKTERIORONLINE_FURNITURE_GLB_LOADS__?: Record<
      string,
      {
        assetId: string;
        assetKey: string;
        catalogItemId: string | null;
        productName: string | null;
        source: "real-glb" | "real-glb-lod";
        status: "loaded";
        meshCount: number;
        materialCount: number;
        bounds: {
          width: number;
          height: number;
          depth: number;
        };
      }
    >;
  }
}

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const relativePreviewEuler = new THREE.Euler();
const MAX_DYNAMIC_EMITTERS = 6;
const LIGHT_EMITTER_HINT_IDS = new Set([
  "p2s_desk_lamp_glow",
  "desk_lamp_arm_01",
  "modern_ceiling_lamp_01",
  "hanging_industrial_lamp",
  "industrial_wall_lamp"
]);
const LIGHT_KEYWORDS = ["lamp", "light", "lighting", "조명", "light-emitter"];

type AssetLightProfile = {
  offset: [number, number, number];
  color: string;
  intensity: number;
  distance: number;
};

type BuilderProxyKind =
  | "desk"
  | "coffee-table"
  | "media-console"
  | "chair"
  | "shelf"
  | "sofa"
  | "monitor"
  | "keyboard"
  | "mouse"
  | "speaker"
  | "lamp"
  | "mat"
  | "plant"
  | "books"
  | "mug"
  | "gamepad"
  | "game-console"
  | "stand"
  | "decor";

type FinishAppearance = {
  tint: THREE.Color | null;
  tintStrength: number;
  roughness: number | null;
  metalness: number | null;
  roughnessBlend: number;
  metalnessBlend: number;
  emissiveTintMultiplier: number;
  allowSurfaceAdjustmentsOnEmissive: boolean;
};

type FinishMetadata = {
  finishColor: string | null | undefined;
  finishMaterial: string | null | undefined;
  detailNotes: string | null | undefined;
};

type InstancedMeshEntry = {
  key: string;
  mesh: THREE.InstancedMesh;
  sourceMatrix: THREE.Matrix4;
};

type AssetPlacementSnapshot = Pick<SceneAsset, "position" | "rotation" | "scale">;

type SlotFinishPolicy = {
  tintStrengthScale: number;
  tintStrengthMax: number;
  roughnessTarget: number | null;
  metalnessTarget: number | null;
  slotWeight: number;
  roughnessBlend: number;
  metalnessBlend: number;
  emissiveTintMultiplier: number;
  allowSurfaceAdjustmentsOnEmissive?: boolean;
};

type FurnitureRenderSource =
  | "builder-preview-proxy"
  | "placeholder-fallback"
  | "model-loading-fallback"
  | "real-glb"
  | "real-glb-lod"
  | "lod-proxy";

function isPlaceholderAsset(assetId: string) {
  return assetId.startsWith("placeholder:");
}

function resolveFurnitureRenderSourceName(source: FurnitureRenderSource, assetId: string) {
  return `furniture-render-source-${source}:${assetId}`;
}

function FurnitureRenderSourceMarker({
  source,
  assetId,
  children
}: {
  source: FurnitureRenderSource;
  assetId: string;
  children: ReactNode;
}) {
  return (
    <group
      name={resolveFurnitureRenderSourceName(source, assetId)}
      userData={{ furnitureRenderSource: source, assetId }}
    >
      {children}
    </group>
  );
}

function resolveFurnitureRenderSource({
  shouldRenderBuilderProxy,
  isPlaceholder,
  lodPlan
}: {
  shouldRenderBuilderProxy: boolean;
  isPlaceholder: boolean;
  lodPlan: AssetLodPlan;
}): FurnitureRenderSource {
  if (shouldRenderBuilderProxy) {
    return "builder-preview-proxy";
  }
  if (isPlaceholder) {
    return "placeholder-fallback";
  }
  if (lodPlan.useProxyBox && lodPlan.lowDetailDistance !== null) {
    return "real-glb-lod";
  }
  return "real-glb";
}

function applyPlacementToInstancedMeshes(
  instancedMeshes: InstancedMeshEntry[],
  instanceId: number,
  placement: AssetPlacementSnapshot
) {
  const assetMatrix = new THREE.Matrix4();
  const instanceMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scaleVector = new THREE.Vector3();

  position.fromArray(placement.position);
  quaternion.setFromEuler(
    new THREE.Euler(
      placement.rotation[0],
      placement.rotation[1],
      placement.rotation[2]
    )
  );
  scaleVector.fromArray(placement.scale);
  assetMatrix.compose(position, quaternion, scaleVector);

  instancedMeshes.forEach((entry) => {
    instanceMatrix.multiplyMatrices(assetMatrix, entry.sourceMatrix);
    entry.mesh.setMatrixAt(instanceId, instanceMatrix);
    entry.mesh.instanceMatrix.needsUpdate = true;
  });
}

function syncInstancedMeshesFromAssets(
  instancedMeshes: InstancedMeshEntry[],
  assets: SceneAsset[]
) {
  assets.forEach((asset, index) => {
    applyPlacementToInstancedMeshes(instancedMeshes, index, {
      position: asset.position,
      rotation: asset.rotation,
      scale: asset.scale
    });
  });
}

function findHighlightMesh(root: THREE.Object3D | null) {
  if (!root) {
    return null;
  }

  let highlightMesh: THREE.Mesh | null = null;
  root.traverse((child) => {
    if (!highlightMesh && child instanceof THREE.Mesh) {
      highlightMesh = child;
    }
  });
  return highlightMesh;
}

function isLightingAsset(asset: SceneAsset) {
  if (asset.catalogItemId && LIGHT_EMITTER_HINT_IDS.has(asset.catalogItemId)) {
    return true;
  }
  const haystack = [
    asset.catalogItemId ?? "",
    asset.assetId,
    asset.product?.name ?? "",
    asset.product?.category ?? "",
    asset.product?.options ?? ""
  ]
    .join(" ")
    .toLowerCase();
  return LIGHT_KEYWORDS.some((keyword) => haystack.includes(keyword.toLowerCase()));
}

function resolveAssetLightProfile(asset: SceneAsset): AssetLightProfile | null {
  if (!isLightingAsset(asset)) return null;

  const anchorType = normalizeSceneAnchorType(asset.anchorType);
  const normalizedText = [
    asset.assetId,
    asset.catalogItemId ?? "",
    asset.product?.name ?? "",
    asset.product?.options ?? ""
  ]
    .join(" ")
    .toLowerCase();
  const warm = normalizedText.includes("3000k") || normalizedText.includes("warm");
  const cool = normalizedText.includes("4000k") || normalizedText.includes("cool");
  const color = warm ? "#ffd29a" : cool ? "#d9ecff" : "#ffe6bf";

  if (anchorType === "ceiling") {
    return {
      offset: [0, -0.16, 0],
      color,
      intensity: 1.2,
      distance: 4.4
    };
  }

  if (anchorType === "wall") {
    return {
      offset: [0.06, 0.24, 0],
      color,
      intensity: 0.9,
      distance: 3.2
    };
  }

  return {
    offset: [0, 0.3, 0],
    color,
    intensity: 0.82,
    distance: 2.6
  };
}

const FINISH_COLOR_HINTS: Array<{ tokens: string[]; color: string }> = [
  { tokens: ["walnut", "espresso", "mocha"], color: "#6f4e37" },
  { tokens: ["oak", "maple", "birch", "pine", "ash"], color: "#c8a165" },
  { tokens: ["teak", "cedar", "wood", "brown"], color: "#9b6f4c" },
  { tokens: ["beige", "sand", "taupe", "linen", "oat"], color: "#d7c2a3" },
  { tokens: ["ivory", "cream", "off-white"], color: "#f2eadb" },
  { tokens: ["white"], color: "#f4f1ea" },
  { tokens: ["black", "onyx"], color: "#2b2b2b" },
  { tokens: ["charcoal", "graphite"], color: "#4a4f57" },
  { tokens: ["gray", "grey", "slate"], color: "#8a8f96" },
  { tokens: ["silver", "chrome", "aluminum", "aluminium"], color: "#bfc4cc" },
  { tokens: ["gold", "brass"], color: "#b89458" },
  { tokens: ["copper", "bronze"], color: "#a76a4d" },
  { tokens: ["green", "olive", "sage"], color: "#8b9873" },
  { tokens: ["blue", "navy"], color: "#6b7d93" },
  { tokens: ["red", "burgundy", "terracotta"], color: "#9b6254" }
];

const FINISH_MATERIAL_HINTS: Array<{
  tokens: string[];
  roughness: number;
  metalness: number;
  tintStrength: number;
}> = [
  { tokens: ["chrome", "stainless", "steel", "aluminum", "aluminium"], roughness: 0.2, metalness: 0.92, tintStrength: 0.14 },
  { tokens: ["brass", "bronze", "copper", "gold", "metal"], roughness: 0.28, metalness: 0.84, tintStrength: 0.18 },
  { tokens: ["glass", "acrylic", "lacquer", "gloss"], roughness: 0.16, metalness: 0.06, tintStrength: 0.1 },
  { tokens: ["ceramic", "porcelain"], roughness: 0.32, metalness: 0.04, tintStrength: 0.14 },
  { tokens: ["stone", "marble", "concrete", "cement"], roughness: 0.72, metalness: 0.03, tintStrength: 0.12 },
  { tokens: ["leather", "suede"], roughness: 0.7, metalness: 0.03, tintStrength: 0.18 },
  { tokens: ["fabric", "linen", "textile", "upholstery", "velvet"], roughness: 0.86, metalness: 0.02, tintStrength: 0.22 },
  { tokens: ["oak", "walnut", "wood", "veneer", "timber", "plywood"], roughness: 0.62, metalness: 0.04, tintStrength: 0.24 },
  { tokens: ["matte"], roughness: 0.82, metalness: 0.02, tintStrength: 0.16 }
];

const KNOWN_SLOT_POLICIES: Record<string, SlotFinishPolicy> = {
  DeskWood: {
    tintStrengthScale: 1.1,
    tintStrengthMax: 0.28,
    roughnessTarget: 0.62,
    metalnessTarget: 0.04,
    slotWeight: 0.82,
    roughnessBlend: 0.55,
    metalnessBlend: 0.24,
    emissiveTintMultiplier: 0.22
  },
  DeskMetal: {
    tintStrengthScale: 0.72,
    tintStrengthMax: 0.16,
    roughnessTarget: 0.28,
    metalnessTarget: 0.88,
    slotWeight: 0.86,
    roughnessBlend: 0.5,
    metalnessBlend: 0.5,
    emissiveTintMultiplier: 0.18
  },
  StandWood: {
    tintStrengthScale: 1.08,
    tintStrengthMax: 0.26,
    roughnessTarget: 0.6,
    metalnessTarget: 0.04,
    slotWeight: 0.8,
    roughnessBlend: 0.54,
    metalnessBlend: 0.24,
    emissiveTintMultiplier: 0.22
  },
  StandPad: {
    tintStrengthScale: 0.5,
    tintStrengthMax: 0.1,
    roughnessTarget: 0.78,
    metalnessTarget: 0.02,
    slotWeight: 0.88,
    roughnessBlend: 0.3,
    metalnessBlend: 0.22,
    emissiveTintMultiplier: 0.15
  },
  LampBody: {
    tintStrengthScale: 0.78,
    tintStrengthMax: 0.18,
    roughnessTarget: 0.46,
    metalnessTarget: 0.18,
    slotWeight: 0.48,
    roughnessBlend: 0.38,
    metalnessBlend: 0.3,
    emissiveTintMultiplier: 0.22
  },
  LampAccent: {
    tintStrengthScale: 0.7,
    tintStrengthMax: 0.14,
    roughnessTarget: 0.34,
    metalnessTarget: 0.74,
    slotWeight: 0.7,
    roughnessBlend: 0.42,
    metalnessBlend: 0.46,
    emissiveTintMultiplier: 0.16
  },
  LampBulb: {
    tintStrengthScale: 0.35,
    tintStrengthMax: 0.08,
    roughnessTarget: null,
    metalnessTarget: null,
    slotWeight: 1,
    roughnessBlend: 0,
    metalnessBlend: 0,
    emissiveTintMultiplier: 0.08
  }
};

function resolveFinishTint(finishColor: string | null | undefined) {
  const normalized = finishColor?.trim().toLowerCase();
  if (!normalized) return null;

  if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)) {
    return new THREE.Color(normalized);
  }

  const match = FINISH_COLOR_HINTS.find(({ tokens }) => tokens.some((token) => normalized.includes(token)));
  return match ? new THREE.Color(match.color) : null;
}

function mergeFinishTarget(base: number | null, target: number | null, weight: number) {
  if (base === null) return target;
  if (target === null) return base;
  return THREE.MathUtils.lerp(base, target, weight);
}

function resolveSlotAwareFinishAppearance(
  slotName: string,
  fallbackAppearance: FinishAppearance | null
): FinishAppearance | null {
  if (!fallbackAppearance) return null;

  const policy = KNOWN_SLOT_POLICIES[slotName];
  if (!policy) {
    return fallbackAppearance;
  }

  return {
    tint: fallbackAppearance.tint,
    tintStrength: fallbackAppearance.tint
      ? Math.min(policy.tintStrengthMax, fallbackAppearance.tintStrength * policy.tintStrengthScale)
      : 0,
    roughness: mergeFinishTarget(
      fallbackAppearance.roughness,
      policy.roughnessTarget,
      policy.slotWeight
    ),
    metalness: mergeFinishTarget(
      fallbackAppearance.metalness,
      policy.metalnessTarget,
      policy.slotWeight
    ),
    roughnessBlend: policy.roughnessBlend,
    metalnessBlend: policy.metalnessBlend,
    emissiveTintMultiplier: policy.emissiveTintMultiplier,
    allowSurfaceAdjustmentsOnEmissive: policy.allowSurfaceAdjustmentsOnEmissive ?? false
  };
}

function resolveFinishAppearance(metadata: FinishMetadata): FinishAppearance | null {
  const normalizedFinishMaterial = [metadata.finishMaterial, metadata.detailNotes]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .trim()
    .toLowerCase();
  const tint = resolveFinishTint(metadata.finishColor);
  const materialHint = FINISH_MATERIAL_HINTS.find(({ tokens }) =>
    tokens.some((token) => normalizedFinishMaterial.includes(token))
  );

  if (!tint && !materialHint) {
    return null;
  }

  return {
    tint,
    tintStrength: materialHint?.tintStrength ?? (tint ? 0.18 : 0),
    roughness: materialHint?.roughness ?? null,
    metalness: materialHint?.metalness ?? null,
    roughnessBlend: 0.45,
    metalnessBlend: 0.35,
    emissiveTintMultiplier: 0.35,
    allowSurfaceAdjustmentsOnEmissive: false
  };
}

function applyFinishAppearance(
  material: THREE.MeshStandardMaterial,
  appearance: FinishAppearance
) {
  const isEmissiveMaterial = material.emissiveIntensity > 0.05;
  const tintStrength = isEmissiveMaterial
    ? appearance.tintStrength * appearance.emissiveTintMultiplier
    : appearance.tintStrength;

  if (appearance.tint && tintStrength > 0) {
    material.color.lerp(appearance.tint, tintStrength);
  }

  if (
    appearance.roughness !== null &&
    (!isEmissiveMaterial || appearance.allowSurfaceAdjustmentsOnEmissive)
  ) {
    material.roughness = THREE.MathUtils.lerp(
      material.roughness,
      appearance.roughness,
      appearance.roughnessBlend
    );
  }

  if (
    appearance.metalness !== null &&
    (!isEmissiveMaterial || appearance.allowSurfaceAdjustmentsOnEmissive)
  ) {
    material.metalness = THREE.MathUtils.lerp(
      material.metalness,
      appearance.metalness,
      appearance.metalnessBlend
    );
  }

  material.needsUpdate = true;
}

function applyFinishAppearanceToObject(
  root: THREE.Object3D,
  fallbackAppearance: FinishAppearance | null
) {
  if (!fallbackAppearance) return;

  const materialCache = new Map<THREE.Material, THREE.Material>();
  const slotAppearanceCache = new Map<string, FinishAppearance | null>();

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const material = child.material;
    const materials = Array.isArray(material) ? material : [material];
    const nextMaterials = materials.map((entry) => {
      if (!(entry instanceof THREE.MeshStandardMaterial)) {
        return entry;
      }

      const slotName = entry.name.trim();
      const appearance =
        slotAppearanceCache.get(slotName) ??
        resolveSlotAwareFinishAppearance(slotName, fallbackAppearance);
      if (!slotAppearanceCache.has(slotName)) {
        slotAppearanceCache.set(slotName, appearance);
      }
      if (!appearance) {
        return entry;
      }

      const cachedMaterial = materialCache.get(entry);
      if (cachedMaterial) {
        return cachedMaterial;
      }

      const clonedMaterial = entry.clone();
      applyFinishAppearance(clonedMaterial, appearance);
      materialCache.set(entry, clonedMaterial);
      return clonedMaterial;
    });

    child.material = Array.isArray(material) ? nextMaterials : (nextMaterials[0] ?? material);
  });
}

function resolveBuilderProxyKind(asset: SceneAsset): BuilderProxyKind | null {
  const id = `${asset.catalogItemId ?? ""} ${asset.assetId ?? ""}`.toLowerCase();
  const category = asset.product?.category?.toLowerCase() ?? "";
  if (id.includes("desk_mat")) return "mat";
  if (id.includes("coffee")) return "coffee-table";
  if (id.includes("gaming_console")) return "game-console";
  if (id.includes("cabinet") || id.includes("console") || id.includes("drawer")) return "media-console";
  if (id.includes("desk") || id.includes("table")) return "desk";
  if (id.includes("chair") || id.includes("stool")) return "chair";
  if (id.includes("shelf") || id.includes("bookshelf")) return "shelf";
  if (id.includes("sofa")) return "sofa";
  if (id.includes("monitor") || id.includes("television")) return "monitor";
  if (id.includes("keyboard")) return "keyboard";
  if (id.includes("mouse")) return "mouse";
  if (id.includes("speaker")) return "speaker";
  if (id.includes("lamp") || id.includes("light")) return "lamp";
  if (id.includes("planter") || id.includes("plant") || category.includes("plant")) return "plant";
  if (id.includes("book")) return "books";
  if (id.includes("mug")) return "mug";
  if (id.includes("gamepad")) return "gamepad";
  if (id.includes("stand")) return "stand";
  return asset.product?.dimensionsMm ? "decor" : null;
}

function useBuilderProxyMaterials() {
  return useMemo(
    () => ({
      wood: new THREE.MeshStandardMaterial({ color: "#c78d52", roughness: 0.62, metalness: 0.02 }),
      metal: new THREE.MeshStandardMaterial({ color: "#111827", roughness: 0.42, metalness: 0.45 }),
      fabric: new THREE.MeshStandardMaterial({ color: "#27324a", roughness: 0.88, metalness: 0 }),
      screen: new THREE.MeshStandardMaterial({
        color: "#111827",
        emissive: new THREE.Color("#2d5bff"),
        emissiveIntensity: 0.2,
        roughness: 0.55,
        metalness: 0
      }),
      screenWarm: new THREE.MeshBasicMaterial({ color: "#f59e0b" }),
      screenCool: new THREE.MeshBasicMaterial({ color: "#60a5fa" }),
      screenInk: new THREE.MeshBasicMaterial({ color: "#0f172a" }),
      light: new THREE.MeshStandardMaterial({
        color: "#fff7ed",
        emissive: new THREE.Color("#ffd28a"),
        emissiveIntensity: 0.8,
        roughness: 0.35,
        metalness: 0
      }),
      white: new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.52, metalness: 0.02 }),
      green: new THREE.MeshStandardMaterial({ color: "#2f7a4f", roughness: 0.78, metalness: 0 }),
      leaf: new THREE.MeshStandardMaterial({ color: "#256f4a", roughness: 0.82, metalness: 0 }),
      rug: new THREE.MeshStandardMaterial({ color: "#566072", roughness: 0.92, metalness: 0 }),
      rugWarm: new THREE.MeshStandardMaterial({ color: "#aeb8c6", roughness: 0.94, metalness: 0 }),
      wovenEdge: new THREE.MeshStandardMaterial({ color: "#efe1cf", roughness: 0.9, metalness: 0 }),
      accent: new THREE.MeshStandardMaterial({ color: "#6d5dfc", roughness: 0.68, metalness: 0.04 }),
      wallFrame: new THREE.MeshStandardMaterial({ color: "#6b4f3b", roughness: 0.66, metalness: 0.03 }),
      wallCanvasWarm: new THREE.MeshStandardMaterial({ color: "#f9735b", roughness: 0.72, metalness: 0 }),
      wallCanvasCool: new THREE.MeshStandardMaterial({ color: "#69b3f0", roughness: 0.72, metalness: 0 }),
      warmLed: new THREE.MeshBasicMaterial({ color: "#ff9a5c", transparent: true, opacity: 0.7, depthWrite: false }),
      coolLed: new THREE.MeshBasicMaterial({ color: "#77a7ff", transparent: true, opacity: 0.66, depthWrite: false })
    }),
    []
  );
}

type ProxyRoundedBoxProps = Omit<ComponentProps<typeof RoundedBox>, "args" | "radius" | "smoothness"> & {
  args: [number, number, number];
  radius?: number;
  smoothness?: number;
};

function ProxyRoundedBox({ args, radius = 0.025, smoothness = 4, ...props }: ProxyRoundedBoxProps) {
  const safeRadius = Math.max(0.001, Math.min(radius, args[0] * 0.45, args[1] * 0.45, args[2] * 0.45));

  return <RoundedBox args={args} radius={safeRadius} smoothness={smoothness} {...props} />;
}

function BuilderPreviewGroundDressing({ assets }: { assets: SceneAsset[] }) {
  const materials = useBuilderProxyMaterials();
  const coffeeTable = assets.find((asset) => resolveBuilderProxyKind(asset) === "coffee-table");
  const sofa = assets.find((asset) => resolveBuilderProxyKind(asset) === "sofa");
  const anchor = sofa ?? coffeeTable;

  if (!anchor) {
    return null;
  }

  const rotationY = sofa?.rotation[1] ?? coffeeTable?.rotation[1] ?? 0;
  const forwardX = Math.sin(rotationY);
  const forwardZ = Math.cos(rotationY);
  const centerX = sofa ? sofa.position[0] + forwardX * 0.45 : anchor.position[0];
  const centerZ = sofa ? sofa.position[2] + forwardZ * 0.45 : anchor.position[2];

  return (
    <group name="builder-preview-ground-dressing" position={[centerX, 0, centerZ]} rotation={[0, rotationY, 0]}>
      <ProxyRoundedBox
        receiveShadow
        position={[0, 0.01, 0]}
        material={materials.rugWarm}
        args={[1.95, 0.018, 1.28]}
        radius={0.07}
        smoothness={5}
      />
      {[0.46, -0.46].map((z) => (
        <mesh key={`rug-weave-${z}`} position={[0, 0.024, z]} material={materials.wovenEdge}>
          <boxGeometry args={[1.58, 0.008, 0.018]} />
        </mesh>
      ))}
      {[-0.38, 0, 0.38].map((x) => (
        <mesh key={`rug-thread-${x}`} position={[x, 0.025, 0]} material={materials.rug}>
          <boxGeometry args={[0.018, 0.006, 1.02]} />
        </mesh>
      ))}
    </group>
  );
}

function computeBuilderPreviewRoomBounds(
  walls: { start: [number, number]; end: [number, number]; height: number }[],
  scale: number
) {
  if (walls.length === 0) {
    return { minX: -2, maxX: 2, minZ: -2, maxZ: 2, height: 2.7 };
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  let height = 2.7;

  walls.forEach((wall) => {
    [wall.start, wall.end].forEach(([x, z]) => {
      minX = Math.min(minX, x * scale);
      maxX = Math.max(maxX, x * scale);
      minZ = Math.min(minZ, z * scale);
      maxZ = Math.max(maxZ, z * scale);
    });
    height = Math.max(height, wall.height);
  });

  return { minX, maxX, minZ, maxZ, height };
}

function BuilderPreviewWallDressing() {
  const materials = useBuilderProxyMaterials();
  const walls = useShellSelector((slice) => slice.walls);
  const scale = useShellSelector((slice) => slice.scale);
  const bounds = useMemo(() => computeBuilderPreviewRoomBounds(walls, scale), [scale, walls]);
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const rearZ = bounds.maxZ - 0.05;
  const sideX = bounds.maxX - 0.05;
  const trimY = Math.min(bounds.height - 0.3, 2.26);

  return (
    <group name="builder-preview-wall-dressing">
      <group name="builder-preview-rear-wall-gallery" position={[centerX - width * 0.28, 1.58, rearZ]}>
        <ProxyRoundedBox
          castShadow
          receiveShadow
          material={materials.white}
          args={[0.66, 0.44, 0.032]}
          radius={0.008}
        />
        <mesh position={[0, 0.22, 0.026]} material={materials.wallFrame}>
          <boxGeometry args={[0.72, 0.035, 0.014]} />
        </mesh>
        <mesh position={[0, -0.22, 0.026]} material={materials.wallFrame}>
          <boxGeometry args={[0.72, 0.035, 0.014]} />
        </mesh>
        <mesh position={[-0.36, 0, 0.026]} material={materials.wallFrame}>
          <boxGeometry args={[0.035, 0.48, 0.014]} />
        </mesh>
        <mesh position={[0.36, 0, 0.026]} material={materials.wallFrame}>
          <boxGeometry args={[0.035, 0.48, 0.014]} />
        </mesh>
        <mesh position={[-0.1, 0.04, 0.032]} material={materials.wallCanvasCool}>
          <boxGeometry args={[0.24, 0.11, 0.012]} />
        </mesh>
        <mesh position={[0.12, -0.08, 0.034]} material={materials.wallCanvasWarm}>
          <boxGeometry args={[0.18, 0.075, 0.014]} />
        </mesh>
      </group>
      <group name="builder-preview-rear-wall-shelf" position={[centerX + width * 0.14, 1.22, rearZ]}>
        <ProxyRoundedBox castShadow receiveShadow material={materials.wood} args={[1.08, 0.055, 0.18]} radius={0.014} />
        {[-0.36, -0.25, -0.14].map((x) => (
          <ProxyRoundedBox
            key={`rear-shelf-book-${x}`}
            castShadow
            receiveShadow
            position={[x, 0.16, -0.018]}
            material={materials.accent}
            args={[0.07, 0.28, 0.12]}
            radius={0.006}
          />
        ))}
        <mesh castShadow receiveShadow position={[0.28, 0.13, -0.012]} material={materials.white}>
          <cylinderGeometry args={[0.08, 0.1, 0.16, 18]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0.28, 0.31, -0.012]} scale={[0.16, 0.05, 0.09]} material={materials.leaf}>
          <sphereGeometry args={[1, 18, 10]} />
        </mesh>
      </group>
      <mesh name="builder-preview-rear-cool-led" position={[centerX - width * 0.12, trimY, rearZ - 0.015]} material={materials.coolLed}>
        <boxGeometry args={[Math.max(0.9, width * 0.28), 0.018, 0.01]} />
      </mesh>
      <group name="builder-preview-side-wall-gallery" position={[sideX, 1.46, centerZ - depth * 0.08]}>
        <ProxyRoundedBox castShadow receiveShadow material={materials.wallFrame} args={[0.035, 0.5, 0.58]} radius={0.012} />
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[-0.006, 0, 0]}
          material={materials.white}
          args={[0.038, 0.37, 0.44]}
          radius={0.008}
        />
        <mesh position={[-0.028, 0.06, -0.1]} material={materials.wallCanvasWarm}>
          <boxGeometry args={[0.014, 0.12, 0.2]} />
        </mesh>
        <mesh position={[-0.03, -0.08, 0.12]} material={materials.wallCanvasCool}>
          <boxGeometry args={[0.012, 0.08, 0.16]} />
        </mesh>
      </group>
      <mesh name="builder-preview-side-warm-led" position={[sideX - 0.016, trimY - 0.42, centerZ - depth * 0.2]} material={materials.warmLed}>
        <boxGeometry args={[0.012, Math.max(0.72, bounds.height * 0.28), 0.018]} />
      </mesh>
    </group>
  );
}

function resolveBuilderPreviewWorldDimensions(asset: SceneAsset) {
  const dimensions = asset.product?.dimensionsMm ?? { width: 620, depth: 420, height: 520 };

  return {
    width: Math.max(0.08, (dimensions.width / 1000) * Math.max(asset.scale[0], 0.001)),
    depth: Math.max(0.08, (dimensions.depth / 1000) * Math.max(asset.scale[2], 0.001)),
    height: Math.max(0.04, (dimensions.height / 1000) * Math.max(asset.scale[1], 0.001))
  };
}

function BuilderPreviewSurfaceDressing({ assets }: { assets: SceneAsset[] }) {
  const materials = useBuilderProxyMaterials();
  const desk = assets.find((asset) => resolveBuilderProxyKind(asset) === "desk");
  const mediaConsole = assets.find((asset) => resolveBuilderProxyKind(asset) === "media-console");
  const shelf = assets.find((asset) => resolveBuilderProxyKind(asset) === "shelf");

  if (!desk && !mediaConsole && !shelf) {
    return null;
  }

  const deskDimensions = desk ? resolveBuilderPreviewWorldDimensions(desk) : null;
  const mediaDimensions = mediaConsole ? resolveBuilderPreviewWorldDimensions(mediaConsole) : null;
  const shelfDimensions = shelf ? resolveBuilderPreviewWorldDimensions(shelf) : null;
  const mediaSurfaceHeight = mediaDimensions
    ? Math.max(0.42, Math.min(mediaDimensions.height, 0.62)) + 0.06
    : 0;

  return (
    <group name="builder-preview-surface-dressing">
      {desk && deskDimensions ? (
        <group
          name="builder-preview-desk-surface-kit"
          position={[desk.position[0], desk.position[1], desk.position[2]]}
          rotation={[0, desk.rotation[1] ?? 0, 0]}
        >
          <ProxyRoundedBox
            castShadow
            receiveShadow
            position={[-deskDimensions.width * 0.14, deskDimensions.height + 0.026, -deskDimensions.depth * 0.12]}
            material={materials.rug}
            args={[0.36, 0.018, 0.24]}
            radius={0.014}
          />
          <ProxyRoundedBox
            castShadow
            receiveShadow
            position={[deskDimensions.width * 0.2, deskDimensions.height + 0.038, -deskDimensions.depth * 0.22]}
            material={materials.accent}
            args={[0.16, 0.018, 0.11]}
            radius={0.01}
          />
          <ProxyRoundedBox
            castShadow
            receiveShadow
            position={[deskDimensions.width * 0.34, deskDimensions.height + 0.036, -deskDimensions.depth * 0.08]}
            material={materials.white}
            args={[0.11, 0.014, 0.09]}
            radius={0.008}
          />
          <mesh
            name="builder-preview-desk-cable"
            castShadow={false}
            receiveShadow={false}
            position={[deskDimensions.width * 0.03, deskDimensions.height + 0.045, deskDimensions.depth * 0.1]}
            rotation={[0, 0.35, 0]}
            material={materials.screenInk}
          >
            <boxGeometry args={[0.46, 0.008, 0.012]} />
          </mesh>
          <group
            name="builder-preview-headphones"
            position={[deskDimensions.width * 0.28, deskDimensions.height + 0.066, deskDimensions.depth * 0.2]}
          >
            <mesh castShadow rotation={[Math.PI / 2, 0, 0]} material={materials.screenInk}>
              <torusGeometry args={[0.12, 0.012, 8, 24, Math.PI * 1.12]} />
            </mesh>
            {[-0.09, 0.09].map((x) => (
              <ProxyRoundedBox
                key={`headphone-pad-${x}`}
                castShadow
                receiveShadow
                position={[x, -0.016, 0.01]}
                material={materials.metal}
                args={[0.048, 0.038, 0.07]}
                radius={0.018}
              />
            ))}
          </group>
        </group>
      ) : null}
      {mediaConsole && mediaDimensions ? (
        <group
          name="builder-preview-media-console-surface-kit"
          position={[mediaConsole.position[0], mediaConsole.position[1], mediaConsole.position[2]]}
          rotation={[0, mediaConsole.rotation[1] ?? 0, 0]}
        >
          <ProxyRoundedBox
            castShadow
            receiveShadow
            position={[-mediaDimensions.width * 0.26, mediaSurfaceHeight, -mediaDimensions.depth * 0.12]}
            material={materials.screenInk}
            args={[0.32, 0.04, 0.16]}
            radius={0.02}
          />
          <mesh
            castShadow={false}
            receiveShadow={false}
            position={[-mediaDimensions.width * 0.26, mediaSurfaceHeight + 0.024, -mediaDimensions.depth * 0.12]}
            material={materials.screenCool}
          >
            <boxGeometry args={[0.2, 0.008, 0.012]} />
          </mesh>
          <ProxyRoundedBox
            castShadow
            receiveShadow
            position={[mediaDimensions.width * 0.14, mediaSurfaceHeight + 0.004, mediaDimensions.depth * 0.06]}
            material={materials.metal}
            args={[0.3, 0.026, 0.075]}
            radius={0.018}
          />
          {[0.03, 0.11, 0.19].map((x) => (
            <mesh
              key={`media-remote-dot-${x}`}
              castShadow
              position={[mediaDimensions.width * 0.14 + x, mediaSurfaceHeight + 0.022, mediaDimensions.depth * 0.06]}
              material={materials.accent}
            >
              <sphereGeometry args={[0.014, 10, 8]} />
            </mesh>
          ))}
        </group>
      ) : null}
      {shelf && shelfDimensions ? (
        <group
          name="builder-preview-shelf-collectibles"
          position={[shelf.position[0], shelf.position[1], shelf.position[2]]}
          rotation={[0, shelf.rotation[1] ?? 0, 0]}
        >
          {[
            { key: "collectible-a", x: -0.32, color: "#2563eb" },
            { key: "collectible-b", x: -0.18, color: "#ef4444" },
            { key: "collectible-c", x: -0.04, color: "#f59e0b" }
          ].map((item) => (
            <group
              key={item.key}
              position={[shelfDimensions.width * item.x, shelfDimensions.height * 0.88, shelfDimensions.depth * 0.28]}
            >
              <mesh castShadow receiveShadow position={[0, 0.035, 0]}>
                <sphereGeometry args={[0.038, 14, 10]} />
                <meshStandardMaterial color={item.color} roughness={0.72} metalness={0.02} />
              </mesh>
              <mesh castShadow receiveShadow position={[0, -0.012, 0]} material={materials.white}>
                <cylinderGeometry args={[0.032, 0.04, 0.032, 12]} />
              </mesh>
            </group>
          ))}
        </group>
      ) : null}
    </group>
  );
}

function BuilderPreviewProxy({ asset, kind }: { asset: SceneAsset; kind: BuilderProxyKind }) {
  const materials = useBuilderProxyMaterials();
  const normalizedId = `${asset.catalogItemId ?? ""} ${asset.assetId ?? ""}`.toLowerCase();
  const isTelevision = kind === "monitor" && (normalizedId.includes("television") || normalizedId.includes("tv"));
  const dimensions = asset.product?.dimensionsMm ?? { width: 620, depth: 420, height: 520 };
  const safeScale: [number, number, number] = [
    Math.max(asset.scale[0], 0.001),
    Math.max(asset.scale[1], 0.001),
    Math.max(asset.scale[2], 0.001)
  ];
  const width = Math.max(0.08, dimensions.width / 1000);
  const depth = Math.max(0.08, dimensions.depth / 1000);
  const height = Math.max(0.04, dimensions.height / 1000);
  const lx = (meters: number) => meters / safeScale[0];
  const ly = (meters: number) => meters / safeScale[1];
  const lz = (meters: number) => meters / safeScale[2];
  const localY = (meters: number) => meters / safeScale[1];
  const roundedRadius = (meters: number) => Math.max(0.002, Math.min(lx(meters), ly(meters), lz(meters)));

  if (kind === "desk") {
    return (
      <group>
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(height), 0]}
          material={materials.wood}
          args={[lx(width), ly(0.07), lz(depth)]}
          radius={roundedRadius(0.035)}
        />
        {[
          [-0.42, 0.32],
          [0.42, 0.32],
          [-0.42, -0.32],
          [0.42, -0.32]
        ].map(([x, z]) => (
          <mesh
            key={`${x}:${z}`}
            castShadow
            receiveShadow
            position={[lx(width * x), localY(height / 2), lz(depth * z)]}
            material={materials.metal}
          >
          <boxGeometry args={[lx(0.045), ly(height), lz(0.045)]} />
          </mesh>
        ))}
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[lx(width * -0.34), localY(height * 0.42), lz(depth * 0.22)]}
          material={materials.white}
          args={[lx(width * 0.24), ly(height * 0.72), lz(depth * 0.3)]}
          radius={roundedRadius(0.026)}
        />
        {[0.27, 0.42, 0.57].map((level) => (
          <mesh
            key={`desk-drawer-${level}`}
            castShadow={false}
            receiveShadow={false}
            position={[lx(width * -0.34), localY(height * level), lz(depth * 0.375)]}
            material={materials.screenInk}
          >
            <boxGeometry args={[lx(width * 0.16), ly(0.012), lz(0.012)]} />
          </mesh>
        ))}
        <mesh
          castShadow={false}
          receiveShadow={false}
          position={[0, localY(height + 0.044), lz(depth * -0.45)]}
          material={materials.screenWarm}
        >
          <boxGeometry args={[lx(width * 0.62), ly(0.012), lz(0.014)]} />
        </mesh>
        <mesh
          castShadow={false}
          receiveShadow={false}
          position={[lx(width * 0.24), localY(height + 0.042), lz(depth * -0.26)]}
          rotation={[0, 0.32, 0]}
          material={materials.screenInk}
        >
          <boxGeometry args={[lx(width * 0.34), ly(0.01), lz(0.012)]} />
        </mesh>
      </group>
    );
  }

  if (kind === "coffee-table") {
    return (
      <group>
        <ProxyRoundedBox
          receiveShadow
          position={[0, localY(0.018), 0]}
          material={materials.rug}
          args={[lx(1.35), ly(0.026), lz(0.82)]}
          radius={roundedRadius(0.032)}
        />
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(0.24), 0]}
          material={materials.wood}
          args={[lx(0.95), ly(0.09), lz(0.55)]}
          radius={roundedRadius(0.045)}
        />
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(0.1), 0]}
          material={materials.metal}
          args={[lx(0.72), ly(0.08), lz(0.42)]}
          radius={roundedRadius(0.035)}
        />
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[lx(-0.18), localY(0.305), lz(0.08)]}
          material={materials.white}
          args={[lx(0.22), ly(0.026), lz(0.16)]}
          radius={roundedRadius(0.012)}
        />
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[lx(-0.16), localY(0.335), lz(0.06)]}
          material={materials.accent}
          args={[lx(0.18), ly(0.018), lz(0.12)]}
          radius={roundedRadius(0.01)}
        />
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[lx(0.28), localY(0.31), lz(-0.04)]}
          material={materials.screenInk}
          args={[lx(0.24), ly(0.022), lz(0.1)]}
          radius={roundedRadius(0.018)}
        />
      </group>
    );
  }

  if (kind === "media-console") {
    const consoleWidth = Math.max(width, 1.35);
    const consoleDepth = Math.max(depth, 0.42);
    const consoleHeight = Math.max(0.42, Math.min(height, 0.62));

    return (
      <group>
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(consoleHeight * 0.5), 0]}
          material={materials.wood}
          args={[lx(consoleWidth), ly(consoleHeight), lz(consoleDepth)]}
          radius={roundedRadius(0.04)}
        />
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(consoleHeight + 0.026), 0]}
          material={materials.white}
          args={[lx(consoleWidth * 1.04), ly(0.052), lz(consoleDepth * 1.08)]}
          radius={roundedRadius(0.035)}
        />
        {[-0.36, 0.36].map((x) => (
          <mesh
            key={`console-slot-${x}`}
            castShadow={false}
            receiveShadow={false}
            position={[lx(consoleWidth * x), localY(consoleHeight * 0.55), lz(consoleDepth * 0.51)]}
            material={materials.screenInk}
          >
            <boxGeometry args={[lx(consoleWidth * 0.24), ly(0.026), lz(0.014)]} />
          </mesh>
        ))}
        {[0.24, 0.42].map((level) => (
          <mesh
            key={`console-drawer-${level}`}
            castShadow={false}
            receiveShadow={false}
            position={[0, localY(consoleHeight * level), lz(consoleDepth * 0.52)]}
            material={materials.screenInk}
          >
            <boxGeometry args={[lx(consoleWidth * 0.82), ly(0.012), lz(0.014)]} />
          </mesh>
        ))}
        {[-0.4, 0.4].map((x) =>
          [-0.32, 0.32].map((z) => (
            <mesh
              key={`console-leg-${x}:${z}`}
              castShadow
              receiveShadow
              position={[lx(consoleWidth * x), localY(0.07), lz(consoleDepth * z)]}
              material={materials.metal}
            >
              <cylinderGeometry args={[lx(0.022), lx(0.022), ly(0.14), 10]} />
            </mesh>
          ))
        )}
      </group>
    );
  }

  if (kind === "shelf") {
    const shelfDecor = [
      { key: "books-a", color: "#b91c1c", position: [-0.24, 0.28, -0.16], size: [0.08, 0.28, 0.16] },
      { key: "books-b", color: "#1d4ed8", position: [-0.14, 0.27, -0.16], size: [0.07, 0.26, 0.15] },
      { key: "books-c", color: "#15803d", position: [-0.05, 0.25, -0.16], size: [0.06, 0.22, 0.14] },
      { key: "box-a", color: "#f8fafc", position: [0.22, 0.29, 0.12], size: [0.28, 0.18, 0.24] },
      { key: "books-d", color: "#f59e0b", position: [0.2, 0.5, -0.14], size: [0.07, 0.24, 0.14] },
      { key: "books-e", color: "#7c3aed", position: [0.29, 0.48, -0.14], size: [0.06, 0.2, 0.13] },
      { key: "box-b", color: "#374151", position: [-0.2, 0.54, 0.12], size: [0.24, 0.16, 0.22] },
      { key: "books-f", color: "#0f766e", position: [-0.24, 0.71, -0.12], size: [0.07, 0.22, 0.13] },
      { key: "books-g", color: "#e11d48", position: [-0.15, 0.72, -0.12], size: [0.06, 0.24, 0.13] }
    ] as const;

    return (
      <group>
        {[-0.48, 0.48].map((x) =>
          [-0.45, 0.45].map((z) => (
            <mesh
              key={`${x}:${z}`}
              castShadow
              receiveShadow
              position={[lx(width * x), localY(height / 2), lz(depth * z)]}
              material={materials.metal}
            >
              <boxGeometry args={[lx(0.035), ly(height), lz(0.035)]} />
            </mesh>
          ))
        )}
        {[0.18, 0.39, 0.6, 0.81].map((level) => (
          <ProxyRoundedBox
            key={level}
            castShadow
            receiveShadow
            position={[0, localY(height * level), 0]}
            material={materials.wood}
            args={[lx(width), ly(0.04), lz(depth)]}
            radius={roundedRadius(0.018)}
          />
        ))}
        {shelfDecor.map((item) => (
          <ProxyRoundedBox
            key={item.key}
            castShadow
            receiveShadow
            position={[lx(width * item.position[0]), localY(height * item.position[1]), lz(depth * item.position[2])]}
            args={[lx(item.size[0]), ly(item.size[1]), lz(item.size[2])]}
            radius={roundedRadius(0.018)}
          >
            <meshStandardMaterial color={item.color} roughness={0.78} metalness={0.02} />
          </ProxyRoundedBox>
        ))}
      </group>
    );
  }

  if (kind === "chair") {
    return (
      <group>
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(0.42), 0]}
          material={materials.fabric}
          args={[lx(width * 0.72), ly(0.08), lz(depth * 0.72)]}
          radius={roundedRadius(0.045)}
        />
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(0.72), lz(depth * -0.34)]}
          material={materials.fabric}
          args={[lx(width * 0.72), ly(height * 0.52), lz(0.08)]}
          radius={roundedRadius(0.045)}
        />
        <mesh castShadow receiveShadow position={[0, localY(0.23), 0]} material={materials.metal}>
          <cylinderGeometry args={[lx(0.035), lx(0.035), ly(0.46), 16]} />
        </mesh>
      </group>
    );
  }

  if (kind === "sofa") {
    return (
      <group>
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(0.26), 0]}
          material={materials.fabric}
          args={[lx(1.45), ly(0.28), lz(0.72)]}
          radius={roundedRadius(0.095)}
          smoothness={5}
        />
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(0.55), lz(-0.28)]}
          material={materials.fabric}
          args={[lx(1.45), ly(0.58), lz(0.18)]}
          radius={roundedRadius(0.075)}
          smoothness={5}
        />
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[lx(-0.22), localY(0.43), lz(0.16)]}
          material={materials.rugWarm}
          args={[lx(0.68), ly(0.035), lz(0.42)]}
          radius={roundedRadius(0.045)}
          smoothness={5}
        />
        {[-0.78, 0.78].map((x) => (
          <ProxyRoundedBox
            key={`sofa-arm-${x}`}
            castShadow
            receiveShadow
            position={[lx(x), localY(0.38), lz(0.02)]}
            material={materials.fabric}
            args={[lx(0.18), ly(0.38), lz(0.7)]}
            radius={roundedRadius(0.07)}
            smoothness={5}
          />
        ))}
        <mesh position={[0, localY(0.41), lz(0.38)]} material={materials.screenInk}>
          <boxGeometry args={[lx(1.02), ly(0.012), lz(0.012)]} />
        </mesh>
        {[-0.22, 0.22].map((x) => (
          <mesh key={`sofa-seat-seam-${x}`} position={[lx(x), localY(0.43), lz(0.4)]} material={materials.screenInk}>
            <boxGeometry args={[lx(0.014), ly(0.012), lz(0.26)]} />
          </mesh>
        ))}
        {[-0.32, 0.32].map((x) => (
          <ProxyRoundedBox
            key={x}
            castShadow
            receiveShadow
            position={[lx(x), localY(0.5), lz(0.06)]}
            material={materials.accent}
            args={[lx(0.26), ly(0.18), lz(0.16)]}
            radius={roundedRadius(0.055)}
          />
        ))}
      </group>
    );
  }

  if (kind === "monitor") {
    const screenWidth = isTelevision ? Math.max(width, 1.2) : width;
    const screenHeight = isTelevision ? Math.max(height, 0.7) : height;
    const screenDepth = isTelevision ? 0.055 : 0.035;
    return (
      <group>
        {isTelevision ? (
          <ProxyRoundedBox
            castShadow
            receiveShadow
            position={[0, localY(0.11), lz(depth * 0.28)]}
            material={materials.wood}
            args={[lx(screenWidth * 0.96), ly(0.14), lz(0.3)]}
            radius={roundedRadius(0.045)}
          />
        ) : null}
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(screenHeight * 0.54), 0]}
          material={isTelevision ? materials.screenInk : materials.screen}
          args={[lx(screenWidth), ly(screenHeight * 0.72), lz(screenDepth)]}
          radius={roundedRadius(0.025)}
        />
        <mesh position={[0, localY(screenHeight * 0.54), lz(screenDepth * 0.56)]} material={materials.screenInk}>
          <planeGeometry args={[lx(screenWidth * 0.78), ly(screenHeight * 0.48)]} />
        </mesh>
        <mesh
          position={[lx(screenWidth * -0.12), localY(screenHeight * 0.58), lz(screenDepth * 0.58)]}
          material={isTelevision ? materials.screenCool : materials.screenWarm}
        >
          <planeGeometry args={[lx(screenWidth * 0.28), ly(screenHeight * 0.18)]} />
        </mesh>
        <mesh
          position={[lx(screenWidth * 0.18), localY(screenHeight * 0.49), lz(screenDepth * 0.59)]}
          material={isTelevision ? materials.screenWarm : materials.screenCool}
        >
          <planeGeometry args={[lx(screenWidth * 0.22), ly(screenHeight * 0.1)]} />
        </mesh>
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(screenHeight * 0.14), lz(depth * 0.18)]}
          material={materials.metal}
          args={[lx(screenWidth * 0.32), ly(screenHeight * 0.24), lz(0.05)]}
          radius={roundedRadius(0.025)}
        />
      </group>
    );
  }

  if (kind === "lamp") {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, localY(height * 0.45), 0]} material={materials.metal}>
          <cylinderGeometry args={[lx(0.025), lx(0.025), ly(height * 0.78), 16]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, localY(height * 0.88), 0]} material={materials.light}>
          <sphereGeometry args={[lx(Math.max(width, depth) * 0.28), 18, 12]} />
        </mesh>
        <pointLight color="#ffd28a" intensity={0.35} distance={2.4} decay={2} position={[0, localY(height * 0.9), 0]} />
      </group>
    );
  }

  if (kind === "plant") {
    const leafSpecs = [
      { key: "leaf-a", position: [-0.2, 0.78, 0], scale: [0.18, 0.035, 0.075], color: "#2f7a4f" },
      { key: "leaf-b", position: [0.2, 0.8, 0.02], scale: [0.18, 0.035, 0.075], color: "#3a8c58" },
      { key: "leaf-c", position: [0, 0.86, -0.18], scale: [0.075, 0.035, 0.18], color: "#256f4a" },
      { key: "leaf-d", position: [0.06, 0.94, 0.18], scale: [0.075, 0.035, 0.18], color: "#4b9b63" },
      { key: "leaf-e", position: [-0.1, 0.92, 0.12], scale: [0.13, 0.035, 0.11], color: "#2f7a4f" },
      { key: "leaf-f", position: [0.12, 0.72, -0.08], scale: [0.13, 0.03, 0.1], color: "#256f4a" }
    ] as const;

    return (
      <group>
        <mesh castShadow receiveShadow position={[0, localY(height * 0.22), 0]} material={materials.white}>
          <cylinderGeometry args={[lx(width * 0.34), lx(width * 0.4), ly(height * 0.42), 18]} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, localY(height * 0.55), 0]} material={materials.green}>
          <cylinderGeometry args={[lx(0.018), lx(0.026), ly(height * 0.62), 10]} />
        </mesh>
        {leafSpecs.map((leaf) => (
          <mesh
            key={leaf.key}
            castShadow
            receiveShadow
            position={[
              lx(width * leaf.position[0]),
              localY(height * leaf.position[1]),
              lz(depth * leaf.position[2])
            ]}
            scale={[lx(width * leaf.scale[0]), ly(height * leaf.scale[1]), lz(depth * leaf.scale[2])]}
          >
            <sphereGeometry args={[1, 18, 10]} />
            <meshStandardMaterial color={leaf.color} roughness={0.82} metalness={0} />
          </mesh>
        ))}
      </group>
    );
  }

  if (kind === "keyboard") {
    const keyRows = [
      [-0.34, -0.12, 0.1, 0.32],
      [-0.28, -0.06, 0.16, 0.38]
    ];
    return (
      <group>
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(0.014), 0]}
          material={materials.metal}
          args={[lx(width), ly(0.028), lz(depth)]}
          radius={roundedRadius(0.014)}
        />
        {keyRows.map((row, rowIndex) =>
          row.map((x, keyIndex) => (
            <ProxyRoundedBox
              key={`${rowIndex}:${keyIndex}`}
              castShadow
              position={[lx(width * x), localY(0.036), lz(depth * (rowIndex === 0 ? -0.16 : 0.14))]}
              material={materials.white}
              args={[lx(width * 0.12), ly(0.012), lz(depth * 0.16)]}
              radius={roundedRadius(0.004)}
            />
          ))
        )}
      </group>
    );
  }

  if (kind === "mouse") {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, localY(0.032), 0]} scale={[lx(width * 0.44), ly(0.032), lz(depth * 0.42)]} material={materials.metal}>
          <sphereGeometry args={[1, 18, 12]} />
        </mesh>
        <mesh position={[0, localY(0.066), lz(depth * 0.08)]} material={materials.screenCool}>
          <planeGeometry args={[lx(width * 0.1), ly(0.018)]} />
        </mesh>
      </group>
    );
  }

  if (kind === "speaker") {
    return (
      <group>
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(height / 2), 0]}
          material={materials.metal}
          args={[lx(width), ly(height), lz(depth)]}
          radius={roundedRadius(0.026)}
        />
        <mesh
          castShadow
          position={[0, localY(height * 0.62), lz(depth * 0.52)]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.screenInk}
        >
          <cylinderGeometry args={[lx(Math.min(width, depth) * 0.22), lx(Math.min(width, depth) * 0.22), lz(0.012), 24]} />
        </mesh>
        <mesh
          castShadow
          position={[0, localY(height * 0.28), lz(depth * 0.53)]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.accent}
        >
          <cylinderGeometry args={[lx(Math.min(width, depth) * 0.12), lx(Math.min(width, depth) * 0.12), lz(0.014), 18]} />
        </mesh>
      </group>
    );
  }

  if (kind === "mug") {
    return (
      <group>
        <mesh castShadow receiveShadow position={[0, localY(height * 0.42), 0]} material={materials.white}>
          <cylinderGeometry args={[lx(width * 0.3), lx(width * 0.34), ly(height * 0.78), 24]} />
        </mesh>
        <mesh castShadow position={[lx(width * 0.35), localY(height * 0.46), 0]} rotation={[0, Math.PI / 2, 0]} material={materials.white}>
          <torusGeometry args={[lx(width * 0.18), lx(width * 0.035), 8, 18]} />
        </mesh>
      </group>
    );
  }

  if (kind === "gamepad") {
    return (
      <group>
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(height * 0.22), 0]}
          material={materials.metal}
          args={[lx(width), ly(height * 0.44), lz(depth * 0.72)]}
          radius={roundedRadius(0.04)}
        />
        {[-0.22, 0.2].map((x) => (
          <mesh key={`stick:${x}`} castShadow position={[lx(width * x), localY(height * 0.48), lz(depth * -0.06)]} material={materials.screenInk}>
            <sphereGeometry args={[lx(Math.min(width, depth) * 0.08), 12, 8]} />
          </mesh>
        ))}
        {[0.2, 0.32].map((x) => (
          <mesh key={`button:${x}`} castShadow position={[lx(width * x), localY(height * 0.5), lz(depth * 0.16)]} material={materials.accent}>
            <sphereGeometry args={[lx(Math.min(width, depth) * 0.055), 12, 8]} />
          </mesh>
        ))}
      </group>
    );
  }

  if (kind === "game-console") {
    return (
      <group>
        <ProxyRoundedBox
          castShadow
          receiveShadow
          position={[0, localY(0.055), 0]}
          material={materials.metal}
          args={[lx(0.42), ly(0.11), lz(0.28)]}
          radius={roundedRadius(0.03)}
        />
        <mesh
          castShadow={false}
          receiveShadow={false}
          position={[0, localY(0.116), lz(0.142)]}
          material={materials.screenInk}
        >
          <boxGeometry args={[lx(0.26), ly(0.012), lz(0.01)]} />
        </mesh>
        <mesh
          castShadow={false}
          receiveShadow={false}
          position={[lx(0.15), localY(0.122), lz(0.145)]}
          material={materials.screenCool}
        >
          <sphereGeometry args={[lx(0.026), 12, 8]} />
        </mesh>
      </group>
    );
  }

  if (kind === "mat") {
    return (
      <group>
        <ProxyRoundedBox
          receiveShadow
          position={[0, localY(0.012), 0]}
          material={materials.rug}
          args={[lx(width), ly(0.024), lz(depth)]}
          radius={roundedRadius(0.014)}
        />
        <mesh position={[lx(width * 0.18), localY(0.026), lz(depth * -0.18)]} rotation={[-Math.PI / 2, 0, 0]} material={materials.screenCool}>
          <planeGeometry args={[lx(width * 0.34), lz(depth * 0.08)]} />
        </mesh>
      </group>
    );
  }

  if (kind === "books") {
    return (
      <group>
        {["#ef4444", "#f59e0b", "#2563eb"].map((color, index) => (
          <ProxyRoundedBox
            key={color}
            castShadow
            receiveShadow
            position={[0, localY(height * (index + 0.5) / 3), lz((index - 1) * depth * 0.12)]}
            args={[lx(width), ly(height / 3), lz(depth * 0.82)]}
            radius={roundedRadius(0.016)}
          >
            <meshStandardMaterial color={color} roughness={0.78} metalness={0.02} />
          </ProxyRoundedBox>
        ))}
      </group>
    );
  }

  const material = kind === "stand" ? materials.metal : materials.accent;

  return (
    <ProxyRoundedBox
      castShadow
      receiveShadow
      position={[0, localY(height / 2), 0]}
      material={material}
      args={[lx(width), ly(height), lz(depth)]}
      radius={roundedRadius(0.026)}
    />
  );
}

function PlaceholderFurniture() {
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[0.8, 0.6, 0.8]} />
      <meshStandardMaterial color="#c4b59d" roughness={0.8} />
    </mesh>
  );
}

function measureColliderHalfExtents(asset: SceneAsset) {
  const width = asset.product?.dimensionsMm?.width
    ? (asset.product.dimensionsMm.width / 1000) * Math.max(asset.scale[0], 0.001)
    : 0.8 * Math.max(asset.scale[0], 0.001);
  const depth = asset.product?.dimensionsMm?.depth
    ? (asset.product.dimensionsMm.depth / 1000) * Math.max(asset.scale[2], 0.001)
    : 0.8 * Math.max(asset.scale[2], 0.001);
  const height = asset.product?.dimensionsMm?.height
    ? (asset.product.dimensionsMm.height / 1000) * Math.max(asset.scale[1], 0.001)
    : 0.6 * Math.max(asset.scale[1], 0.001);

  return {
    halfWidth: Math.max(0.1, width / 2),
    halfHeight: Math.max(0.1, height / 2),
    halfDepth: Math.max(0.1, depth / 2)
  };
}

function ClusteredWalkCollider({ asset }: { asset: SceneAsset }) {
  const collider = useMemo(() => measureColliderHalfExtents(asset), [asset]);

  return (
    <RigidBody type="fixed" colliders={false} position={asset.position} rotation={asset.rotation}>
      <CuboidCollider
        args={[collider.halfWidth, collider.halfHeight, collider.halfDepth]}
        position={[0, collider.halfHeight, 0]}
      />
    </RigidBody>
  );
}

function InstancedFurnitureCluster({
  assets,
  readOnly
}: {
  assets: SceneAsset[];
  readOnly: boolean;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const runtimeRenderer = useRuntimeRendererAdapter();
  const viewMode = useEditorStore((state) => state.viewMode);
  const topMode = useEditorStore((state) => state.topMode);
  const setIsTransforming = useEditorStore((state) => state.setIsTransforming);
  const setSelectedAssetId = useSelectionSelector((slice) => slice.setSelectedAssetId);
  const walls = useShellSelector((slice) => slice.walls);
  const ceilings = useShellSelector((slice) => slice.ceilings);
  const scale = useShellSelector((slice) => slice.scale);
  const sceneAssets = useAssetSelector((slice) => slice.assets);
  const recordSnapshot = usePublishSelector((slice) => slice.recordSnapshot);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const syncedVersionsRef = useRef<Record<string, number>>({});
  const topViewPolicy = useMemo(
    () => resolveTopViewInteractionPolicy(topMode),
    [topMode]
  );
  const firstAsset = assets[0]!;
  const clusterMembershipKey = useMemo(
    () => resolveInstancedClusterMembershipKey(assets),
    [assets]
  );
  const gltf = useGLBAsset(firstAsset.assetId);
  const finishMetadata = useMemo<FinishMetadata>(
    () => ({
      finishColor: firstAsset.product?.finishColor,
      finishMaterial: firstAsset.product?.finishMaterial,
      detailNotes: firstAsset.product?.detailNotes
    }),
    [
      firstAsset.product?.detailNotes,
      firstAsset.product?.finishColor,
      firstAsset.product?.finishMaterial
    ]
  );
  const finishAppearance = useMemo(
    () => resolveFinishAppearance(finishMetadata),
    [finishMetadata]
  );
  const instancedMeshes = useMemo<InstancedMeshEntry[]>(() => {
    const template = gltf.scene.clone(true);
    applyFinishAppearanceToObject(template, finishAppearance);
    template.updateWorldMatrix(true, true);

    const clusterMeshes: InstancedMeshEntry[] = [];

    template.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const mesh = new THREE.InstancedMesh(child.geometry, child.material, assets.length);
      mesh.name = `instanced:${firstAsset.assetId}:${clusterMembershipKey}:${child.uuid}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;

      clusterMeshes.push({
        key: child.uuid,
        mesh,
        sourceMatrix: child.matrixWorld.clone()
      });
    });

    return clusterMeshes;
  }, [assets.length, clusterMembershipKey, finishAppearance, firstAsset.assetId, gltf.scene]);

  useLayoutEffect(() => {
    syncInstancedMeshesFromAssets(instancedMeshes, assets);
    const activeIds = new Set(assets.map((asset) => asset.id));
    Object.keys(syncedVersionsRef.current).forEach((objectId) => {
      if (!activeIds.has(objectId)) {
        delete syncedVersionsRef.current[objectId];
      }
    });
  }, [assets, instancedMeshes]);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
      instancedMeshes.forEach(({ mesh }) => {
        const material = mesh.material;
        if (Array.isArray(material)) {
          material.forEach((entry) => entry.dispose());
        } else {
          material?.dispose();
        }
      });
    };
  }, [instancedMeshes]);

  const allowRoomModeDirectDrag =
    !readOnly && viewMode === "top" && topViewPolicy.allowDirectAssetDrag;
  const allowInteractiveSelection = readOnly;
  const allowPointerInteraction = allowRoomModeDirectDrag || allowInteractiveSelection;

  const applyPreviewPlacementToInstance = useMemo(() => {
    return (
      instanceId: number,
      targetAsset: SceneAsset,
      placement: {
        position: [number, number, number];
        rotation: [number, number, number];
      }
    ) => {
      applyPlacementToInstancedMeshes(instancedMeshes, instanceId, {
        position: placement.position,
        rotation: placement.rotation,
        scale: targetAsset.scale
      });
    };
  }, [instancedMeshes]);

  useFrame(() => {
    if (!runtimeRenderer) {
      return;
    }

    let updated = false;
    const assetMatrix = new THREE.Matrix4();

    assets.forEach((asset, index) => {
      const handle = runtimeRenderer.getObjectHandle(asset.id);
      if (!handle?.matrix) {
        return;
      }

      const previousVersion = syncedVersionsRef.current[asset.id] ?? -1;
      if (handle.version === previousVersion) {
        return;
      }

      syncedVersionsRef.current[asset.id] = handle.version;
      assetMatrix.fromArray(handle.matrix);
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scaleVector = new THREE.Vector3();
      assetMatrix.decompose(position, quaternion, scaleVector);
      const rotation = new THREE.Euler().setFromQuaternion(quaternion, "XYZ");
      applyPlacementToInstancedMeshes(instancedMeshes, index, {
        position: [position.x, position.y, position.z],
        rotation: [rotation.x, rotation.y, rotation.z],
        scale: [scaleVector.x, scaleVector.y, scaleVector.z]
      });
      updated = true;
    });

    if (updated) {
      invalidate();
    }
  });

  const resolvePlacementFromPointer = (nativeEvent: PointerEvent, targetAsset: SceneAsset) => {
    const rect = gl.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const pointer = new THREE.Vector2(
      ((nativeEvent.clientX - rect.left) / rect.width) * 2 - 1,
      -((nativeEvent.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);

    const intersection = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(groundPlane, intersection)) {
      return null;
    }

    const snap = (value: number) =>
      Math.round(value / topViewPolicy.translationSnap) * topViewPolicy.translationSnap;

    return constrainPlacementToAnchor(
      {
        position: [snap(intersection.x), targetAsset.position[1], snap(intersection.z)],
        rotation: targetAsset.rotation,
        anchorType: targetAsset.anchorType,
        supportAssetId: targetAsset.supportAssetId
      },
      {
        walls,
        ceilings,
        scale,
        sceneAssets,
        activeAssetId: targetAsset.id
      }
    );
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    const instanceId = event.instanceId;
    if (instanceId === undefined || instanceId === null) return;
    const targetAsset = assets[instanceId];
    if (!targetAsset) return;
    event.stopPropagation();
    const startedAt = performance.now();
    setSelectedAssetId(targetAsset.id);

    if (allowRoomModeDirectDrag) {
      dragCleanupRef.current?.();
      beginRuntimeAssetPreview(targetAsset.id);
      setIsTransforming(true);
      scheduleInteractionLatency("drag-start", startedAt, {
        viewMode,
        topMode,
        targetId: targetAsset.id
      });

      let moved = false;
      let pendingPlacement: {
        anchorType: SceneAsset["anchorType"];
        supportAssetId: SceneAsset["supportAssetId"];
        position: [number, number, number];
        rotation: [number, number, number];
      } | null = null;
      const handleWindowPointerMove = (nativeEvent: PointerEvent) => {
        const anchoredPlacement = resolvePlacementFromPointer(nativeEvent, targetAsset);
        if (!anchoredPlacement) return;
        moved = true;
        pendingPlacement = {
          anchorType: anchoredPlacement.anchorType,
          supportAssetId: anchoredPlacement.supportAssetId,
          position: anchoredPlacement.position,
          rotation: anchoredPlacement.rotation
        };
        previewRuntimeAssetTransform(targetAsset.id, {
          position: anchoredPlacement.position,
          rotation: anchoredPlacement.rotation,
          scale: targetAsset.scale
        });
        applyPreviewPlacementToInstance(instanceId, targetAsset, anchoredPlacement);
        invalidate();
      };
      const handleWindowPointerUp = () => {
        dragCleanupRef.current?.();
        dragCleanupRef.current = null;
        setIsTransforming(false);
        if (moved && pendingPlacement) {
          commitRuntimeAssetUpdateToStore({
            objectId: targetAsset.id,
            updates: pendingPlacement
          });
          recordSnapshot("Move asset");
        } else {
          cancelRuntimeAssetPreview(targetAsset.id);
        }
        invalidate();
      };

      dragCleanupRef.current = () => {
        window.removeEventListener("pointermove", handleWindowPointerMove);
        window.removeEventListener("pointerup", handleWindowPointerUp);
        window.removeEventListener("pointercancel", handleWindowPointerUp);
      };

      window.addEventListener("pointermove", handleWindowPointerMove);
      window.addEventListener("pointerup", handleWindowPointerUp, { once: true });
      window.addEventListener("pointercancel", handleWindowPointerUp, { once: true });
      invalidate();
      return;
    }

    if (!allowInteractiveSelection) return;
    invalidate();
    scheduleInteractionLatency("select", startedAt, {
      viewMode,
      topMode,
      targetId: targetAsset.id
    });
  };

  const handlePointerOver = () => {
    if (!allowPointerInteraction || typeof document === "undefined") return;
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    if (!allowPointerInteraction || typeof document === "undefined") return;
    document.body.style.cursor = "default";
  };

  return (
    <group>
      {instancedMeshes.map(({ key, mesh }) => (
        <primitive
          key={key}
          object={mesh}
          onPointerDown={handlePointerDown}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        />
      ))}
      {readOnly && viewMode === "walk"
        ? assets.map((asset) => <ClusteredWalkCollider key={`collider:${asset.id}`} asset={asset} />)
        : null}
    </group>
  );
}

function ModelInstance({ asset, lodPlan }: { asset: SceneAsset; lodPlan: AssetLodPlan }) {
  const gltf = useGLBAsset(asset.assetId);
  const finishMetadata = useMemo<FinishMetadata>(
    () => ({
      finishColor: asset.product?.finishColor,
      finishMaterial: asset.product?.finishMaterial,
      detailNotes: asset.product?.detailNotes
    }),
    [asset.product?.detailNotes, asset.product?.finishColor, asset.product?.finishMaterial]
  );
  const finishAppearance = useMemo(
    () => resolveFinishAppearance(finishMetadata),
    [finishMetadata]
  );
  const model = useMemo(() => {
    const high = gltf.scene.clone(true);
    high.name = resolveFurnitureRenderSourceName("real-glb", asset.id);
    high.userData.furnitureRenderSource = "real-glb";
    high.userData.assetId = asset.id;
    applyFinishAppearanceToObject(high, finishAppearance);

    if (!lodPlan.useProxyBox || lodPlan.lowDetailDistance === null) {
      return high;
    }

    const root = new THREE.LOD();
    const bbox = new THREE.Box3().setFromObject(high);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bbox.getSize(size);
    bbox.getCenter(center);
    const lowGeometry = new THREE.BoxGeometry(
      Math.max(0.2, size.x),
      Math.max(0.2, size.y),
      Math.max(0.2, size.z)
    );
    lowGeometry.translate(center.x, center.y, center.z);
    const lowMaterial = new THREE.MeshStandardMaterial({ color: "#d8d2c4", roughness: 0.9 });
    if (finishAppearance) {
      applyFinishAppearance(lowMaterial, {
        ...finishAppearance,
        tintStrength: Math.min(0.26, finishAppearance.tintStrength + 0.04)
      });
    }
    const low = new THREE.Mesh(lowGeometry, lowMaterial);
    low.name = resolveFurnitureRenderSourceName("lod-proxy", asset.id);
    low.userData.furnitureRenderSource = "lod-proxy";
    low.userData.assetId = asset.id;
    root.name = resolveFurnitureRenderSourceName("real-glb-lod", asset.id);
    root.userData.furnitureRenderSource = "real-glb-lod";
    root.userData.assetId = asset.id;
    root.addLevel(high, 0);
    root.addLevel(low, lodPlan.lowDetailDistance);
    return root;
  }, [asset.id, finishAppearance, gltf.scene, lodPlan.lowDetailDistance, lodPlan.useProxyBox]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const bounds = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    let meshCount = 0;
    const materials = new Set<THREE.Material>();

    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      meshCount += 1;
      const material = child.material;
      if (Array.isArray(material)) {
        material.forEach((entry) => materials.add(entry));
      } else if (material) {
        materials.add(material);
      }
    });

    const registry = (window.__DESKTERIORONLINE_FURNITURE_GLB_LOADS__ ??= {});
    registry[asset.id] = {
      assetId: asset.id,
      assetKey: asset.assetId,
      catalogItemId: asset.catalogItemId ?? null,
      productName: asset.product?.name ?? null,
      source: lodPlan.useProxyBox && lodPlan.lowDetailDistance !== null ? "real-glb-lod" : "real-glb",
      status: "loaded",
      meshCount,
      materialCount: materials.size,
      bounds: {
        width: size.x,
        height: size.y,
        depth: size.z
      }
    };

    return () => {
      delete window.__DESKTERIORONLINE_FURNITURE_GLB_LOADS__?.[asset.id];
    };
  }, [
    asset.assetId,
    asset.catalogItemId,
    asset.id,
    asset.product?.name,
    lodPlan.lowDetailDistance,
    lodPlan.useProxyBox,
    model
  ]);

  useEffect(() => {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return () => {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          const material = child.material;
          if (Array.isArray(material)) {
            material.forEach((mat) => mat.dispose());
          } else {
            material?.dispose();
          }
        }
      });
    };
  }, [model]);

  return (
    <FurnitureRenderSourceMarker
      source={lodPlan.useProxyBox && lodPlan.lowDetailDistance !== null ? "real-glb-lod" : "real-glb"}
      assetId={asset.id}
    >
      <primitive object={model} />
    </FurnitureRenderSourceMarker>
  );
}

function FurnitureItem({ asset, enableDynamicLight }: { asset: SceneAsset; enableDynamicLight: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  const runtimeEngine = useRuntimeEngine();
  const runtimeRenderer = useRuntimeRendererAdapter();
  const interactionRegistry = useInteractionRegistry();
  const viewMode = useEditorStore((state) => state.viewMode);
  const topMode = useEditorStore((state) => state.topMode);
  const isTransforming = useEditorStore((state) => state.isTransforming);
  const setIsTransforming = useEditorStore((state) => state.setIsTransforming);
  const readOnly = useEditorStore((state) => state.readOnly);
  const requestFocusPlacement = useFocusPlacementStore((state) => state.requestFocusPlacement);
  const pendingFocusPlacementRequest = useFocusPlacementStore((state) => state.pendingRequest);
  const activeFocusPlacementSession = useFocusPlacementStore((state) => state.activeSession);
  const placementDraft = useWalkInventoryStore((state) => state.placementDraft);
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const setSelectedAssetId = useSelectionSelector((slice) => slice.setSelectedAssetId);
  const walls = useShellSelector((slice) => slice.walls);
  const ceilings = useShellSelector((slice) => slice.ceilings);
  const scale = useShellSelector((slice) => slice.scale);
  const storeSceneAssets = useAssetSelector((slice) => slice.assets);
  const recordSnapshot = usePublishSelector((slice) => slice.recordSnapshot);
  const sceneAssets = useMemo(() => {
    if (!placementDraft?.asset || storeSceneAssets.some((candidate) => candidate.id === placementDraft.objectId)) {
      return storeSceneAssets;
    }
    return [...storeSceneAssets, placementDraft.asset];
  }, [placementDraft, storeSceneAssets]);
  const [isDragging, setIsDragging] = useState(false);
  const groupRef = useRef<THREE.Group | null>(null);
  const pendingPlacementRef = useRef<{
    anchorType: SceneAsset["anchorType"];
    supportAssetId: SceneAsset["supportAssetId"];
    position: [number, number, number];
    rotation: [number, number, number];
  } | null>(null);
  const isSelected = selectedAssetId === asset.id;
  const selectedAsset = useMemo(
    () => sceneAssets.find((candidate) => candidate.id === selectedAssetId) ?? null,
    [sceneAssets, selectedAssetId]
  );
  const selectedSupportAssetId = useMemo(
    () => sceneAssets.find((candidate) => candidate.id === selectedAssetId)?.supportAssetId ?? null,
    [sceneAssets, selectedAssetId]
  );
  const supportRuntimeAsset = useMemo(() => {
    const runtimeAssetId = asset.catalogItemId ?? asset.assetId;
    return runtimeEngine?.runtimeScene.runtimeAssets.get(runtimeAssetId) ?? null;
  }, [asset.assetId, asset.catalogItemId, runtimeEngine]);
  const selectedRuntimeAsset = useMemo(() => {
    if (!selectedAsset) {
      return null;
    }

    const runtimeAssetId = selectedAsset.catalogItemId ?? selectedAsset.assetId;
    return runtimeEngine?.runtimeScene.runtimeAssets.get(runtimeAssetId) ?? null;
  }, [runtimeEngine, selectedAsset]);
  const focusPlacementEntry = useMemo(
    () =>
      resolveFocusPlacementEntry({
        selectedAsset,
        selectedRuntimeAsset,
        supportAsset: asset,
        supportSurfaces: supportRuntimeAsset?.supportSurfaces ?? []
      }),
    [asset, selectedAsset, selectedRuntimeAsset, supportRuntimeAsset]
  );
  const focusSurfaceCandidate =
    focusPlacementEntry.candidates[focusPlacementEntry.preferredCandidateIndex] ?? null;
  const focusPlacementRequest = useMemo(() => {
    if (!selectedAsset || !focusSurfaceCandidate) {
      return null;
    }

    return buildFocusPlacementRequest({
      selectedAsset,
      supportAsset: asset,
      entry: focusPlacementEntry,
      candidate: focusSurfaceCandidate
    });
  }, [asset, focusPlacementEntry, focusSurfaceCandidate, selectedAsset]);
  const canRegisterFocusPlacement =
    !readOnly &&
    viewMode === "walk" &&
    selectedAsset?.id !== asset.id &&
    focusPlacementEntry.candidates.length > 0;
  const canOfferFocusPlacement =
    canRegisterFocusPlacement && focusPlacementEntry.availability.enabled;
  const canAutoAimFocusPlacement =
    canOfferFocusPlacement &&
    Boolean(placementDraft && selectedAsset && placementDraft.objectId === selectedAsset.id);
  const topViewPolicy = useMemo(
    () => resolveTopViewInteractionPolicy(topMode),
    [topMode]
  );
  const lodPlan = useMemo(
    () => {
      const hasFocusPriority =
        selectedAssetId === asset.id ||
        selectedSupportAssetId === asset.id ||
        pendingFocusPlacementRequest?.objectId === asset.id ||
        pendingFocusPlacementRequest?.supportObjectId === asset.id ||
        activeFocusPlacementSession?.objectId === asset.id ||
        activeFocusPlacementSession?.supportObjectId === asset.id ||
        (isDragging && selectedAssetId === asset.id);

      return resolveAssetLodPlan({
        asset,
        viewMode,
        topMode,
        priority: hasFocusPriority ? "focus" : "default"
      });
    },
    [
      activeFocusPlacementSession,
      asset,
      isDragging,
      pendingFocusPlacementRequest,
      selectedAssetId,
      selectedSupportAssetId,
      topMode,
      viewMode
    ]
  );
  const lightProfile = useMemo(
    () => (enableDynamicLight ? resolveAssetLightProfile(asset) : null),
    [asset, enableDynamicLight]
  );
  const shouldRenderLight =
    lightProfile != null &&
    (viewMode !== "top" || topMode === "desk-precision");
  const isVisible = resolveRuntimeAssetVisibility(runtimeRenderer, runtimeEngine, asset);
  const activeFocusFeedback =
    activeFocusPlacementSession?.objectId === asset.id
      ? resolveFocusPlacementFeedback(
          activeFocusPlacementSession.constraintReport,
          activeFocusPlacementSession.collisionReport
        )
      : null;
  const isInventoryDraft = placementDraft?.objectId === asset.id;
  const ghostDimensions = asset.product?.dimensionsMm
    ? {
        width: Math.max(asset.product.dimensionsMm.width / 1000, 0.04),
        depth: Math.max(asset.product.dimensionsMm.depth / 1000, 0.04),
        height: Math.max(asset.product.dimensionsMm.height / 1000, 0.02)
      }
    : {
        width: Math.max(asset.scale[0], 0.3),
        depth: Math.max(asset.scale[2], 0.3),
        height: Math.max(asset.scale[1], 0.3)
      };
  const focusGhostColor =
    activeFocusFeedback?.tone === "blocked"
      ? "#fb7185"
      : activeFocusFeedback?.tone === "warning"
        ? "#fbbf24"
        : "#34d399";
  const shouldShowPlacementGhost = Boolean(activeFocusFeedback || isInventoryDraft);

  const handleReadOnlySelect = (event: ThreeEvent<PointerEvent>) => {
    if (!readOnly) return;
    event.stopPropagation();
    const startedAt = performance.now();
    setSelectedAssetId(asset.id);
    invalidate();
    scheduleInteractionLatency("select", startedAt, {
      viewMode,
      topMode,
      targetId: asset.id
    });
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (viewMode !== "top" || isTransforming || readOnly) return;
    event.stopPropagation();
    const startedAt = performance.now();
    setSelectedAssetId(asset.id);
    invalidate();
    if (!topViewPolicy.allowDirectAssetDrag) {
      scheduleInteractionLatency("select", startedAt, {
        viewMode,
        topMode,
        targetId: asset.id
      });
      return;
    }
    setIsDragging(true);
    setIsTransforming(true);
    beginRuntimeAssetPreview(asset.id);
    pendingPlacementRef.current = {
      anchorType: asset.anchorType,
      supportAssetId: asset.supportAssetId,
      position: asset.position,
      rotation: asset.rotation
    };
    const target = event.nativeEvent.target as HTMLElement | null;
    target?.setPointerCapture(event.pointerId);
    invalidate();
    scheduleInteractionLatency("drag-start", startedAt, {
      viewMode,
      topMode,
      targetId: asset.id
    });
  };

  const handlePointerUp = (event: ThreeEvent<PointerEvent>) => {
    if (viewMode !== "top" || readOnly) return;
    event.stopPropagation();
    const pendingPlacement = pendingPlacementRef.current;
    if (isDragging && pendingPlacement) {
      commitRuntimeAssetUpdateToStore({
        objectId: asset.id,
        updates: pendingPlacement
      });
      recordSnapshot("Move asset");
    } else {
      cancelRuntimeAssetPreview(asset.id);
    }
    pendingPlacementRef.current = null;
    setIsDragging(false);
    setIsTransforming(false);
    const target = event.nativeEvent.target as HTMLElement | null;
    target?.releasePointerCapture(event.pointerId);
    invalidate();
  };

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    if (viewMode !== "top" || !isDragging || readOnly) return;
    event.stopPropagation();
    const intersection = new THREE.Vector3();
    if (!event.ray.intersectPlane(groundPlane, intersection)) return;
    const snap = (value: number) =>
      Math.round(value / topViewPolicy.translationSnap) * topViewPolicy.translationSnap;
    const anchoredPlacement = constrainPlacementToAnchor(
      {
        position: [snap(intersection.x), asset.position[1], snap(intersection.z)],
        rotation: asset.rotation,
        anchorType: asset.anchorType,
        supportAssetId: asset.supportAssetId
      },
      {
        walls,
        ceilings,
        scale,
        sceneAssets,
        activeAssetId: asset.id
      }
    );
    pendingPlacementRef.current = {
      anchorType: anchoredPlacement.anchorType,
      supportAssetId: anchoredPlacement.supportAssetId,
      position: anchoredPlacement.position,
      rotation: anchoredPlacement.rotation
    };
    previewRuntimeAssetTransform(asset.id, {
      position: anchoredPlacement.position,
      rotation: anchoredPlacement.rotation,
      scale: asset.scale
    });
    groupRef.current?.position.set(...anchoredPlacement.position);
    groupRef.current?.rotation.set(...anchoredPlacement.rotation);
    invalidate();
  };

  useEffect(() => {
    return () => {
      cancelRuntimeAssetPreview(asset.id);
      pendingPlacementRef.current = null;
      if (isDragging) {
        setIsTransforming(false);
      }
    };
  }, [asset.id, isDragging, setIsTransforming]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group || !canRegisterFocusPlacement || !focusSurfaceCandidate) {
      return;
    }

    const highlightMesh = findHighlightMesh(group);
    group.userData.interactive = true;
    group.userData.interactionLabel = focusPlacementEntry.availability.hint;
    group.userData.interactionHint = {
      label: focusPlacementEntry.availability.hint,
      actionable: focusPlacementEntry.availability.enabled,
      tone: focusPlacementEntry.availability.tone
    };
    group.userData.focusPlacementAimRequest = canAutoAimFocusPlacement
      ? focusPlacementRequest
      : undefined;
    if (canAutoAimFocusPlacement && focusPlacementRequest && typeof window !== "undefined") {
      window.__DESKTERIORONLINE_FOCUS_PLACEMENT_AIM_REQUESTS__ ??= {};
      window.__DESKTERIORONLINE_FOCUS_PLACEMENT_AIM_REQUESTS__[asset.id] = focusPlacementRequest;
    }
    group.userData.onInteract =
      canOfferFocusPlacement && focusPlacementRequest
        ? () => requestFocusPlacement(focusPlacementRequest)
        : undefined;
    if (highlightMesh) {
      group.userData.highlightMesh = highlightMesh;
    }

    interactionRegistry?.register(group);
    return () => {
      interactionRegistry?.unregister(group);
      delete group.userData.interactive;
      delete group.userData.interactionLabel;
      delete group.userData.interactionHint;
      delete group.userData.onInteract;
      delete group.userData.focusPlacementAimRequest;
      delete group.userData.highlightMesh;
      if (typeof window !== "undefined") {
        delete window.__DESKTERIORONLINE_FOCUS_PLACEMENT_AIM_REQUESTS__?.[asset.id];
      }
    };
  }, [
    asset.assetId,
    asset.id,
    asset.product?.name,
    canRegisterFocusPlacement,
    canOfferFocusPlacement,
    canAutoAimFocusPlacement,
    focusPlacementEntry.availability.enabled,
    focusPlacementEntry.availability.hint,
    focusPlacementEntry.availability.tone,
    focusPlacementEntry.candidates,
    focusPlacementEntry.preferredCandidateIndex,
    focusPlacementRequest,
    focusSurfaceCandidate,
    interactionRegistry,
    requestFocusPlacement,
    selectedAsset
  ]);

  useEffect(() => {
    if (viewMode === "walk" || isDragging || !groupRef.current) return;
    applyRuntimeTransformToObject(
      groupRef.current,
      resolveRuntimeAssetTransform(runtimeRenderer, runtimeEngine, asset)
    );
    invalidate();
  }, [asset, invalidate, isDragging, runtimeEngine, runtimeRenderer, viewMode]);

  useFrame(() => {
    if (!groupRef.current || isDragging || !isSelected) {
      return;
    }

    const resolvedTransform = resolveRuntimeAssetTransform(runtimeRenderer, runtimeEngine, asset);
    if (viewMode === "walk") {
      groupRef.current.position.set(
        resolvedTransform.position[0] - asset.position[0],
        resolvedTransform.position[1] - asset.position[1],
        resolvedTransform.position[2] - asset.position[2]
      );
      relativePreviewEuler.set(
        resolvedTransform.rotation[0] - asset.rotation[0],
        resolvedTransform.rotation[1] - asset.rotation[1],
        resolvedTransform.rotation[2] - asset.rotation[2]
      );
      groupRef.current.rotation.copy(relativePreviewEuler);
      groupRef.current.scale.set(...resolvedTransform.scale);
      return;
    }

    applyRuntimeTransformToObject(groupRef.current, resolvedTransform);
  });

  const builderProxyKind = useMemo(() => resolveBuilderProxyKind(asset), [asset]);
  const builderProxyFallback = builderProxyKind ? (
    <FurnitureRenderSourceMarker source="builder-preview-proxy" assetId={asset.id}>
      <BuilderPreviewProxy asset={asset} kind={builderProxyKind} />
    </FurnitureRenderSourceMarker>
  ) : (
    <FurnitureRenderSourceMarker source="placeholder-fallback" assetId={asset.id}>
      <PlaceholderFurniture />
    </FurnitureRenderSourceMarker>
  );
  const forceRealGlbTopViewQa =
    typeof window !== "undefined" && window.__DESKTERIORONLINE_FORCE_REAL_GLB_TOP_VIEW_QA__ === true;
  const shouldRenderBuilderProxy =
    (viewMode === "builder-preview" || (viewMode === "top" && !forceRealGlbTopViewQa)) &&
    builderProxyKind !== null;
  const isPlaceholder = isPlaceholderAsset(asset.assetId);
  const renderSource = resolveFurnitureRenderSource({
    shouldRenderBuilderProxy,
    isPlaceholder,
    lodPlan
  });
  const content = shouldRenderBuilderProxy ? (
    builderProxyFallback
  ) : isPlaceholder ? (
    <FurnitureRenderSourceMarker source="placeholder-fallback" assetId={asset.id}>
      <PlaceholderFurniture />
    </FurnitureRenderSourceMarker>
  ) : (
    <Suspense
      fallback={
        <FurnitureRenderSourceMarker source="model-loading-fallback" assetId={asset.id}>
          <PlaceholderFurniture />
        </FurnitureRenderSourceMarker>
      }
    >
      <ModelInstance asset={asset} lodPlan={lodPlan} />
    </Suspense>
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const registry = (window.__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__ ??= {});
    if (!isVisible) {
      delete registry[asset.id];
      return;
    }

    registry[asset.id] = {
      assetId: asset.id,
      assetKey: asset.assetId,
      catalogItemId: asset.catalogItemId ?? null,
      productName: asset.product?.name ?? null,
      source: renderSource,
      viewMode,
      topMode,
      usesLodProxy: lodPlan.useProxyBox && lodPlan.lowDetailDistance !== null
    };

    return () => {
      delete window.__DESKTERIORONLINE_FURNITURE_RENDER_SOURCES__?.[asset.id];
    };
  }, [
    asset.assetId,
    asset.catalogItemId,
    asset.id,
    asset.product?.name,
    isVisible,
    lodPlan.lowDetailDistance,
    lodPlan.useProxyBox,
    renderSource,
    topMode,
    viewMode
  ]);

  const groupProps =
    readOnly
      ? {
          onPointerDown: handleReadOnlySelect
        }
      : viewMode === "top"
      ? topViewPolicy.allowDirectAssetDrag
        ? {
            onPointerDown: handlePointerDown,
            onPointerUp: handlePointerUp,
            onPointerMove: handlePointerMove,
            onPointerLeave: handlePointerUp
          }
        : {}
      : {};

  if (!isVisible) {
    return null;
  }

  if (viewMode === "walk") {
    return (
      <RigidBody
        type="fixed"
        colliders={isInventoryDraft ? false : "cuboid"}
        position={asset.position}
        rotation={asset.rotation}
      >
        <group ref={groupRef} name={`furniture:${asset.id}`} scale={asset.scale} {...groupProps}>
          {isInventoryDraft ? null : content}
          {shouldShowPlacementGhost ? (
            <mesh
              name={`focus-placement-ghost:${asset.id}`}
              position={[0, ghostDimensions.height / 2, 0]}
              renderOrder={20}
            >
              <boxGeometry args={[ghostDimensions.width, ghostDimensions.height, ghostDimensions.depth]} />
              <meshBasicMaterial
                color={focusGhostColor}
                transparent
                opacity={activeFocusFeedback?.tone === "blocked" ? 0.22 : 0.16}
                depthWrite={false}
              />
            </mesh>
          ) : null}
          {shouldShowPlacementGhost ? (
            <mesh
              name={`focus-placement-ghost-outline:${asset.id}`}
              position={[0, ghostDimensions.height / 2, 0]}
              renderOrder={21}
            >
              <boxGeometry args={[ghostDimensions.width, ghostDimensions.height, ghostDimensions.depth]} />
              <meshBasicMaterial
                color={focusGhostColor}
                wireframe
                transparent
                opacity={0.9}
                depthTest={false}
              />
            </mesh>
          ) : null}
          {shouldRenderLight ? (
            <pointLight
              position={lightProfile.offset}
              color={lightProfile.color}
              intensity={lightProfile.intensity}
              distance={lightProfile.distance}
              decay={2}
            />
          ) : null}
        </group>
      </RigidBody>
    );
  }

  return (
    <group
      ref={groupRef}
      name={`furniture:${asset.id}`}
      position={asset.position}
      rotation={asset.rotation}
      scale={asset.scale}
      {...groupProps}
    >
      {content}
      {shouldRenderLight ? (
        <pointLight
          position={lightProfile.offset}
          color={lightProfile.color}
          intensity={lightProfile.intensity}
          distance={lightProfile.distance}
          decay={2}
        />
      ) : null}
      {isSelected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.45, 0.62, 48]} />
          <meshBasicMaterial color={readOnly ? "#f2e8d9" : "#cde7ff"} transparent opacity={0.7} />
        </mesh>
      ) : null}
    </group>
  );
}

export default function Furniture({ allowDynamicLights }: { allowDynamicLights: boolean }) {
  const assets = useAssetSelector((slice) => slice.assets);
  const placementDraft = useWalkInventoryStore((state) => state.placementDraft);
  const runtimeEngine = useRuntimeEngine();
  const runtimeRenderer = useRuntimeRendererAdapter();
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const viewMode = useEditorStore((state) => state.viewMode);
  const topMode = useEditorStore((state) => state.topMode);
  const isTransforming = useEditorStore((state) => state.isTransforming);
  const readOnly = useEditorStore((state) => state.readOnly);
  const renderAssets = useMemo(() => {
    if (!placementDraft?.asset || assets.some((asset) => asset.id === placementDraft.objectId)) {
      return assets;
    }
    return [...assets, placementDraft.asset];
  }, [assets, placementDraft]);
  const visibleAssets = useMemo(
    () =>
      renderAssets.filter((asset) => resolveRuntimeAssetVisibility(runtimeRenderer, runtimeEngine, asset)),
    [renderAssets, runtimeEngine, runtimeRenderer]
  );
  const emitterAssetIds = useMemo(() => {
    if (!allowDynamicLights) {
      return new Set<string>();
    }
    const ids = new Set<string>();
    let count = 0;
    for (const asset of visibleAssets) {
      if (count >= MAX_DYNAMIC_EMITTERS) break;
      if (!isLightingAsset(asset)) continue;
      ids.add(asset.id);
      count += 1;
    }
    return ids;
  }, [allowDynamicLights, visibleAssets]);
  const pinnedAssetIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedAssetId) {
      ids.add(selectedAssetId);
      const selectedAsset = visibleAssets.find((asset) => asset.id === selectedAssetId);
      if (viewMode === "top" && topMode === "desk-precision" && selectedAsset?.supportAssetId) {
        ids.add(selectedAsset.supportAssetId);
      }
    }
    return ids;
  }, [selectedAssetId, topMode, viewMode, visibleAssets]);
  const instancingClusters = useMemo(
    () =>
      viewMode === "builder-preview"
        ? []
        : groupAssetsForInstancing({
            assets: visibleAssets,
            viewMode,
            topMode,
            readOnly,
            isTransforming,
            selectedAssetId,
            pinnedAssetIds,
            emitterAssetIds
          }),
    [emitterAssetIds, isTransforming, pinnedAssetIds, readOnly, selectedAssetId, topMode, viewMode, visibleAssets]
  );
  const instancedAssetIds = useMemo(() => {
    const ids = new Set<string>();
    instancingClusters.forEach((cluster) => {
      cluster.assets.forEach((asset) => ids.add(asset.id));
    });
    return ids;
  }, [instancingClusters]);

  return (
    <group>
      {viewMode === "builder-preview" ? <BuilderPreviewGroundDressing assets={visibleAssets} /> : null}
      {viewMode === "builder-preview" ? <BuilderPreviewSurfaceDressing assets={visibleAssets} /> : null}
      {viewMode === "builder-preview" ? <BuilderPreviewWallDressing /> : null}
      {instancingClusters.map((cluster) => (
        <InstancedFurnitureCluster key={cluster.key} assets={cluster.assets} readOnly={readOnly} />
      ))}
      {visibleAssets.map((asset) =>
        instancedAssetIds.has(asset.id) ? null : (
          <FurnitureItem
            key={asset.id}
            asset={asset}
            enableDynamicLight={emitterAssetIds.has(asset.id)}
          />
        )
      )}
    </group>
  );
}
