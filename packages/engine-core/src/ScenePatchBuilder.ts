import { serializeWorldTransform, type PlacementRecord, type SceneDocumentV2 } from "@deskterioronline/scene-schema";
import type { RuntimeScene, SceneObjectPatch } from "./types";

function clonePlacement(placement: PlacementRecord): PlacementRecord {
  return JSON.parse(JSON.stringify(placement)) as PlacementRecord;
}

export class ScenePatchBuilder {
  buildObjectPatches(document: SceneDocumentV2, runtimeScene: RuntimeScene): SceneObjectPatch[] {
    return document.objects.flatMap((objectDocument) => {
      const runtimeObject = runtimeScene.objectRegistry.get(objectDocument.id);
      if (!runtimeObject) {
        return [];
      }

      const nextPlacement = clonePlacement(runtimeObject.placement);
      const previousPlacement = objectDocument.placement;
      if (JSON.stringify(previousPlacement) === JSON.stringify(nextPlacement)) {
        return [];
      }

      return [
        {
          objectId: objectDocument.id,
          previousPlacement,
          nextPlacement
        }
      ];
    });
  }

  apply(document: SceneDocumentV2, runtimeScene: RuntimeScene): SceneDocumentV2 {
    return {
      ...document,
      updatedAt: new Date().toISOString(),
      objects: document.objects.map((objectDocument) => {
        const runtimeObject = runtimeScene.objectRegistry.get(objectDocument.id);
        if (!runtimeObject) {
          return objectDocument;
        }

        return {
          ...objectDocument,
          placement: clonePlacement(runtimeObject.placement),
          ...(runtimeObject.objectDocument.runtimeAssetId
            ? { runtimeAssetId: runtimeObject.objectDocument.runtimeAssetId }
            : {})
        };
      })
    };
  }

  static fromRuntimeTransform(transform: RuntimeScene["objectRegistry"] extends Map<string, infer TValue>
    ? TValue extends { transform: infer TTransform }
      ? TTransform
      : never
    : never) {
    return serializeWorldTransform(transform);
  }
}
