import type { RuntimeObjectRecord, RuntimeWorldTransform } from "@deskterioronline/engine-core";
import type { PlacementRecord, SurfacePlacementRecord, SupportSurface } from "@deskterioronline/scene-schema";

function rotateY(vector: [number, number, number], yawRad: number): [number, number, number] {
  const cos = Math.cos(yawRad);
  const sin = Math.sin(yawRad);
  return [
    vector[0] * cos + vector[2] * sin,
    vector[1],
    -vector[0] * sin + vector[2] * cos
  ];
}

function addScaledMm(
  targetMeters: [number, number, number],
  vectorMm: [number, number, number],
  scaleMm: number
) {
  targetMeters[0] += (vectorMm[0] * scaleMm) / 1_000_000;
  targetMeters[1] += (vectorMm[1] * scaleMm) / 1_000_000;
  targetMeters[2] += (vectorMm[2] * scaleMm) / 1_000_000;
}

export function resolveSurfaceLocalWorldTransform(input: {
  placement: SurfacePlacementRecord;
  runtimeObject: RuntimeObjectRecord;
  supportObject: RuntimeObjectRecord;
  surface: SupportSurface;
}): RuntimeWorldTransform {
  const supportTransform = input.supportObject.previewTransform ?? input.supportObject.transform;
  const supportYaw = supportTransform.rotation[1] ?? 0;
  const frame = input.surface.localFrame;
  const position = [...supportTransform.position] as [number, number, number];

  addScaledMm(position, rotateY(frame.originMm, supportYaw), 1000);
  addScaledMm(position, rotateY(frame.tangentU, supportYaw), input.placement.localPose.uMm);
  addScaledMm(position, rotateY(frame.tangentV, supportYaw), input.placement.localPose.vMm);
  addScaledMm(position, rotateY(frame.normal, supportYaw), input.placement.localPose.normalOffsetMm);

  return {
    position,
    rotation: [
      supportTransform.rotation[0],
      supportYaw + (input.placement.localPose.rotationMilliDeg * Math.PI) / 180000,
      supportTransform.rotation[2]
    ],
    scale: [
      input.placement.scalePermille[0] / 1000,
      input.placement.scalePermille[1] / 1000,
      input.placement.scalePermille[2] / 1000
    ]
  };
}

export function buildSurfacePlacementFromCandidate(input: {
  candidate: {
    supportObjectId: string;
    surfaceId: string;
    attachmentType: SurfacePlacementRecord["attachmentType"];
    localPose: SurfacePlacementRecord["localPose"];
    cableRoute?: SurfacePlacementRecord["cableRoute"];
  };
  scalePermille: SurfacePlacementRecord["scalePermille"];
}): PlacementRecord {
  return {
    mode: "surface_local",
    supportObjectId: input.candidate.supportObjectId,
    surfaceId: input.candidate.surfaceId,
    attachmentType: input.candidate.attachmentType,
    localPose: input.candidate.localPose,
    ...(input.candidate.cableRoute ? { cableRoute: input.candidate.cableRoute } : {}),
    scalePermille: input.scalePermille
  };
}
