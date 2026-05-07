import type { Opening, Wall } from "../../../lib/stores/useSceneStore";
import type { DoorStyle, WindowStyle } from "../types";

export const OPENING_EDGE_MARGIN = 0.32;
export const DOOR_EDGE_MARGIN = 0.38;
export const OPENING_GAP = 0.08;

export type OpeningPlacementIssueCode =
  | "WALL_MISSING"
  | "EDGE_CLEARANCE"
  | "OPENING_OVERLAP";

export type OpeningPlacementIssue = {
  code: OpeningPlacementIssueCode;
  openingId: string;
  wallId: string | null;
  message: string;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function getWallLength(wall: Wall) {
  return Math.hypot(wall.end[0] - wall.start[0], wall.end[1] - wall.start[1]);
}

export function createOpeningId(type: "door" | "window") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `opening-${type}-${crypto.randomUUID()}`;
  }
  return `opening-${type}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getDoorWidthByStyle(style: DoorStyle) {
  if (style === "double") return 1.4;
  if (style === "french") return 1.6;
  return 0.92;
}

export function getWindowWidthByStyle(style: WindowStyle) {
  return style === "wide" ? 2.4 : 1.8;
}

function getOpeningMargin(opening: Pick<Opening, "type">) {
  return opening.type === "door" ? DOOR_EDGE_MARGIN : OPENING_EDGE_MARGIN;
}

function getOpeningMinWidth(opening: Pick<Opening, "type">) {
  return opening.type === "door" ? 0.72 : 0.92;
}

function resolveOpeningCenterRatio(opening: Opening, wallLength: number) {
  const safeLength = Math.max(wallLength, 0.01);
  return (opening.offset + opening.width / 2) / safeLength;
}

function ensureSingleEntranceDoor(openings: Opening[]) {
  const doors = openings.filter((opening) => opening.type === "door");
  if (doors.length === 0) return openings;
  const entranceId = doors.find((opening) => opening.isEntrance)?.id ?? doors[0]?.id;
  return openings.map((opening) =>
    opening.type === "door" ? { ...opening, isEntrance: opening.id === entranceId } : opening
  );
}

function sanitizeOpeningForWalls(opening: Opening, walls: Wall[]): Opening | null {
  if (walls.length === 0) return null;
  const wall = walls.find((candidate) => candidate.id === opening.wallId) ?? walls[0];
  if (!wall) return null;

  const wallLength = getWallLength(wall);
  const margin = getOpeningMargin(opening);
  const minWidth = getOpeningMinWidth(opening);
  const maxWidth = Math.max(minWidth, wallLength - margin * 2);
  const width = clamp(opening.width, minWidth, maxWidth);
  const maxOffset = Math.max(margin, wallLength - width - margin);
  const offset = clamp(opening.offset, margin, maxOffset);

  if (opening.type === "door") {
    return {
      ...opening,
      wallId: wall.id,
      width,
      offset,
      height: clamp(opening.height, 1.9, 2.4),
      verticalOffset: clamp(opening.verticalOffset ?? 0, 0, 0.42),
      sillHeight: undefined,
      isEntrance: Boolean(opening.isEntrance)
    };
  }

  return {
    ...opening,
    wallId: wall.id,
    width,
    offset,
    height: clamp(opening.height, 0.82, 2.1),
    verticalOffset: undefined,
    sillHeight: clamp(opening.sillHeight ?? 0.9, 0.25, 1.45),
    isEntrance: false
  };
}

export function reassignOpeningToWall(opening: Opening, nextWallId: string, walls: Wall[]) {
  const currentWall = walls.find((wall) => wall.id === opening.wallId);
  const nextWall = walls.find((wall) => wall.id === nextWallId) ?? currentWall ?? walls[0];

  if (!nextWall) {
    return opening;
  }

  const previousLength = currentWall ? getWallLength(currentWall) : getWallLength(nextWall);
  const nextLength = getWallLength(nextWall);
  const centerRatio = resolveOpeningCenterRatio(opening, previousLength);
  const margin = getOpeningMargin(opening);
  const minWidth = getOpeningMinWidth(opening);
  const width = clamp(opening.width, minWidth, Math.max(minWidth, nextLength - margin * 2));
  const offset = centerRatio * nextLength - width / 2;

  return {
    ...opening,
    wallId: nextWall.id,
    width,
    offset
  };
}

export function resolveWallOpeningOverlaps(openings: Opening[], walls: Wall[]) {
  const byWall = new Map<string, Opening[]>();

  openings.forEach((opening) => {
    const entries = byWall.get(opening.wallId) ?? [];
    entries.push(opening);
    byWall.set(opening.wallId, entries);
  });

  const resolved: Opening[] = [];

  walls.forEach((wall) => {
    const wallOpenings = byWall.get(wall.id);
    if (!wallOpenings || wallOpenings.length === 0) return;
    const wallLength = getWallLength(wall);
    let cursor = -Infinity;

    [...wallOpenings]
      .sort((a, b) => a.offset - b.offset)
      .forEach((opening) => {
        const margin = getOpeningMargin(opening);
        const minWidth = getOpeningMinWidth(opening);
        let width = clamp(opening.width, minWidth, Math.max(minWidth, wallLength - margin * 2));
        const minStart = Math.max(margin, Number.isFinite(cursor) ? cursor + OPENING_GAP : margin);
        let maxStart = wallLength - width - margin;

        if (maxStart < minStart) {
          const fitWidth = wallLength - margin - minStart;
          if (fitWidth < minWidth) {
            return;
          }
          width = fitWidth;
          maxStart = minStart;
        }

        const offset = clamp(opening.offset, minStart, maxStart);
        cursor = offset + width;
        resolved.push({
          ...opening,
          width,
          offset
        });
      });
  });

  return resolved;
}

export function getOpeningPlacementIssues(openings: Opening[], walls: Wall[]) {
  const issues: OpeningPlacementIssue[] = [];
  const byWall = new Map<string, Opening[]>();

  openings.forEach((opening) => {
    const wall = walls.find((candidate) => candidate.id === opening.wallId);
    if (!wall) {
      issues.push({
        code: "WALL_MISSING",
        openingId: opening.id,
        wallId: opening.wallId,
        message: "선택한 벽을 찾을 수 없습니다."
      });
      return;
    }

    const wallLength = getWallLength(wall);
    const margin = getOpeningMargin(opening);
    if (opening.offset < margin || opening.offset + opening.width > wallLength - margin) {
      issues.push({
        code: "EDGE_CLEARANCE",
        openingId: opening.id,
        wallId: opening.wallId,
        message: "문/창문이 벽 모서리에 너무 가깝습니다."
      });
    }

    const entries = byWall.get(opening.wallId) ?? [];
    entries.push(opening);
    byWall.set(opening.wallId, entries);
  });

  byWall.forEach((wallOpenings, wallId) => {
    const sorted = [...wallOpenings].sort((a, b) => a.offset - b.offset);
    sorted.forEach((opening, index) => {
      const next = sorted[index + 1];
      if (!next) return;
      if (opening.offset + opening.width + OPENING_GAP > next.offset) {
        issues.push({
          code: "OPENING_OVERLAP",
          openingId: next.id,
          wallId,
          message: "문/창문끼리 겹치거나 필요한 간격이 부족합니다."
        });
      }
    });
  });

  return issues;
}

export function normalizeOpenings(openings: Opening[], walls: Wall[]) {
  const normalized = openings
    .map((opening) => sanitizeOpeningForWalls(opening, walls))
    .filter((opening): opening is Opening => Boolean(opening));
  return ensureSingleEntranceDoor(resolveWallOpeningOverlaps(normalized, walls));
}

export function remapOpeningsToWalls(openings: Opening[], previousWalls: Wall[], nextWalls: Wall[]) {
  if (nextWalls.length === 0) return [];

  return openings.map((opening) => {
    const previousWall = previousWalls.find((wall) => wall.id === opening.wallId);
    const previousIndex = previousWall ? previousWalls.findIndex((wall) => wall.id === previousWall.id) : -1;
    const targetWall =
      (previousIndex >= 0 ? nextWalls[previousIndex] : null) ??
      nextWalls.find((wall) => wall.id === opening.wallId) ??
      nextWalls[0];

    if (!targetWall) return opening;

    const previousLength = Math.max(previousWall ? getWallLength(previousWall) : getWallLength(targetWall), 0.01);
    const nextLength = getWallLength(targetWall);
    const centerRatio = resolveOpeningCenterRatio(opening, previousLength);

    return {
      ...opening,
      wallId: targetWall.id,
      offset: centerRatio * nextLength - opening.width / 2
    };
  });
}

export function tuneOpenings(
  openings: Opening[],
  walls: Wall[],
  options: {
    doorStyle: DoorStyle;
    windowStyle: WindowStyle;
    addSecondaryWindow: boolean;
  }
) {
  const tuned = openings.map((opening) => {
    if (opening.type === "door") {
      return {
        ...opening,
        width: getDoorWidthByStyle(options.doorStyle)
      };
    }

    return {
      ...opening,
      width: getWindowWidthByStyle(options.windowStyle)
    };
  });

  if (!options.addSecondaryWindow) {
    const windows = tuned.filter((opening) => opening.type === "window");
    if (windows.length <= 1) {
      return tuned;
    }
    const keepWindowId = windows[0]?.id;
    return tuned.filter((opening) => opening.type !== "window" || opening.id === keepWindowId);
  }

  const windowCount = tuned.filter((opening) => opening.type === "window").length;
  if (windowCount >= 2 || walls.length < 2) {
    return tuned;
  }

  const primaryWindow = tuned.find((opening) => opening.type === "window");
  const secondaryWall = walls.find((wall) => wall.id !== primaryWindow?.wallId) ?? walls[1] ?? walls[0];

  if (!secondaryWall) {
    return tuned;
  }

  const wallLength = getWallLength(secondaryWall);
  const baseWidth = options.windowStyle === "wide" ? 2.2 : 1.6;
  const width = Math.min(baseWidth, Math.max(1.2, wallLength - 0.9));
  const margin = 0.36;

  tuned.push({
    id: createOpeningId("window"),
    wallId: secondaryWall.id,
    type: "window",
    offset: clamp(wallLength * 0.28, margin, Math.max(margin, wallLength - width - margin)),
    width,
    height: 1.3,
    sillHeight: 0.9
  });

  return tuned;
}
