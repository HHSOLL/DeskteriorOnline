"use client";

import { SlidersHorizontal, Trash2 } from "lucide-react";
import type { LibraryCatalogItem } from "../../lib/builder/catalog";
import {
  degreesToRadians,
  metersToMillimeters,
  millimetersToMeters,
  radiansToDegrees
} from "../../lib/domain/scene-placement";
import { SCENE_ANCHOR_TYPES, type SceneAnchorType } from "../../lib/scene/anchor-types";
import { isSupportAnchorType } from "../../lib/scene/support-profiles";
import {
  PrecisionSurfaceMicroView,
  type PrecisionSurfaceLockInfo
} from "./PrecisionSurfaceMicroView";
import { PrecisionSurfaceProjectionView } from "./PrecisionSurfaceProjectionView";
import { builderCeilingFinishes, builderFloorFinishes, builderWallFinishes } from "../../lib/builder/templates";
import {
  CEILING_TEXTURE_PRESETS,
  FLOOR_TEXTURE_PRESETS,
  WALL_TEXTURE_PRESETS
} from "../../lib/textures/room-shell-textures";
import {
  LIGHTING_PRESETS,
  inferLightingPresetId,
  type LightingPresetId
} from "../../lib/scene/lighting-presets";
import type {
  EditorTopMode,
  TransformMode,
  TransformSpace
} from "../../lib/stores/useEditorStore";
import type { LightingSettings, SceneAsset } from "../../lib/stores/useSceneStore";

type BuilderInspectorPanelProps = {
  visible: boolean;
  layout?: "overlay" | "inline";
  className?: string;
  topMode: EditorTopMode;
  transformMode: TransformMode;
  transformSpace: TransformSpace;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  ceilingMaterialIndex: number;
  lighting: LightingSettings;
  wallsCount: number;
  floorsCount: number;
  assetsCount: number;
  selectedAsset: SceneAsset | null;
  selectedAssetMeta: LibraryCatalogItem | null;
  surfaceLockInfo: PrecisionSurfaceLockInfo | null;
  onTransformModeChange: (mode: TransformMode) => void;
  onTransformSpaceChange: (space: TransformSpace) => void;
  onWallMaterialChange: (index: number) => void;
  onFloorMaterialChange: (index: number) => void;
  onCeilingMaterialChange: (index: number) => void;
  onLightingChange: (lighting: Partial<LightingSettings>) => void;
  onLightingCommit: () => void;
  onApplyLightingPreset: (presetId: LightingPresetId) => void;
  onUpdateAsset: (id: string, updates: Partial<SceneAsset>) => void;
  onRemoveAsset: (id: string) => void;
  formatAssetLabel: (assetId: string) => string;
};

function formatDimensionsMm(
  dimensions: { width: number; depth: number; height: number } | null | undefined
) {
  if (!dimensions) return null;
  return `W ${dimensions.width} / D ${dimensions.depth} / H ${dimensions.height} mm`;
}

function toRoundedDegree(value: number) {
  return Math.round(radiansToDegrees(value) * 10) / 10;
}

function materialPreviewStyle(preset: { previewThumbnail?: string; topColor: string }) {
  return {
    backgroundColor: preset.topColor,
    backgroundImage: preset.previewThumbnail ? `url(${preset.previewThumbnail})` : undefined
  };
}

