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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export class SnapCandidateGenerator {
  resolveRule(
    attachmentType: AttachmentType,
    surface?: SupportSurface | null
  ): SnapRule {
    if (
      attachmentType === "edge_clamp" ||
      attachmentType === "underside_screw" ||
      attachmentType === "vesa_mount" ||
      attachmentType === "cable_route" ||
      surface?.type === "desk_edge" ||
      surface?.type === "desk_underside" ||
      surface?.type === "monitor_back"
    ) {
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
    const snapped = {
      uMm: snapToStep(localPose.uMm, rule.moveStepMm),
      vMm: snapToStep(localPose.vMm, rule.moveStepMm),
      normalOffsetMm: snapToStep(localPose.normalOffsetMm, rule.moveStepMm),
      rotationMilliDeg: snapToStep(localPose.rotationMilliDeg, rule.rotateStepMilliDeg)
    };

    if (
      surface &&
      (
        attachmentType === "edge_clamp" ||
        attachmentType === "underside_screw" ||
        attachmentType === "vesa_mount" ||
        attachmentType === "cable_route"
      )
    ) {
      return {
        ...snapped,
        uMm: clamp(snapped.uMm, surface.boundsMm.min[0], surface.boundsMm.max[0]),
        vMm: clamp(snapped.vMm, surface.boundsMm.min[1], surface.boundsMm.max[1]),
        normalOffsetMm: Math.max(0, snapped.normalOffsetMm)
      };
    }

    return snapped;
  }
}
