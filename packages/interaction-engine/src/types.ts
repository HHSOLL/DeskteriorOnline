import type {
  CollisionReport,
  ConstraintReport,
  SnapRule
} from "@deskterioronline/placement-kernel";
import type {
  AttachmentType,
  SurfaceLocalPose,
  SupportSurface
} from "@deskterioronline/scene-schema";

export type InteractionMode =
  | "walk"
  | "top-room"
  | "top-desk-precision"
  | "builder-preview"
  | "viewer-shared"
  | "viewer-showcase";

export type FocusPlacementMachineStatus =
  | "idle"
  | "aiming"
  | "candidate_preview"
  | "manipulating"
  | "blocked"
  | "committing"
  | "committed"
  | "cancelled";

export type BlockedReasonCode =
  | "NO_SURFACE"
  | "INCOMPATIBLE_ATTACHMENT"
  | "OUT_OF_SURFACE_BOUNDS"
  | "COLLISION"
  | "INSUFFICIENT_CLEARANCE"
  | "UNREACHABLE_ARM_TARGET"
  | "INVALID_CABLE_ROUTE"
  | "SCALE_LOCKED"
  | "READ_ONLY"
  | "MISSING_METADATA";

export type BlockedReason = {
  code: BlockedReasonCode;
  message: string;
  severity: "error" | "warning";
  source?: "candidate" | "constraint" | "collision" | "mode" | "metadata";
};

export type CandidateVisualAffordance = {
  tone: "valid" | "warning" | "blocked" | "info";
  outline: "surface-ring" | "edge-band" | "mount-target" | "ghost-only";
  label: string;
};

export type CandidateRankingSignals = {
  rayHitConfidence?: number;
  attachmentCompatibility?: number;
  surfaceVisibility?: number;
  distancePriority?: number;
  userSelectedSupportBonus?: number;
  preferredSurfaceBonus?: number;
  collisionPenalty?: number;
  clearancePenalty?: number;
  outOfBoundsPenalty?: number;
};

export type InteractionSurfaceCandidate = {
  id?: string;
  supportObjectId: string;
  surfaceId: string;
  surfaceLabel?: string;
  surfaceType: SupportSurface["type"];
  attachmentType: AttachmentType;
  enabled: boolean;
  reason?: string | null;
  blockedReasons?: BlockedReason[];
  surfaceBoundsMm?: SupportSurface["boundsMm"];
  noPlaceZones?: NonNullable<SupportSurface["noPlaceZones"]>;
  preferredZones?: NonNullable<SupportSurface["preferredZones"]>;
  visualAffordance?: CandidateVisualAffordance;
  ranking?: CandidateRankingSignals;
};

export type RankedInteractionSurfaceCandidate = InteractionSurfaceCandidate & {
  score: number;
  rank: number;
  blockedReasons: BlockedReason[];
  visualAffordance: CandidateVisualAffordance;
};

export type AimPayload = {
  objectId?: string | null;
  supportObjectId?: string | null;
  surfaceId?: string | null;
  candidates?: InteractionSurfaceCandidate[];
  rayHitConfidence?: number;
};

export type InteractionEvent =
  | { type: "AIM_AT_SURFACE"; payload: AimPayload }
  | {
      type: "START_PLACEMENT";
      objectId: string;
      supportObjectId: string;
      candidates: InteractionSurfaceCandidate[];
      preferredCandidateIndex?: number;
      initialLocalPose?: Partial<SurfaceLocalPose>;
      readOnly?: boolean;
    }
  | { type: "NUDGE"; axis: "u" | "v" | "normal"; deltaMm: number; snapRule?: SnapRule }
  | { type: "ROTATE"; deltaMilliDeg: number; snapRule?: SnapRule }
  | { type: "SWITCH_CANDIDATE"; direction: 1 | -1 }
  | { type: "SELECT_CANDIDATE"; candidateIndex: number }
  | { type: "SET_NUMERIC_POSE"; pose: Partial<SurfaceLocalPose>; snapRule?: SnapRule }
  | {
      type: "APPLY_REPORTS";
      localPose?: SurfaceLocalPose;
      constraintReport: ConstraintReport | null;
      collisionReport: CollisionReport | null;
    }
  | { type: "COMMIT" }
  | { type: "COMMIT_SUCCEEDED" }
  | { type: "COMMIT_FAILED"; reasons: BlockedReason[] }
  | { type: "CANCEL" };

export type InteractionCommand =
  | { type: "BEGIN_PREVIEW"; objectId: string }
  | {
      type: "UPDATE_PREVIEW_POSE";
      objectId: string;
      candidate: RankedInteractionSurfaceCandidate;
      localPose: SurfaceLocalPose;
      snapRule?: SnapRule;
    }
  | { type: "CANCEL_PREVIEW"; objectId?: string | null }
  | {
      type: "COMMIT_PLACEMENT_PATCH";
      objectId: string;
      candidate: RankedInteractionSurfaceCandidate;
      localPose: SurfaceLocalPose;
      expectedPatchCount: 1;
    }
  | { type: "REPORT_BLOCKED"; reasons: BlockedReason[] }
  | { type: "SET_ACTIVE_CANDIDATE"; candidate: RankedInteractionSurfaceCandidate }
  | { type: "INVALIDATE_RENDER"; reason: "aim" | "preview" | "nudge" | "commit" | "cancel" };

export type FocusPlacementMachineState = {
  status: FocusPlacementMachineStatus;
  mode: InteractionMode;
  objectId: string | null;
  supportObjectId: string | null;
  candidates: RankedInteractionSurfaceCandidate[];
  activeCandidateIndex: number;
  localPose: SurfaceLocalPose;
  blockedReasons: BlockedReason[];
  constraintReport: ConstraintReport | null;
  collisionReport: CollisionReport | null;
  readOnly: boolean;
};

export type InteractionResult = {
  state: FocusPlacementMachineState;
  commands: InteractionCommand[];
  documentPatchCount: number;
};

export const ZERO_SURFACE_LOCAL_POSE: SurfaceLocalPose = {
  uMm: 0,
  vMm: 0,
  normalOffsetMm: 0,
  rotationMilliDeg: 0
};
