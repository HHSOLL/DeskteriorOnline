import { create } from "zustand";
import type {
  ProductCollisionProxyMetadata,
  ProductContractMetadata,
  ProductDimensionsMm,
  ProductLicenseMetadata,
  ProductLodProfileMetadata,
  ProductPhysicalMetadata,
  ProductPivotMetadata,
  ProductSourceMetadata,
  ProductTextureSetMetadata
} from "../builder/catalog";
import { normalizeSceneAnchorType, type SceneAnchorType } from "../scene/anchor-types";
import { constrainPlacementToAnchor } from "../scene/anchors";
import {
  normalizeAssetSupportProfile,
  type AssetSupportProfile
} from "../scene/support-profiles";
import type { PlacementRecord } from "@deskterioronline/scene-schema";

export type Vector2 = [number, number];
export type Vector3 = [number, number, number];
export type ScaleSource = "ocr_dimension" | "door_heuristic" | "user_measure" | "unknown";

export type ScaleEvidence = {
  mmValue?: number;
  pxDistance?: number;
  p1?: Vector2;
  p2?: Vector2;
  ocrText?: string;
  ocrBox?: { x: number; y: number; w: number; h: number };
  notes?: string;
};

export type ScaleInfo = {
  value: number;
  source: ScaleSource;
  confidence: number;
  evidence?: ScaleEvidence;
};

export type Wall = {
  id: string;
  start: Vector2;
  end: Vector2;
  thickness: number;
  height: number;
  confidence?: number;
  type?: "exterior" | "interior" | "balcony" | "column";
  isPartOfBalcony?: boolean;
};

export type RoomType =
  | "living_room"
  | "bedroom"
  | "kitchen"
  | "dining"
  | "bathroom"
  | "foyer"
  | "corridor"
  | "balcony"
  | "utility"
  | "pantry"
  | "dress_room"
  | "alpha_room"
  | "service_area"
  | "evacuation_space"
  | "other";

export type Opening = {
  id: string;
  wallId: string;
  type: "door" | "window";
  offset: number;
  width: number;
  height: number;
  verticalOffset?: number;
  sillHeight?: number;
  isEntrance?: boolean;
  detectConfidence?: number;
  attachConfidence?: number;
  typeConfidence?: number;
};

export type Floor = {
  id: string;
  outline: Vector2[];
  materialId: string | null;
  roomId?: string | null;
  roomType?: RoomType;
  label?: string;
};

export type Ceiling = {
  id: string;
  outline: Vector2[];
  materialId: string | null;
  roomId?: string | null;
  roomType?: RoomType;
  height: number;
};

export type RoomZone = {
  id: string;
  roomType: RoomType;
  label: string;
  polygon: Vector2[];
  area: number;
  center: Vector2;
  openingIds: string[];
  connectedRoomIds: string[];
  estimatedCeilingHeight: number;
  estimatedUsage: "primary" | "secondary" | "service";
  isExteriorFacing: boolean;
};

export type CameraAnchor = {
  id: string;
  kind: "entrance" | "room_center" | "overview";
  roomId: string | null;
  openingId: string | null;
  planPosition: Vector2;
  targetPlanPosition: Vector2;
  height: number;
};

export type NavGraphNode = {
  id: string;
  roomId: string | null;
  kind: "entrance" | "room_center";
  planPosition: Vector2;
};

export type NavGraphEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: "door" | "passage" | "entrance";
  openingId: string;
};

export type NavGraph = {
  nodes: NavGraphNode[];
  edges: NavGraphEdge[];
};

export type SceneAsset = {
  id: string;
  assetId: string;
  catalogItemId?: string | null;
  visible?: boolean;
  placement?: PlacementRecord | null;
  product?: {
    id: string;
    name: string;
    category: string;
    brand?: string | null;
    price?: string | null;
    options?: string | null;
    externalUrl?: string | null;
    thumbnail?: string | null;
  } & ProductPhysicalMetadata &
    ProductContractMetadata | null;
  anchorType?: SceneAnchorType;
  supportAssetId?: string | null;
  supportProfile?: AssetSupportProfile | null;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  materialId: string | null;
};

