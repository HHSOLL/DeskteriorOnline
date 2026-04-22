import type { PlacementRecord } from "./placement";
import type { Vector2Mm, Vector3Mm } from "./primitives";

export type ScaleInfoDocument = {
  valueMmPerMeter: number;
  source: "ocr_dimension" | "door_heuristic" | "user_measure" | "unknown";
  confidence: number;
  evidence?: Record<string, unknown>;
};

export type WallDocument = {
  id: string;
  startMm: Vector2Mm;
  endMm: Vector2Mm;
  thicknessMm: number;
  heightMm: number;
  confidence?: number;
  type?: "exterior" | "interior" | "balcony" | "column";
  isPartOfBalcony?: boolean;
};

export type OpeningDocument = {
  id: string;
  wallId: string;
  type: "door" | "window";
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  verticalOffsetMm?: number;
  sillHeightMm?: number;
  isEntrance?: boolean;
};

export type FloorDocument = {
  id: string;
  outlineMm: Vector2Mm[];
  materialId: string | null;
  roomId?: string | null;
  roomType?: string;
  label?: string;
};

export type CeilingDocument = {
  id: string;
  outlineMm: Vector2Mm[];
  materialId: string | null;
  roomId?: string | null;
  roomType?: string;
  heightMm: number;
};

export type RoomZoneDocument = {
  id: string;
  roomType: string;
  label: string;
  polygonMm: Vector2Mm[];
  areaSqMm: number;
  centerMm: Vector2Mm;
  openingIds: string[];
  connectedRoomIds: string[];
  estimatedCeilingHeightMm: number;
  estimatedUsage: "primary" | "secondary" | "service";
  isExteriorFacing: boolean;
};

export type CameraAnchorDocument = {
  id: string;
  kind: "entrance" | "room_center" | "overview";
  roomId: string | null;
  openingId: string | null;
  planPositionMm: Vector2Mm;
  targetPlanPositionMm: Vector2Mm;
  heightMm: number;
};

export type NavGraphDocument = {
  nodes: Array<{
    id: string;
    roomId: string | null;
    kind: "entrance" | "room_center";
    planPositionMm: Vector2Mm;
  }>;
  edges: Array<{
    id: string;
    fromNodeId: string;
    toNodeId: string;
    relation: "door" | "passage" | "entrance";
    openingId: string;
  }>;
};

export type RoomShellDocument = {
  scaleInfo?: ScaleInfoDocument;
  walls: WallDocument[];
  openings: OpeningDocument[];
  floors: FloorDocument[];
  ceilings: CeilingDocument[];
  rooms: RoomZoneDocument[];
  cameraAnchors: CameraAnchorDocument[];
  navGraph: NavGraphDocument;
};

export type SceneObjectDocument = {
  id: string;
  assetId: string;
  runtimeAssetId?: string | null;
  materialVariantId?: string | null;
  placement: PlacementRecord;
  catalogItemId?: string | null;
  anchorType?: string | null;
  supportAssetId?: string | null;
  supportProfile?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  product?: Record<string, unknown> | null;
  tags?: string[];
  debugLabel?: string;
};

export type EnvironmentDocument = {
  lighting?: Record<string, unknown>;
  toneMapping?: "aces" | "neutral";
  exposure?: number;
};

export type SceneDocumentV2 = {
  schemaVersion: 2;
  id: string;
  version: number;
  units: "mm";
  room: RoomShellDocument;
  objects: SceneObjectDocument[];
  materials: Array<{
    id: string;
    objectId?: string;
    materialId?: string | null;
    materialVariantId?: string | null;
  }>;
  cameras: Array<{
    id: string;
    label: string;
    positionMm: Vector3Mm;
    targetMm: Vector3Mm;
  }>;
  environment: EnvironmentDocument;
  createdAt?: string;
  updatedAt?: string;
};
