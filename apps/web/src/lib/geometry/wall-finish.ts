import type { Opening, Wall } from "../stores/useSceneStore";
import type { WallRenderPlacement } from "./wall-placement";

const POINT_KEY_PRECISION = 1000;
const MIN_TRIM_SEGMENT_LENGTH = 0.08;
const MIN_BLOCKED_RANGE_LENGTH = 0.04;

export type TrimSegment = {
  start: number;
  length: number;
};

export type WallCornerCap = {
  id: string;
  position: readonly [number, number];
  height: number;
  radius: number;
};

export function resolveOpeningBottomOffset(opening: Opening, scale: number) {
  if (typeof opening.verticalOffset === "number") {
    return opening.verticalOffset * scale;
  }

  if (typeof opening.sillHeight === "number") {
    return opening.sillHeight * scale;
  }

  return opening.type === "window" ? 0.9 * scale : 0;
}

export function resolveOpeningRange(
  opening: Opening,
  placement: WallRenderPlacement,
  scale: number
) {
  const start = opening.offset * scale + placement.startInset;
  return {
    start,
    end: start + opening.width * scale
  };
}

export function resolveWallInteriorSide(
  wall: Wall,
  placement: WallRenderPlacement,
  scale: number
) {
  const rawMidX = ((wall.start[0] + wall.end[0]) / 2) * scale;
  const rawMidZ = ((wall.start[1] + wall.end[1]) / 2) * scale;
  const placedMidX = placement.start[0] + placement.direction[0] * (placement.length / 2);
  const placedMidZ = placement.start[1] + placement.direction[1] * (placement.length / 2);
  const outwardX = placedMidX - rawMidX;
  const outwardZ = placedMidZ - rawMidZ;
  const localPositiveZ = [-Math.sin(placement.angle), Math.cos(placement.angle)] as const;
  const dot = outwardX * localPositiveZ[0] + outwardZ * localPositiveZ[1];

  if (!Number.isFinite(dot) || Math.abs(dot) < 1e-5) {
    return 1;
  }

  return dot > 0 ? -1 : 1;
}

export function resolveTrimSegments(
  length: number,
  blockedRanges: { start: number; end: number }[]
): TrimSegment[] {
  if (!Number.isFinite(length) || length <= MIN_TRIM_SEGMENT_LENGTH) return [];

  const sortedRanges = blockedRanges
    .map((range) => ({
      start: Math.max(0, Math.min(length, range.start)),
      end: Math.max(0, Math.min(length, range.end))
    }))
    .filter((range) => range.end - range.start > MIN_BLOCKED_RANGE_LENGTH)
    .sort((left, right) => left.start - right.start);

  const segments: TrimSegment[] = [];
  let cursor = 0;

  sortedRanges.forEach((range) => {
    if (range.start - cursor > MIN_TRIM_SEGMENT_LENGTH) {
      segments.push({ start: cursor, length: range.start - cursor });
    }
    cursor = Math.max(cursor, range.end);
  });

  if (length - cursor > MIN_TRIM_SEGMENT_LENGTH) {
    segments.push({ start: cursor, length: length - cursor });
  }

  return segments;
}

function pointKey(point: readonly [number, number], scale: number) {
  const x = Math.round(point[0] * scale * POINT_KEY_PRECISION);
  const z = Math.round(point[1] * scale * POINT_KEY_PRECISION);
  return `${x}:${z}`;
}

export function resolveWallCornerCaps(walls: Wall[], scale: number): WallCornerCap[] {
  const corners = new Map<
    string,
    {
      position: [number, number];
      maxHeight: number;
      maxThickness: number;
    }
  >();

  walls.forEach((wall) => {
    const height = Math.max(0.8, (wall.height > 0 ? wall.height : 2.8) * scale);
    const thickness = Math.max(0.08, wall.thickness * scale);

    [wall.start, wall.end].forEach((point) => {
      const key = pointKey(point, scale);
      const existing = corners.get(key);
      if (existing) {
        existing.maxHeight = Math.max(existing.maxHeight, height);
        existing.maxThickness = Math.max(existing.maxThickness, thickness);
        return;
      }

      corners.set(key, {
        position: [point[0] * scale, point[1] * scale],
        maxHeight: height,
        maxThickness: thickness
      });
    });
  });

  return Array.from(corners.entries()).map(([id, corner]) => ({
    id,
    position: corner.position,
    height: corner.maxHeight,
    radius: Math.min(0.16, Math.max(0.06, corner.maxThickness * 0.58))
  }));
}
