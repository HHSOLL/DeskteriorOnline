import type {
  CameraAnchorDocument,
  CeilingDocument,
  FloorDocument,
  NavGraphDocument,
  OpeningDocument,
  RoomShellDocument,
  RoomZoneDocument,
  ScaleInfoDocument,
  SceneDocumentV2,
  SceneObjectDocument,
  WallDocument
} from "./scene-document";
import { serializeWorldTransform, type PlacementRecord } from "./placement";
import {
  metersToMillimeters,
  type Vector2Mm,
  type Vector3Meters,
  type Vector3Radians
} from "./primitives";

type LegacyVector2 = [number, number];
type LegacyVector3 = [number, number, number];

export type LegacySceneAssetLike = {
  id: string;
  assetId: string;
  catalogItemId?: string | null;
  product?: Record<string, unknown> | null;
  anchorType?: string | null;
  supportAssetId?: string | null;
  supportProfile?: Record<string, unknown> | null;
  position: LegacyVector3;
  rotation: LegacyVector3;
  scale: LegacyVector3;
  materialId?: string | null;
};

export type LegacySceneDocumentLike = {
  schemaVersion?: number;
  roomShell: {
    scale?: number;
    scaleInfo?: {
      value?: number;
      source?: ScaleInfoDocument["source"];
      confidence?: number;
      evidence?: Record<string, unknown>;
    };
    walls?: Array<{
      id: string;
      start: LegacyVector2;
      end: LegacyVector2;
      thickness: number;
      height: number;
      confidence?: number;
      type?: WallDocument["type"];
      isPartOfBalcony?: boolean;
    }>;
    openings?: Array<{
      id: string;
      wallId: string;
      type: "door" | "window";
      offset: number;
      width: number;
      height: number;
      verticalOffset?: number;
      sillHeight?: number;
      isEntrance?: boolean;
    }>;
    floors?: Array<{
      id: string;
      outline: LegacyVector2[];
      materialId: string | null;
      roomId?: string | null;
      roomType?: string;
      label?: string;
    }>;
    ceilings?: Array<{
      id: string;
      outline: LegacyVector2[];
      materialId: string | null;
      roomId?: string | null;
      roomType?: string;
      height: number;
    }>;
    rooms?: Array<{
      id: string;
      roomType: string;
      label: string;
      polygon: LegacyVector2[];
      area: number;
      center: LegacyVector2;
      openingIds: string[];
      connectedRoomIds: string[];
      estimatedCeilingHeight: number;
      estimatedUsage: "primary" | "secondary" | "service";
      isExteriorFacing: boolean;
    }>;
    cameraAnchors?: Array<{
      id: string;
      kind: "entrance" | "room_center" | "overview";
      roomId: string | null;
      openingId: string | null;
      planPosition: LegacyVector2;
      targetPlanPosition: LegacyVector2;
      height: number;
    }>;
    navGraph?: {
      nodes?: Array<{
        id: string;
        roomId: string | null;
        kind: "entrance" | "room_center";
        planPosition: LegacyVector2;
      }>;
      edges?: Array<{
        id: string;
        fromNodeId: string;
        toNodeId: string;
        relation: "door" | "passage" | "entrance";
        openingId: string;
      }>;
    };
  };
  nodes?: Array<LegacySceneAssetLike & { placement?: PlacementRecord }>;
  objects?: SceneObjectDocument[];
  materialOverride?: {
    wallMaterialIndex: number;
    floorMaterialIndex: number;
  };
  materials?: Array<{
    id: string;
    objectId?: string;
    materialId?: string | null;
    materialVariantId?: string | null;
  }>;
  lighting?: Record<string, unknown>;
};

export type LegacySceneStoreStateLike = {
  scale: number;
  scaleInfo?: LegacySceneDocumentLike["roomShell"]["scaleInfo"];
  walls: NonNullable<LegacySceneDocumentLike["roomShell"]["walls"]>;
  openings: NonNullable<LegacySceneDocumentLike["roomShell"]["openings"]>;
  floors: NonNullable<LegacySceneDocumentLike["roomShell"]["floors"]>;
  ceilings: NonNullable<LegacySceneDocumentLike["roomShell"]["ceilings"]>;
  rooms: NonNullable<LegacySceneDocumentLike["roomShell"]["rooms"]>;
  cameraAnchors: NonNullable<LegacySceneDocumentLike["roomShell"]["cameraAnchors"]>;
  navGraph: NonNullable<LegacySceneDocumentLike["roomShell"]["navGraph"]>;
  assets: LegacySceneAssetLike[];
  wallMaterialIndex?: number;
  floorMaterialIndex?: number;
  lighting?: Record<string, unknown>;
};

