"use client";

import type { PrecisionSurfaceLockInfo } from "./PrecisionSurfaceMicroView";

type PrecisionSurfaceProjectionViewProps = {
  surfaceLockInfo: PrecisionSurfaceLockInfo;
  variant?: "panel" | "compact";
};

type ProjectionAxis = {
  id: "x" | "z";
  label: string;
  surfaceSpanMm: number;
  usableSpanMm: number;
  marginMm: number;
  offsetMm: number;
  projectedSpanMm: number;
  negativeClearanceMm: number;
  positiveClearanceMm: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toAxisX(frame: { x: number; width: number }, surfaceSpanMm: number, valueMm: number) {
  return frame.x + ((valueMm + surfaceSpanMm / 2) / Math.max(surfaceSpanMm, 1)) * frame.width;
}

function toAxisY(
  frame: { y: number; height: number },
  minValueMm: number,
  maxValueMm: number,
  valueMm: number
) {
  const range = Math.max(maxValueMm - minValueMm, 1);
  return frame.y + ((maxValueMm - valueMm) / range) * frame.height;
}

function resolveProjectionFrame(surfaceSpanMm: number) {
  const safeSpan = Math.max(surfaceSpanMm, 1);
  const aspect = clamp(safeSpan / 520, 0.72, 1.28);
  const width = 82;
  const height = clamp(46 / aspect, 34, 50);
  return {
    x: 9,
    y: 11,
    width,
    height
  };
}

function ProjectionCard({
  axis,
  surfaceLockInfo,
  variant
}: {
  axis: ProjectionAxis;
  surfaceLockInfo: PrecisionSurfaceLockInfo;
  variant: "panel" | "compact";
}) {
  const frame = resolveProjectionFrame(axis.surfaceSpanMm);
  const heightPadding = Math.max(surfaceLockInfo.assetHeightMm * 0.18, 18);
  const minValueMm = Math.min(surfaceLockInfo.bottomOffsetMm, 0) - Math.max(surfaceLockInfo.assetHeightMm * 0.08, 8);
  const maxValueMm = Math.max(surfaceLockInfo.topOffsetMm, surfaceLockInfo.assetHeightMm) + heightPadding;
  const baselineY = toAxisY({ y: frame.y, height: frame.height }, minValueMm, maxValueMm, 0);
  const assetStart = axis.offsetMm - axis.projectedSpanMm / 2;
  const assetEnd = axis.offsetMm + axis.projectedSpanMm / 2;
  const assetLeft = toAxisX({ x: frame.x, width: frame.width }, axis.surfaceSpanMm, assetStart);
  const assetRight = toAxisX({ x: frame.x, width: frame.width }, axis.surfaceSpanMm, assetEnd);
  const assetTopY = toAxisY({ y: frame.y, height: frame.height }, minValueMm, maxValueMm, surfaceLockInfo.topOffsetMm);
  const assetBottomY = toAxisY(
    { y: frame.y, height: frame.height },
    minValueMm,
    maxValueMm,
    surfaceLockInfo.bottomOffsetMm
  );
  const usableStart = -axis.usableSpanMm / 2;
  const usableEnd = axis.usableSpanMm / 2;
  const usableX = toAxisX({ x: frame.x, width: frame.width }, axis.surfaceSpanMm, usableStart);
  const usableWidth =
    toAxisX({ x: frame.x, width: frame.width }, axis.surfaceSpanMm, usableEnd) - usableX;
  const centerX = toAxisX({ x: frame.x, width: frame.width }, axis.surfaceSpanMm, axis.offsetMm);
  const isCompact = variant === "compact";
  const cardClassName = isCompact
    ? "rounded-[14px] border border-black/10 bg-white/80 p-2"
    : "rounded-[16px] border border-black/10 bg-[#fcfbf8] p-2.5";
  const titleClassName = isCompact
    ? "text-[9px] font-bold uppercase tracking-[0.14em] text-[#7a7064]"
    : "text-[10px] font-bold uppercase tracking-[0.16em] text-[#7a7064]";
  const detailClassName = isCompact
    ? "mt-1 flex items-center justify-between gap-2 text-[9px] text-[#6f665b]"
    : "mt-1 flex items-center justify-between gap-2 text-[10px] text-[#6f665b]";
  const svgHeightClassName = isCompact ? "h-24 w-full" : "h-28 w-full";

  return (
    <div className={cardClassName}>
      <div className={titleClassName}>{axis.label}</div>
      <svg
        viewBox="0 0 100 70"
        className={svgHeightClassName}
        role="img"
        aria-label={`${axis.label} projection`}
      >
        <defs>
          <linearGradient id={`projection-surface-${axis.id}-${variant}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#efe6d8" />
            <stop offset="100%" stopColor="#dccdb8" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="96" height="66" rx="12" fill="#f7f3ec" />
        <rect
          x={frame.x}
          y={baselineY - 2.2}
          width={frame.width}
          height="4.4"
          rx="2.2"
          fill={`url(#projection-surface-${axis.id}-${variant})`}
          stroke="#8a7d6e"
          strokeWidth="1"
        />
        <rect
          x={usableX}
          y={baselineY - 1.4}
          width={Math.max(usableWidth, 0)}
          height="2.8"
          rx="1.4"
          fill="rgba(46,139,87,0.18)"
          stroke="#2e8b57"
          strokeWidth="0.8"
          strokeDasharray="3 2"
        />
        <line
          x1={frame.x + frame.width / 2}
          y1={frame.y}
          x2={frame.x + frame.width / 2}
          y2={frame.y + frame.height}
          stroke="#c7bdb0"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
        <line
          x1={centerX}
          y1={frame.y + 2}
          x2={centerX}
          y2={frame.y + frame.height}
          stroke="#9b8f81"
          strokeWidth="1"
          strokeDasharray="3 2"
        />
        <rect
          x={Math.min(assetLeft, assetRight)}
          y={Math.min(assetTopY, assetBottomY)}
          width={Math.max(Math.abs(assetRight - assetLeft), 2.4)}
          height={Math.max(Math.abs(assetBottomY - assetTopY), 2.8)}
          rx="3"
          fill={surfaceLockInfo.withinUsableBounds ? "rgba(17,19,22,0.14)" : "rgba(180,83,9,0.18)"}
          stroke={surfaceLockInfo.withinUsableBounds ? "#111316" : "#b45309"}
          strokeWidth="1.2"
        />
        <circle cx={centerX} cy={baselineY} r="2.2" fill={surfaceLockInfo.withinUsableBounds ? "#111316" : "#b45309"} />
      </svg>
      <div className={detailClassName}>
        <span>
          {axis.id === "x" ? "-X" : "-Z"} {axis.negativeClearanceMm} mm
        </span>
        <span>
          {axis.id === "x" ? "+X" : "+Z"} {axis.positiveClearanceMm} mm
        </span>
      </div>
      <div className={detailClassName}>
        <span>Gap {surfaceLockInfo.bottomOffsetMm} mm</span>
        <span>Reach {surfaceLockInfo.topOffsetMm} mm</span>
      </div>
    </div>
  );
}

export function PrecisionSurfaceProjectionView({
  surfaceLockInfo,
  variant = "panel"
}: PrecisionSurfaceProjectionViewProps) {
  const axes: ProjectionAxis[] = [
    {
      id: "x",
      label: "Front (X / H)",
      surfaceSpanMm: surfaceLockInfo.sizeMm[0],
      usableSpanMm: surfaceLockInfo.usableSizeMm[0],
      marginMm: surfaceLockInfo.marginMm[0],
      offsetMm: surfaceLockInfo.localOffsetMm[0],
      projectedSpanMm: surfaceLockInfo.projectedFootprintMm[0],
      negativeClearanceMm: surfaceLockInfo.clearanceMm.left,
      positiveClearanceMm: surfaceLockInfo.clearanceMm.right
    },
    {
      id: "z",
      label: "Side (Z / H)",
      surfaceSpanMm: surfaceLockInfo.sizeMm[1],
      usableSpanMm: surfaceLockInfo.usableSizeMm[1],
      marginMm: surfaceLockInfo.marginMm[1],
      offsetMm: surfaceLockInfo.localOffsetMm[1],
      projectedSpanMm: surfaceLockInfo.projectedFootprintMm[1],
      negativeClearanceMm: surfaceLockInfo.clearanceMm.bottom,
      positiveClearanceMm: surfaceLockInfo.clearanceMm.top
    }
  ];

  return (
    <div className={variant === "compact" ? "grid grid-cols-2 gap-2" : "grid grid-cols-2 gap-3"}>
      {axes.map((axis) => (
        <ProjectionCard
          key={axis.id}
          axis={axis}
          surfaceLockInfo={surfaceLockInfo}
          variant={variant}
        />
      ))}
    </div>
  );
}
