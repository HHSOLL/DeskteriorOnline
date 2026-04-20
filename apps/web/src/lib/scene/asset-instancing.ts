import { resolveAssetLodComplexity } from "./asset-lod";
import type { EditorTopMode, EditorViewMode } from "../stores/useEditorStore";
import type { SceneAsset } from "../stores/useSceneStore";

export type AssetInstancingPlan = {
  eligible: boolean;
  clusterKey: string | null;
};

type AssetInstancingInput = {
  asset: Pick<SceneAsset, "assetId" | "product">;
  viewMode: EditorViewMode;
  topMode: EditorTopMode;
  readOnly: boolean;
  enableDynamicLight: boolean;
  isSelected: boolean;
  allowSelectedInstancing?: boolean;
};

export type AssetInstancingCluster = {
  key: string;
  assets: SceneAsset[];
};

function resolveFinishClusterKey(asset: Pick<SceneAsset, "product">) {
  return [
    asset.product?.finishColor ?? "",
    asset.product?.finishMaterial ?? "",
    asset.product?.detailNotes ?? ""
  ].join("|");
}

export function resolveAssetInstancingPlan({
  asset,
  viewMode,
  topMode,
  readOnly,
  enableDynamicLight,
  isSelected,
  allowSelectedInstancing = false
}: AssetInstancingInput): AssetInstancingPlan {
  if ((isSelected && !allowSelectedInstancing) || enableDynamicLight) {
    return { eligible: false, clusterKey: null };
  }

  const allowMode =
    viewMode === "builder-preview" ||
    (viewMode === "walk" && readOnly) ||
    (viewMode === "top" && (readOnly || topMode === "desk-precision" || topMode === "room"));
  if (!allowMode) {
    return { eligible: false, clusterKey: null };
  }

  const lodProfile = asset.product?.lodProfile ?? null;
  if (!lodProfile || lodProfile.strategy !== "single_mesh") {
    return { eligible: false, clusterKey: null };
  }

  const complexity = resolveAssetLodComplexity(lodProfile);
  if (complexity === "high") {
    return { eligible: false, clusterKey: null };
  }

  return {
    eligible: true,
    clusterKey: `${asset.assetId}::${resolveFinishClusterKey(asset)}`
  };
}

type GroupAssetsForInstancingInput = {
  assets: SceneAsset[];
  viewMode: EditorViewMode;
  topMode: EditorTopMode;
  readOnly: boolean;
  isTransforming: boolean;
  selectedAssetId: string | null;
  emitterAssetIds: Set<string>;
};

export function groupAssetsForInstancing({
  assets,
  viewMode,
  topMode,
  readOnly,
  isTransforming,
  selectedAssetId,
  emitterAssetIds
}: GroupAssetsForInstancingInput): AssetInstancingCluster[] {
  const byKey = new Map<string, SceneAsset[]>();

  for (const asset of assets) {
    if (asset.assetId.startsWith("placeholder:")) {
      continue;
    }

    const plan = resolveAssetInstancingPlan({
      asset,
      viewMode,
      topMode,
      readOnly,
      enableDynamicLight: emitterAssetIds.has(asset.id),
      isSelected: asset.id === selectedAssetId,
      allowSelectedInstancing:
        isTransforming &&
        !readOnly &&
        viewMode === "top" &&
        topMode === "room" &&
        asset.id === selectedAssetId
    });
    if (!plan.eligible || !plan.clusterKey) {
      continue;
    }

    const existing = byKey.get(plan.clusterKey) ?? [];
    existing.push(asset);
    byKey.set(plan.clusterKey, existing);
  }

  return Array.from(byKey.entries())
    .filter(([, groupedAssets]) => groupedAssets.length > 1)
    .map(([key, groupedAssets]) => ({
      key,
      assets: groupedAssets
    }));
}
