import type { ArticulationDefinition } from "@deskterioronline/scene-schema";
import type { ConstraintIssue } from "./types";

export type MonitorArmTargetPose = {
  positionMm: [number, number, number];
  rollDeg?: number;
};

export type MonitorArmSolveResult = {
  reachable: boolean;
  joints: Record<string, number>;
  errors: ConstraintIssue[];
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function dominantAxis(axis: [number, number, number]) {
  const absolute = axis.map((value) => Math.abs(value)) as [number, number, number];
  if (absolute[0] >= absolute[1] && absolute[0] >= absolute[2]) {
    return "x";
  }
  if (absolute[1] >= absolute[0] && absolute[1] >= absolute[2]) {
    return "y";
  }
  return "z";
}

function resolveProjectedDistanceMm(
  axis: [number, number, number],
  positionMm: [number, number, number]
) {
  const normalizedMagnitude = Math.max(
    Math.sqrt(axis[0] * axis[0] + axis[1] * axis[1] + axis[2] * axis[2]),
    1
  );

  return (
    (axis[0] * positionMm[0] + axis[1] * positionMm[1] + axis[2] * positionMm[2]) /
    normalizedMagnitude
  );
}

function resolveTargetAngleDeg(
  axis: [number, number, number],
  positionMm: [number, number, number],
  rollDeg: number
) {
  switch (dominantAxis(axis)) {
    case "x":
      return (Math.atan2(positionMm[1], Math.max(positionMm[2], 1)) * 180) / Math.PI;
    case "y":
      return (Math.atan2(positionMm[0], Math.max(positionMm[2], 1)) * 180) / Math.PI;
    case "z":
    default:
      return rollDeg;
  }
}

export class MonitorArmSolver {
  solve(
    articulation: ArticulationDefinition,
    targetPose: MonitorArmTargetPose
  ): MonitorArmSolveResult {
    const joints: Record<string, number> = {};
    const errors: ConstraintIssue[] = [];

    if (articulation.type !== "monitor_arm") {
      return {
        reachable: false,
        joints,
        errors: [
          {
            code: "ARTICULATION_UNSUPPORTED",
            message: "Only monitor-arm articulation is supported by this solver.",
            severity: "error"
          }
        ]
      };
    }

    const rollDeg = targetPose.rollDeg ?? 0;

    for (const joint of articulation.joints) {
      if (joint.type === "fixed") {
        joints[joint.id] = joint.defaultValue;
        continue;
      }

      if (joint.type === "prismatic") {
        const targetValue = resolveProjectedDistanceMm(
          joint.axis as [number, number, number],
          targetPose.positionMm
        );
        if (!joint.limitMm) {
          joints[joint.id] = targetValue;
          continue;
        }

        const clamped = clamp(targetValue, joint.limitMm[0], joint.limitMm[1]);
        joints[joint.id] = clamped;
        if (clamped !== targetValue) {
          errors.push({
            code: "ARTICULATION_TARGET_UNREACHABLE",
            message: `Joint ${joint.id} exceeds its prismatic travel limit.`,
            severity: "error"
          });
        }
        continue;
      }

      const targetAngleDeg = resolveTargetAngleDeg(
        joint.axis as [number, number, number],
        targetPose.positionMm,
        rollDeg
      );
      if (!joint.limitDeg) {
        joints[joint.id] = targetAngleDeg;
        continue;
      }

      const clamped = clamp(targetAngleDeg, joint.limitDeg[0], joint.limitDeg[1]);
      joints[joint.id] = clamped;
      if (clamped !== targetAngleDeg) {
        errors.push({
          code: "ARTICULATION_TARGET_UNREACHABLE",
          message: `Joint ${joint.id} exceeds its angular limit.`,
          severity: "error"
        });
      }
    }

    return {
      reachable: errors.length === 0,
      joints,
      errors
    };
  }
}
