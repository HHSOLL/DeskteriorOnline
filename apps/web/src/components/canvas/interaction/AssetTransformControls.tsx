"use client";

import { TransformControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TransformControls as TransformControlsImpl } from "three-stdlib";
import { resolveTopViewInteractionPolicy } from "../../../lib/editor/top-view-policy";
import { scheduleInteractionLatency } from "../../../lib/performance/scene-telemetry";
import { constrainPlacementToAnchor } from "../../../lib/scene/anchors";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import type { Floor, RoomZone, Wall } from "../../../lib/stores/useSceneStore";
import {
  useAssetSelector,
  usePublishSelector,
  useSelectionSelector,
  useShellSelector
} from "../../../lib/stores/scene-slices";

const DEFAULT_HALF_FOOTPRINT = 0.12;

type PlacementBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};
type PlanPoint = [number, number];
type ExtendedTransformControls = TransformControlsImpl & {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

function vector3ToTuple(v: THREE.Vector3): [number, number, number] {
  return [v.x, v.y, v.z];
}

function eulerToTuple(e: THREE.Euler): [number, number, number] {
  return [e.x, e.y, e.z];
}

function polygonArea(points: PlanPoint[]) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, z1] = points[index]!;
    const [x2, z2] = points[(index + 1) % points.length]!;
    sum += x1 * z2 - x2 * z1;
  }
  return sum / 2;
}

function toWorldOutline(points: PlanPoint[], scale: number) {
  return points.map(([x, z]) => [x * scale, z * scale] as PlanPoint);
}

function pickLargestOutline(outlines: PlanPoint[][]) {
  return (
    outlines
      .filter((outline) => outline.length >= 3)
      .sort((left, right) => Math.abs(polygonArea(right)) - Math.abs(polygonArea(left)))[0] ?? null
  );
}

function computeBoundsFromPoints(points: PlanPoint[]): PlacementBounds | null {
  if (points.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  points.forEach(([x, z]) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  });
  return { minX, maxX, minZ, maxZ };
}

function resolvePlacementBounds(
  floors: Floor[],
  rooms: RoomZone[],
  walls: Wall[],
  scale: number
) {
  const primaryFloor = pickLargestOutline(floors.map((floor) => toWorldOutline(floor.outline, scale)));
  if (primaryFloor) {
    return computeBoundsFromPoints(primaryFloor);
  }

  const primaryRoom = pickLargestOutline(rooms.map((room) => toWorldOutline(room.polygon, scale)));
  if (primaryRoom) {
    return computeBoundsFromPoints(primaryRoom);
  }

  const wallPoints = walls.flatMap((wall) => [
    [wall.start[0] * scale, wall.start[1] * scale] as PlanPoint,
    [wall.end[0] * scale, wall.end[1] * scale] as PlanPoint
  ]);
  return computeBoundsFromPoints(wallPoints);
}

function measureObjectFootprint(object: THREE.Object3D) {
  object.updateWorldMatrix(true, true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) {
    return {
      halfWidth: DEFAULT_HALF_FOOTPRINT,
      halfDepth: DEFAULT_HALF_FOOTPRINT
    };
  }

  return {
    halfWidth: Math.max((box.max.x - box.min.x) / 2, DEFAULT_HALF_FOOTPRINT),
    halfDepth: Math.max((box.max.z - box.min.z) / 2, DEFAULT_HALF_FOOTPRINT)
  };
}

function clampPositionToBounds(
  position: [number, number, number],
  bounds: PlacementBounds | null,
  footprint: { halfWidth: number; halfDepth: number }
) {
  if (!bounds) return position;

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const minX = Math.min(bounds.minX + footprint.halfWidth, bounds.maxX);
  const maxX = Math.max(bounds.maxX - footprint.halfWidth, bounds.minX);
  const minZ = Math.min(bounds.minZ + footprint.halfDepth, bounds.maxZ);
  const maxZ = Math.max(bounds.maxZ - footprint.halfDepth, bounds.minZ);

  return [
    minX <= maxX ? THREE.MathUtils.clamp(position[0], minX, maxX) : centerX,
    position[1],
    minZ <= maxZ ? THREE.MathUtils.clamp(position[2], minZ, maxZ) : centerZ
  ] as [number, number, number];
}

