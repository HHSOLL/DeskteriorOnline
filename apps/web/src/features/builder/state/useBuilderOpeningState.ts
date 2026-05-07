import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Opening, Wall } from "../../../lib/stores/useSceneStore";
import {
  clamp,
  createOpeningId,
  getDoorWidthByStyle,
  getOpeningPlacementIssues,
  getWallLength,
  getWindowWidthByStyle,
  normalizeOpenings,
  reassignOpeningToWall,
  remapOpeningsToWalls,
  tuneOpenings,
  type OpeningPlacementIssue
} from "../logic/openings";
import type { DoorStyle, WindowStyle } from "../types";

type UseBuilderOpeningStateInput = {
  walls: Wall[];
  templateOpenings: Opening[];
  doorStyle: DoorStyle;
  windowStyle: WindowStyle;
  addSecondaryWindow: boolean;
};

export function useBuilderOpeningState({
  walls,
  templateOpenings,
  doorStyle,
  windowStyle,
  addSecondaryWindow
}: UseBuilderOpeningStateInput) {
  const [openingDrafts, setOpeningDrafts] = useState<Opening[]>([]);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [placementIssue, setPlacementIssue] = useState<OpeningPlacementIssue | null>(null);

  const openingDraftsRef = useRef<Opening[]>([]);
  const previousWallSignatureRef = useRef<string | null>(null);
  const previousStyleSignatureRef = useRef<string | null>(null);
  const previousWallsRef = useRef<Wall[]>(walls);

  const wallSignature = useMemo(
    () =>
      walls
        .map(
          (wall) =>
            `${wall.id}:${wall.start[0].toFixed(3)},${wall.start[1].toFixed(3)}-${wall.end[0].toFixed(3)},${wall.end[1].toFixed(3)}`
        )
        .join("|"),
    [walls]
  );

  useEffect(() => {
    openingDraftsRef.current = openingDrafts;
  }, [openingDrafts]);

  const styleSignature = `${doorStyle}:${windowStyle}:${addSecondaryWindow ? "1" : "0"}`;

  useEffect(() => {
    const wallSignatureChanged = previousWallSignatureRef.current !== wallSignature;
    const styleSignatureChanged = previousStyleSignatureRef.current !== styleSignature;
    if (!wallSignatureChanged && !styleSignatureChanged) return;

    previousWallSignatureRef.current = wallSignature;
    previousStyleSignatureRef.current = styleSignature;
    const previousWalls = previousWallsRef.current;
    const hasDrafts = openingDraftsRef.current.length > 0;

    const sourceOpenings =
      wallSignatureChanged && hasDrafts && previousWalls.length > 0
        ? remapOpeningsToWalls(openingDraftsRef.current, previousWalls, walls)
        : hasDrafts
          ? openingDraftsRef.current
          : templateOpenings;

    const nextDrafts = normalizeOpenings(
      tuneOpenings(sourceOpenings, walls, {
        doorStyle,
        windowStyle,
        addSecondaryWindow
      }),
      walls
    );

    setOpeningDrafts(nextDrafts);
    setSelectedOpeningId((current) =>
      current && nextDrafts.some((opening) => opening.id === current) ? current : nextDrafts[0]?.id ?? null
    );
    setSelectedWallId((current) => {
      if (current && walls.some((wall) => wall.id === current)) {
        return current;
      }
      return nextDrafts[0]?.wallId ?? walls[0]?.id ?? null;
    });
    previousWallsRef.current = walls;
  }, [addSecondaryWindow, doorStyle, styleSignature, templateOpenings, wallSignature, walls, windowStyle]);

  const openings = useMemo(() => normalizeOpenings(openingDrafts, walls), [openingDrafts, walls]);
  const selectedOpening = useMemo(
    () => openings.find((opening) => opening.id === selectedOpeningId) ?? null,
    [openings, selectedOpeningId]
  );
  const selectedOpeningWall = useMemo(
    () => walls.find((wall) => wall.id === selectedOpening?.wallId) ?? null,
    [walls, selectedOpening?.wallId]
  );
  const selectedWallOpenings = useMemo(
    () => openings.filter((opening) => opening.wallId === selectedWallId),
    [openings, selectedWallId]
  );

  useEffect(() => {
    if (!selectedOpeningId) return;
    const nextOpening = openings.find((opening) => opening.id === selectedOpeningId);
    if (!nextOpening) return;
    if (nextOpening.wallId !== selectedWallId) {
      setSelectedWallId(nextOpening.wallId);
    }
  }, [openings, selectedOpeningId, selectedWallId]);

  useEffect(() => {
    if (!selectedWallId) return;
    const selectedOnCurrentWall = selectedOpeningId
      ? openings.some((opening) => opening.id === selectedOpeningId && opening.wallId === selectedWallId)
      : false;
    if (selectedOnCurrentWall) return;
    setSelectedOpeningId(openings.find((opening) => opening.wallId === selectedWallId)?.id ?? null);
  }, [openings, selectedOpeningId, selectedWallId]);

  const setOpeningPatch = useCallback(
    (openingId: string, patch: Partial<Opening>) => {
      setOpeningDrafts((current) => {
        const nextDrafts = current.map((opening) =>
          opening.id === openingId
            ? patch.wallId && patch.wallId !== opening.wallId
              ? {
                  ...reassignOpeningToWall(opening, patch.wallId, walls),
                  ...patch
                }
              : {
                  ...opening,
                  ...patch
                }
            : opening
        );
        const blockingIssue =
          getOpeningPlacementIssues(nextDrafts, walls).find((issue) => issue.openingId === openingId) ?? null;
        if (blockingIssue) {
          setPlacementIssue(blockingIssue);
          return current;
        }
        setPlacementIssue(null);
        return normalizeOpenings(nextDrafts, walls);
      });
      setSelectedOpeningId(openingId);
      if (patch.wallId && walls.some((wall) => wall.id === patch.wallId)) {
        setSelectedWallId(patch.wallId);
      }
    },
    [walls]
  );

  const setEntranceOpening = useCallback(
    (openingId: string) => {
      setOpeningDrafts((current) =>
        normalizeOpenings(
          current.map((opening) =>
            opening.type === "door" ? { ...opening, isEntrance: opening.id === openingId } : opening
          ),
          walls
        )
      );
    },
    [walls]
  );

  const deleteOpening = useCallback(
    (openingId: string) => {
      setOpeningDrafts((current) =>
        normalizeOpenings(
          current.filter((opening) => opening.id !== openingId),
          walls
        )
      );
      setPlacementIssue(null);
      setSelectedOpeningId((current) => (current === openingId ? null : current));
    },
    [walls]
  );

  const addOpening = useCallback(
    (type: "door" | "window") => {
      const targetWall = walls.find((wall) => wall.id === selectedWallId) ?? walls[0];

      if (!targetWall) {
        return null;
      }

      const wallLength = getWallLength(targetWall);
      const width = type === "door" ? getDoorWidthByStyle(doorStyle) : getWindowWidthByStyle(windowStyle);
      const minMargin = type === "door" ? 0.38 : 0.32;
      const clampedWidth = Math.min(width, Math.max(type === "door" ? 0.72 : 0.92, wallLength - minMargin * 2));
      const nextOpening: Opening = {
        id: createOpeningId(type),
        wallId: targetWall.id,
        type,
        offset: clamp(wallLength * 0.25, minMargin, Math.max(minMargin, wallLength - clampedWidth - minMargin)),
        width: clampedWidth,
        height: type === "door" ? 2.1 : 1.3,
        ...(type === "door"
          ? { isEntrance: openings.filter((opening) => opening.type === "door").length === 0 }
          : { sillHeight: 0.9 })
      };

      const nextDrafts = [...openings, nextOpening];
      const blockingIssue =
        getOpeningPlacementIssues(nextDrafts, walls).find((issue) => issue.openingId === nextOpening.id) ?? null;
      if (blockingIssue) {
        setPlacementIssue(blockingIssue);
        return null;
      }

      setPlacementIssue(null);
      setOpeningDrafts(() => normalizeOpenings(nextDrafts, walls));
      setSelectedWallId(targetWall.id);
      setSelectedOpeningId(nextOpening.id);

      return nextOpening.id;
    },
    [doorStyle, openings, selectedWallId, walls, windowStyle]
  );

  const replaceOpenings = useCallback(
    (nextOpenings: Opening[]) => {
      setOpeningDrafts(normalizeOpenings(nextOpenings, walls));
      setPlacementIssue(null);
      setSelectedOpeningId(nextOpenings[0]?.id ?? null);
      setSelectedWallId(nextOpenings[0]?.wallId ?? walls[0]?.id ?? null);
    },
    [walls]
  );

  return {
    openings,
    selectedOpeningId,
    selectedWallId,
    selectedOpening,
    selectedOpeningWall,
    selectedWallOpenings,
    placementIssue,
    hasInvalidOpenings: Boolean(placementIssue),
    setSelectedOpeningId,
    setSelectedWallId,
    setOpeningPatch,
    setEntranceOpening,
    deleteOpening,
    addOpening,
    replaceOpenings
  };
}
