"use client";

import type { Engine, RuntimeWorldTransform } from "@deskterioronline/engine-core";
import type { ThreeRendererAdapter } from "@deskterioronline/renderer-three";
import * as THREE from "three";
import type { SceneAsset } from "../stores/useSceneStore";

const TRANSFORM_EPSILON = 1e-5;
const tempMatrix = new THREE.Matrix4();
const tempPosition = new THREE.Vector3();
const tempQuaternion = new THREE.Quaternion();
const tempScale = new THREE.Vector3();
const tempEuler = new THREE.Euler();

export function resolveRuntimeAssetTransform(
  runtimeRenderer: ThreeRendererAdapter | null | undefined,
  engine: Engine | null | undefined,
  asset: SceneAsset
): RuntimeWorldTransform {
  const rendererMatrix = runtimeRenderer?.getTransform(asset.id);
  if (rendererMatrix) {
    tempMatrix.fromArray(rendererMatrix);
    tempMatrix.decompose(tempPosition, tempQuaternion, tempScale);
    tempEuler.setFromQuaternion(tempQuaternion, "XYZ");
    return {
      position: [tempPosition.x, tempPosition.y, tempPosition.z],
      rotation: [tempEuler.x, tempEuler.y, tempEuler.z],
      scale: [tempScale.x, tempScale.y, tempScale.z]
    };
  }

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

export function resolveRuntimeAssetVisibility(
  runtimeRenderer: ThreeRendererAdapter | null | undefined,
  engine: Engine | null | undefined,
  asset: SceneAsset
) {
  const rendererHandle = runtimeRenderer?.getObjectHandle(asset.id);
  if (rendererHandle) {
    return rendererHandle.visible;
  }

  const runtimeObject = engine?.runtimeScene.objectRegistry.get(asset.id);
  if (runtimeObject) {
    return runtimeObject.visible;
  }

  return asset.visible !== false;
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
