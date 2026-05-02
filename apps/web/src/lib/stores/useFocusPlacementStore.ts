import { create } from "zustand";
import type { CollisionReport, ConstraintReport } from "@deskterioronline/placement-kernel";
import type { DimensionsMm, SurfaceLocalPose, SupportSurface } from "@deskterioronline/scene-schema";
import type {
  FocusPlacementAttachmentType,
  FocusPlacementSurfaceCandidate,
  FocusPlacementWizardState
} from "../runtime/focus-placement-session";

export type FocusPlacementRequest = {
  objectId: string;
  supportObjectId: string;
  surfaceId: string;
  attachmentType: FocusPlacementAttachmentType;
  objectLabel: string;
  supportLabel: string;
  surfaceLabel: string;
  surfaceType: SupportSurface["type"];
  surfaceBoundsMm: SupportSurface["boundsMm"];
  noPlaceZones: NonNullable<SupportSurface["noPlaceZones"]>;
  preferredZones: NonNullable<SupportSurface["preferredZones"]>;
  objectDimensionsMm: DimensionsMm | null;
  surfaceCandidates: FocusPlacementSurfaceCandidate[];
  preferredCandidateIndex: number;
  aimRayHitConfidence?: number;
};

export type FocusPlacementSession = FocusPlacementRequest & {
  activeCandidateIndex: number;
  localPose: SurfaceLocalPose;
  constraintReport: ConstraintReport | null;
  collisionReport: CollisionReport | null;
  moveStepMm: number;
  rotateStepMilliDeg: number;
  wizardState: FocusPlacementWizardState | null;
};

type FocusPlacementState = {
  pendingRequest: FocusPlacementRequest | null;
  activeSession: FocusPlacementSession | null;
  requestFocusPlacement: (request: FocusPlacementRequest) => void;
  clearPendingRequest: () => void;
  startSession: (session: FocusPlacementSession) => void;
  updateSession: (updates: Partial<FocusPlacementSession>) => void;
  clearSession: () => void;
};

export const useFocusPlacementStore = create<FocusPlacementState>((set) => ({
  pendingRequest: null,
  activeSession: null,
  requestFocusPlacement: (request) =>
    set({
      pendingRequest: request
    }),
  clearPendingRequest: () =>
    set({
      pendingRequest: null
    }),
  startSession: (session) =>
    set({
      pendingRequest: null,
      activeSession: session
    }),
  updateSession: (updates) =>
    set((state) => ({
      activeSession: state.activeSession ? { ...state.activeSession, ...updates } : null
    })),
  clearSession: () =>
    set({
      pendingRequest: null,
      activeSession: null
    })
}));
