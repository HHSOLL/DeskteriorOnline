import type {
  AttachmentType,
  CableRouteRecord,
  SurfaceLocalPose,
  SupportSurface
} from "@deskterioronline/scene-schema";

export type SurfaceHit = {
  objectId: string;
  surfaceId: string;
  surface: SupportSurface;
  distance: number;
  localPose?: Partial<SurfaceLocalPose>;
  worldPointMm?: [number, number, number];
};

export type ConstraintIssue = {
  code: string;
  message: string;
  severity: "error" | "warning";
};

export type ConstraintReport = {
  valid: boolean;
  errors: ConstraintIssue[];
  warnings: ConstraintIssue[];
  score: number;
};

export type CollisionReport = {
  collided: boolean;
  collisions: Array<{
    code: string;
    objectId: string;
    reason: string;
  }>;
};

export type PlacementCandidate = {
  objectId: string;
  supportObjectId: string;
  surfaceId: string;
  attachmentType: AttachmentType;
  localPose: SurfaceLocalPose;
  cableRoute?: CableRouteRecord;
};
