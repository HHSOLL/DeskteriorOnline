import type { RuntimeAsset } from "@deskterioronline/scene-schema";
import type { SupportSurface } from "@deskterioronline/scene-schema";
import type { PlacementCandidate, ConstraintReport } from "./types";
import { CableRouteSolver } from "./CableRouteSolver";
import { MonitorArmSolver } from "./MonitorArmSolver";
import {
  rectContainedBySurface,
  rectOverlapsSurfaceZone,
  resolveLocalFootprintBounds,
  resolveSurfaceEdgeClearanceMm
} from "./footprint";

export class ConstraintSolver {
  private readonly cableRouteSolver = new CableRouteSolver();
  private readonly monitorArmSolver = new MonitorArmSolver();

  evaluate(
    candidate: PlacementCandidate,
    surface?: SupportSurface | null,
    runtimeAsset?: RuntimeAsset | null,
    supportRuntimeAsset?: RuntimeAsset | null
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
    const validatesSurfaceFootprint =
      candidate.attachmentType === "place_on_surface" ||
      candidate.attachmentType === "grommet_hole" ||
      candidate.attachmentType === "wall_screw" ||
      candidate.attachmentType === "wall_attach";
    const validatesMountedPoint =
      candidate.attachmentType === "edge_clamp" ||
      candidate.attachmentType === "underside_screw" ||
      candidate.attachmentType === "vesa_mount" ||
      candidate.attachmentType === "grommet_hole" ||
      candidate.attachmentType === "wall_screw" ||
      candidate.attachmentType === "wall_attach" ||
      candidate.attachmentType === "cable_route";

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

        if (candidate.attachmentType === "vesa_mount") {
          const declaredPatterns = compatiblePoints
            .map((point) => point.constraints.vesaPatternMm)
            .filter((pattern): pattern is [75, 75] | [100, 100] | [75, 100] => Boolean(pattern));
          if (declaredPatterns.length === 0) {
            errors.push({
              code: "VESA_PATTERN_MISSING",
              message: "Placed asset must declare a VESA pattern before it can mount to an articulated arm.",
              severity: "error"
            });
          }

          const supportPatterns = supportRuntimeAsset?.attachmentPoints
            .filter((point) => point.type === "vesa_mount")
            .map((point) => point.constraints.vesaPatternMm)
            .filter((pattern): pattern is [75, 75] | [100, 100] | [75, 100] => Boolean(pattern)) ?? [];
          const articulationPatterns =
            supportRuntimeAsset?.articulation?.type === "monitor_arm"
              ? [supportRuntimeAsset.articulation.endEffector.compatiblePatternsMm]
              : [];

          const matchesSupportPattern = declaredPatterns.some((declaredPattern) =>
            supportPatterns.some(
              (supportPattern) =>
                supportPattern[0] === declaredPattern[0] &&
                supportPattern[1] === declaredPattern[1]
            ) ||
            articulationPatterns.some((pattern) => {
              if (pattern === "both") {
                return (
                  (declaredPattern[0] === 75 && declaredPattern[1] === 75) ||
                  (declaredPattern[0] === 100 && declaredPattern[1] === 100)
                );
              }

              return pattern[0] === declaredPattern[0] && pattern[1] === declaredPattern[1];
            })
          );

          if (!supportRuntimeAsset || (supportPatterns.length === 0 && articulationPatterns.length === 0)) {
            errors.push({
              code: "SUPPORT_ATTACHMENT_TARGET_MISSING",
              message: "Support object does not advertise a VESA-compatible attachment target.",
              severity: "error"
            });
          } else if (!matchesSupportPattern) {
            errors.push({
              code: "VESA_PATTERN_INCOMPATIBLE",
              message: "Placed asset VESA pattern is not compatible with the focused support target.",
              severity: "error"
            });
          }

          if (supportRuntimeAsset?.articulation?.type === "monitor_arm") {
            const articulationSolveResult = this.monitorArmSolver.solve(
              supportRuntimeAsset.articulation,
              {
                positionMm: [
                  candidate.localPose.uMm,
                  candidate.localPose.vMm,
                  candidate.localPose.normalOffsetMm
                ]
              }
            );

            if (!articulationSolveResult.reachable) {
              errors.push(...articulationSolveResult.errors);
            }
          }
        }

        const constrainedThicknessPoints = compatiblePoints.filter(
          (point) => point.constraints.requiredThicknessMm
        );
        if (constrainedThicknessPoints.length > 0 && typeof surface.thicknessMm !== "number") {
          errors.push({
            code: "SURFACE_THICKNESS_MISSING",
            message: "Surface thickness must be authored before this mounted attachment can be validated.",
            severity: "error"
          });
        } else if (
          constrainedThicknessPoints.length > 0 &&
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

        const clearanceRequirements = compatiblePoints
          .map((point) => point.constraints.minClearanceMm)
          .filter((value): value is number => typeof value === "number");
        if (
          candidate.attachmentType === "grommet_hole" &&
          !compatiblePoints.some(
            (point) =>
              typeof point.constraints.holeDiameterMm === "number" &&
              Number.isFinite(point.constraints.holeDiameterMm) &&
              point.constraints.holeDiameterMm > 0
          )
        ) {
          errors.push({
            code: "GROMMET_HOLE_DIAMETER_MISSING",
            message: "Grommet-hole attachments must declare an authored hole diameter.",
            severity: "error"
          });
        }

        if (
          candidate.attachmentType === "underside_screw" &&
          clearanceRequirements.length > 0 &&
          candidate.localPose.normalOffsetMm < Math.min(...clearanceRequirements)
        ) {
          errors.push({
            code: "KNEE_CLEARANCE_INSUFFICIENT",
            message: "Underside screw attachment does not preserve the required knee clearance.",
            severity: "error"
          });
        }

        const footprint = resolveLocalFootprintBounds(
          candidate.localPose,
          runtimeAsset.dimensionsMm,
          surface.type
        );

        if (validatesMountedPoint) {
          const pointInsideSurface =
            candidate.localPose.uMm >= surface.boundsMm.min[0] &&
            candidate.localPose.uMm <= surface.boundsMm.max[0] &&
            candidate.localPose.vMm >= surface.boundsMm.min[1] &&
            candidate.localPose.vMm <= surface.boundsMm.max[1];
          if (!pointInsideSurface) {
            errors.push({
              code: "MOUNTED_POINT_OUTSIDE_SURFACE",
              message: "Mounted attachment point must remain inside the focused support surface.",
              severity: "error"
            });
          }

          if (candidate.localPose.normalOffsetMm < 0) {
            errors.push({
              code: "MOUNTED_NORMAL_OFFSET_INVALID",
              message: "Mounted attachment normal offset must stay outside the support surface.",
              severity: "error"
            });
          }
        }

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

        if (candidate.attachmentType === "underside_screw") {
          if (!rectContainedBySurface(footprint, surface)) {
            errors.push({
              code: "UNDERSIDE_FOOTPRINT_EXCEEDED",
              message: "Underside mounted accessory footprint must remain below the desk surface.",
              severity: "error"
            });
          }

          if (surface.noPlaceZones?.some((zone) => rectOverlapsSurfaceZone(footprint, zone))) {
            errors.push({
              code: "KNEE_ZONE_OVERLAP",
              message: "Underside mounted accessory overlaps the reserved knee-clearance zone.",
              severity: "error"
            });
          }
        }

        if (candidate.attachmentType === "cable_route") {
          const routeReport = this.cableRouteSolver.validate(candidate.cableRoute, surface);
          errors.push(...routeReport.errors);
          warnings.push(...routeReport.warnings);
        }

        const edgeClearanceMm = resolveSurfaceEdgeClearanceMm(footprint, surface);
        if (candidate.attachmentType === "edge_clamp") {
          const edgeBandMm = 24;
          const vEdgeDistance = Math.min(
            Math.abs(candidate.localPose.vMm - surface.boundsMm.min[1]),
            Math.abs(surface.boundsMm.max[1] - candidate.localPose.vMm)
          );
          if (vEdgeDistance > edgeBandMm) {
            errors.push({
              code: "EDGE_CLAMP_NOT_ON_EDGE",
              message: "Edge clamp placement must stay close to the support edge.",
              severity: "error"
            });
          }
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
