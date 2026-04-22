import type { AssetHandle, ObjectHandle } from "./types";

export class AssetInstanceManager {
  private readonly byObjectId = new Map<string, ObjectHandle>();

  create(assetHandle: AssetHandle, objectId: string): ObjectHandle {
    const handle = {
      objectId,
      assetHandle,
      visible: true
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
}
