import type { AssetHandle, ObjectHandle } from "./types";

export class AssetInstanceManager {
  private readonly byObjectId = new Map<string, ObjectHandle>();

  create(assetHandle: AssetHandle, objectId: string): ObjectHandle {
    const handle = {
      objectId,
      assetHandle,
      visible: true,
      materialId: null,
      matrix: null,
      version: 0,
      batchKey: null,
      sceneGeneration: -1,
      transformRevision: -1
    };
    this.byObjectId.set(objectId, handle);
    return handle;
  }

  get(objectId: string) {
    return this.byObjectId.get(objectId) ?? null;
  }

  delete(objectId: string) {
    this.byObjectId.delete(objectId);
  }

  values() {
    return Array.from(this.byObjectId.values());
  }

  size() {
    return this.byObjectId.size;
  }
}