export type MaterialRef = {
  id: string;
  name: string;
  type: "floor" | "wall" | "ceiling" | "asset";
};

export type LightingSettings = {
  mode: "direct" | "indirect";
  ambientIntensity: number;
  hemisphereIntensity: number;
  directionalIntensity: number;
  environmentBlur: number;
  accentIntensity: number;
  beamOpacity: number;
};

export type Comment = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
};

export type Activity = {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
};

export type ProjectSnapshot = {
  id: string;
  timestamp: number;
  label: string;
  scale: number;
  scaleInfo: ScaleInfo;
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
  ceilings: Ceiling[];
  rooms: RoomZone[];
  cameraAnchors: CameraAnchor[];
  navGraph: NavGraph;
  assets: SceneAsset[];
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  lighting: LightingSettings;
};

export type VersionHistory = {
  snapshots: ProjectSnapshot[];
  currentIndex: number;
};

type SceneDataState = {
  scale: number;
  scaleInfo: ScaleInfo;
  walls: Wall[];
  openings: Opening[];
  floors: Floor[];
  ceilings: Ceiling[];
  rooms: RoomZone[];
  cameraAnchors: CameraAnchor[];
  navGraph: NavGraph;
  assets: SceneAsset[];
  materials: Record<string, MaterialRef>;
  wallMaterialIndex: number;
  floorMaterialIndex: number;
  lighting: LightingSettings;
  selectedAssetId: string | null;
  entranceId: string | null;
  commentsByAsset: Record<string, Comment[]>;
  activities: Activity[];
  versionHistory: VersionHistory;
  lastSnapshotTime: number;
};

type SceneState = SceneDataState & {
  setWalls: (walls: Wall[]) => void;
  setOpenings: (openings: Opening[]) => void;
  setFloors: (floors: Floor[]) => void;
  setCeilings: (ceilings: Ceiling[]) => void;
  setRooms: (rooms: RoomZone[]) => void;
  setCameraAnchors: (cameraAnchors: CameraAnchor[]) => void;
  setNavGraph: (navGraph: NavGraph) => void;
  setAssets: (assets: SceneAsset[]) => void;
  setScale: (scale: number, scaleInfo?: ScaleInfo) => void;
  setScaleInfo: (scaleInfo: ScaleInfo) => void;
  setWallMaterialIndex: (index: number) => void;
  setFloorMaterialIndex: (index: number) => void;
  setLighting: (lighting: Partial<LightingSettings>) => void;
  setSelectedAssetId: (id: string | null) => void;
  setEntranceId: (id: string | null) => void;
  addFurniture: (asset: Omit<SceneAsset, "id"> & { id?: string }) => void;
  updateFurniture: (id: string, updates: Partial<SceneAsset>) => void;
  removeFurniture: (id: string) => void;
  upsertMaterial: (material: MaterialRef) => void;
  addComment: (assetId: string, comment: Comment) => void;
  logActivity: (userId: string, action: string) => void;
  initializeHistory: (label?: string) => void;
  recordSnapshot: (label?: string) => void;
  createSnapshot: (label?: string) => void;
  undo: () => void;
  redo: () => void;
  restoreSnapshot: (id: string) => void;
  setScene: (scene: Partial<SceneDataState>) => void;
  resetScene: () => void;
};

const makeUnknownScaleInfo = (value = 1): ScaleInfo => ({
  value,
  source: "unknown",
  confidence: 0,
  evidence: {
    notes: "Scale has not been calibrated."
  }
});

const DEFAULT_LIGHTING: LightingSettings = {
  mode: "direct",
  ambientIntensity: 0.44,
  hemisphereIntensity: 0.54,
  directionalIntensity: 1.24,
  environmentBlur: 0.14,
  accentIntensity: 0.82,
  beamOpacity: 0.18
};

