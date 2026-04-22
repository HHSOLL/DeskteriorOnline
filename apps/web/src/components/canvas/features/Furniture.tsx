"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { resolveTopViewInteractionPolicy } from "../../../lib/editor/top-view-policy";
import { useGLBAsset } from "../../../lib/loaders/AssetLoader";
import { constrainPlacementToAnchor } from "../../../lib/scene/anchors";
import { normalizeSceneAnchorType } from "../../../lib/scene/anchor-types";
import { groupAssetsForInstancing } from "../../../lib/scene/asset-instancing";
import {
  resolveAssetLodComplexity,
  resolveAssetLodPlan,
  type AssetLodPlan
} from "../../../lib/scene/asset-lod";
import { scheduleInteractionLatency } from "../../../lib/performance/scene-telemetry";
import { useRuntimeEngine } from "../../../lib/runtime/runtime-engine-context";
import { useRuntimeRendererAdapter } from "../../../lib/runtime/runtime-renderer-context";
import { applyRuntimeTransformToObject, resolveRuntimeAssetTransform } from "../../../lib/runtime/runtime-render-sync";
import {
  beginRuntimeAssetPreview,
  cancelRuntimeAssetPreview,
  commitRuntimeAssetUpdateToStore,
  previewRuntimeAssetTransform
} from "../../../lib/runtime/runtime-asset-bridge";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import {
  useAssetSelector,
  usePublishSelector,
  useSelectionSelector,
  useShellSelector
} from "../../../lib/stores/scene-slices";
import type { SceneAsset } from "../../../lib/stores/useSceneStore";

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
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

