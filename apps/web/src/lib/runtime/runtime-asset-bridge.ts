"use client";

import type { Engine, RuntimeWorldTransform, SceneObjectPatch } from "@deskterioronline/engine-core";
import {
  clonePlacementRecord,
  isSurfacePlacementRecord,
  type PlacementRecord
} from "@deskterioronline/scene-schema";
import { useSceneStore, type SceneAsset } from "../stores/useSceneStore";
import type { SceneAnchorType } from "../scene/anchor-types";

declare global {
  interface Window {
    __DESKTERIORONLINE_RUNTIME_ENGINE__?: Engine;
    __DESKTERIORONLINE_RUNTIME_DOCUMENT_ID__?: string;
    __DESKTERIORONLINE_RUNTIME_LAST_PATCHES__?: SceneObjectPatch[];
  }
}

export const PLAN2SPACE_RUNTIME_DOCUMENT_PATCH_EVENT = "deskterioronline:runtime-document-patch";

type SceneStoreLike = Pick<ReturnType<typeof useSceneStore.getState>, "assets" | "updateFurniture">;
type SceneStoreWithAdd = SceneStoreLike & Pick<ReturnType<typeof useSceneStore.getState>, "addFurniture">;

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

function resolveAnchorTypeFromRuntimePlacement(
  engine: Engine,
  asset: SceneAsset,
  placement: NonNullable<SceneAsset["placement"]>
): SceneAnchorType {
  if (!isSurfacePlacementRecord(placement)) {
    return asset.anchorType ?? "floor";
  }

  const supportObject = engine.runtimeScene.objectRegistry.get(placement.supportObjectId);
  const runtimeAssetId =
    supportObject?.runtimeAssetId ??
    supportObject?.objectDocument.runtimeAssetId ??
    supportObject?.objectDocument.catalogItemId ??
    supportObject?.assetId ??
    null;
  const supportSurface = runtimeAssetId
    ? engine.runtimeScene.runtimeAssets
        .get(runtimeAssetId)
        ?.supportSurfaces.find((surface) => surface.id === placement.surfaceId) ?? null
    : null;

  switch (supportSurface?.type) {
    case "desktop_top":
      return "desk_surface";
    case "shelf_top":
      return "shelf_surface";
    case "wall":
    case "pegboard":
      return "wall";
    case "floor":
      return "floor";
    default:
      return asset.anchorType ?? "furniture_surface";
  }
}

function buildRuntimeStoreUpdate(
  engine: Engine,
  asset: SceneAsset,
  objectId: string
): Partial<SceneAsset> | null {
  const runtimeObject = engine.runtimeScene.objectRegistry.get(objectId);
  if (!runtimeObject) {
    return null;
  }

  const transform = runtimeObject.previewTransform ?? runtimeObject.transform;
  const placement = clonePlacementRecord(runtimeObject.placement);

  return {
    position: [...transform.position] as SceneAsset["position"],
    rotation: [...transform.rotation] as SceneAsset["rotation"],
    scale: [...transform.scale] as SceneAsset["scale"],
    placement,
    anchorType: resolveAnchorTypeFromRuntimePlacement(engine, asset, placement),
    supportAssetId: isSurfacePlacementRecord(placement)
      ? placement.supportObjectId
      : asset.supportAssetId ?? null
  };
}

export function resolveRuntimeStoreUpdateFromObject({
  objectId,
  asset,
  engine
}: {
  objectId: string;
  asset: SceneAsset;
  engine?: Engine | null;
}) {
  const runtimeEngine = resolveRuntimeEngine(engine);
  if (!runtimeEngine) {
    return null;
  }
  return buildRuntimeStoreUpdate(runtimeEngine, asset, objectId);
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

    const runtimeStoreUpdate = buildRuntimeStoreUpdate(runtimeEngine, asset, objectId);
    sceneStore.updateFurniture(objectId, runtimeStoreUpdate ? { ...updates, ...runtimeStoreUpdate } : updates);
    return patches;
  }

  sceneStore.updateFurniture(objectId, updates);
  return patches;
}

export function commitRuntimePlacementToStore({
  objectId,
  engine,
  store
}: {
  objectId: string;
  engine?: Engine | null;
  store?: SceneStoreLike;
}) {
  const sceneStore = store ?? useSceneStore.getState();
  const asset = sceneStore.assets.find((candidate) => candidate.id === objectId);
  if (!asset) {
    return [];
  }

  const runtimeEngine = resolveRuntimeEngine(engine);
  if (!runtimeEngine) {
    return [];
  }

  const runtimeStoreUpdate = buildRuntimeStoreUpdate(runtimeEngine, asset, objectId);
  if (!runtimeStoreUpdate) {
    return [];
  }

  const patches = runtimeEngine.buildDocumentPatch();
  publishRuntimeDocumentPatches(patches, {
    objectId,
    engine: runtimeEngine
  });
  sceneStore.updateFurniture(objectId, runtimeStoreUpdate);
  return patches;
}

export function commitRuntimePlacementDraftToStore({
  asset,
  engine,
  store,
  commitPreview = false,
  placement
}: {
  asset: SceneAsset;
  engine?: Engine | null;
  store?: SceneStoreWithAdd;
  commitPreview?: boolean;
  placement?: PlacementRecord | null;
}) {
  const sceneStore = store ?? useSceneStore.getState();
  const runtimeEngine = resolveRuntimeEngine(engine);
  if (!runtimeEngine) {
    sceneStore.addFurniture(asset);
    return [];
  }

  if (commitPreview) {
    runtimeEngine.commitObjectPreview(asset.id);
  }

  const committedPlacement = placement ? clonePlacementRecord(placement) : null;
  const runtimeStoreUpdate = buildRuntimeStoreUpdate(runtimeEngine, asset, asset.id);
  const placementUpdate = committedPlacement
    ? {
        placement: committedPlacement,
        anchorType: resolveAnchorTypeFromRuntimePlacement(runtimeEngine, asset, committedPlacement),
        supportAssetId: isSurfacePlacementRecord(committedPlacement)
          ? committedPlacement.supportObjectId
          : asset.supportAssetId ?? null
      }
    : null;
  const patches = runtimeEngine.buildDocumentPatch();
  publishRuntimeDocumentPatches(patches, {
    objectId: asset.id,
    engine: runtimeEngine
  });
  sceneStore.addFurniture(
    runtimeStoreUpdate || placementUpdate
      ? { ...asset, ...runtimeStoreUpdate, ...placementUpdate }
      : asset
  );
  return patches;
}