const initialSceneState: SceneDataState = {
  scale: 1,
  scaleInfo: makeUnknownScaleInfo(1),
  walls: [],
  openings: [],
  floors: [],
  ceilings: [],
  rooms: [],
  cameraAnchors: [],
  navGraph: {
    nodes: [],
    edges: []
  },
  assets: [],
  materials: {},
  wallMaterialIndex: 0,
  floorMaterialIndex: 0,
  lighting: DEFAULT_LIGHTING,
  selectedAssetId: null,
  entranceId: null,
  commentsByAsset: {},
  activities: [],
  versionHistory: {
    snapshots: [],
    currentIndex: -1
  },
  lastSnapshotTime: 0
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `asset-${Math.random().toString(36).slice(2, 10)}`;
};

function normalizeSupportAssetId(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeProductText(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeProductUrl(value: unknown) {
  const normalized = normalizeProductText(value);
  if (!normalized) return null;
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  return null;
}

function normalizeProductBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return false;
}

function normalizeProductStrictBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
}

function normalizeProductDimensionValue(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function normalizeProductDimensions(value: unknown): ProductDimensionsMm | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const width = normalizeProductDimensionValue((value as ProductDimensionsMm).width);
  const depth = normalizeProductDimensionValue((value as ProductDimensionsMm).depth);
  const height = normalizeProductDimensionValue((value as ProductDimensionsMm).height);
  if (width === null || depth === null || height === null) {
    return null;
  }

  return { width, depth, height };
}

function normalizeProductPositiveInteger(value: unknown) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return typeof numeric === "number" && Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeProductSource(value: unknown): ProductSourceMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const kind =
    record.kind === "deskterioronline_blender" || record.kind === "open_source" ? record.kind : null;
  const name = normalizeProductText(record.name);
  const metadataPath = normalizeProductText(record.path);
  const url = normalizeProductUrl(record.url);
  if (!kind || !name || (!metadataPath && !url)) return null;
  return {
    kind,
    name,
    path: metadataPath,
    url
  };
}

function normalizeProductLicense(value: unknown): ProductLicenseMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const spdx = normalizeProductText(record.spdx);
  const label = normalizeProductText(record.label);
  const requiresAttribution = normalizeProductStrictBoolean(record.requiresAttribution);
  if (!spdx || !label || requiresAttribution === null) return null;
  return {
    spdx,
    label,
    requiresAttribution
  };
}

function normalizeProductPivot(value: unknown): ProductPivotMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const x = record.x === "left" || record.x === "center" || record.x === "right" ? record.x : null;
  const y = record.y === "floor" || record.y === "center" || record.y === "top" ? record.y : null;
  const z = record.z === "front" || record.z === "center" || record.z === "back" ? record.z : null;
  if (!x || !y || !z) return null;
  return { x, y, z };
}

function normalizeProductCollisionProxy(value: unknown): ProductCollisionProxyMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.kind !== "box" || record.derivesFrom !== "dimensionsMm") return null;
  return {
    kind: "box",
    derivesFrom: "dimensionsMm"
  };
}

function normalizeProductTextureSet(value: unknown): ProductTextureSetMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const workflow = record.workflow === "pbr_metallic_roughness" ? record.workflow : null;
  const authored =
    record.authored === "procedural" || record.authored === "image_based" ? record.authored : null;
  const ktx2Ready = normalizeProductStrictBoolean(record.ktx2Ready);
  if (!workflow || !authored || ktx2Ready === null) return null;
  return {
    workflow,
    authored,
    ktx2Ready
  };
}

function normalizeProductLodProfile(value: unknown): ProductLodProfileMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const strategy = record.strategy === "single_mesh" || record.strategy === "manual_lod" ? record.strategy : null;
  const levelCount = normalizeProductPositiveInteger(record.levelCount);
  const maxDrawCalls = normalizeProductPositiveInteger(record.maxDrawCalls);
  const maxTriangleCount = normalizeProductPositiveInteger(record.maxTriangleCount);
  if (!strategy || levelCount === null || maxDrawCalls === null || maxTriangleCount === null) return null;
  return {
    strategy,
    levelCount,
    maxDrawCalls,
    maxTriangleCount
  };
}

