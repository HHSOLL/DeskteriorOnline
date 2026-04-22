import type { RuntimeObjectRecord, RuntimeScene, RuntimeWorldTransform } from "./types";

function cloneTransform(transform: RuntimeWorldTransform): RuntimeWorldTransform {
  return {
    position: [...transform.position] as RuntimeWorldTransform["position"],
    rotation: [...transform.rotation] as RuntimeWorldTransform["rotation"],
    scale: [...transform.scale] as RuntimeWorldTransform["scale"]
  };
}

export class TransformBuffer {
  beginPreview(scene: RuntimeScene, objectId: string) {
    const object = scene.objectRegistry.get(objectId);
    if (!object || object.previewTransform) {
      return object ?? null;
    }

    object.previewTransform = cloneTransform(object.transform);
    scene.dirtyObjectIds.add(objectId);
    return object;
  }

  updatePreview(scene: RuntimeScene, objectId: string, transform: Partial<RuntimeWorldTransform>) {
    const object = scene.objectRegistry.get(objectId);
    if (!object) {
      return null;
    }

    const base = object.previewTransform ?? cloneTransform(object.transform);
    object.previewTransform = {
      position: transform.position ? [...transform.position] : base.position,
      rotation: transform.rotation ? [...transform.rotation] : base.rotation,
      scale: transform.scale ? [...transform.scale] : base.scale
    };
    scene.dirtyObjectIds.add(objectId);
    return object.previewTransform;
  }

  commitPreview(scene: RuntimeScene, objectId: string) {
    const object = scene.objectRegistry.get(objectId);
    if (!object || !object.previewTransform) {
      return null;
    }

    object.transform = cloneTransform(object.previewTransform);
    object.previewTransform = null;
    scene.dirtyObjectIds.add(objectId);
    return object.transform;
  }

  cancelPreview(scene: RuntimeScene, objectId: string) {
    const object = scene.objectRegistry.get(objectId);
    if (!object || !object.previewTransform) {
      return null;
    }

    object.previewTransform = null;
    scene.dirtyObjectIds.add(objectId);
    return object.transform;
  }

  read(scene: RuntimeScene, objectId: string): RuntimeObjectRecord | null {
    return scene.objectRegistry.get(objectId) ?? null;
  }
}
