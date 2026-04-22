import { serializeWorldTransform, type PlacementRecord } from "@deskterioronline/scene-schema";
import type { RuntimeScene, RuntimeWorldTransform } from "./types";
import { TransformBuffer } from "./TransformBuffer";

export type SceneCommand =
  | {
      type: "BEGIN_TRANSFORM_PREVIEW";
      objectId: string;
    }
  | {
      type: "UPDATE_TRANSFORM_PREVIEW";
      objectId: string;
      transform: Partial<RuntimeWorldTransform>;
    }
  | {
      type: "COMMIT_TRANSFORM_PREVIEW";
      objectId: string;
    }
  | {
      type: "CANCEL_TRANSFORM_PREVIEW";
      objectId: string;
    }
  | {
      type: "SET_OBJECT_PLACEMENT";
      objectId: string;
      placement: PlacementRecord;
      transform?: RuntimeWorldTransform;
    };

export class CommandBuffer {
  constructor(private readonly transforms = new TransformBuffer()) {}

  execute(scene: RuntimeScene, command: SceneCommand) {
    const runtimeObject = scene.objectRegistry.get(command.objectId);
    if (!runtimeObject) {
      return null;
    }

    switch (command.type) {
      case "BEGIN_TRANSFORM_PREVIEW":
        return this.transforms.beginPreview(scene, command.objectId);
      case "UPDATE_TRANSFORM_PREVIEW":
        return this.transforms.updatePreview(scene, command.objectId, command.transform);
      case "COMMIT_TRANSFORM_PREVIEW": {
        const committed = this.transforms.commitPreview(scene, command.objectId);
        if (!committed) {
          return null;
        }

        runtimeObject.placement = serializeWorldTransform(committed);
        return committed;
      }
      case "CANCEL_TRANSFORM_PREVIEW":
        return this.transforms.cancelPreview(scene, command.objectId);
      case "SET_OBJECT_PLACEMENT":
        runtimeObject.placement = command.placement;
        if (command.transform) {
          runtimeObject.transform = command.transform;
          runtimeObject.previewTransform = null;
        }
        runtimeObject.transformRevision += 1;
        scene.dirtyObjectIds.add(command.objectId);
        return runtimeObject;
      default:
        return null;
    }
  }
}
