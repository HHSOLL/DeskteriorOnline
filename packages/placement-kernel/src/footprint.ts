import type { DimensionsMm, SupportSurface, SurfaceLocalPose } from "@deskterioronline/scene-schema";

export type LocalFootprintBounds = {
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  halfSpanU: number;
  halfSpanV: number;
};

export type SurfaceClearanceMm = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  min: number;
};

function resolveSurfacePlaneSpanMm(dimensionsMm: DimensionsMm, surfaceType: SupportSurface["type"]) {
  switch (surfaceType) {
    case "wall":
    case "monitor_back":
      return {
        spanU: dimensionsMm.width,
        spanV: dimensionsMm.height
      };
    case "desk_edge":
      return {
        spanU: dimensionsMm.width,
        spanV: dimensionsMm.height
      };
    case "floor":
    case "desktop_top":
    case "shelf_top":
    case "desk_underside":
    case "pegboard":
    default:
      return {
        spanU: dimensionsMm.width,
        spanV: dimensionsMm.depth
      };
  }
}

export function resolveLocalFootprintBounds(
  localPose: SurfaceLocalPose,
  dimensionsMm: DimensionsMm,
  surfaceType: SupportSurface["type"]
): LocalFootprintBounds {
  const { spanU, spanV } = resolveSurfacePlaneSpanMm(dimensionsMm, surfaceType);
  const theta = (localPose.rotationMilliDeg * Math.PI) / 180000;
  const cos = Math.abs(Math.cos(theta));
  const sin = Math.abs(Math.sin(theta));
  const halfSpanU = (cos * spanU + sin * spanV) / 2;
  const halfSpanV = (sin * spanU + cos * spanV) / 2;

  return {
    minU: localPose.uMm - halfSpanU,
    maxU: localPose.uMm + halfSpanU,
    minV: localPose.vMm - halfSpanV,
    maxV: localPose.vMm + halfSpanV,
    halfSpanU,
    halfSpanV
  };
}

export function rectsOverlap(
  left: Pick<LocalFootprintBounds, "minU" | "maxU" | "minV" | "maxV">,
  right: Pick<LocalFootprintBounds, "minU" | "maxU" | "minV" | "maxV">
) {
  return left.minU < right.maxU && left.maxU > right.minU && left.minV < right.maxV && left.maxV > right.minV;
}

export function rectContainedBySurface(
  rect: Pick<LocalFootprintBounds, "minU" | "maxU" | "minV" | "maxV">,
  surface: SupportSurface
) {
  return (
    rect.minU >= surface.boundsMm.min[0] &&
    rect.maxU <= surface.boundsMm.max[0] &&
    rect.minV >= surface.boundsMm.min[1] &&
    rect.maxV <= surface.boundsMm.max[1]
  );
}

export function rectOverlapsSurfaceZone(
  rect: Pick<LocalFootprintBounds, "minU" | "maxU" | "minV" | "maxV">,
  zone: { min: [number, number]; max: [number, number] }
) {
  return rectsOverlap(rect, {
    minU: zone.min[0],
    maxU: zone.max[0],
    minV: zone.min[1],
    maxV: zone.max[1]
  });
}

export function resolveSurfaceEdgeClearanceMm(
  rect: Pick<LocalFootprintBounds, "minU" | "maxU" | "minV" | "maxV">,
  surface: SupportSurface
) {
  return resolveSurfaceClearanceMm(rect, surface).min;
}

export function resolveSurfaceClearanceMm(
  rect: Pick<LocalFootprintBounds, "minU" | "maxU" | "minV" | "maxV">,
  surface: SupportSurface
): SurfaceClearanceMm {
  const left = rect.minU - surface.boundsMm.min[0];
  const right = surface.boundsMm.max[0] - rect.maxU;
  const bottom = rect.minV - surface.boundsMm.min[1];
  const top = surface.boundsMm.max[1] - rect.maxV;

  return {
    left,
    right,
    top,
    bottom,
    min: Math.min(left, right, top, bottom)
  };
}
