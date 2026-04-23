import type { ProductLodProfileMetadata } from "../builder/catalog";
import type { EditorTopMode, EditorViewMode } from "../stores/useEditorStore";
import type { SceneAsset } from "../stores/useSceneStore";

export type AssetLodComplexity = "low" | "medium" | "high";
export type AssetLodStreamingPriority = "deferred" | "visible" | "focus";

export type AssetLodPlan = {
  complexity: AssetLodComplexity;
  useProxyBox: boolean;
  lowDetailDistance: number | null;
  streamingPriority: AssetLodStreamingPriority;
};

type AssetLodPlanInput = {
  asset: Pick<SceneAsset, "product">;
  viewMode: EditorViewMode;
  topMode: EditorTopMode;
  priority?: "default" | "focus";
};

function clampDistance(value: number) {
  return Math.max(3.5, Math.min(16, value));
}

export function resolveAssetLodComplexity(
  profile: ProductLodProfileMetadata | null | undefined
): AssetLodComplexity {
  if (!profile) {
    return "medium";
  }

  if (profile.maxDrawCalls <= 3 && profile.maxTriangleCount <= 600) {
    return "low";
  }

  if (profile.maxDrawCalls <= 6 && profile.maxTriangleCount <= 3000) {
    return "medium";
  }

  return "high";
}

function resolveBaseDistance(
  complexity: AssetLodComplexity,
  viewMode: EditorViewMode,
  topMode: EditorTopMode
) {
  if (viewMode === "top") {
    if (topMode === "desk-precision") {
      switch (complexity) {
        case "low":
          return null;
        case "medium":
          return 10.5;
        case "high":
          return 8.5;
      }
    }

    switch (complexity) {
      case "low":
        return null;
      case "medium":
        return 6.25;
      case "high":
        return 4.75;
    }
  }

  if (viewMode === "builder-preview") {
    switch (complexity) {
      case "low":
        return null;
      case "medium":
        return 9.25;
      case "high":
        return 7.5;
    }
  }

  switch (complexity) {
    case "low":
      return null;
    case "medium":
      return 11.5;
    case "high":
      return 9.5;
  }
}

function resolveStreamingPriority(
  viewMode: EditorViewMode,
  topMode: EditorTopMode,
  priority: "default" | "focus"
): AssetLodStreamingPriority {
  if (priority === "focus") {
    return "focus";
  }

  if (viewMode === "walk" || viewMode === "builder-preview") {
    return "visible";
  }

  return topMode === "desk-precision" ? "visible" : "deferred";
}

export function resolveAssetLodPlan({
  asset,
  viewMode,
  topMode,
  priority = "default"
}: AssetLodPlanInput): AssetLodPlan {
  const profile = asset.product?.lodProfile ?? null;
  const complexity = resolveAssetLodComplexity(profile);
  const baseDistance = resolveBaseDistance(complexity, viewMode, topMode);
  const streamingPriority = resolveStreamingPriority(viewMode, topMode, priority);

  if (priority === "focus") {
    return {
      complexity,
      useProxyBox: false,
      lowDetailDistance: null,
      streamingPriority
    };
  }

  if (baseDistance === null) {
    return {
      complexity,
      useProxyBox: false,
      lowDetailDistance: null,
      streamingPriority
    };
  }

  const distanceBonus =
    profile?.strategy === "manual_lod" && profile.levelCount > 1 ? 2 : 0;

  return {
    complexity,
    useProxyBox: true,
    lowDetailDistance: clampDistance(baseDistance + distanceBonus),
    streamingPriority
  };
}
