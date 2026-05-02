import type { CollisionReport, ConstraintReport } from "@deskterioronline/placement-kernel";
import type {
  BlockedReason,
  BlockedReasonCode,
  CandidateVisualAffordance,
  InteractionSurfaceCandidate,
  RankedInteractionSurfaceCandidate
} from "./types";

const DEFAULT_REASON_MESSAGES: Record<BlockedReasonCode, string> = {
  NO_SURFACE: "No compatible support surface is available.",
  INCOMPATIBLE_ATTACHMENT: "The selected product cannot attach to this surface.",
  OUT_OF_SURFACE_BOUNDS: "The placement footprint is outside the support surface bounds.",
  COLLISION: "The preview collides with another object.",
  INSUFFICIENT_CLEARANCE: "The placement does not have enough required clearance.",
  UNREACHABLE_ARM_TARGET: "The articulated support cannot reach this target pose.",
  INVALID_CABLE_ROUTE: "The cable route is invalid for this support surface.",
  SCALE_LOCKED: "This product is scale locked.",
  READ_ONLY: "This scene is read-only.",
  MISSING_METADATA: "Required placement metadata is missing."
};

function clampUnit(value: number | undefined, fallback = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(Math.max(value, 0), 1);
}

function positive(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(value, 0);
}

export function createBlockedReason(
  code: BlockedReasonCode,
  message = DEFAULT_REASON_MESSAGES[code],
  source: BlockedReason["source"] = "candidate",
  severity: BlockedReason["severity"] = "error"
): BlockedReason {
  return {
    code,
    message,
    source,
    severity
  };
}

export function inferCandidateBlockedReasons(
  candidate: InteractionSurfaceCandidate
): BlockedReason[] {
  const explicitReasons = candidate.blockedReasons ?? [];
  if (candidate.enabled) {
    return explicitReasons;
  }

  if (explicitReasons.length > 0) {
    return explicitReasons;
  }

  const reason = candidate.reason ?? "";
  const lowerReason = reason.toLowerCase();
  if (
    lowerReason.includes("metadata") ||
    lowerReason.includes("dimension") ||
    lowerReason.includes("실측") ||
    lowerReason.includes("메타데이터")
  ) {
    return [createBlockedReason("MISSING_METADATA", reason || undefined, "metadata")];
  }
  if (
    lowerReason.includes("compatible") ||
    lowerReason.includes("attachment") ||
    lowerReason.includes("호환") ||
    lowerReason.includes("설치")
  ) {
    return [createBlockedReason("INCOMPATIBLE_ATTACHMENT", reason || undefined, "candidate")];
  }
  if (
    lowerReason.includes("bounds") ||
    lowerReason.includes("surface") ||
    lowerReason.includes("표면")
  ) {
    return [createBlockedReason("OUT_OF_SURFACE_BOUNDS", reason || undefined, "candidate")];
  }

  return [createBlockedReason("NO_SURFACE", reason || undefined, "candidate")];
}

export function resolveCandidateScore(candidate: InteractionSurfaceCandidate) {
  const ranking = candidate.ranking ?? {};
  const positiveScore =
    clampUnit(ranking.rayHitConfidence, 0.5) +
    clampUnit(ranking.attachmentCompatibility, candidate.enabled ? 1 : 0) +
    clampUnit(ranking.surfaceVisibility, 0.5) +
    clampUnit(ranking.distancePriority, 0.5) +
    positive(ranking.userSelectedSupportBonus) +
    positive(ranking.preferredSurfaceBonus);
  const penalty =
    positive(ranking.collisionPenalty) +
    positive(ranking.clearancePenalty) +
    positive(ranking.outOfBoundsPenalty) +
    (candidate.enabled ? 0 : 10);

  return Number((positiveScore - penalty).toFixed(4));
}

export function resolveCandidateVisualAffordance(
  candidate: InteractionSurfaceCandidate,
  blockedReasons: BlockedReason[]
): CandidateVisualAffordance {
  if (candidate.visualAffordance) {
    return candidate.visualAffordance;
  }

  const tone =
    blockedReasons.some((reason) => reason.severity === "error")
      ? "blocked"
      : blockedReasons.length > 0
        ? "warning"
        : candidate.enabled
          ? "valid"
          : "info";
  const outline =
    candidate.attachmentType === "edge_clamp"
      ? "edge-band"
      : candidate.attachmentType === "vesa_mount" ||
          candidate.attachmentType === "grommet_hole" ||
          candidate.attachmentType === "wall_screw" ||
          candidate.attachmentType === "wall_attach"
        ? "mount-target"
        : candidate.enabled
          ? "surface-ring"
          : "ghost-only";

  return {
    tone,
    outline,
    label: candidate.surfaceLabel ?? candidate.surfaceId
  };
}

export function rankInteractionCandidates(
  candidates: InteractionSurfaceCandidate[]
): RankedInteractionSurfaceCandidate[] {
  return candidates
    .map((candidate) => {
      const blockedReasons = inferCandidateBlockedReasons(candidate);
      return {
        ...candidate,
        blockedReasons,
        score: resolveCandidateScore(candidate),
        rank: 0,
        visualAffordance: resolveCandidateVisualAffordance(candidate, blockedReasons)
      };
    })
    .sort((left, right) => {
      if (left.enabled !== right.enabled) {
        return left.enabled ? -1 : 1;
      }
      return right.score - left.score;
    })
    .map((candidate, index) => ({
      ...candidate,
      rank: index
    }));
}

function mapConstraintCode(code: string): BlockedReasonCode {
  const normalized = code.toUpperCase();
  if (normalized.includes("COLLISION")) {
    return "COLLISION";
  }
  if (normalized.includes("BOUND") || normalized.includes("FOOTPRINT")) {
    return "OUT_OF_SURFACE_BOUNDS";
  }
  if (
    normalized.includes("ATTACH") ||
    normalized.includes("COMPAT") ||
    normalized.includes("VESA") ||
    normalized.includes("THICKNESS")
  ) {
    return "INCOMPATIBLE_ATTACHMENT";
  }
  if (normalized.includes("CLEARANCE") || normalized.includes("SEPARATION")) {
    return "INSUFFICIENT_CLEARANCE";
  }
  if (normalized.includes("ARTICULATION") || normalized.includes("REACH")) {
    return "UNREACHABLE_ARM_TARGET";
  }
  if (normalized.includes("CABLE") || normalized.includes("ROUTE")) {
    return "INVALID_CABLE_ROUTE";
  }
  if (normalized.includes("SCALE")) {
    return "SCALE_LOCKED";
  }
  return "MISSING_METADATA";
}

export function resolveBlockedReasonsFromReports(
  constraintReport: ConstraintReport | null,
  collisionReport: CollisionReport | null
): BlockedReason[] {
  const reasons: BlockedReason[] = [];

  if (collisionReport?.collided) {
    for (const collision of collisionReport.collisions) {
      reasons.push(
        createBlockedReason(
          "COLLISION",
          collision.reason || DEFAULT_REASON_MESSAGES.COLLISION,
          "collision"
        )
      );
    }
  }

  for (const issue of constraintReport?.errors ?? []) {
    reasons.push(
      createBlockedReason(
        mapConstraintCode(issue.code),
        issue.message,
        "constraint",
        issue.severity
      )
    );
  }

  return reasons;
}
