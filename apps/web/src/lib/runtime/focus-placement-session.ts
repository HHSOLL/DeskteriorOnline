import type {
  CollisionReport,
  ConstraintReport,
  PlacementTransactionState
} from "@deskterioronline/placement-kernel";
import type { SurfaceLocalPose, SupportSurface } from "@deskterioronline/scene-schema";
import type { SceneAsset } from "../stores/useSceneStore";

export type FocusPlacementAvailability = {
  enabled: boolean;
  hint: string;
  tone: "ready" | "blocked" | "info";
};

export type FocusPlacementFeedback = {
  tone: "ready" | "warning" | "blocked";
  badgeLabel: "Ready" | "Warning" | "Blocked";
  detail: string | null;
  blocked: boolean;
};

export function resolveFocusPlacementAvailability(input: {
  selectedAsset: SceneAsset | null;
  supportAsset: SceneAsset;
  focusSurface: SupportSurface | null;
}): FocusPlacementAvailability {
  const { selectedAsset, supportAsset, focusSurface } = input;
  if (!focusSurface || !focusSurface.allowedAttachments.includes("place_on_surface")) {
    return {
      enabled: false,
      hint: "이 표면은 아직 정밀 배치를 지원하지 않습니다",
      tone: "info"
    };
  }

  if (!selectedAsset) {
    return {
      enabled: false,
      hint: "배치할 제품을 먼저 선택하세요",
      tone: "info"
    };
  }

  if (selectedAsset.id === supportAsset.id) {
    return {
      enabled: false,
      hint: "다른 제품을 선택해야 배치할 수 있습니다",
      tone: "blocked"
    };
  }

  if (!selectedAsset.product?.dimensionsMm) {
    return {
      enabled: false,
      hint: "선택한 제품에 실측 규격이 없어 정밀 배치할 수 없습니다",
      tone: "blocked"
    };
  }

  return {
    enabled: true,
    hint: "정밀 배치",
    tone: "ready"
  };
}

export function resolveFocusPlacementFeedback(
  constraintReport: ConstraintReport | null,
  collisionReport: CollisionReport | null
): FocusPlacementFeedback {
  if (collisionReport?.collided) {
    return {
      tone: "blocked",
      badgeLabel: "Blocked",
      detail: collisionReport.collisions[0]?.reason ?? "Collision detected.",
      blocked: true
    };
  }

  if (constraintReport && !constraintReport.valid) {
    return {
      tone: "blocked",
      badgeLabel: "Blocked",
      detail: constraintReport.errors[0]?.message ?? "Placement is blocked.",
      blocked: true
    };
  }

  if ((constraintReport?.warnings.length ?? 0) > 0) {
    return {
      tone: "warning",
      badgeLabel: "Warning",
      detail: constraintReport?.warnings[0]?.message ?? "Placement needs attention.",
      blocked: false
    };
  }

  return {
    tone: "ready",
    badgeLabel: "Ready",
    detail: null,
    blocked: false
  };
}

export function resolveFocusPlacementAttachmentLabel(attachmentType: "place_on_surface") {
  switch (attachmentType) {
    case "place_on_surface":
    default:
      return "Place On Surface";
  }
}

export function resolveFocusPlacementSessionUpdate(
  requestedLocalPose: SurfaceLocalPose,
  nextState: PlacementTransactionState
) {
  return {
    localPose: nextState.activeCandidate?.localPose ?? requestedLocalPose,
    constraintReport: nextState.constraintReport,
    collisionReport: nextState.collisionReport
  };
}
