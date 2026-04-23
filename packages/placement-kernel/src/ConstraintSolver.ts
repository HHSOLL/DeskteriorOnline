import type { SupportSurface } from "@deskterioronline/scene-schema";
import type { RuntimeAsset } from "@deskterioronline/scene-schema";
import type { PlacementCandidate, ConstraintReport } from "./types";
import {
  rectContainedBySurface,
  rectOverlapsSurfaceZone,
  resolveLocalFootprintBounds,
  resolveSurfaceEdgeClearanceMm
} from "./footprint";

export class ConstraintSolver {
  evaluate(
    candidate: PlacementCandidate,
    surface?: SupportSurface | null,
    runtimeAsset?: RuntimeAsset | null
  ): ConstraintReport {
    if (
      !Number.isFinite(candidate.localPose.uMm) ||
      !Number.isFinite(candidate.localPose.vMm) ||
      !Number.isFinite(candidate.localPose.normalOffsetMm) ||
      !Number.isFinite(candidate.localPose.rotationMilliDeg)
    ) {
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
    const validatesSurfaceFootprint = candidate.attachmentType === "place_on_surface";

    if (!surface) {
      errors.push({
        code: "SURFACE_MISSING",
        message: "Placement candidate must target a valid support surface.",
        severity: "error"
      });
    } else {
      if (!surface.allowedAttachments.includes(candidate.attachmentType)) {
        errors.push({
          code: "ATTACHMENT_NOT_ALLOWED",
          message: "Selected attachment type is not supported by the focused surface.",
          severity: "error"
        });
      }

      if (!runtimeAsset) {
        warnings.push({
          code: "RUNTIME_ASSET_MISSING",
          message: "Placement candidate dimensions are unavailable, so only partial validation is active.",
          severity: "warning"
        });
      } else {
        if (
          candidate.attachmentType !== "place_on_surface" &&
          !runtimeAsset.attachmentPoints.some((point) => point.type === candidate.attachmentType)
        ) {
          errors.push({
            code: "ATTACHMENT_POINT_MISSING",
            message: "Placed asset does not advertise a compatible attachment point for this attachment type.",
            severity: "error"
          });
        }

        const attachmentPoints = runtimeAsset.attachmentPoints.filter(
          (attachmentPoint) => attachmentPoint.type === candidate.attachmentType
        );
        const compatiblePoints = attachmentPoints.filter((point) =>
          point.compatibleWith.length === 0 ||
          point.compatibleWith.includes(surface.id) ||
          point.compatibleWith.includes(surface.type)
        );

        if (attachmentPoints.length > 0 && compatiblePoints.length === 0) {
          errors.push({
            code: "ATTACHMENT_SURFACE_INCOMPATIBLE",
            message: "Placed asset attachment points are not compatible with the focused support surface.",
            severity: "error"
          });
        }

        const constrainedThicknessPoints = compatiblePoints.filter(
          (point) => point.constraints.requiredThicknessMm
        );
        if (
          constrainedThicknessPoints.length > 0 &&
          typeof surface.thicknessMm === "number" &&
          !constrainedThicknessPoints.some((point) => {
            const requiredThickness = point.constraints.requiredThicknessMm;
            return (
              requiredThickness &&
              surface.thicknessMm >= requiredThickness[0] &&
              surface.thicknessMm <= requiredThickness[1]
            );
          })
        ) {
          errors.push({
            code: "SURFACE_THICKNESS_INCOMPATIBLE",
            message: "Surface thickness is outside the attachment point constraint range.",
            severity: "error"
          });
        }

        const footprint = resolveLocalFootprintBounds(
          candidate.localPose,
          runtimeAsset.dimensionsMm,
          surface.type
        );

        if (validatesSurfaceFootprint) {
          if (!rectContainedBySurface(footprint, surface)) {
            errors.push({
              code: "SURFACE_FOOTPRINT_EXCEEDED",
              message: "Placement footprint must remain inside the focused support surface.",
              severity: "error"
            });
          }

          if (
            surface.noPlaceZones?.some((zone) => rectOverlapsSurfaceZone(footprint, zone))
          ) {
            errors.push({
              code: "NO_PLACE_ZONE_OVERLAP",
              message: "Placement footprint overlaps a restricted zone on the support surface.",
              severity: "error"
            });
          }

          if (
            surface.preferredZones &&
            surface.preferredZones.length > 0 &&
            !surface.preferredZones.some((zone) => rectOverlapsSurfaceZone(footprint, zone))
          ) {
            warnings.push({
              code: "OUTSIDE_PREFERRED_ZONE",
              message: "Placement candidate is outside the preferred zone for this surface.",
              severity: "warning"
            });
          }
        }

        const edgeClearanceMm = resolveSurfaceEdgeClearanceMm(footprint, surface);
        if (candidate.attachmentType === "edge_clamp" && edgeClearanceMm > 24) {
          errors.push({
            code: "EDGE_CLAMP_NOT_ON_EDGE",
            message: "Edge clamp placement must stay close to the support edge.",
            severity: "error"
          });
        } else if (validatesSurfaceFootprint && edgeClearanceMm < 40) {
          warnings.push({
            code: "EDGE_CLEARANCE_LOW",
            message: "Placement candidate is close to the surface edge.",
            severity: "warning"
          });
        }
      }

      if (surface.thicknessMm && candidate.attachmentType === "edge_clamp" && surface.thicknessMm > 85) {
        errors.push({
          code: "SURFACE_TOO_THICK",
          message: "The selected support surface exceeds the default edge clamp thickness budget.",
          severity: "error"
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      score: errors.length > 0 ? 0 : Math.max(0.4, 1 - warnings.length * 0.18)
    };
  }
}
