import type { PlacementRecord, RuntimeAsset, SceneDocumentV2 } from "@deskterioronline/scene-schema";
import { CommandBuffer, type SceneCommand } from "./CommandBuffer";
import { History } from "./History";
import { SceneCompiler } from "./SceneCompiler";
import { ScenePatchBuilder } from "./ScenePatchBuilder";
import { TransformBuffer } from "./TransformBuffer";
import type { RuntimeScene, RuntimeWorldTransform, SceneObjectPatch } from "./types";

export class Engine {
  readonly history = new History();
  readonly commands = new CommandBuffer();
  readonly transforms = new TransformBuffer();
  readonly compiler = new SceneCompiler();
  readonly patchBuilder = new ScenePatchBuilder();

  runtimeScene: RuntimeScene;

  constructor(document: SceneDocumentV2, runtimeAssets: Iterable<RuntimeAsset> = []) {
    this.runtimeScene = this.compiler.compile(document, runtimeAssets);
  }

  replaceDocument(document: SceneDocumentV2, runtimeAssets: Iterable<RuntimeAsset> = []) {
    this.runtimeScene = this.compiler.compile(document, runtimeAssets);
    return this.runtimeScene;
  }

  execute(command: SceneCommand) {
    const result = this.commands.execute(this.runtimeScene, command);
    if (result) {
      this.history.push(command);
    }
    return result;
  }

  beginObjectPreview(objectId: string) {
    return this.commands.execute(this.runtimeScene, {
      type: "BEGIN_TRANSFORM_PREVIEW",
      objectId
    });
  }

  previewObjectTransform(objectId: string, transform: Partial<RuntimeWorldTransform>) {
    this.beginObjectPreview(objectId);
    return this.commands.execute(this.runtimeScene, {
      type: "UPDATE_TRANSFORM_PREVIEW",
      objectId,
      transform
    });
  }

  cancelObjectPreview(objectId: string) {
    return this.commands.execute(this.runtimeScene, {
      type: "CANCEL_TRANSFORM_PREVIEW",
      objectId
    });
  }

  commitObjectPreview(objectId: string) {
    return this.commands.execute(this.runtimeScene, {
      type: "COMMIT_TRANSFORM_PREVIEW",
      objectId
    });
  }

  setObjectPlacement(objectId: string, placement: PlacementRecord, transform?: RuntimeWorldTransform) {
    return this.commands.execute(this.runtimeScene, {
      type: "SET_OBJECT_PLACEMENT",
      objectId,
      placement,
      transform
    });
  }

  buildDocumentPatch(): SceneObjectPatch[] {
    return this.patchBuilder.buildObjectPatches(this.runtimeScene.sourceDocument, this.runtimeScene);
  }

  exportDocument(): SceneDocumentV2 {
    return this.patchBuilder.apply(this.runtimeScene.sourceDocument, this.runtimeScene);
  }
}

export function createEngine(document: SceneDocumentV2, runtimeAssets: Iterable<RuntimeAsset> = []) {
  return new Engine(document, runtimeAssets);
}
