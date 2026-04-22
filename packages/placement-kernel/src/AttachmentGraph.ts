import type { RuntimeScene } from "@deskterioronline/engine-core";
import { isSurfacePlacementRecord } from "@deskterioronline/scene-schema";

export class AttachmentGraph {
  build(scene: RuntimeScene) {
    const graph = new Map<string, string[]>();

    for (const runtimeObject of scene.objectRegistry.values()) {
      if (!isSurfacePlacementRecord(runtimeObject.placement)) {
        continue;
      }

      const children = graph.get(runtimeObject.placement.supportObjectId) ?? [];
      children.push(runtimeObject.id);
      graph.set(runtimeObject.placement.supportObjectId, children);
    }

    return graph;
  }
}