export default function AssetTransformControls() {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const viewMode = useEditorStore((state) => state.viewMode);
  const topMode = useEditorStore((state) => state.topMode);
  const transformMode = useEditorStore((state) => state.transformMode);
  const transformSpace = useEditorStore((state) => state.transformSpace);
  const setIsTransforming = useEditorStore((state) => state.setIsTransforming);
  const readOnly = useEditorStore((state) => state.readOnly);
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const assets = useAssetSelector((slice) => slice.assets);
  const updateFurniture = useAssetSelector((slice) => slice.updateFurniture);
  const walls = useShellSelector((slice) => slice.walls);
  const floors = useShellSelector((slice) => slice.floors);
  const ceilings = useShellSelector((slice) => slice.ceilings);
  const rooms = useShellSelector((slice) => slice.rooms);
  const scale = useShellSelector((slice) => slice.scale);
  const recordSnapshot = usePublishSelector((slice) => slice.recordSnapshot);

  const [target, setTarget] = useState<THREE.Object3D | null>(null);
  const controlsRef = useRef<ExtendedTransformControls | null>(null);
  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );
  const topViewPolicy = useMemo(
    () => resolveTopViewInteractionPolicy(topMode),
    [topMode]
  );
  const placementBounds = useMemo(
    () => resolvePlacementBounds(floors, rooms, walls, scale),
    [floors, rooms, scale, walls]
  );

  useEffect(() => {
    if (
      !selectedAssetId ||
      viewMode !== "top" ||
      readOnly ||
      !topViewPolicy.allowTransformControls
    ) {
      setTarget(null);
      setIsTransforming(false);
      return;
    }
    const object = scene.getObjectByName(`furniture:${selectedAssetId}`) ?? null;
    setTarget(object);
  }, [
    assets,
    readOnly,
    scene,
    selectedAssetId,
    setIsTransforming,
    topViewPolicy.allowTransformControls,
    viewMode
  ]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    if (!target || !placementBounds) {
      controls.minX = -Infinity;
      controls.maxX = Infinity;
      controls.minY = -Infinity;
      controls.maxY = Infinity;
      controls.minZ = -Infinity;
      controls.maxZ = Infinity;
      return;
    }

    const footprint = measureObjectFootprint(target);
    const nextMinX = placementBounds.minX + footprint.halfWidth;
    const nextMaxX = placementBounds.maxX - footprint.halfWidth;
    const nextMinZ = placementBounds.minZ + footprint.halfDepth;
    const nextMaxZ = placementBounds.maxZ - footprint.halfDepth;
    const centerX = (placementBounds.minX + placementBounds.maxX) / 2;
    const centerZ = (placementBounds.minZ + placementBounds.maxZ) / 2;
    controls.minX = nextMinX <= nextMaxX ? nextMinX : centerX;
    controls.maxX = nextMinX <= nextMaxX ? nextMaxX : centerX;
    controls.minY = -Infinity;
    controls.maxY = Infinity;
    controls.minZ = nextMinZ <= nextMaxZ ? nextMinZ : centerZ;
    controls.maxZ = nextMinZ <= nextMaxZ ? nextMaxZ : centerZ;
  }, [placementBounds, target]);

  const applyLiveConstraints = useCallback(() => {
    if (!selectedAsset || !target) return null;
    const scaleLocked = selectedAsset.product?.scaleLocked === true;
    const footprint = measureObjectFootprint(target);
    const clampedPosition = clampPositionToBounds(
      vector3ToTuple(target.position),
      placementBounds,
      footprint
    );
    const anchoredPlacement = constrainPlacementToAnchor(
      {
        position: clampedPosition,
        rotation: eulerToTuple(target.rotation),
        anchorType: selectedAsset.anchorType,
        supportAssetId: selectedAsset.supportAssetId
      },
      {
        walls,
        ceilings,
        scale,
        sceneAssets: assets,
        activeAssetId: selectedAsset.id
      }
    );

    target.position.set(...anchoredPlacement.position);
    target.rotation.set(...anchoredPlacement.rotation);
    if (scaleLocked) {
      target.scale.set(...selectedAsset.scale);
    }

    invalidate();

    return {
      scaleLocked,
      updates: {
        anchorType: anchoredPlacement.anchorType,
        supportAssetId: anchoredPlacement.supportAssetId,
        position: anchoredPlacement.position,
        rotation: anchoredPlacement.rotation
      } as const
    };
  }, [assets, ceilings, invalidate, placementBounds, scale, selectedAsset, target, walls]);

  const commitTarget = useCallback(() => {
    if (!selectedAssetId || !target) return false;
    const constrained = applyLiveConstraints();
    if (!constrained) return false;

    updateFurniture(
      selectedAssetId,
      constrained.scaleLocked
        ? constrained.updates
        : {
            ...constrained.updates,
            scale: vector3ToTuple(target.scale)
          }
    );
    return true;
  }, [applyLiveConstraints, selectedAssetId, target, updateFurniture]);

  if (viewMode !== "top" || readOnly || !target || !topViewPolicy.allowTransformControls) {
    return null;
  }

  return (
    <TransformControls
      ref={controlsRef}
      object={target}
      mode={transformMode}
      showY={false}
      space={transformSpace}
      translationSnap={topViewPolicy.translationSnap}
      rotationSnap={topViewPolicy.rotationSnap}
      onObjectChange={applyLiveConstraints}
      onMouseDown={() => {
        const startedAt = performance.now();
        setIsTransforming(true);
        invalidate();
        scheduleInteractionLatency("gizmo-drag-start", startedAt, {
          viewMode,
          topMode,
          targetId: selectedAssetId
        });
      }}
      onMouseUp={() => {
        setIsTransforming(false);
        const didCommit = commitTarget();
        if (didCommit) {
          recordSnapshot("Transform asset");
        }
        invalidate();
      }}
    />
  );
}