function vector2ToMm(value: LegacyVector2): Vector2Mm {
  return [metersToMillimeters(value[0]), metersToMillimeters(value[1])];
}

function toScaleInfoDocument(
  scale: number,
  scaleInfo?: LegacySceneDocumentLike["roomShell"]["scaleInfo"]
): ScaleInfoDocument | undefined {
  if (!scaleInfo && !Number.isFinite(scale)) {
    return undefined;
  }

  return {
    valueMmPerMeter: metersToMillimeters(scale || 1),
    source: scaleInfo?.source ?? "unknown",
    confidence: scaleInfo?.confidence ?? 0,
    ...(scaleInfo?.evidence ? { evidence: scaleInfo.evidence } : {})
  };
}

function mapWalls(walls: NonNullable<LegacySceneDocumentLike["roomShell"]["walls"]>): WallDocument[] {
  return walls.map((wall) => ({
    id: wall.id,
    startMm: vector2ToMm(wall.start),
    endMm: vector2ToMm(wall.end),
    thicknessMm: metersToMillimeters(wall.thickness),
    heightMm: metersToMillimeters(wall.height),
    confidence: wall.confidence,
    type: wall.type,
    isPartOfBalcony: wall.isPartOfBalcony
  }));
}

function mapOpenings(
  openings: NonNullable<LegacySceneDocumentLike["roomShell"]["openings"]>
): OpeningDocument[] {
  return openings.map((opening) => ({
    id: opening.id,
    wallId: opening.wallId,
    type: opening.type,
    offsetMm: metersToMillimeters(opening.offset),
    widthMm: metersToMillimeters(opening.width),
    heightMm: metersToMillimeters(opening.height),
    verticalOffsetMm:
      typeof opening.verticalOffset === "number" ? metersToMillimeters(opening.verticalOffset) : undefined,
    sillHeightMm:
      typeof opening.sillHeight === "number" ? metersToMillimeters(opening.sillHeight) : undefined,
    isEntrance: opening.isEntrance
  }));
}

function mapFloors(floors: NonNullable<LegacySceneDocumentLike["roomShell"]["floors"]>): FloorDocument[] {
  return floors.map((floor) => ({
    id: floor.id,
    outlineMm: floor.outline.map(vector2ToMm),
    materialId: floor.materialId,
    roomId: floor.roomId,
    roomType: floor.roomType,
    label: floor.label
  }));
}

function mapCeilings(
  ceilings: NonNullable<LegacySceneDocumentLike["roomShell"]["ceilings"]>
): CeilingDocument[] {
  return ceilings.map((ceiling) => ({
    id: ceiling.id,
    outlineMm: ceiling.outline.map(vector2ToMm),
    materialId: ceiling.materialId,
    roomId: ceiling.roomId,
    roomType: ceiling.roomType,
    heightMm: metersToMillimeters(ceiling.height)
  }));
}

function mapRooms(rooms: NonNullable<LegacySceneDocumentLike["roomShell"]["rooms"]>): RoomZoneDocument[] {
  return rooms.map((room) => ({
    id: room.id,
    roomType: room.roomType,
    label: room.label,
    polygonMm: room.polygon.map(vector2ToMm),
    areaSqMm: Math.round(room.area * 1_000_000),
    centerMm: vector2ToMm(room.center),
    openingIds: room.openingIds,
    connectedRoomIds: room.connectedRoomIds,
    estimatedCeilingHeightMm: metersToMillimeters(room.estimatedCeilingHeight),
    estimatedUsage: room.estimatedUsage,
    isExteriorFacing: room.isExteriorFacing
  }));
}

function mapCameraAnchors(
  anchors: NonNullable<LegacySceneDocumentLike["roomShell"]["cameraAnchors"]>
): CameraAnchorDocument[] {
  return anchors.map((anchor) => ({
    id: anchor.id,
    kind: anchor.kind,
    roomId: anchor.roomId,
    openingId: anchor.openingId,
    planPositionMm: vector2ToMm(anchor.planPosition),
    targetPlanPositionMm: vector2ToMm(anchor.targetPlanPosition),
    heightMm: metersToMillimeters(anchor.height)
  }));
}