function isPlaceholderAsset(assetId: string) {
  return assetId.startsWith("placeholder:");
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
  const gltf = useGLBAsset(assets[0]!.assetId);
  const finishMetadata = useMemo<FinishMetadata>(
    () => ({
      finishColor: assets[0]?.product?.finishColor,
      finishMaterial: assets[0]?.product?.finishMaterial,
      detailNotes: assets[0]?.product?.detailNotes
    }),
    [assets]
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
    const assetMatrix = new THREE.Matrix4();
    const instanceMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    template.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const mesh = new THREE.InstancedMesh(child.geometry, child.material, assets.length);
      mesh.name = `instanced:${assets[0]!.assetId}:${child.uuid}`;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.instanceMatrix.needsUpdate = true;

      assets.forEach((asset, index) => {
        position.fromArray(asset.position);
        quaternion.setFromEuler(
          new THREE.Euler(asset.rotation[0], asset.rotation[1], asset.rotation[2])
        );
        scale.fromArray(asset.scale);
        assetMatrix.compose(position, quaternion, scale);
        instanceMatrix.multiplyMatrices(assetMatrix, child.matrixWorld);
        mesh.setMatrixAt(index, instanceMatrix);
      });

      clusterMeshes.push({
        key: child.uuid,
        mesh,
        sourceMatrix: child.matrixWorld.clone()
      });
    });

    return clusterMeshes;
  }, [assets, finishAppearance, gltf.scene]);

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
  const allowInteractiveSelection =
    readOnly || (viewMode === "top" && !topViewPolicy.allowDirectAssetDrag);
  const allowPointerInteraction = allowRoomModeDirectDrag || allowInteractiveSelection;

  const applyPreviewPlacementToInstance = useMemo(() => {
    const assetMatrix = new THREE.Matrix4();
    const instanceMatrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scaleVector = new THREE.Vector3();

    return (
      instanceId: number,
      targetAsset: SceneAsset,
      placement: {
        position: [number, number, number];
        rotation: [number, number, number];
      }
    ) => {
      position.fromArray(placement.position);
      quaternion.setFromEuler(
        new THREE.Euler(placement.rotation[0], placement.rotation[1], placement.rotation[2])
      );
      scaleVector.fromArray(targetAsset.scale);
      assetMatrix.compose(position, quaternion, scaleVector);

      instancedMeshes.forEach((entry) => {
        instanceMatrix.multiplyMatrices(assetMatrix, entry.sourceMatrix);
        entry.mesh.setMatrixAt(instanceId, instanceMatrix);
        entry.mesh.instanceMatrix.needsUpdate = true;
      });
    };
  }, [instancedMeshes]);

  useFrame(() => {
    if (!runtimeRenderer) {
      return;
    }

    let updated = false;
    const assetMatrix = new THREE.Matrix4();
    const instanceMatrix = new THREE.Matrix4();

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
      instancedMeshes.forEach((entry) => {
        instanceMatrix.multiplyMatrices(assetMatrix, entry.sourceMatrix);
        entry.mesh.setMatrixAt(index, instanceMatrix);
        entry.mesh.instanceMatrix.needsUpdate = true;
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
    root.addLevel(high, 0);
    root.addLevel(low, lodPlan.lowDetailDistance);
    return root;
  }, [finishAppearance, gltf.scene, lodPlan.lowDetailDistance, lodPlan.useProxyBox]);

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

  return <primitive object={model} />;
}

function FurnitureItem({ asset, enableDynamicLight }: { asset: SceneAsset; enableDynamicLight: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  const runtimeEngine = useRuntimeEngine();
  const runtimeRenderer = useRuntimeRendererAdapter();
  const viewMode = useEditorStore((state) => state.viewMode);
  const topMode = useEditorStore((state) => state.topMode);
  const isTransforming = useEditorStore((state) => state.isTransforming);
  const setIsTransforming = useEditorStore((state) => state.setIsTransforming);
  const readOnly = useEditorStore((state) => state.readOnly);
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const setSelectedAssetId = useSelectionSelector((slice) => slice.setSelectedAssetId);
  const walls = useShellSelector((slice) => slice.walls);
  const ceilings = useShellSelector((slice) => slice.ceilings);
  const scale = useShellSelector((slice) => slice.scale);
  const sceneAssets = useAssetSelector((slice) => slice.assets);
  const recordSnapshot = usePublishSelector((slice) => slice.recordSnapshot);
  const [isDragging, setIsDragging] = useState(false);
  const groupRef = useRef<THREE.Group | null>(null);
  const pendingPlacementRef = useRef<{
    anchorType: SceneAsset["anchorType"];
    supportAssetId: SceneAsset["supportAssetId"];
    position: [number, number, number];
    rotation: [number, number, number];
  } | null>(null);
  const isSelected = selectedAssetId === asset.id;
  const selectedSupportAssetId = useMemo(
    () => sceneAssets.find((candidate) => candidate.id === selectedAssetId)?.supportAssetId ?? null,
    [sceneAssets, selectedAssetId]
  );
  const topViewPolicy = useMemo(
    () => resolveTopViewInteractionPolicy(topMode),
    [topMode]
  );
  const lodPlan = useMemo(
    () => {
      const preserveFullDetail =
        viewMode === "top" &&
        topMode === "desk-precision" &&
        (selectedAssetId === asset.id || selectedSupportAssetId === asset.id);

      if (preserveFullDetail) {
        return {
          complexity: resolveAssetLodComplexity(asset.product?.lodProfile ?? null),
          useProxyBox: false,
          lowDetailDistance: null
        } satisfies AssetLodPlan;
      }

      return resolveAssetLodPlan({
        asset,
        viewMode,
        topMode
      });
    },
    [asset, selectedAssetId, selectedSupportAssetId, topMode, viewMode]
  );
  const lightProfile = useMemo(
    () => (enableDynamicLight ? resolveAssetLightProfile(asset) : null),
    [asset, enableDynamicLight]
  );
  const shouldRenderLight =
    lightProfile != null &&
    (viewMode !== "top" || topMode === "desk-precision");

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

    applyRuntimeTransformToObject(
      groupRef.current,
      resolveRuntimeAssetTransform(runtimeRenderer, runtimeEngine, asset)
    );
  });

  const content = isPlaceholderAsset(asset.assetId) ? (
    <PlaceholderFurniture />
  ) : (
    <Suspense fallback={<PlaceholderFurniture />}>
      <ModelInstance asset={asset} lodPlan={lodPlan} />
    </Suspense>
  );

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
        : {
            onPointerDown: handlePointerDown
          }
      : {};

  if (viewMode === "walk") {
    return (
      <RigidBody type="fixed" colliders="cuboid" position={asset.position} rotation={asset.rotation}>
        <group name={`furniture:${asset.id}`} scale={asset.scale} {...groupProps}>
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
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const viewMode = useEditorStore((state) => state.viewMode);
  const topMode = useEditorStore((state) => state.topMode);
  const isTransforming = useEditorStore((state) => state.isTransforming);
  const readOnly = useEditorStore((state) => state.readOnly);
  const emitterAssetIds = useMemo(() => {
    if (!allowDynamicLights) {
      return new Set<string>();
    }
    const ids = new Set<string>();
    let count = 0;
    for (const asset of assets) {
      if (count >= MAX_DYNAMIC_EMITTERS) break;
      if (!isLightingAsset(asset)) continue;
      ids.add(asset.id);
      count += 1;
    }
    return ids;
  }, [allowDynamicLights, assets]);
  const pinnedAssetIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedAssetId) {
      ids.add(selectedAssetId);
      const selectedAsset = assets.find((asset) => asset.id === selectedAssetId);
      if (viewMode === "top" && topMode === "desk-precision" && selectedAsset?.supportAssetId) {
        ids.add(selectedAsset.supportAssetId);
      }
    }
    return ids;
  }, [assets, selectedAssetId, topMode, viewMode]);
  const instancingClusters = useMemo(
    () =>
      groupAssetsForInstancing({
        assets,
        viewMode,
        topMode,
        readOnly,
        isTransforming,
        selectedAssetId,
        pinnedAssetIds,
        emitterAssetIds
      }),
    [assets, emitterAssetIds, isTransforming, pinnedAssetIds, readOnly, selectedAssetId, topMode, viewMode]
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
      {instancingClusters.map((cluster) => (
        <InstancedFurnitureCluster key={cluster.key} assets={cluster.assets} readOnly={readOnly} />
      ))}
      {assets.map((asset) =>
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
