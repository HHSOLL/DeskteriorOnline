import type { LibraryCatalogItem } from "../../lib/builder/catalog";
import { metersToMillimeters, radiansToDegrees } from "../../lib/domain/scene-placement";
import { isSupportAnchorType } from "../../lib/scene/support-profiles";
import type { SceneAsset } from "../../lib/stores/useSceneStore";
import {
  PrecisionSurfaceMicroView,
  type PrecisionSurfaceLockInfo
} from "./PrecisionSurfaceMicroView";
import { PrecisionSurfaceProjectionView } from "./PrecisionSurfaceProjectionView";

type PrecisionMeasurementOverlayProps = {
  selectedAsset: SceneAsset | null;
  selectedAssetMeta: LibraryCatalogItem | null;
  surfaceLockInfo: PrecisionSurfaceLockInfo | null;
  formatAssetLabel: (assetId: string) => string;
};

function toRoundedDegree(value: number) {
  return Math.round(radiansToDegrees(value) * 10) / 10;
}

function formatDimensions(
  dimensions: { width: number; depth: number; height: number } | null | undefined
) {
  if (!dimensions) return null;
  return `W ${dimensions.width} / D ${dimensions.depth} / H ${dimensions.height} mm`;
}

export function PrecisionMeasurementOverlay({
  selectedAsset,
  selectedAssetMeta,
  surfaceLockInfo,
  formatAssetLabel
}: PrecisionMeasurementOverlayProps) {
  if (!selectedAsset) {
    return null;
  }

  const dimensions = selectedAsset.product?.dimensionsMm ?? selectedAssetMeta?.dimensionsMm ?? null;
  const dimensionsLabel = formatDimensions(dimensions);
  const anchorLabel = selectedAsset.anchorType?.replaceAll("_", " ") ?? "floor";
  const usesSurfaceLock = isSupportAnchorType(selectedAsset.anchorType);
  const surfaceLockTone = surfaceLockInfo
    ? surfaceLockInfo.withinUsableBounds
      ? {
          panel: "border-emerald-200 bg-emerald-50/70 text-[#245c46]",
          accent: "text-[#3b7d63]",
          detail: "text-[#356953]"
        }
      : {
          panel: "border-amber-200 bg-amber-50 text-[#8a6a2c]",
          accent: "text-[#9a6a14]",
          detail: "text-[#8a6a2c]"
        }
    : null;

  return (
    <div className="pointer-events-none absolute bottom-4 right-4 z-[24] w-[min(92vw,320px)] rounded-[22px] border border-black/10 bg-white/96 p-4 shadow-[0_16px_34px_rgba(16,18,22,0.14)] backdrop-blur-xl">
      <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#7a7064]">Desk Precision</div>
      <div className="mt-2 text-sm font-semibold text-[#1f1b16]">
        {selectedAssetMeta?.label ?? formatAssetLabel(selectedAsset.assetId)}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#8b8277]">{anchorLabel}</div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[#5f574d]">
        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">X</div>
          <div className="mt-1 font-semibold text-[#1f1b16]">{metersToMillimeters(selectedAsset.position[0])} mm</div>
        </div>
        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">Z</div>
          <div className="mt-1 font-semibold text-[#1f1b16]">{metersToMillimeters(selectedAsset.position[2])} mm</div>
        </div>
        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">Y</div>
          <div className="mt-1 font-semibold text-[#1f1b16]">{metersToMillimeters(selectedAsset.position[1])} mm</div>
        </div>
        <div className="rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2">
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#8b8277]">회전</div>
          <div className="mt-1 font-semibold text-[#1f1b16]">{toRoundedDegree(selectedAsset.rotation[1])} deg</div>
        </div>
      </div>

      {surfaceLockInfo ? (
        <div className={`mt-3 rounded-xl border px-3 py-2 text-[11px] ${surfaceLockTone?.panel ?? ""}`}>
          <div className={`text-[9px] font-bold uppercase tracking-[0.14em] ${surfaceLockTone?.accent ?? ""}`}>
            Surface Lock
          </div>
          <div className="mt-1 font-semibold">
            {surfaceLockInfo.supportLabel} · {surfaceLockInfo.surfaceLabel}
          </div>
          <div className="mt-1 text-[10px]">
            {surfaceLockInfo.withinUsableBounds ? "usable area 안에 배치됨" : "usable area 가장자리를 넘어섬"}
          </div>
          <div className="mt-3">
            <PrecisionSurfaceMicroView surfaceLockInfo={surfaceLockInfo} variant="compact" />
          </div>
          <div className="mt-2">
            <PrecisionSurfaceProjectionView surfaceLockInfo={surfaceLockInfo} variant="compact" />
          </div>
          <div className={`mt-1 text-[10px] ${surfaceLockTone?.detail ?? ""}`}>
            {surfaceLockInfo.sizeMm[0]} x {surfaceLockInfo.sizeMm[1]} mm · margin{" "}
            {surfaceLockInfo.marginMm[0]} / {surfaceLockInfo.marginMm[1]} mm
          </div>
          <div className={`mt-1 text-[10px] ${surfaceLockTone?.detail ?? ""}`}>
            footprint {surfaceLockInfo.footprintMm[0]} x {surfaceLockInfo.footprintMm[1]} mm · projected{" "}
            {surfaceLockInfo.projectedFootprintMm[0]} x {surfaceLockInfo.projectedFootprintMm[1]} mm
          </div>
          <div className={`mt-1 text-[10px] ${surfaceLockTone?.detail ?? ""}`}>
            clearance L {surfaceLockInfo.clearanceMm.left} / R {surfaceLockInfo.clearanceMm.right} / T{" "}
            {surfaceLockInfo.clearanceMm.top} / B {surfaceLockInfo.clearanceMm.bottom} mm
          </div>
          <div className={`mt-1 text-[10px] ${surfaceLockTone?.detail ?? ""}`}>
            offset {surfaceLockInfo.localOffsetMm[0]} / {surfaceLockInfo.localOffsetMm[1]} mm · yaw Δ{" "}
            {surfaceLockInfo.relativeYawDeg} deg · top {surfaceLockInfo.topMm} mm
          </div>
          <div className={`mt-1 text-[10px] ${surfaceLockTone?.detail ?? ""}`}>
            height {surfaceLockInfo.assetHeightMm} mm · gap {surfaceLockInfo.bottomOffsetMm} mm · reach{" "}
            {surfaceLockInfo.topOffsetMm} mm
          </div>
        </div>
      ) : usesSurfaceLock ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-[#8a6a2c]">
          support surface lock가 아직 확인되지 않았습니다.
        </div>
      ) : null}

      {dimensionsLabel ? (
        <div className="mt-3 rounded-xl border border-black/10 bg-[#faf9f7] px-3 py-2 text-[11px] font-semibold text-[#1f1b16]">
          {dimensionsLabel}
        </div>
      ) : null}
    </div>
  );
}
