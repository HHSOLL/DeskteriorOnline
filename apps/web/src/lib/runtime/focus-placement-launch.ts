import type { Engine } from "@deskterioronline/engine-core";
import type { RuntimeAsset } from "@deskterioronline/scene-schema";
import { formatAssetIdLabel } from "../builder/catalog";
import type { SceneAsset } from "../stores/useSceneStore";
import {
  resolveFocusPlacementEntry,
  type FocusPlacementSurfaceCandidate,
  type FocusPlacementEntry
} from "./focus-placement-session";
import type { FocusPlacementRequest } from "../stores/useFocusPlacementStore";

export type FocusPlacementLaunchOption = {
  supportAsset: SceneAsset;
  entry: FocusPlacementEntry;
  candidate: FocusPlacementSurfaceCandidate;
};

export function resolveRuntimeAssetForObject(
  engine: Engine | null,
  objectId: string
): RuntimeAsset | null {
  const runtimeObject = engine?.runtimeScene.objectRegistry.get(objectId);
  if (!runtimeObject) {
    return null;
  }

  const runtimeAssetId = runtimeObject.runtimeAssetId ?? runtimeObject.assetId;
  return engine?.runtimeScene.runtimeAssets.get(runtimeAssetId) ?? null;
}

export function resolveSceneAssetLabel(asset: SceneAsset) {
  return asset.product?.name ?? formatAssetIdLabel(asset.assetId);
}

export function resolveFocusPlacementLaunchOptions(input: {
  engine: Engine | null;
  assets: SceneAsset[];
  selectedAsset: SceneAsset | null;
  selectedRuntimeAsset: RuntimeAsset | null;
}): FocusPlacementLaunchOption[] {
  const { engine, assets, selectedAsset, selectedRuntimeAsset } = input;
  if (!engine || !selectedAsset) {
    return [];
  }

  return assets.flatMap((supportAsset): FocusPlacementLaunchOption[] => {
    if (supportAsset.id === selectedAsset.id) {
      return [];
    }

    const supportRuntimeAsset = resolveRuntimeAssetForObject(engine, supportAsset.id);
    const supportSurfaces = supportRuntimeAsset?.supportSurfaces ?? [];
    if (supportSurfaces.length === 0) {
      return [];
    }

    const entry = resolveFocusPlacementEntry({
      selectedAsset,
      selectedRuntimeAsset,
      supportAsset,
      supportSurfaces
    });
    const candidate = entry.candidates[entry.preferredCandidateIndex] ?? null;

    if (!candidate || !entry.availability.enabled || !candidate.enabled) {
      return [];
    }

    return [
      {
        supportAsset,
        entry,
        candidate
      }
    ];
  });
}

export function resolveFocusPlacementUnavailableReason(input: {
  engine: Engine | null;
  assets: SceneAsset[];
  selectedAsset: SceneAsset | null;
  selectedRuntimeAsset: RuntimeAsset | null;
}) {
  const { engine, assets, selectedAsset, selectedRuntimeAsset } = input;
  if (!engine || !selectedAsset) {
    return null;
  }

  for (const supportAsset of assets) {
    if (supportAsset.id === selectedAsset.id) continue;
    const supportRuntimeAsset = resolveRuntimeAssetForObject(engine, supportAsset.id);
    const supportSurfaces = supportRuntimeAsset?.supportSurfaces ?? [];
    if (supportSurfaces.length === 0) continue;
    const entry = resolveFocusPlacementEntry({
      selectedAsset,
      selectedRuntimeAsset,
      supportAsset,
      supportSurfaces
    });
    const reason = entry.candidates.find((candidate) => candidate.reason)?.reason;
    if (reason) {
      return reason;
    }
  }

  return "호환되는 표면을 가진 제품이 없습니다";
}

export function buildFocusPlacementRequest(input: {
  selectedAsset: SceneAsset;
  supportAsset: SceneAsset;
  entry: FocusPlacementEntry;
  candidate: FocusPlacementSurfaceCandidate;
}): FocusPlacementRequest {
  const { selectedAsset, supportAsset, entry, candidate } = input;

  return {
    objectId: selectedAsset.id,
    supportObjectId: supportAsset.id,
    surfaceId: candidate.surfaceId,
    attachmentType: candidate.attachmentType,
    objectLabel: resolveSceneAssetLabel(selectedAsset),
    supportLabel: resolveSceneAssetLabel(supportAsset),
    surfaceLabel: candidate.surfaceLabel,
    surfaceType: candidate.surfaceType,
    surfaceBoundsMm: candidate.surfaceBoundsMm,
    noPlaceZones: candidate.noPlaceZones,
    preferredZones: candidate.preferredZones,
    objectDimensionsMm: selectedAsset.product?.dimensionsMm ?? null,
    surfaceCandidates: entry.candidates,
    preferredCandidateIndex: entry.preferredCandidateIndex
  };
}
