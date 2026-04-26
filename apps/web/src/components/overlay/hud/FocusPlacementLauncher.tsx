"use client";

import { useMemo } from "react";
import type { RuntimeAsset } from "@deskterioronline/scene-schema";
import {
  resolveFocusPlacementEntry,
  type FocusPlacementSurfaceCandidate
} from "../../../lib/runtime/focus-placement-session";
import { useRuntimeEngine } from "../../../lib/runtime/runtime-engine-context";
import { formatAssetIdLabel } from "../../../lib/builder/catalog";
import { useAssetSelector, useSelectionSelector } from "../../../lib/stores/scene-slices";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useFocusPlacementStore } from "../../../lib/stores/useFocusPlacementStore";
import type { SceneAsset } from "../../../lib/stores/useSceneStore";

type PlacementLaunchOption = {
  supportAsset: SceneAsset;
  entry: ReturnType<typeof resolveFocusPlacementEntry>;
  candidate: FocusPlacementSurfaceCandidate;
};

function resolveRuntimeAssetForObject(
  engine: ReturnType<typeof useRuntimeEngine>,
  objectId: string
): RuntimeAsset | null {
  const runtimeObject = engine?.runtimeScene.objectRegistry.get(objectId);
  if (!runtimeObject) {
    return null;
  }

  const runtimeAssetId = runtimeObject.runtimeAssetId ?? runtimeObject.assetId;
  return engine?.runtimeScene.runtimeAssets.get(runtimeAssetId) ?? null;
}

function resolveAssetLabel(asset: SceneAsset) {
  return asset.product?.name ?? formatAssetIdLabel(asset.assetId);
}

export default function FocusPlacementLauncher() {
  const engine = useRuntimeEngine();
  const viewMode = useEditorStore((state) => state.viewMode);
  const readOnly = useEditorStore((state) => state.readOnly);
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const assets = useAssetSelector((slice) => slice.assets);
  const activeSession = useFocusPlacementStore((state) => state.activeSession);
  const pendingRequest = useFocusPlacementStore((state) => state.pendingRequest);
  const requestFocusPlacement = useFocusPlacementStore((state) => state.requestFocusPlacement);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  );
  const selectedRuntimeAsset = selectedAsset
    ? resolveRuntimeAssetForObject(engine, selectedAsset.id)
    : null;

  const launchOptions = useMemo(() => {
    if (!engine || !selectedAsset) {
      return [];
    }

    return assets.flatMap((supportAsset): PlacementLaunchOption[] => {
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
  }, [assets, engine, selectedAsset, selectedRuntimeAsset]);

  const unavailableReason = useMemo(() => {
    if (!engine || !selectedAsset || launchOptions.length > 0) {
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
  }, [assets, engine, launchOptions.length, selectedAsset, selectedRuntimeAsset]);

  if (viewMode !== "walk" || readOnly || !selectedAsset || activeSession || pendingRequest) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto absolute bottom-5 left-4 z-40 w-[min(360px,calc(100%-2rem))] rounded-[22px] border border-white/14 bg-black/58 px-4 py-3 text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      data-testid="focus-placement-launcher"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/50">정밀 배치</div>
          <div className="mt-1 truncate text-sm font-semibold text-white">{resolveAssetLabel(selectedAsset)}</div>
        </div>
        <div className="rounded-full border border-white/12 bg-white/8 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70">
          Walk
        </div>
      </div>

      {launchOptions.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {launchOptions.slice(0, 3).map(({ supportAsset, entry, candidate }) => (
            <button
              key={`${supportAsset.id}:${candidate.surfaceId}:${candidate.attachmentType}`}
              type="button"
              onClick={() =>
                requestFocusPlacement({
                  objectId: selectedAsset.id,
                  supportObjectId: supportAsset.id,
                  surfaceId: candidate.surfaceId,
                  attachmentType: candidate.attachmentType,
                  objectLabel: resolveAssetLabel(selectedAsset),
                  supportLabel: resolveAssetLabel(supportAsset),
                  surfaceLabel: candidate.surfaceLabel,
                  surfaceType: candidate.surfaceType,
                  surfaceBoundsMm: candidate.surfaceBoundsMm,
                  noPlaceZones: candidate.noPlaceZones,
                  preferredZones: candidate.preferredZones,
                  objectDimensionsMm: selectedAsset.product?.dimensionsMm ?? null,
                  surfaceCandidates: entry.candidates,
                  preferredCandidateIndex: entry.preferredCandidateIndex
                })
              }
              className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/22 bg-emerald-400/12 px-3 py-2 text-left transition hover:border-emerald-200/45 hover:bg-emerald-400/18"
              aria-label={`정밀 배치 시작: ${resolveAssetLabel(supportAsset)} ${candidate.surfaceLabel}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{resolveAssetLabel(supportAsset)}</span>
                <span className="mt-0.5 block text-xs text-emerald-100/72">
                  {candidate.surfaceLabel} · {candidate.attachmentType.replaceAll("_", " ")}
                </span>
              </span>
              <span className="shrink-0 rounded-full bg-emerald-300/18 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-100">
                시작
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-400/12 px-3 py-2 text-sm leading-6 text-amber-100">
          {unavailableReason}
        </div>
      )}
    </div>
  );
}
