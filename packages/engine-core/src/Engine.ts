import type { PlacementRecord, RuntimeAsset, SceneDocumentV2 } from "@deskterioronline/scene-schema";
import { CommandBuffer, type SceneCommand } from "./CommandBuffer";
import { History } from "./History";
import { SceneCompiler } from "./SceneCompiler";
import { ScenePatchBuilder } from "./ScenePatchBuilder";
import { TransformBuffer } from "./TransformBuffer";
import type { RuntimeObjectRecord, RuntimeScene, RuntimeWorldTransform, SceneObjectPatch } from "./types";

function serializeComparable(value: unknown) {
  return JSON.stringify(value);
}

function cloneRuntimeTransform(transform: RuntimeWorldTransform): RuntimeWorldTransform {
  return {
    position: [...transform.position] as RuntimeWorldTransform["position"],
    rotation: [...transform.rotation] as RuntimeWorldTransform["rotation"],
    scale: [...transform.scale] as RuntimeWorldTransform["scale"]
  };
}

function hasObjectShapeChanged(previous: RuntimeObjectRecord, next: RuntimeObjectRecord) {
  return (
    previous.assetId !== next.assetId ||
    previous.runtimeAssetId !== next.runtimeAssetId ||
    previous.materialId !== next.materialId ||
    serializeComparable(previous.placement) !== serializeComparable(next.placement) ||
    serializeComparable(previous.transform) !== serializeComparable(next.transform)
  );
}

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

  syncDocument(document: SceneDocumentV2, runtimeAssets: Iterable<RuntimeAsset> = []) {
    const nextRuntimeAssets = this.compiler.createRuntimeAssetMap(runtimeAssets);
    const nextRegistry = new Map<string, RuntimeObjectRecord>();
    const currentRegistry = this.runtimeScene.objectRegistry;
    const nextIds = new Set(document.objects.map((objectDocument) => objectDocument.id));
    let generationChanged = false;

    currentRegistry.forEach((runtimeObject, objectId) => {
      if (nextIds.has(objectId)) {
        return;
      }
      this.runtimeScene.dirtyObjectIds.delete(objectId);
      generationChanged = true;
    });

    for (const objectDocument of document.objects) {
      const compiled = this.compiler.createObjectRecord(
        document,
        objectDocument,
        nextRegistry,
        nextRuntimeAssets
      );
      const previous = currentRegistry.get(objectDocument.id);
      if (!previous) {
        nextRegistry.set(objectDocument.id, compiled);
        this.runtimeScene.dirtyObjectIds.add(objectDocument.id);
        generationChanged = true;
        continue;
      }

      const changed = hasObjectShapeChanged(previous, compiled);
      const nextObject: RuntimeObjectRecord = {
        ...previous,
        assetId: compiled.assetId,
        runtimeAssetId: compiled.runtimeAssetId,
        materialId: compiled.materialId,
        objectDocument,
        placement: compiled.placement,
        transform: changed ? cloneRuntimeTransform(compiled.transform) : previous.transform,
        previewTransform: null,
        transformRevision: changed ? previous.transformRevision + 1 : previous.transformRevision
      };
      if (changed) {
        this.runtimeScene.dirtyObjectIds.add(objectDocument.id);
      }
      nextRegistry.set(objectDocument.id, nextObject);
    }

    this.runtimeScene.sourceDocument = document;
    this.runtimeScene.room = document.room;
    this.runtimeScene.runtimeAssets = nextRuntimeAssets;
    this.runtimeScene.objectRegistry = nextRegistry;
    if (
      this.runtimeScene.selectionState.selectedObjectId &&
      !nextIds.has(this.runtimeScene.selectionState.selectedObjectId)
    ) {
      this.runtimeScene.selectionState.selectedObjectId = null;
    }
    if (
      this.runtimeScene.hoverState.hoveredObjectId &&
      !nextIds.has(this.runtimeScene.hoverState.hoveredObjectId)
    ) {
      this.runtimeScene.hoverState.hoveredObjectId = null;
    }
    if (generationChanged) {
      this.runtimeScene.generation += 1;
    }
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
