import type { AttachmentType, SurfaceLocalPose, SupportSurface } from "@deskterioronline/scene-schema";

export type SnapRule = {
  moveStepMm: number;
  rotateStepMilliDeg: number;
};

function snapToStep(value: number, step: number) {
  if (step <= 0) {
    return value;
  }
  return Math.round(value / step) * step;
}

export class SnapCandidateGenerator {
  resolveRule(
    attachmentType: AttachmentType,
    surface?: SupportSurface | null
  ): SnapRule {
    if (attachmentType === "edge_clamp" || surface?.type === "desk_edge") {
      return {
        moveStepMm: 10,
        rotateStepMilliDeg: 5000
      };
    }

    if (
      attachmentType === "wall_attach" ||
      attachmentType === "wall_screw" ||
      surface?.type === "wall"
    ) {
      return {
        moveStepMm: 10,
        rotateStepMilliDeg: 5000
      };
    }

    return {
      moveStepMm: 5,
      rotateStepMilliDeg: 1000
    };
  }

  snapLocalPose(
    localPose: SurfaceLocalPose,
    attachmentType: AttachmentType,
    surface?: SupportSurface | null
  ): SurfaceLocalPose {
    const rule = this.resolveRule(attachmentType, surface);
    return {
      uMm: snapToStep(localPose.uMm, rule.moveStepMm),
      vMm: snapToStep(localPose.vMm, rule.moveStepMm),
      normalOffsetMm: snapToStep(localPose.normalOffsetMm, rule.moveStepMm),
      rotationMilliDeg: snapToStep(localPose.rotationMilliDeg, rule.rotateStepMilliDeg)
    };
  }
}