function normalizeSceneAssetProduct(product: SceneAsset["product"]) {
  if (!product || typeof product !== "object") return null;

  const id = normalizeProductText(product.id);
  const name = normalizeProductText(product.name);
  const category = normalizeProductText(product.category);
  if (!id || !name || !category) return null;

  return {
    id,
    name,
    category,
    brand: normalizeProductText(product.brand),
    price: normalizeProductText(product.price),
    options: normalizeProductText(product.options),
    externalUrl: normalizeProductUrl(product.externalUrl),
    thumbnail: normalizeProductUrl(product.thumbnail),
    dimensionsMm: normalizeProductDimensions(product.dimensionsMm),
    finishColor: normalizeProductText(product.finishColor),
    finishMaterial: normalizeProductText(product.finishMaterial),
    detailNotes: normalizeProductText(product.detailNotes),
    scaleLocked: normalizeProductBoolean(product.scaleLocked),
    source: normalizeProductSource(product.source),
    license: normalizeProductLicense(product.license),
    pivot: normalizeProductPivot(product.pivot),
    collisionProxy: normalizeProductCollisionProxy(product.collisionProxy),
    textureSet: normalizeProductTextureSet(product.textureSet),
    lodProfile: normalizeProductLodProfile(product.lodProfile)
  } satisfies NonNullable<SceneAsset["product"]>;
}

function normalizeSceneAsset(asset: SceneAsset): SceneAsset {
  return {
    ...asset,
    visible: asset.visible !== false,
    placement: asset.placement ?? null,
    catalogItemId: typeof asset.catalogItemId === "string" && asset.catalogItemId.length > 0 ? asset.catalogItemId : null,
    product: normalizeSceneAssetProduct(asset.product),
    anchorType: normalizeSceneAnchorType(asset.anchorType),
    supportAssetId: normalizeSupportAssetId(asset.supportAssetId),
    supportProfile: normalizeAssetSupportProfile(asset.supportProfile)
  };
}

function isSurfaceAnchor(anchorType: SceneAnchorType | undefined): boolean {
  return (
    anchorType === "desk_surface" ||
    anchorType === "shelf_surface" ||
    anchorType === "furniture_surface"
  );
}

function isScaleLockedProduct(product: SceneAsset["product"] | null | undefined) {
  return normalizeProductBoolean(product?.scaleLocked);
}

function reanchorDependentsForSupport(
  assets: SceneAsset[],
  supportId: string,
  context: {
    walls: Wall[];
    ceilings: Ceiling[];
    scale: number;
  }
) {
  if (!assets.some((asset) => asset.supportAssetId === supportId)) {
    return assets;
  }

  let nextAssets = assets;
  nextAssets.forEach((asset, index) => {
    if (asset.supportAssetId !== supportId || !isSurfaceAnchor(asset.anchorType)) {
      return;
    }

    const anchoredPlacement = constrainPlacementToAnchor(
      {
        position: asset.position,
        rotation: asset.rotation,
        anchorType: asset.anchorType,
        supportAssetId: asset.supportAssetId
      },
      {
        walls: context.walls,
        ceilings: context.ceilings,
        scale: context.scale,
        sceneAssets: nextAssets,
        activeAssetId: asset.id
      }
    );

    nextAssets = nextAssets.map((candidate, candidateIndex) =>
      candidateIndex === index
        ? normalizeSceneAsset({
            ...candidate,
            anchorType: anchoredPlacement.anchorType,
            supportAssetId: anchoredPlacement.supportAssetId,
            position: anchoredPlacement.position,
            rotation: anchoredPlacement.rotation
          })
        : candidate
    );
  });

  return nextAssets;
}

function buildSnapshot(
  state: SceneDataState,
  label?: string,
  timestamp = Date.now()
): ProjectSnapshot {
  return {
    id: `snapshot-${timestamp}`,
    timestamp,
    label: label ?? `Snapshot ${new Date(timestamp).toLocaleTimeString()}`,
    scale: state.scale,
    scaleInfo: state.scaleInfo,
    walls: state.walls,
    openings: state.openings,
    floors: state.floors,
    ceilings: state.ceilings,
    rooms: state.rooms,
    cameraAnchors: state.cameraAnchors,
    navGraph: state.navGraph,
    assets: state.assets,
    wallMaterialIndex: state.wallMaterialIndex,
    floorMaterialIndex: state.floorMaterialIndex,
    lighting: state.lighting
  };
}

