import { useShallow } from "zustand/react/shallow";
import {
  useSceneStore,
  type LightingSettings,
  type SceneAsset,
  type ScaleInfo,
  type Wall,
  type Opening,
  type Floor,
  type Ceiling,
  type RoomZone,
  type CameraAnchor,
  type NavGraph,
  type ProjectSnapshot,
  type MaterialRef
} from "./useSceneStore";

export type ShellSlice = {
  scale: number;
  scaleInfo: ScaleInfo;
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
  ceilings: Ceiling[];
  rooms: RoomZone[];
  cameraAnchors: CameraAnchor[];
  navGraph: NavGraph;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  ceilingMaterialIndex: number;
  lighting: LightingSettings;
  setWalls: (walls: Wall[]) => void;
  setOpenings: (openings: Opening[]) => void;
  setFloors: (floors: Floor[]) => void;
  setCeilings: (ceilings: Ceiling[]) => void;
  setRooms: (rooms: RoomZone[]) => void;
  setCameraAnchors: (cameraAnchors: CameraAnchor[]) => void;
  setNavGraph: (navGraph: NavGraph) => void;
  setScale: (scale: number, scaleInfo?: ScaleInfo) => void;
  setScaleInfo: (scaleInfo: ScaleInfo) => void;
  setWallMaterialIndex: (index: number) => void;
  setFloorMaterialIndex: (index: number) => void;
  setCeilingMaterialIndex: (index: number) => void;
  setLighting: (lighting: Partial<LightingSettings>) => void;
  setScene: (scene: any) => void;
  resetScene: () => void;
};

export type AssetSlice = {
  assets: SceneAsset[];
  materials: Record<string, MaterialRef>;
  setAssets: (assets: SceneAsset[]) => void;
  addFurniture: (asset: Omit<SceneAsset, "id"> & { id?: string }) => void;
  updateFurniture: (id: string, updates: Partial<SceneAsset>) => void;
  removeFurniture: (id: string) => void;
  upsertMaterial: (material: MaterialRef) => void;
};

export type SelectionSlice = {
  selectedAssetId: string | null;
  setSelectedAssetId: (id: string | null) => void;
};

export type CameraSlice = {
  entranceId: string | null;
  setEntranceId: (id: string | null) => void;
};

export type PublishSlice = {
  versionHistory: {
    snapshots: ProjectSnapshot[];
    currentIndex: number;
  };
  lastSnapshotTime: number;
  initializeHistory: (label?: string) => void;
  recordSnapshot: (label?: string) => void;
  createSnapshot: (label?: string) => void;
  undo: () => void;
  redo: () => void;
  restoreSnapshot: (id: string) => void;
};

type SceneStoreState = ReturnType<typeof useSceneStore.getState>;

const selectShellSlice = (state: SceneStoreState): ShellSlice => ({
  scale: state.scale,
  scaleInfo: state.scaleInfo,
  walls: state.walls,
  openings: state.openings,
  floors: state.floors,
  ceilings: state.ceilings,
  rooms: state.rooms,
  cameraAnchors: state.cameraAnchors,
  navGraph: state.navGraph,
  wallMaterialIndex: state.wallMaterialIndex,
  floorMaterialIndex: state.floorMaterialIndex,
  ceilingMaterialIndex: state.ceilingMaterialIndex,
  lighting: state.lighting,
  setWalls: state.setWalls,
  setOpenings: state.setOpenings,
  setFloors: state.setFloors,
  setCeilings: state.setCeilings,
  setRooms: state.setRooms,
  setCameraAnchors: state.setCameraAnchors,
  setNavGraph: state.setNavGraph,
  setScale: state.setScale,
  setScaleInfo: state.setScaleInfo,
  setWallMaterialIndex: state.setWallMaterialIndex,
  setFloorMaterialIndex: state.setFloorMaterialIndex,
  setCeilingMaterialIndex: state.setCeilingMaterialIndex,
  setLighting: state.setLighting,
  setScene: state.setScene,
  resetScene: state.resetScene
});

const selectAssetSlice = (state: SceneStoreState): AssetSlice => ({
  assets: state.assets,
  materials: state.materials,
  setAssets: state.setAssets,
  addFurniture: state.addFurniture,
  updateFurniture: state.updateFurniture,
  removeFurniture: state.removeFurniture,
  upsertMaterial: state.upsertMaterial
});

const selectSelectionSlice = (state: SceneStoreState): SelectionSlice => ({
  selectedAssetId: state.selectedAssetId,
  setSelectedAssetId: state.setSelectedAssetId
});

const selectCameraSlice = (state: SceneStoreState): CameraSlice => ({
  entranceId: state.entranceId,
  setEntranceId: state.setEntranceId
});

const selectPublishSlice = (state: SceneStoreState): PublishSlice => ({
  versionHistory: state.versionHistory,
  lastSnapshotTime: state.lastSnapshotTime,
  initializeHistory: state.initializeHistory,
  recordSnapshot: state.recordSnapshot,
  createSnapshot: state.createSnapshot,
  undo: state.undo,
  redo: state.redo,
  restoreSnapshot: state.restoreSnapshot
});

export function useShellStore() {
  return useSceneStore(useShallow(selectShellSlice));
}

export function useShellSelector<T>(selector: (slice: ShellSlice) => T) {
  return useSceneStore((state) => selector(selectShellSlice(state)));
}

export function useAssetStore() {
  return useSceneStore(useShallow(selectAssetSlice));
}

export function useAssetSelector<T>(selector: (slice: AssetSlice) => T) {
  return useSceneStore((state) => selector(selectAssetSlice(state)));
}

export function useSelectionStore() {
  return useSceneStore(useShallow(selectSelectionSlice));
}

export function useSelectionSelector<T>(selector: (slice: SelectionSlice) => T) {
  return useSceneStore((state) => selector(selectSelectionSlice(state)));
}

export function useCameraStore() {
  return useSceneStore(useShallow(selectCameraSlice));
}

export function useCameraSelector<T>(selector: (slice: CameraSlice) => T) {
  return useSceneStore((state) => selector(selectCameraSlice(state)));
}

export function usePublishStore() {
  return useSceneStore(useShallow(selectPublishSlice));
}

export function usePublishSelector<T>(selector: (slice: PublishSlice) => T) {
  return useSceneStore((state) => selector(selectPublishSlice(state)));
}
