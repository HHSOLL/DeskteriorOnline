import type { RuntimeScene } from "@deskterioronline/engine-core";
import { isSurfacePlacementRecord } from "@deskterioronline/scene-schema";

export type AttachmentGraphSnapshot = {
  childrenBySupportObjectId: Map<string, string[]>;
  parentByObjectId: Map<string, string>;
};

export class AttachmentGraph {
  build(scene: RuntimeScene): AttachmentGraphSnapshot {
    const childrenBySupportObjectId = new Map<string, string[]>();
    const parentByObjectId = new Map<string, string>();

    for (const runtimeObject of scene.objectRegistry.values()) {
      if (!isSurfacePlacementRecord(runtimeObject.placement)) {
        continue;
      }

      const children = childrenBySupportObjectId.get(runtimeObject.placement.supportObjectId) ?? [];
      children.push(runtimeObject.id);
      childrenBySupportObjectId.set(runtimeObject.placement.supportObjectId, children);
      parentByObjectId.set(runtimeObject.id, runtimeObject.placement.supportObjectId);
    }

    return {
      childrenBySupportObjectId,
      parentByObjectId
    };
  }

  getChildren(snapshot: AttachmentGraphSnapshot, supportObjectId: string) {
    return snapshot.childrenBySupportObjectId.get(supportObjectId) ?? [];
  }

  getParent(snapshot: AttachmentGraphSnapshot, objectId: string) {
    return snapshot.parentByObjectId.get(objectId) ?? null;
  }

  getSiblings(
    snapshot: AttachmentGraphSnapshot,
    supportObjectId: string,
    objectId: string
  ) {
    return this.getChildren(snapshot, supportObjectId).filter((candidateId) => candidateId !== objectId);
  }
}