function serializeSnapshot(snapshot: ProjectSnapshot) {
  return JSON.stringify({
    scale: snapshot.scale,
    scaleInfo: snapshot.scaleInfo,
    walls: snapshot.walls,
    openings: snapshot.openings,
    floors: snapshot.floors,
    ceilings: snapshot.ceilings,
    rooms: snapshot.rooms,
    cameraAnchors: snapshot.cameraAnchors,
    navGraph: snapshot.navGraph,
    assets: snapshot.assets,
    wallMaterialIndex: snapshot.wallMaterialIndex,
    floorMaterialIndex: snapshot.floorMaterialIndex,
    lighting: snapshot.lighting
  });
}

function applySnapshot(snapshot: ProjectSnapshot) {
  return {
    scale: snapshot.scale,
    scaleInfo: snapshot.scaleInfo ?? makeUnknownScaleInfo(snapshot.scale),
    walls: snapshot.walls,
    openings: snapshot.openings,
    floors: snapshot.floors,
    ceilings: snapshot.ceilings,
    rooms: snapshot.rooms,
    cameraAnchors: snapshot.cameraAnchors,
    navGraph: snapshot.navGraph,
    assets: snapshot.assets,
    wallMaterialIndex: snapshot.wallMaterialIndex,
    floorMaterialIndex: snapshot.floorMaterialIndex,
    lighting: snapshot.lighting ?? DEFAULT_LIGHTING
  };
}

function createEmptyNavGraph(): NavGraph {
  return {
    nodes: [],
    edges: []
  };
}

function createDerivedSceneReset() {
  return {
    ceilings: [] as Ceiling[],
    rooms: [] as RoomZone[],
    cameraAnchors: [] as CameraAnchor[],
    navGraph: createEmptyNavGraph()
  };
}

function resolveEntranceId(openings: Opening[]) {
  const entrance = openings.find((opening) => opening.isEntrance);
  return entrance?.id ?? null;
}

