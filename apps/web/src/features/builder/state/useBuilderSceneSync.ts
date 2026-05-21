import { useEffect } from "react";
import { deriveBlankRoomShell } from "../../../lib/domain/room-shell";
import { useCameraStore, useShellStore } from "../../../lib/stores/scene-slices";
import { useEditorStore, type EditorViewMode } from "../../../lib/stores/useEditorStore";
import type { LightingSettings, SceneAsset } from "../../../lib/stores/useSceneStore";

type BuilderPreviewMode = Extract<EditorViewMode, "top" | "builder-preview">;

type UseBuilderSceneSyncInput = {
  previewMode: BuilderPreviewMode;
  derivedRoomShell: ReturnType<typeof deriveBlankRoomShell>;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  lighting: LightingSettings;
  assets?: SceneAsset[];
};

export function useBuilderSceneSync({
  previewMode,
  derivedRoomShell,
  wallMaterialIndex,
  floorMaterialIndex,
  lighting,
  assets = []
}: UseBuilderSceneSyncInput) {
  const { setScene, resetScene } = useShellStore();
  const { setEntranceId } = useCameraStore();
  const applyShellPreset = useEditorStore((state) => state.applyShellPreset);
  const resetShellState = useEditorStore((state) => state.resetShellState);
  const setViewMode = useEditorStore((state) => state.setViewMode);

  useEffect(() => {
    applyShellPreset("viewer", {
      viewMode: "builder-preview"
    });

    return () => {
      resetShellState();
      resetScene();
    };
  }, [applyShellPreset, resetScene, resetShellState]);

  useEffect(() => {
    setViewMode(previewMode);
  }, [previewMode, setViewMode]);

  useEffect(() => {
    setScene({
      scale: derivedRoomShell.scale,
      scaleInfo: derivedRoomShell.scaleInfo,
      walls: derivedRoomShell.walls,
      openings: derivedRoomShell.openings,
      floors: derivedRoomShell.floors,
      ceilings: derivedRoomShell.ceilings,
      rooms: derivedRoomShell.rooms,
      cameraAnchors: derivedRoomShell.cameraAnchors,
      navGraph: derivedRoomShell.navGraph,
      assets,
      wallMaterialIndex,
      floorMaterialIndex,
      lighting
    });

    setEntranceId(derivedRoomShell.entranceId);
  }, [assets, derivedRoomShell, floorMaterialIndex, lighting, setEntranceId, setScene, wallMaterialIndex]);
}
