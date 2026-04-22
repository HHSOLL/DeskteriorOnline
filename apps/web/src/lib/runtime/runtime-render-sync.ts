"use client";

import type { Engine, RuntimeWorldTransform } from "@deskterioronline/engine-core";
import * as THREE from "three";
import type { SceneAsset } from "../stores/useSceneStore";

const TRANSFORM_EPSILON = 1e-5;

export function resolveRuntimeAssetTransform(
  engine: Engine | null | undefined,
  asset: SceneAsset
): RuntimeWorldTransform {
  const runtimeObject = engine?.runtimeScene.objectRegistry.get(asset.id);
  const resolved = runtimeObject?.previewTransform ?? runtimeObject?.transform;
  if (resolved) {
    return resolved;
  }

  return {
    position: asset.position,
    rotation: asset.rotation,
    scale: asset.scale
  };
}

function differs(left: number, right: number) {
  return Math.abs(left - right) > TRANSFORM_EPSILON;
}

export function applyRuntimeTransformToObject(
  object: THREE.Object3D,
  transform: RuntimeWorldTransform
) {
  const needsPosition =
    differs(object.position.x, transform.position[0]) ||
    differs(object.position.y, transform.position[1]) ||
    differs(object.position.z, transform.position[2]);
  const needsRotation =
    differs(object.rotation.x, transform.rotation[0]) ||
    differs(object.rotation.y, transform.rotation[1]) ||
    differs(object.rotation.z, transform.rotation[2]);
  const needsScale =
    differs(object.scale.x, transform.scale[0]) ||
    differs(object.scale.y, transform.scale[1]) ||
    differs(object.scale.z, transform.scale[2]);

  if (!needsPosition && !needsRotation && !needsScale) {
    return false;
  }

  if (needsPosition) {
    object.position.set(...transform.position);
  }
  if (needsRotation) {
    object.rotation.set(...transform.rotation);
  }
  if (needsScale) {
    object.scale.set(...transform.scale);
  }

  return true;
}
