"use client";

import { useMemo } from "react";
import {
  buildFocusPlacementRequest,
  resolveFocusPlacementLaunchOptions,
  resolveFocusPlacementUnavailableReason,
  resolveRuntimeAssetForObject,
  resolveSceneAssetLabel
} from "../../../lib/runtime/focus-placement-launch";
import { useRuntimeEngine } from "../../../lib/runtime/runtime-engine-context";
import { useAssetSelector, useSelectionSelector } from "../../../lib/stores/scene-slices";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useFocusPlacementStore } from "../../../lib/stores/useFocusPlacementStore";
import { useWalkInventoryStore } from "../../../lib/stores/useWalkInventoryStore";

export default function FocusPlacementLauncher() {
  const engine = useRuntimeEngine();
  const viewMode = useEditorStore((state) => state.viewMode);
  const readOnly = useEditorStore((state) => state.readOnly);
  const selectedAssetId = useSelectionSelector((slice) => slice.selectedAssetId);
  const assets = useAssetSelector((slice) => slice.assets);
  const placementDraft = useWalkInventoryStore((state) => state.placementDraft);
  const activeSession = useFocusPlacementStore((state) => state.activeSession);
  const pendingRequest = useFocusPlacementStore((state) => state.pendingRequest);
  const requestFocusPlacement = useFocusPlacementStore((state) => state.requestFocusPlacement);

  const effectiveAssets = useMemo(() => {
    if (!placementDraft?.asset || assets.some((asset) => asset.id === placementDraft.objectId)) {
      return assets;
    }
    return [...assets, placementDraft.asset];
  }, [assets, placementDraft]);

  const selectedAsset = useMemo(
    () => effectiveAssets.find((asset) => asset.id === selectedAssetId) ?? null,
    [effectiveAssets, selectedAssetId]
  );
  const selectedRuntimeAsset = selectedAsset
    ? (resolveRuntimeAssetForObject(engine, selectedAsset.id) ??
      engine?.runtimeScene.runtimeAssets.get(selectedAsset.catalogItemId ?? selectedAsset.assetId) ??
      null)
    : null;

  const launchOptions = useMemo(() => {
    return resolveFocusPlacementLaunchOptions({
      engine,
      assets: effectiveAssets,
      selectedAsset,
      selectedRuntimeAsset
    });
  }, [effectiveAssets, engine, selectedAsset, selectedRuntimeAsset]);

  const unavailableReason = useMemo(
    () =>
      resolveFocusPlacementUnavailableReason({
        engine,
        assets: effectiveAssets,
        selectedAsset,
        selectedRuntimeAsset
      }),
    [effectiveAssets, engine, selectedAsset, selectedRuntimeAsset]
  );

  if (
    viewMode !== "walk" ||
    readOnly ||
    !selectedAsset ||
    activeSession ||
    pendingRequest
  ) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto absolute bottom-5 left-4 z-40 w-[min(360px,calc(100%-2rem))] rounded-[22px] border border-white/14 bg-black/58 px-4 py-3 text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      data-focus-placement-ui="true"
      data-testid="focus-placement-launcher"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/50">정밀 배치</div>
          <div className="mt-1 truncate text-sm font-semibold text-white">{resolveSceneAssetLabel(selectedAsset)}</div>
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
                requestFocusPlacement(
                  buildFocusPlacementRequest({
                    selectedAsset,
                    supportAsset,
                    entry,
                    candidate
                  })
                )
              }
              className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300/22 bg-emerald-400/12 px-3 py-2 text-left transition hover:border-emerald-200/45 hover:bg-emerald-400/18"
              aria-label={`정밀 배치 시작: ${resolveSceneAssetLabel(supportAsset)} ${candidate.surfaceLabel}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{resolveSceneAssetLabel(supportAsset)}</span>
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
