import type { InteractionSurfaceCandidate } from "@deskterioronline/interaction-engine";
import type { FocusPlacementRequest, FocusPlacementSession } from "../stores/useFocusPlacementStore";

export const WALK_FOCUS_PLACEMENT_AIM_EVENT = "deskterioronline:focus-placement:aim";

export type WalkFocusPlacementAimDetail = {
  request: FocusPlacementRequest;
  rayHitConfidence: number;
  source: "crosshair";
  targetName?: string | null;
};

type FocusPlacementRequestLike = FocusPlacementRequest | FocusPlacementSession;

function normalizeRayHitConfidence(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, value));
}

export function resolveWalkFocusPlacementAimKey(request: FocusPlacementRequest) {
  return [
    request.objectId,
    request.supportObjectId,
    request.surfaceId,
    request.attachmentType
  ].join(":");
}

export function resolveFocusPlacementAimRequest(target: { userData?: Record<string, unknown> } | null) {
  return (target?.userData?.focusPlacementAimRequest ?? null) as FocusPlacementRequest | null;
}

export function withFocusPlacementAimMetadata(
  request: FocusPlacementRequest,
  rayHitConfidence: number
): FocusPlacementRequest {
  const aimRayHitConfidence = normalizeRayHitConfidence(rayHitConfidence);
  if (aimRayHitConfidence === null) {
    return request;
  }

  return {
    ...request,
    aimRayHitConfidence
  };
}

export function dispatchWalkFocusPlacementAim(detail: WalkFocusPlacementAimDetail) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<WalkFocusPlacementAimDetail>(WALK_FOCUS_PLACEMENT_AIM_EVENT, {
      detail
    })
  );
}

export function focusPlacementRequestToInteractionCandidates(
  request: FocusPlacementRequestLike,
  rayHitConfidence?: number
): InteractionSurfaceCandidate[] {
  const resolvedRayHitConfidence =
    normalizeRayHitConfidence(rayHitConfidence) ??
    normalizeRayHitConfidence(request.aimRayHitConfidence) ??
    0.8;

  return request.surfaceCandidates.map((candidate, index) => ({
    supportObjectId: request.supportObjectId,
    surfaceId: candidate.surfaceId,
    surfaceLabel: candidate.surfaceLabel,
    surfaceType: candidate.surfaceType,
    attachmentType: candidate.attachmentType,
    enabled: candidate.enabled,
    reason: candidate.reason,
    blockedReasons: candidate.blockedReasons,
    surfaceBoundsMm: candidate.surfaceBoundsMm,
    noPlaceZones: candidate.noPlaceZones,
    preferredZones: candidate.preferredZones,
    visualAffordance: candidate.visualAffordance,
    ranking: {
      ...candidate.ranking,
      rayHitConfidence: resolvedRayHitConfidence,
      attachmentCompatibility: candidate.enabled ? 1 : 0,
      surfaceVisibility: candidate.ranking.surfaceVisibility ?? 0.75,
      distancePriority: Math.max(candidate.ranking.distancePriority ?? 0, 1 - index * 0.05),
      userSelectedSupportBonus: (candidate.ranking.userSelectedSupportBonus ?? 0) + 0.5,
      preferredSurfaceBonus:
        (candidate.ranking.preferredSurfaceBonus ?? 0) +
        (index === request.preferredCandidateIndex ? 0.5 : 0),
      outOfBoundsPenalty: candidate.enabled ? 0 : 1
    }
  }));
}
