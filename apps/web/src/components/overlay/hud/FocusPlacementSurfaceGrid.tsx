"use client";

import { resolveLocalFootprintBounds } from "@deskterioronline/placement-kernel";
import type { FocusPlacementSession } from "../../../lib/stores/useFocusPlacementStore";

type FocusPlacementSurfaceGridProps = {
  session: FocusPlacementSession;
  tone: "ready" | "warning" | "blocked";
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mapPoint(
  x: number,
  y: number,
  bounds: FocusPlacementSession["surfaceBoundsMm"]
) {
  const minX = bounds.min[0];
  const maxX = bounds.max[0];
  const minY = bounds.min[1];
  const maxY = bounds.max[1];
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  return {
    x: 8 + ((x - minX) / width) * 84,
    y: 92 - ((y - minY) / height) * 84
  };
}

function mapRect(
  rect: { min: [number, number]; max: [number, number] },
  bounds: FocusPlacementSession["surfaceBoundsMm"]
) {
  const min = mapPoint(rect.min[0], rect.min[1], bounds);
  const max = mapPoint(rect.max[0], rect.max[1], bounds);
  return {
    x: min.x,
    y: max.y,
    width: Math.max(max.x - min.x, 0),
    height: Math.max(min.y - max.y, 0)
  };
}

export default function FocusPlacementSurfaceGrid({
  session,
  tone
}: FocusPlacementSurfaceGridProps) {
  const frameBounds = session.surfaceBoundsMm;
  const currentPoint = mapPoint(session.localPose.uMm, session.localPose.vMm, frameBounds);
  const footprint =
    session.objectDimensionsMm
      ? resolveLocalFootprintBounds(session.localPose, session.objectDimensionsMm, session.surfaceType)
      : null;
  const footprintRect = footprint
    ? mapRect(
        {
          min: [footprint.minU, footprint.minV],
          max: [footprint.maxU, footprint.maxV]
        },
        frameBounds
      )
    : null;
  const toneStroke =
    tone === "blocked" ? "#fb7185" : tone === "warning" ? "#fbbf24" : "#34d399";
  const toneFill =
    tone === "blocked"
      ? "rgba(251,113,133,0.18)"
      : tone === "warning"
        ? "rgba(251,191,36,0.18)"
        : "rgba(52,211,153,0.18)";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Local Grid</div>
        <div className="text-[10px] font-medium text-white/70">
          {frameBounds.max[0] - frameBounds.min[0]} x {frameBounds.max[1] - frameBounds.min[1]} mm
        </div>
      </div>

      <svg viewBox="0 0 100 100" className="h-36 w-full">
        <rect x="4" y="4" width="92" height="92" rx="14" fill="#07111b" />
        <rect x="8" y="8" width="84" height="84" rx="10" fill="#0f1721" stroke="rgba(255,255,255,0.14)" />

        {[29, 50, 71].map((offset) => (
          <g key={offset}>
            <line x1={offset} y1="8" x2={offset} y2="92" stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />
            <line x1="8" y1={offset} x2="92" y2={offset} stroke="rgba(255,255,255,0.08)" strokeDasharray="2 3" />
          </g>
        ))}

        {session.preferredZones.map((zone, index) => {
          const rect = mapRect(zone, frameBounds);
          return (
            <rect
              key={`preferred-${index}`}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx="4"
              fill="rgba(52,211,153,0.14)"
              stroke="rgba(52,211,153,0.55)"
              strokeDasharray="4 3"
            />
          );
        })}

        {session.noPlaceZones.map((zone, index) => {
          const rect = mapRect(zone, frameBounds);
          return (
            <rect
              key={`blocked-${index}`}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx="4"
              fill="rgba(251,113,133,0.14)"
              stroke="rgba(251,113,133,0.55)"
            />
          );
        })}

        {footprintRect ? (
          <rect
            x={footprintRect.x}
            y={footprintRect.y}
            width={Math.max(footprintRect.width, 2)}
            height={Math.max(footprintRect.height, 2)}
            rx="4"
            fill={toneFill}
            stroke={toneStroke}
            strokeWidth="1.6"
          />
        ) : null}

        <line
          x1={clamp(currentPoint.x - 6, 8, 92)}
          y1={currentPoint.y}
          x2={clamp(currentPoint.x + 6, 8, 92)}
          y2={currentPoint.y}
          stroke="#ffffff"
          strokeWidth="1.4"
        />
        <line
          x1={currentPoint.x}
          y1={clamp(currentPoint.y - 6, 8, 92)}
          x2={currentPoint.x}
          y2={clamp(currentPoint.y + 6, 8, 92)}
          stroke="#ffffff"
          strokeWidth="1.4"
        />
        <circle cx={currentPoint.x} cy={currentPoint.y} r="3.6" fill="#ffffff" />
      </svg>

      <div className="mt-2 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.18em] text-white/55">
        <span>Preferred {session.preferredZones.length}</span>
        <span>No-Place {session.noPlaceZones.length}</span>
      </div>
    </div>
  );
}
