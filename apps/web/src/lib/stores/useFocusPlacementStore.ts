import { create } from "zustand";
import type { CollisionReport, ConstraintReport } from "@deskterioronline/placement-kernel";
import type { SurfaceLocalPose } from "@deskterioronline/scene-schema";

export type FocusPlacementRequest = {
  objectId: string;
  supportObjectId: string;
  surfaceId: string;
  attachmentType: "place_on_surface";
  objectLabel: string;
  supportLabel: string;
  surfaceLabel: string;
};

export type FocusPlacementSession = FocusPlacementRequest & {
  localPose: SurfaceLocalPose;
  constraintReport: ConstraintReport | null;
  collisionReport: CollisionReport | null;
  moveStepMm: number;
  rotateStepMilliDeg: number;
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
