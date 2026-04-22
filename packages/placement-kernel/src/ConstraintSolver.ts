import type { SupportSurface } from "@deskterioronline/scene-schema";
import type { PlacementCandidate, ConstraintReport } from "./types";

export class ConstraintSolver {
  evaluate(candidate: PlacementCandidate, surface?: SupportSurface | null): ConstraintReport {
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

    const errors: ConstraintReport["errors"] = [];
    const warnings: ConstraintReport["warnings"] = [];

    if (surface) {
      const outOfBounds =
        candidate.localPose.uMm < surface.boundsMm.min[0] ||
        candidate.localPose.uMm > surface.boundsMm.max[0] ||
        candidate.localPose.vMm < surface.boundsMm.min[1] ||
        candidate.localPose.vMm > surface.boundsMm.max[1];

      if (outOfBounds) {
        errors.push({
          code: "SURFACE_BOUNDS_EXCEEDED",
          message: "Placement candidate must remain inside the focused support surface.",
          severity: "error"
        });
      } else {
        const edgeClearanceMm = Math.min(
          candidate.localPose.uMm - surface.boundsMm.min[0],
          surface.boundsMm.max[0] - candidate.localPose.uMm,
          candidate.localPose.vMm - surface.boundsMm.min[1],
          surface.boundsMm.max[1] - candidate.localPose.vMm
        );

        if (edgeClearanceMm < 40) {
          warnings.push({
            code: "EDGE_CLEARANCE_LOW",
            message: "Placement candidate is close to the surface edge.",
            severity: "warning"
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score: errors.length > 0 ? 0 : warnings.length > 0 ? 0.72 : 1
    };
  }
}
