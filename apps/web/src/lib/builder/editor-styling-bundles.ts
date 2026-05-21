import type { DerivedRoomShell } from "../domain/room-shell";
import { constrainPlacementToAnchor } from "../scene/anchors";
import type { SceneAsset } from "../stores/useSceneStore";
import type { LibraryCatalogItem } from "./catalog";
import {
  buildSeededSceneAssets,
  describeWorkspaceFlexClusterSelection,
  type WorkspaceFlexClusterSelectionPreview,
  WORKSPACE_FLEX_CLUSTER_PRESETS,
  type WorkspaceFlexClusterId
} from "./seeded-assets";

export const EDITOR_ROOM_STYLING_BUNDLES = WORKSPACE_FLEX_CLUSTER_PRESETS;
export type { WorkspaceFlexClusterId } from "./seeded-assets";

export type EditorRoomStylingBundleId = (typeof EDITOR_ROOM_STYLING_BUNDLES)[number]["id"];

export type EditorRoomStylingBundleResult = {
  nextAssets: SceneAsset[];
  addedAssets: SceneAsset[];
  skippedAssets: SceneAsset[];
  requestedAssets: SceneAsset[];
};

export type EditorRoomStylingBundlePreview = WorkspaceFlexClusterSelectionPreview;

export function describeEditorRoomStylingBundle({
  catalog,
  clusterIds
}: {
  catalog: LibraryCatalogItem[];
  clusterIds: readonly WorkspaceFlexClusterId[];
}): EditorRoomStylingBundlePreview {
  return describeWorkspaceFlexClusterSelection({ catalog, clusterIds });
}

function getSceneAssetDedupeKey(asset: SceneAsset) {
  return asset.catalogItemId ?? asset.assetId;
}

function groupExistingAssetsByKey(assets: SceneAsset[]) {
  return assets.reduce<Map<string, SceneAsset[]>>((groups, asset) => {
    const key = getSceneAssetDedupeKey(asset);
    const existing = groups.get(key) ?? [];
    existing.push(asset);
    groups.set(key, existing);
    return groups;
  }, new Map<string, SceneAsset[]>());
}

export function buildEditorRoomStylingBundleAssets({
  catalog,
  roomShell,
  existingAssets,
  clusterIds
}: {
  catalog: LibraryCatalogItem[];
  roomShell: DerivedRoomShell;
  existingAssets: SceneAsset[];
  clusterIds: readonly WorkspaceFlexClusterId[];
}): EditorRoomStylingBundleResult {
  const requestedAssets = buildSeededSceneAssets(catalog, roomShell, "full", "workspace-flex", {
    enabledWorkspaceFlexClusterIds: clusterIds
  });
  const existingByKey = groupExistingAssetsByKey(existingAssets);
  const requestedKeyCounts = new Map<string, number>();
  const seedIdToTargetId = new Map<string, string>();
  const nextAssets = [...existingAssets];
  const addedAssets: SceneAsset[] = [];
  const skippedAssets: SceneAsset[] = [];

  requestedAssets.forEach((asset) => {
    const key = getSceneAssetDedupeKey(asset);
    const nextRequestedCount = (requestedKeyCounts.get(key) ?? 0) + 1;
    requestedKeyCounts.set(key, nextRequestedCount);

    const matchingExistingAsset = existingByKey.get(key)?.[nextRequestedCount - 1] ?? null;
    if (matchingExistingAsset) {
      seedIdToTargetId.set(asset.id, matchingExistingAsset.id);
      skippedAssets.push(asset);
      return;
    }

    const supportAssetId = asset.supportAssetId ? seedIdToTargetId.get(asset.supportAssetId) ?? null : null;
    const anchoredPlacement = constrainPlacementToAnchor(
      {
        position: asset.position,
        rotation: asset.rotation,
        anchorType: asset.anchorType,
        supportAssetId
      },
      {
        walls: roomShell.walls,
        ceilings: roomShell.ceilings,
        scale: roomShell.scale,
        sceneAssets: nextAssets,
        activeAsset: {
          id: asset.id,
          assetId: asset.assetId,
          catalogItemId: asset.catalogItemId,
          product: asset.product,
          supportProfile: asset.supportProfile,
          scale: asset.scale
        }
      }
    );
    const nextAsset: SceneAsset = {
      ...asset,
      anchorType: anchoredPlacement.anchorType,
      supportAssetId: anchoredPlacement.supportAssetId,
      position: anchoredPlacement.position,
      rotation: anchoredPlacement.rotation
    };

    nextAssets.push(nextAsset);
    addedAssets.push(nextAsset);
    seedIdToTargetId.set(asset.id, nextAsset.id);
  });

  return {
    nextAssets,
    addedAssets,
    skippedAssets,
    requestedAssets
  };
}
