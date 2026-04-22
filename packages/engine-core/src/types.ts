import type {
  PlacementRecord,
  RuntimeAsset,
  SceneDocumentV2,
  SceneObjectDocument,
  Vector3Meters,
  Vector3Radians
} from "@deskterioronline/scene-schema";

export type RuntimeWorldTransform = {
  position: Vector3Meters;
  rotation: Vector3Radians;
  scale: Vector3Meters;
};

export type RuntimeObjectRecord = {
  id: string;
  assetId: string;
  runtimeAssetId: string | null;
  materialId: string | null;
  objectDocument: SceneObjectDocument;
  placement: PlacementRecord;
  transform: RuntimeWorldTransform;
  previewTransform: RuntimeWorldTransform | null;
  transformRevision: number;
};

export type RuntimeScene = {
  id: string;
  units: "mm";
  generation: number;
  sourceDocument: SceneDocumentV2;
  room: SceneDocumentV2["room"];
  runtimeAssets: Map<string, RuntimeAsset>;
  objectRegistry: Map<string, RuntimeObjectRecord>;
  dirtyObjectIds: Set<string>;
  selectionState: {
    selectedObjectId: string | null;
  };
  hoverState: {
    hoveredObjectId: string | null;
  };
};

export type SceneObjectPatch = {
  objectId: string;
  previousPlacement: PlacementRecord;
  nextPlacement: PlacementRecord;
};