function mapNavGraph(navGraph: NonNullable<LegacySceneDocumentLike["roomShell"]["navGraph"]>): NavGraphDocument {
  return {
    nodes: (navGraph.nodes ?? []).map((node) => ({
      id: node.id,
      roomId: node.roomId,
      kind: node.kind,
      planPositionMm: vector2ToMm(node.planPosition)
    })),
    edges: navGraph.edges ?? []
  };
}

function mapPlacement(asset: LegacySceneAssetLike & { placement?: PlacementRecord }) {
  if (asset.placement) {
    return asset.placement;
  }

  return serializeWorldTransform({
    position: asset.position as Vector3Meters,
    rotation: asset.rotation as Vector3Radians,
    scale: asset.scale as Vector3Meters
  });
}

function mapObjects(assets: LegacySceneAssetLike[]): SceneObjectDocument[] {
  return assets.map((asset) => ({
    id: asset.id,
    assetId: asset.assetId,
    runtimeAssetId: asset.catalogItemId ?? asset.assetId,
    placement: mapPlacement(asset),
    catalogItemId: asset.catalogItemId ?? null,
    anchorType: asset.anchorType ?? null,
    supportAssetId: asset.supportAssetId ?? null,
    supportProfile: asset.supportProfile ?? null,
    product: asset.product ?? null,
    metadata: {
      legacyMaterialId: asset.materialId ?? null
    }
  }));
}

function mapLegacyObjectMaterials(assets: LegacySceneAssetLike[]) {
  return assets.flatMap((asset) => {
    if (!asset.materialId) {
      return [];
    }

    return [
      {
        id: `object:${asset.id}:default`,
        objectId: asset.id,
        materialId: asset.materialId,
        materialVariantId: null
      }
    ];
  });
}

export function migrateLegacySceneDocumentToV2(
  input: LegacySceneDocumentLike,
  options?: { id?: string; version?: number }
): SceneDocumentV2 {
  const roomShell = input.roomShell;
  const legacyAssets = input.nodes ?? [];
  return {
    schemaVersion: 2,
    id: options?.id ?? "scene-runtime-migration",
    version: options?.version ?? 2,
    units: "mm",
    room: {
      scaleInfo: toScaleInfoDocument(roomShell.scale ?? 1, roomShell.scaleInfo),
      walls: mapWalls(roomShell.walls ?? []),
      openings: mapOpenings(roomShell.openings ?? []),
      floors: mapFloors(roomShell.floors ?? []),
      ceilings: mapCeilings(roomShell.ceilings ?? []),
      rooms: mapRooms(roomShell.rooms ?? []),
      cameraAnchors: mapCameraAnchors(roomShell.cameraAnchors ?? []),
      navGraph: mapNavGraph(roomShell.navGraph ?? {})
    },
    objects: input.objects ?? mapObjects(legacyAssets),
    materials:
      input.materials ??
      [
        {
          id: "wall:default",
          materialId:
            typeof input.materialOverride?.wallMaterialIndex === "number"
              ? `wall:${input.materialOverride.wallMaterialIndex}`
              : null
        },
        {
          id: "floor:default",
          materialId:
            typeof input.materialOverride?.floorMaterialIndex === "number"
              ? `floor:${input.materialOverride.floorMaterialIndex}`
              : null
        },
        ...mapLegacyObjectMaterials(legacyAssets)
      ],
    cameras: [],
    environment: {
      lighting: input.lighting ?? {}
    }
  };
}

export function migrateLegacySceneStoreStateToV2(
  input: LegacySceneStoreStateLike,
  options?: { id?: string; version?: number }
) {
  return migrateLegacySceneDocumentToV2(
    {
      roomShell: {
        scale: input.scale,
        scaleInfo: input.scaleInfo,
        walls: input.walls,
        openings: input.openings,
        floors: input.floors,
        ceilings: input.ceilings,
        rooms: input.rooms,
        cameraAnchors: input.cameraAnchors,
        navGraph: input.navGraph
      },
      nodes: input.assets,
      materialOverride: {
        wallMaterialIndex: input.wallMaterialIndex ?? 0,
        floorMaterialIndex: input.floorMaterialIndex ?? 0
      },
      lighting: input.lighting
    },
    options
  );
}
