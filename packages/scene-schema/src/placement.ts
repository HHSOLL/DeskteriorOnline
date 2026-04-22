import type {
  Vector3Meters,
  Vector3MilliDeg,
  Vector3Mm,
  Vector3Permille,
  Vector3Radians
} from "./primitives";
import {
  vectorMetersToMillimeters,
  vectorMilliDegreesToRadians,
  vectorPermilleToScale,
  vectorRadiansToMilliDegrees,
  vectorScaleToPermille
} from "./primitives";

export type AttachmentType =
  | "place_on_surface"
  | "edge_clamp"
  | "underside_screw"
  | "vesa_mount"
  | "grommet_hole"
  | "wall_screw"
  | "adhesive_patch"
  | "magnetic_attach"
  | "cable_route"
  | "peg_slot"
  | "wall_attach";

export type WorldTransformSnapshot = {
  positionMm: Vector3Mm;
  rotationMilliDeg: Vector3MilliDeg;
  scalePermille: Vector3Permille;
};

export type WorldPlacementRecord = {
  mode: "world";
  world: WorldTransformSnapshot;
};

export type SurfaceLocalPose = {
  uMm: number;
  vMm: number;
  normalOffsetMm: number;
  rotationMilliDeg: number;
};

export type SurfacePlacementRecord = {
  mode: "surface_local";
  supportObjectId: string;
  surfaceId: string;
  attachmentType: AttachmentType;
  localPose: SurfaceLocalPose;
  scalePermille: Vector3Permille;
};

export type PlacementRecord = WorldPlacementRecord | SurfacePlacementRecord;

export type WorldTransform = {
  position: Vector3Meters;
  rotation: Vector3Radians;
  scale: Vector3Meters;
};

export function serializeWorldTransform(input: WorldTransform): WorldPlacementRecord {
  return {
    mode: "world",
    world: {
      positionMm: vectorMetersToMillimeters(input.position),
      rotationMilliDeg: vectorRadiansToMilliDegrees(input.rotation),
      scalePermille: vectorScaleToPermille(input.scale)
    }
  };
}

export function deserializeWorldPlacementRecord(record: WorldPlacementRecord): WorldTransform {
  return {
    position: [
      record.world.positionMm[0] / 1000,
      record.world.positionMm[1] / 1000,
      record.world.positionMm[2] / 1000
    ],
    rotation: vectorMilliDegreesToRadians(record.world.rotationMilliDeg),
    scale: vectorPermilleToScale(record.world.scalePermille)
  };
}

export function isSurfacePlacementRecord(record: PlacementRecord): record is SurfacePlacementRecord {
  return record.mode === "surface_local";
}

export function clonePlacementRecord(record: PlacementRecord): PlacementRecord {
  return JSON.parse(JSON.stringify(record)) as PlacementRecord;
}
