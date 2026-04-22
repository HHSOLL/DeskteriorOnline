import type { PlacementCandidate, ConstraintReport } from "./types";

export class ConstraintSolver {
  evaluate(candidate: PlacementCandidate): ConstraintReport {
    if (!Number.isFinite(candidate.localPose.uMm) || !Number.isFinite(candidate.localPose.vMm)) {
      return {
        valid: false,
        errors: [
          {
            code: "INVALID_LOCAL_POSE",
            message: "Placement candidate must have finite local coordinates.",
            severity: "error"
          }
        ],
        warnings: [],
        score: 0
      };
    }

    return {
      valid: true,
      errors: [],
      warnings: [],
      score: 1
    };
  }
}