export const useSceneStore = create<SceneState>((set) => ({
  ...initialSceneState,
  setWalls: (walls) =>
    set((state) => ({
      walls,
      ...createDerivedSceneReset(),
      entranceId: resolveEntranceId(state.openings)
    })),
  setOpenings: (openings) =>
    set(() => ({
      openings,
      ...createDerivedSceneReset(),
      entranceId: resolveEntranceId(openings)
    })),
  setFloors: (floors) =>
    set((state) => ({
      floors,
      ...createDerivedSceneReset(),
      entranceId: resolveEntranceId(state.openings)
    })),
  setCeilings: (ceilings) => set({ ceilings }),
  setRooms: (rooms) => set({ rooms }),
  setCameraAnchors: (cameraAnchors) => set({ cameraAnchors }),
  setNavGraph: (navGraph) => set({ navGraph }),
  setAssets: (assets) => set({ assets: assets.map((asset) => normalizeSceneAsset(asset)) }),
  setScale: (scale, scaleInfo) =>
    set((state) => ({
      scale,
      scaleInfo: scaleInfo ? { ...scaleInfo, value: scale } : { ...state.scaleInfo, value: scale },
      ...createDerivedSceneReset()
    })),
  setScaleInfo: (scaleInfo) =>
    set(() => ({
      scale: scaleInfo.value,
      scaleInfo
    })),
  setWallMaterialIndex: (index) => set({ wallMaterialIndex: index }),
  setFloorMaterialIndex: (index) => set({ floorMaterialIndex: index }),
  setLighting: (lighting) =>
    set((state) => ({
      lighting: {
        ...state.lighting,
        ...lighting
      }
    })),
  setSelectedAssetId: (id) => set({ selectedAssetId: id }),
  setEntranceId: (id) => set({ entranceId: id }),
  addFurniture: (asset) =>
    set((state) => {
      const newAssets = [
        ...state.assets,
        normalizeSceneAsset({
          id: asset.id ?? createId(),
          assetId: asset.assetId,
          catalogItemId:
            typeof asset.catalogItemId === "string" && asset.catalogItemId.length > 0
              ? asset.catalogItemId
              : null,
          product: normalizeSceneAssetProduct(asset.product),
          anchorType: normalizeSceneAnchorType(asset.anchorType),
          supportAssetId: normalizeSupportAssetId(asset.supportAssetId),
          supportProfile: normalizeAssetSupportProfile(asset.supportProfile),
          position: asset.position,
          rotation: asset.rotation,
          scale: asset.scale,
          materialId: asset.materialId ?? null
        })
      ];
      return { assets: newAssets };
    }),
  updateFurniture: (id, updates) =>
    set((state) => {
      let nextAssets = state.assets.map((asset) =>
        asset.id === id
          ? (() => {
              const mergedProduct = normalizeSceneAssetProduct(updates.product ?? asset.product);
              const scaleLocked = isScaleLockedProduct(mergedProduct);

              return normalizeSceneAsset({
                ...asset,
                ...updates,
                product: mergedProduct,
                scale: scaleLocked ? asset.scale : (updates.scale ?? asset.scale),
                catalogItemId:
                  typeof (updates.catalogItemId ?? asset.catalogItemId) === "string" &&
                  (updates.catalogItemId ?? asset.catalogItemId)?.length
                    ? (updates.catalogItemId ?? asset.catalogItemId)
                    : null,
                anchorType: normalizeSceneAnchorType(updates.anchorType ?? asset.anchorType),
                supportAssetId:
                  updates.supportAssetId !== undefined
                    ? normalizeSupportAssetId(updates.supportAssetId)
                    : asset.supportAssetId,
                supportProfile:
                  updates.supportProfile !== undefined
                    ? normalizeAssetSupportProfile(updates.supportProfile)
                    : asset.supportProfile ?? null
              });
            })()
          : asset
      );

      nextAssets = reanchorDependentsForSupport(nextAssets, id, {
        walls: state.walls,
        ceilings: state.ceilings,
        scale: state.scale
      });

      return { assets: nextAssets };
    }),
  removeFurniture: (id) =>
    set((state) => {
      const remainingAssets = state.assets.filter((asset) => asset.id !== id);
      const nextAssets = remainingAssets.map((asset) => {
        if (asset.supportAssetId !== id || !isSurfaceAnchor(asset.anchorType)) {
          return asset;
        }

        const anchoredPlacement = constrainPlacementToAnchor(
          {
            position: asset.position,
            rotation: asset.rotation,
            anchorType: asset.anchorType,
            supportAssetId: null
          },
          {
            walls: state.walls,
            ceilings: state.ceilings,
            scale: state.scale,
            sceneAssets: remainingAssets,
            activeAssetId: asset.id
          }
        );

        return normalizeSceneAsset({
          ...asset,
          anchorType: anchoredPlacement.anchorType,
          supportAssetId: anchoredPlacement.supportAssetId,
          position: anchoredPlacement.position,
          rotation: anchoredPlacement.rotation
        });
      });

      return {
        assets: nextAssets,
        selectedAssetId: state.selectedAssetId === id ? null : state.selectedAssetId
      };
    }),
  upsertMaterial: (material) =>
    set((state) => ({
      materials: { ...state.materials, [material.id]: material }
    })),
  addComment: (assetId, comment) =>
    set((state) => ({
      commentsByAsset: {
        ...state.commentsByAsset,
        [assetId]: [...(state.commentsByAsset[assetId] ?? []), comment]
      }
    })),
  logActivity: (userId, action) =>
    set((state) => ({
      activities: [
        {
          id: createId(),
          userId,
          action,
          timestamp: new Date().toISOString()
        },
        ...state.activities
      ].slice(0, 50)
    })),
  initializeHistory: (label) =>
    set((state) => {
      const timestamp = Date.now();
      const snapshot = buildSnapshot(state, label ?? "Session start", timestamp);
      return {
        versionHistory: {
          snapshots: [snapshot],
          currentIndex: 0
        },
        lastSnapshotTime: timestamp
      };
    }),
  recordSnapshot: (label) =>
    set((state) => {
      const timestamp = Date.now();
      const snapshot = buildSnapshot(state, label, timestamp);
      const activeSnapshots = state.versionHistory.snapshots.slice(
        0,
        state.versionHistory.currentIndex + 1
      );
      const previous = activeSnapshots[activeSnapshots.length - 1];
      if (previous && serializeSnapshot(previous) === serializeSnapshot(snapshot)) {
        return state;
      }
      activeSnapshots.push(snapshot);
      return {
        versionHistory: {
          snapshots: activeSnapshots,
          currentIndex: activeSnapshots.length - 1
        },
        lastSnapshotTime: timestamp
      };
    }),
  createSnapshot: (label) =>
    set((state) => {
      const timestamp = Date.now();
      const snapshot = buildSnapshot(state, label, timestamp);
      const newSnapshots = state.versionHistory.snapshots.slice(0, state.versionHistory.currentIndex + 1);
      newSnapshots.push(snapshot);
      return {
        versionHistory: {
          snapshots: newSnapshots,
          currentIndex: newSnapshots.length - 1
        },
        lastSnapshotTime: timestamp
      };
    }),
  undo: () =>
    set((state) => {
      const { snapshots, currentIndex } = state.versionHistory;
      if (currentIndex <= 0) return state;
      const prev = snapshots[currentIndex - 1];
      return {
        ...applySnapshot(prev),
        versionHistory: { ...state.versionHistory, currentIndex: currentIndex - 1 }
      };
    }),
  redo: () =>
    set((state) => {
      const { snapshots, currentIndex } = state.versionHistory;
      if (currentIndex >= snapshots.length - 1) return state;
      const next = snapshots[currentIndex + 1];
      return {
        ...applySnapshot(next),
        versionHistory: { ...state.versionHistory, currentIndex: currentIndex + 1 }
      };
    }),
  restoreSnapshot: (id) =>
    set((state) => {
      const index = state.versionHistory.snapshots.findIndex((s) => s.id === id);
      if (index === -1) return state;
      const snapshot = state.versionHistory.snapshots[index];
      return {
        ...applySnapshot(snapshot),
        versionHistory: { ...state.versionHistory, currentIndex: index }
      };
    }),
  setScene: (scene) =>
    set((state) => {
      const nextScale = typeof scene.scale === "number" ? scene.scale : state.scale;
      const nextScaleInfo =
        scene.scaleInfo ??
        (typeof scene.scale === "number" ? { ...state.scaleInfo, value: scene.scale } : state.scaleInfo);
      const roomShellChanged =
        scene.walls !== undefined ||
        scene.openings !== undefined ||
        scene.floors !== undefined ||
        scene.scale !== undefined ||
        scene.scaleInfo !== undefined;
      const derivedProvided =
        scene.ceilings !== undefined ||
        scene.rooms !== undefined ||
        scene.cameraAnchors !== undefined ||
        scene.navGraph !== undefined;
      const derivedReset = roomShellChanged && !derivedProvided ? createDerivedSceneReset() : {};
      const nextOpenings = scene.openings ?? state.openings;
      const nextAssets = Array.isArray(scene.assets)
        ? scene.assets.map((asset) => normalizeSceneAsset(asset))
        : scene.assets;
      const nextLighting = scene.lighting
        ? {
            ...state.lighting,
            ...scene.lighting
          }
        : state.lighting;
      const nextEntranceId =
        scene.entranceId !== undefined
          ? scene.entranceId
          : roomShellChanged
            ? resolveEntranceId(nextOpenings)
            : state.entranceId;
      return {
        ...scene,
        ...derivedReset,
        assets: nextAssets,
        lighting: nextLighting,
        scale: nextScale,
        scaleInfo: nextScaleInfo,
        entranceId: nextEntranceId
      };
    }),
  resetScene: () => set({ ...initialSceneState })
}));