export function BuilderInspectorPanel({
  visible,
  layout = "overlay",
  className,
  topMode,
  transformMode,
  transformSpace,
  wallMaterialIndex,
  floorMaterialIndex,
  ceilingMaterialIndex,
  lighting,
  wallsCount,
  floorsCount,
  assetsCount,
  selectedAsset,
  selectedAssetMeta,
  surfaceLockInfo,
  onTransformModeChange,
  onTransformSpaceChange,
  onWallMaterialChange,
  onFloorMaterialChange,
  onCeilingMaterialChange,
  onLightingChange,
  onLightingCommit,
  onApplyLightingPreset,
  onUpdateAsset,
  onRemoveAsset,
  formatAssetLabel
}: BuilderInspectorPanelProps) {
  const anchorLabel: Record<SceneAnchorType, string> = {
    floor: "바닥",
    wall: "벽",
    ceiling: "천장",
    furniture_surface: "가구 표면",
    desk_surface: "데스크 표면",
    shelf_surface: "선반 표면"
  };
  const isYManagedByAnchor =
    selectedAsset?.anchorType === "floor" ||
    selectedAsset?.anchorType === "ceiling" ||
    selectedAsset?.anchorType === "desk_surface" ||
    selectedAsset?.anchorType === "furniture_surface" ||
    selectedAsset?.anchorType === "shelf_surface";
  const isRotationManagedByAnchor = selectedAsset?.anchorType === "wall";
  const productDimensions = selectedAsset?.product?.dimensionsMm ?? selectedAssetMeta?.dimensionsMm ?? null;
  const productFinishColor = selectedAsset?.product?.finishColor ?? selectedAssetMeta?.finishColor ?? null;
  const productFinishMaterial = selectedAsset?.product?.finishMaterial ?? selectedAssetMeta?.finishMaterial ?? null;
  const productDetailNotes = selectedAsset?.product?.detailNotes ?? selectedAssetMeta?.detailNotes ?? null;
  const scaleLocked =
    selectedAsset?.product?.scaleLocked ?? selectedAssetMeta?.scaleLocked ?? false;
  const dimensionsLabel = formatDimensionsMm(productDimensions);
  const activeLightingPresetId = inferLightingPresetId(lighting);
  const topModeLabel = topMode === "room" ? "룸 배치" : "데스크 정밀";
  const usesSurfaceLock = isSupportAnchorType(selectedAsset?.anchorType);
  const surfaceLockStatus = surfaceLockInfo
    ? surfaceLockInfo.withinUsableBounds
      ? {
          label: "Locked",
          className: "border border-emerald-200 bg-emerald-50 text-emerald-700"
        }
      : {
          label: "Overflow",
          className: "border border-amber-200 bg-amber-50 text-amber-700"
        }
    : usesSurfaceLock
      ? {
          label: "Pending",
          className: "border border-amber-200 bg-amber-50 text-amber-700"
        }
      : {
          label: "Off",
          className: "border border-black/10 bg-[#f4f1eb] text-[#7a7064]"
        };
  const topModeDescription =
    topMode === "room"
      ? "제품 본체를 직접 드래그해 큰 위치를 옮깁니다. 250mm 그리드와 월드 기준 정렬만 유지합니다."
      : "선택한 제품에 gizmo를 붙여 surface/anchor 기준 미세 위치와 회전을 조정합니다. 25mm / 15도 snap이 적용됩니다.";
  const containerClassName =
    layout === "inline"
      ? `flex h-full min-h-0 flex-col bg-white ${className ?? ""}`.trim()
      : `absolute inset-y-3 right-3 z-[30] flex w-[min(86vw,340px)] flex-col rounded-[24px] border border-black/10 bg-white/96 shadow-[0_18px_44px_rgba(17,19,22,0.14)] backdrop-blur-xl transition-all duration-300 xl:inset-y-5 xl:right-5 ${
          visible ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-[108%] opacity-0"
        } ${className ?? ""}`.trim();

  return (
    <aside className={containerClassName}>
      <div className="border-b border-black/10 px-4 py-4">
        <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6f665b]">
          <SlidersHorizontal className="h-4 w-4" />
          속성 패널
        </div>
        <p className="mt-2 text-sm leading-6 text-[#5f574d]">
          마감재와 선택한 제품의 배치/변형 값을 조정합니다.
        </p>
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">편집 정책</p>
          <div className="rounded-[20px] border border-black/10 bg-[#faf9f7] p-4">
            <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#4e473d]">
              {topModeLabel}
            </div>
            <p className="mt-2 text-[12px] leading-6 text-[#746b60]">{topModeDescription}</p>
          </div>
        </div>

        {topMode === "desk-precision" ? (
          <>
            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">변형 모드</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "translate", label: "이동" },
                  { id: "rotate", label: "회전" }
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onTransformModeChange(mode.id as TransformMode)}
                    className={`rounded-full px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                      transformMode === mode.id
                        ? "bg-[#1c1a17] text-white"
                        : "border border-black/10 bg-[#f4f4f1] text-[#4e473d] hover:border-black/20 hover:bg-white"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">좌표계</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "world", label: "월드" },
                  { id: "local", label: "로컬" }
                ].map((space) => (
                  <button
                    key={space.id}
                    type="button"
                    onClick={() => onTransformSpaceChange(space.id as TransformSpace)}
                    className={`rounded-full px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] transition ${
                      transformSpace === space.id
                        ? "bg-[#1c1a17] text-white"
                        : "border border-black/10 bg-[#f4f4f1] text-[#4e473d] hover:border-black/20 hover:bg-white"
                    }`}
                  >
                    {space.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] leading-5 text-[#82796d]">
                월드는 방 기준, 로컬은 선택한 제품 기준 축으로 이동/회전합니다.
              </p>
            </div>
          </>
        ) : null}

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">벽 마감</p>
          <div className="grid grid-cols-2 gap-2">
            {builderWallFinishes.map((finish) => {
              const preset = WALL_TEXTURE_PRESETS[finish.id] ?? WALL_TEXTURE_PRESETS[0];
              return (
                <button
                  key={finish.id}
                  type="button"
                  onClick={() => onWallMaterialChange(finish.id)}
                  className={`flex min-h-[72px] items-center gap-3 rounded-[16px] border px-2.5 py-2 text-left transition ${
                    wallMaterialIndex === finish.id
                      ? "border-[#1c1a17] bg-[#1c1a17] text-white"
                      : "border-black/10 bg-[#f4f4f1] text-[#5f584e] hover:border-black/20 hover:bg-white"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-11 w-11 shrink-0 rounded-[10px] border border-black/10 bg-cover bg-center"
                    style={materialPreviewStyle(preset)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em]">{finish.name}</span>
                    <span className={`mt-1 block text-[10px] ${wallMaterialIndex === finish.id ? "text-white/65" : "text-[#81786c]"}`}>
                      {finish.category}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">바닥 마감</p>
          <div className="grid grid-cols-2 gap-2">
            {builderFloorFinishes.map((finish) => {
              const preset = FLOOR_TEXTURE_PRESETS[finish.id] ?? FLOOR_TEXTURE_PRESETS[0];
              return (
                <button
                  key={finish.id}
                  type="button"
                  onClick={() => onFloorMaterialChange(finish.id)}
                  className={`flex min-h-[72px] items-center gap-3 rounded-[16px] border px-2.5 py-2 text-left transition ${
                    floorMaterialIndex === finish.id
                      ? "border-[#1c1a17] bg-[#1c1a17] text-white"
                      : "border-black/10 bg-[#f4f4f1] text-[#5f584e] hover:border-black/20 hover:bg-white"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-11 w-11 shrink-0 rounded-[10px] border border-black/10 bg-cover bg-center"
                    style={materialPreviewStyle(preset)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em]">{finish.name}</span>
                    <span className={`mt-1 block text-[10px] ${floorMaterialIndex === finish.id ? "text-white/65" : "text-[#81786c]"}`}>
                      {finish.category}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">천장 마감</p>
          <div className="grid grid-cols-2 gap-2">
            {builderCeilingFinishes.map((finish) => {
              const preset = CEILING_TEXTURE_PRESETS[finish.id] ?? CEILING_TEXTURE_PRESETS[0];
              return (
                <button
                  key={finish.id}
                  type="button"
                  onClick={() => onCeilingMaterialChange(finish.id)}
                  className={`flex min-h-[72px] items-center gap-3 rounded-[16px] border px-2.5 py-2 text-left transition ${
                    ceilingMaterialIndex === finish.id
                      ? "border-[#1c1a17] bg-[#1c1a17] text-white"
                      : "border-black/10 bg-[#f4f4f1] text-[#5f584e] hover:border-black/20 hover:bg-white"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-11 w-11 shrink-0 rounded-[10px] border border-black/10 bg-cover bg-center"
                    style={materialPreviewStyle(preset)}
                  />
                  <span className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em]">{finish.name}</span>
                    <span className={`mt-1 block text-[10px] ${ceilingMaterialIndex === finish.id ? "text-white/65" : "text-[#81786c]"}`}>
                      {finish.category}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-[20px] border border-black/10 bg-[#faf9f7] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">조명</p>
          <div className="grid gap-2">
            {LIGHTING_PRESETS.map((preset) => {
              const isActive = activeLightingPresetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onApplyLightingPreset(preset.id)}
                    className={`rounded-[16px] border px-3 py-2 text-left transition ${
                      isActive
                        ? "border-[#1c1a17] bg-[#1c1a17] text-white"
                        : "border-black/10 bg-white text-[#4e473d] hover:border-black/20"
                    }`}
                  >
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em]">{preset.label}</div>
                  <div className={`mt-1 text-[11px] leading-4 ${isActive ? "text-white/80" : "text-[#6f665a]"}`}>
                    {preset.description}
                  </div>
                </button>
              );
            })}
          </div>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            주변광
            <input
              type="range"
              min="0.05"
              max="1.2"
              step="0.05"
              value={lighting.ambientIntensity}
              onChange={(event) => onLightingChange({ ambientIntensity: Number(event.target.value) })}
              onMouseUp={onLightingCommit}
              onTouchEnd={onLightingCommit}
              className="w-full accent-[#1c1a17]"
            />
          </label>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            하늘광
            <input
              type="range"
              min="0.05"
              max="1.4"
              step="0.05"
              value={lighting.hemisphereIntensity}
              onChange={(event) => onLightingChange({ hemisphereIntensity: Number(event.target.value) })}
              onMouseUp={onLightingCommit}
              onTouchEnd={onLightingCommit}
              className="w-full accent-[#1c1a17]"
            />
          </label>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            직사광
            <input
              type="range"
              min="0.2"
              max="2.4"
              step="0.05"
              value={lighting.directionalIntensity}
              onChange={(event) => onLightingChange({ directionalIntensity: Number(event.target.value) })}
              onMouseUp={onLightingCommit}
              onTouchEnd={onLightingCommit}
              className="w-full accent-[#1c1a17]"
            />
          </label>
          <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
            환경 블러
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.02"
              value={lighting.environmentBlur}
              onChange={(event) => onLightingChange({ environmentBlur: Number(event.target.value) })}
              onMouseUp={onLightingCommit}
              onTouchEnd={onLightingCommit}
              className="w-full accent-[#1c1a17]"
            />
          </label>
        </div>

        <div className="space-y-3 rounded-[20px] border border-black/10 bg-[#faf9f7] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">공간 요약</p>
          <div className="space-y-2 text-sm text-[#4f473d]">
            <div className="flex items-center justify-between">
              <span>벽</span>
              <span>{wallsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>바닥 구역</span>
              <span>{floorsCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>제품</span>
              <span>{assetsCount}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-[20px] border border-black/10 bg-[#faf9f7] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">선택 항목</p>
          {selectedAsset ? (
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-[#1f1b16]">
                  {selectedAssetMeta?.label ?? formatAssetLabel(selectedAsset.assetId)}
                </div>
                {selectedAssetMeta ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full border border-black/10 bg-[#faf9f7] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#6f665a]">
                      {selectedAssetMeta.category}
                    </span>
                    <span className="rounded-full border border-black/10 bg-[#faf9f7] px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#6f665a]">
                      {selectedAssetMeta.collection}
                    </span>
                  </div>
                ) : null}
                <div className="mt-1 text-xs text-[#83796d]">{selectedAsset.id}</div>
              </div>
              {dimensionsLabel || productFinishColor || productFinishMaterial || productDetailNotes ? (
                <div className="space-y-3 rounded-[18px] border border-black/10 bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                    실제 규격
                  </div>
                  {dimensionsLabel ? (
                    <div className="rounded-xl border border-black/10 bg-white/80 px-3 py-2 text-sm font-semibold text-[#1f1b16]">
                      {dimensionsLabel}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {productFinishColor ? (
                      <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6f665a]">
                        색상 {productFinishColor}
                      </span>
                    ) : null}
                    {productFinishMaterial ? (
                      <span className="rounded-full border border-black/10 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6f665a]">
                        재질 {productFinishMaterial}
                      </span>
                    ) : null}
                  </div>
                  {productDetailNotes ? (
                    <p className="text-xs leading-6 text-[#6f665b]">{productDetailNotes}</p>
                  ) : null}
                </div>
              ) : null}
              <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                기준면
                <select
                  value={selectedAsset.anchorType ?? "floor"}
                  onChange={(event) =>
                    onUpdateAsset(selectedAsset.id, {
                      anchorType: event.target.value as SceneAnchorType
                    })
                  }
                  className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2 text-sm text-[#2f2921] outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35"
                >
                  {SCENE_ANCHOR_TYPES.map((anchorType) => (
                    <option key={anchorType} value={anchorType}>
                      {anchorLabel[anchorType]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                  X (mm)
                  <input
                    type="number"
                    step="1"
                    value={metersToMillimeters(selectedAsset.position[0])}
                    onChange={(event) =>
                      onUpdateAsset(selectedAsset.id, {
                        position: [
                          millimetersToMeters(Number(event.target.value)),
                          selectedAsset.position[1],
                          selectedAsset.position[2]
                        ]
                      })
                    }
                    className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2 text-sm text-[#2f2921] outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35"
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                  Z (mm)
                  <input
                    type="number"
                    step="1"
                    value={metersToMillimeters(selectedAsset.position[2])}
                    onChange={(event) =>
                      onUpdateAsset(selectedAsset.id, {
                        position: [
                          selectedAsset.position[0],
                          selectedAsset.position[1],
                          millimetersToMeters(Number(event.target.value))
                        ]
                      })
                    }
                    className="w-full rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2 text-sm text-[#2f2921] outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35"
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                  Y (mm)
                  <input
                    type="number"
                    step="1"
                    value={metersToMillimeters(selectedAsset.position[1])}
                    disabled={isYManagedByAnchor}
                    onChange={(event) =>
                      onUpdateAsset(selectedAsset.id, {
                        position: [
                          selectedAsset.position[0],
                          millimetersToMeters(Number(event.target.value)),
                          selectedAsset.position[2]
                        ]
                      })
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35 ${
                      isYManagedByAnchor
                        ? "cursor-not-allowed border-black/10 bg-[#efede8] text-[#9b9287]"
                        : "border-black/10 bg-[#faf9f7] text-[#2f2921]"
                    }`}
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                  Y축 회전 (deg)
                  <input
                    type="number"
                    step="1"
                    value={toRoundedDegree(selectedAsset.rotation[1])}
                    disabled={isRotationManagedByAnchor}
                    onChange={(event) =>
                      onUpdateAsset(selectedAsset.id, {
                        rotation: [
                          selectedAsset.rotation[0],
                          degreesToRadians(Number(event.target.value)),
                          selectedAsset.rotation[2]
                        ]
                      })
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35 ${
                      isRotationManagedByAnchor
                        ? "cursor-not-allowed border-black/10 bg-[#efede8] text-[#9b9287]"
                        : "border-black/10 bg-[#faf9f7] text-[#2f2921]"
                    }`}
                  />
                </label>
                <label className="space-y-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                  크기 비율
                  <input
                    type="number"
                    step="0.1"
                    value={selectedAsset.scale[0]}
                    disabled={scaleLocked}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      onUpdateAsset(selectedAsset.id, {
                        scale: [nextValue, nextValue, nextValue]
                      });
                    }}
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#a48f79]/35 ${
                      scaleLocked
                        ? "cursor-not-allowed border-black/10 bg-[#efede8] text-[#9b9287]"
                        : "border-black/10 bg-[#faf9f7] text-[#2f2921]"
                    }`}
                  />
                </label>
              </div>
              {topMode === "desk-precision" ? (
                <div className="rounded-[18px] border border-black/10 bg-white p-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                    정밀 측정
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[#5f574d]">
                    <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">X</div>
                      <div className="mt-1 font-semibold text-[#1f1b16]">
                        {metersToMillimeters(selectedAsset.position[0])} mm
                      </div>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">Z</div>
                      <div className="mt-1 font-semibold text-[#1f1b16]">
                        {metersToMillimeters(selectedAsset.position[2])} mm
                      </div>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">Y</div>
                      <div className="mt-1 font-semibold text-[#1f1b16]">
                        {metersToMillimeters(selectedAsset.position[1])} mm
                      </div>
                    </div>
                    <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">회전</div>
                      <div className="mt-1 font-semibold text-[#1f1b16]">
                        {toRoundedDegree(selectedAsset.rotation[1])} deg
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {topMode === "desk-precision" ? (
                <div className="rounded-[18px] border border-black/10 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]">
                      Surface Lock
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] ${surfaceLockStatus.className}`}
                    >
                      {surfaceLockStatus.label}
                    </span>
                  </div>

                  {surfaceLockInfo ? (
                    <>
                      <div className="mt-3 text-sm font-semibold text-[#1f1b16]">
                        {surfaceLockInfo.supportLabel}
                      </div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#8b8277]">
                        {surfaceLockInfo.surfaceLabel}
                      </div>
                      <div className="mt-2 text-[11px] leading-5 text-[#6f665b]">
                        {surfaceLockInfo.withinUsableBounds
                          ? "현재 footprint가 usable area 안에 들어와 있습니다."
                          : "현재 footprint가 usable area 가장자리를 넘어서고 있습니다."}
                      </div>
                      <div className="mt-3">
                        <PrecisionSurfaceMicroView surfaceLockInfo={surfaceLockInfo} />
                      </div>
                      <div className="mt-3">
                        <PrecisionSurfaceProjectionView surfaceLockInfo={surfaceLockInfo} />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[#5f574d]">
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Surface
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.sizeMm[0]} x {surfaceLockInfo.sizeMm[1]} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Margin
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.marginMm[0]} / {surfaceLockInfo.marginMm[1]} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Footprint
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.footprintMm[0]} x {surfaceLockInfo.footprintMm[1]} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Projected
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.projectedFootprintMm[0]} x {surfaceLockInfo.projectedFootprintMm[1]} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Usable
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.usableSizeMm[0]} x {surfaceLockInfo.usableSizeMm[1]} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Offset
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.localOffsetMm[0]} / {surfaceLockInfo.localOffsetMm[1]} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Top
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">{surfaceLockInfo.topMm} mm</div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Height
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.assetHeightMm} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Gap / Reach
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.bottomOffsetMm} / {surfaceLockInfo.topOffsetMm} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Clearance X
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            L {surfaceLockInfo.clearanceMm.left} / R {surfaceLockInfo.clearanceMm.right} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Clearance Z
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            T {surfaceLockInfo.clearanceMm.top} / B {surfaceLockInfo.clearanceMm.bottom} mm
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Yaw Delta
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {surfaceLockInfo.relativeYawDeg} deg
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
                          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">
                            Anchor
                          </div>
                          <div className="mt-1 font-semibold text-[#1f1b16]">
                            {anchorLabel[selectedAsset.anchorType ?? "floor"]}
                          </div>
                        </div>
                      </div>
                      {!surfaceLockInfo.withinUsableBounds ? (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
                          최소 edge clearance가 {surfaceLockInfo.clearanceMm.min} mm 입니다. usable area 안으로 다시
                          옮기거나 회전을 줄여 주세요.
                        </div>
                      ) : null}
                    </>
                  ) : usesSurfaceLock ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-[#8a6a2c]">
                      현재 기준면은 support surface를 사용하지만, 아직 잠긴 상면 정보를 확인하지 못했습니다.
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2 text-[11px] leading-5 text-[#6f665b]">
                      floor / wall / ceiling 기준면은 surface lock을 사용하지 않습니다.
                    </div>
                  )}
                </div>
              ) : null}
              {isYManagedByAnchor || isRotationManagedByAnchor ? (
                <div className="text-[10px] uppercase tracking-[0.14em] text-[#8b8277]">
                  현재 기준면이
                  {isYManagedByAnchor ? " 높이" : ""}
                  {isYManagedByAnchor && isRotationManagedByAnchor ? " 및" : ""}
                  {isRotationManagedByAnchor ? " 회전" : ""}
                  값을 관리합니다.
                </div>
              ) : null}
              {scaleLocked ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-[#8a6a2c]">
                  이 제품은 실제 규격 기준으로 고정되어 있어 크기 비율을 직접 변경할 수 없습니다.
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => onRemoveAsset(selectedAsset.id)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-red-300/60 bg-red-50 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.18em] text-red-700 transition hover:border-red-400 hover:bg-red-100"
              >
                <Trash2 className="h-4 w-4" />
                제품 삭제
              </button>
            </div>
          ) : (
            <div className="text-sm leading-6 text-[#6f665b]">
              상단뷰에서 배치된 제품을 선택하면 위치/회전/크기를 조정할 수 있습니다.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
