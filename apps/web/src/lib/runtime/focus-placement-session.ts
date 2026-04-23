import type { PlacementTransactionState } from "@deskterioronline/placement-kernel";
import type { SurfaceLocalPose } from "@deskterioronline/scene-schema";

export function resolveFocusPlacementSessionUpdate(
  requestedLocalPose: SurfaceLocalPose,
  nextState: PlacementTransactionState
) {
  return {
    localPose: nextState.activeCandidate?.localPose ?? requestedLocalPose,
    constraintReport: nextState.constraintReport,
    collisionReport: nextState.collisionReport
  };
}
