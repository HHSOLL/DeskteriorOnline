import type { CableRouteRecord, SupportSurface } from "@deskterioronline/scene-schema";
import type { ConstraintIssue } from "./types";

export type CableRouteValidationResult = {
  valid: boolean;
  errors: ConstraintIssue[];
  warnings: ConstraintIssue[];
  lengthMm: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function distanceMm(
  left: { uMm: number; vMm: number; normalOffsetMm?: number },
  right: { uMm: number; vMm: number; normalOffsetMm?: number }
) {
  const du = left.uMm - right.uMm;
  const dv = left.vMm - right.vMm;
  const dn = (left.normalOffsetMm ?? 0) - (right.normalOffsetMm ?? 0);
  return Math.sqrt(du * du + dv * dv + dn * dn);
}

function pointInsideSurface(
  point: { uMm: number; vMm: number },
  surface: SupportSurface
) {
  return (
    point.uMm >= surface.boundsMm.min[0] &&
    point.uMm <= surface.boundsMm.max[0] &&
    point.vMm >= surface.boundsMm.min[1] &&
    point.vMm <= surface.boundsMm.max[1]
  );
}

function pointInsideZone(
  point: { uMm: number; vMm: number },
  zone: { min: [number, number]; max: [number, number] }
) {
  return (
    point.uMm >= zone.min[0] &&
    point.uMm <= zone.max[0] &&
    point.vMm >= zone.min[1] &&
    point.vMm <= zone.max[1]
  );
}

export class CableRouteSolver {
  validate(route: CableRouteRecord | undefined, surface?: SupportSurface | null): CableRouteValidationResult {
    const errors: ConstraintIssue[] = [];
    const warnings: ConstraintIssue[] = [];

    if (!surface) {
      return {
        valid: false,
        errors: [
          {
            code: "CABLE_ROUTE_SURFACE_MISSING",
            message: "Cable route validation requires a support surface.",
            severity: "error"
          }
        ],
        warnings,
        lengthMm: 0
      };
    }

    if (!route || !Array.isArray(route.waypoints) || route.waypoints.length < 2) {
      return {
        valid: false,
        errors: [
          {
            code: "CABLE_ROUTE_WAYPOINTS_MISSING",
            message: "Cable route placement requires at least two route waypoints.",
            severity: "error"
          }
        ],
        warnings,
        lengthMm: 0
      };
    }

    let lengthMm = 0;
    route.waypoints.forEach((waypoint, index) => {
      if (
        !isFiniteNumber(waypoint.uMm) ||
        !isFiniteNumber(waypoint.vMm) ||
        (waypoint.normalOffsetMm !== undefined && !isFiniteNumber(waypoint.normalOffsetMm))
      ) {
        errors.push({
          code: "CABLE_ROUTE_WAYPOINT_INVALID",
          message: `Cable route waypoint ${index} must use finite local coordinates.`,
          severity: "error"
        });
        return;
      }

      if (!pointInsideSurface(waypoint, surface)) {
        errors.push({
          code: "CABLE_ROUTE_WAYPOINT_OUT_OF_BOUNDS",
          message: `Cable route waypoint ${index} is outside the focused support surface.`,
          severity: "error"
        });
      }

      if (
        surface.noPlaceZones?.some((zone) => pointInsideZone(waypoint, zone))
      ) {
        errors.push({
          code: "CABLE_ROUTE_RESTRICTED_ZONE",
          message: `Cable route waypoint ${index} crosses a restricted zone.`,
          severity: "error"
        });
      }

      if (index > 0) {
        lengthMm += distanceMm(route.waypoints[index - 1]!, waypoint);
      }
    });

    if (route.bendRadiusMm !== undefined && (!isFiniteNumber(route.bendRadiusMm) || route.bendRadiusMm < 0)) {
      errors.push({
        code: "CABLE_ROUTE_BEND_RADIUS_INVALID",
        message: "Cable route bend radius must be a positive finite value.",
        severity: "error"
      });
    }

    if (route.slackMm !== undefined && (!isFiniteNumber(route.slackMm) || route.slackMm < 0)) {
      errors.push({
        code: "CABLE_ROUTE_SLACK_INVALID",
        message: "Cable route slack must be a positive finite value.",
        severity: "error"
      });
    } else if (route.slackMm !== undefined && route.slackMm > lengthMm * 0.5) {
      warnings.push({
        code: "CABLE_ROUTE_SLACK_HIGH",
        message: "Cable route slack is high relative to the route length.",
        severity: "warning"
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      lengthMm
    };
  }
}
