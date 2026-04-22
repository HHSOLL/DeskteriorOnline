"use client";

import type { Engine, RuntimeWorldTransform, SceneObjectPatch } from "@deskterioronline/engine-core";
import { useSceneStore, type SceneAsset } from "../stores/useSceneStore";

declare global {
  interface Window {
    __DESKTERIORONLINE_RUNTIME_ENGINE__?: Engine;
    __DESKTERIORONLINE_RUNTIME_DOCUMENT_ID__?: string;
    __DESKTERIORONLINE_RUNTIME_LAST_PATCHES__?: SceneObjectPatch[];
  }
}

export const PLAN2SPACE_RUNTIME_DOCUMENT_PATCH_EVENT = "deskterioronline:runtime-document-patch";

type SceneStoreLike = Pick<ReturnType<typeof useSceneStore.getState>, "assets" | "updateFurniture">;

type CommitRuntimeAssetUpdateParams = {
  objectId: string;
  updates: Partial<SceneAsset>;
  engine?: Engine | null;
  store?: SceneStoreLike;
};

function getBrowserRuntimeEngine() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.__DESKTERIORONLINE_RUNTIME_ENGINE__ ?? null;
}

function resolveRuntimeEngine(engine?: Engine | null) {
  return engine ?? getBrowserRuntimeEngine();
}

function publishRuntimeDocumentPatches(
  patches: SceneObjectPatch[],
  options: {
    objectId: string;
    engine: Engine;
  }
) {
  if (typeof window === "undefined") {
    return;
  }

  window.__DESKTERIORONLINE_RUNTIME_LAST_PATCHES__ = patches;
  window.dispatchEvent(
    new CustomEvent(PLAN2SPACE_RUNTIME_DOCUMENT_PATCH_EVENT, {
      detail: {
        documentId: window.__DESKTERIORONLINE_RUNTIME_DOCUMENT_ID__ ?? options.engine.runtimeScene.id,
        objectId: options.objectId,
        patchCount: patches.length,
        patches
      }
    })
  );
}

export function resolveRuntimeWorldTransformFromAsset(
  asset: SceneAsset,
  updates: Partial<SceneAsset> = {}
): RuntimeWorldTransform {
  return {
    position: updates.position ?? asset.position,
    rotation: updates.rotation ?? asset.rotation,
    scale: updates.scale ?? asset.scale
  };
}

export function beginRuntimeAssetPreview(objectId: string, engine?: Engine | null) {
  return resolveRuntimeEngine(engine)?.beginObjectPreview(objectId) ?? null;
}

export function previewRuntimeAssetTransform(
  objectId: string,
  transform: Partial<RuntimeWorldTransform>,
  engine?: Engine | null
) {
  return resolveRuntimeEngine(engine)?.previewObjectTransform(objectId, transform) ?? null;
}

export function previewRuntimeAssetFromSceneAsset(
  asset: SceneAsset,
  updates: Partial<SceneAsset>,
  engine?: Engine | null
) {
  return previewRuntimeAssetTransform(
    asset.id,
    resolveRuntimeWorldTransformFromAsset(asset, updates),
    engine
  );
}

export function cancelRuntimeAssetPreview(objectId: string, engine?: Engine | null) {
  return resolveRuntimeEngine(engine)?.cancelObjectPreview(objectId) ?? null;
}

export function commitRuntimeAssetUpdateToStore({
  objectId,
  updates,
  engine,
  store
}: CommitRuntimeAssetUpdateParams) {
  const sceneStore = store ?? useSceneStore.getState();
  const asset = sceneStore.assets.find((candidate) => candidate.id === objectId);
  if (!asset) {
    return [];
  }

  const runtimeEngine = resolveRuntimeEngine(engine);
  let patches: SceneObjectPatch[] = [];

  if (runtimeEngine) {
    runtimeEngine.beginObjectPreview(objectId);
    runtimeEngine.previewObjectTransform(
      objectId,
      resolveRuntimeWorldTransformFromAsset(asset, updates)
    );
    runtimeEngine.commitObjectPreview(objectId);
    patches = runtimeEngine.buildDocumentPatch();
    publishRuntimeDocumentPatches(patches, {
      objectId,
      engine: runtimeEngine
    });
  }

  sceneStore.updateFurniture(objectId, updates);
  return patches;
}
