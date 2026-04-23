import type {
  CollisionReport,
  ConstraintReport,
  PlacementTransactionState
} from "@deskterioronline/placement-kernel";
import type {
  RuntimeAsset,
  SurfaceLocalPose,
  SupportSurface
} from "@deskterioronline/scene-schema";
import type { SceneAsset } from "../stores/useSceneStore";

export type FocusPlacementAttachmentType =
  | "place_on_surface"
  | "edge_clamp"
  | "underside_screw"
  | "wall_attach";

export type FocusPlacementSurfaceCandidate = {
  surfaceId: string;
  surfaceLabel: string;
  surfaceType: SupportSurface["type"];
  attachmentType: FocusPlacementAttachmentType;
  surfaceBoundsMm: SupportSurface["boundsMm"];
  noPlaceZones: NonNullable<SupportSurface["noPlaceZones"]>;
  preferredZones: NonNullable<SupportSurface["preferredZones"]>;
  enabled: boolean;
  tone: "ready" | "blocked" | "info";
  reason: string | null;
};

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

export type FocusPlacementEntry = {
  candidates: FocusPlacementSurfaceCandidate[];
  preferredCandidateIndex: number;
  availability: FocusPlacementAvailability;
};

const FOCUS_ATTACHMENT_TYPES: FocusPlacementAttachmentType[] = [
  "place_on_surface",
  "edge_clamp",
  "underside_screw",
  "wall_attach"
];

const SURFACE_TYPE_PRIORITY: Record<SupportSurface["type"], number> = {
  desktop_top: 0,
  shelf_top: 1,
  desk_edge: 2,
  desk_underside: 3,
  wall: 4,
  monitor_back: 5,
  pegboard: 6,
  floor: 7
};

function isFocusPlacementAttachmentType(value: string): value is FocusPlacementAttachmentType {
  return FOCUS_ATTACHMENT_TYPES.includes(value as FocusPlacementAttachmentType);
}

function resolveCandidatePriority(
  candidate: FocusPlacementSurfaceCandidate,
  selectedRuntimeAsset: RuntimeAsset | null
) {
  const assetHasMountedAttachments = Boolean(
    selectedRuntimeAsset?.attachmentPoints.some(
      (point) => point.type !== "place_on_surface" && isFocusPlacementAttachmentType(point.type)
    )
  );
  const supportsMountedAttachment =
    candidate.attachmentType !== "place_on_surface" &&
    Boolean(
      selectedRuntimeAsset?.attachmentPoints.some(
        (point) => point.type === candidate.attachmentType
      )
    );
  const attachmentPriority = supportsMountedAttachment
    ? 0
    : candidate.attachmentType === "place_on_surface"
      ? assetHasMountedAttachments
        ? 20
        : 0
      : 10;

  return attachmentPriority + SURFACE_TYPE_PRIORITY[candidate.surfaceType];
}

function resolveCandidateState(input: {
  selectedAsset: SceneAsset | null;
  selectedRuntimeAsset: RuntimeAsset | null;
  supportAsset: SceneAsset;
  surface: SupportSurface;
  attachmentType: FocusPlacementAttachmentType;
}): Pick<FocusPlacementSurfaceCandidate, "enabled" | "tone" | "reason"> {
  const {
    selectedAsset,
    selectedRuntimeAsset,
    supportAsset,
    surface,
    attachmentType
  } = input;

  if (!selectedAsset) {
    return {
      enabled: false,
      tone: "info",
      reason: "배치할 제품을 먼저 선택하세요"
    };
  }

  if (selectedAsset.id === supportAsset.id) {
    return {
      enabled: false,
      tone: "blocked",
      reason: "다른 제품을 선택해야 배치할 수 있습니다"
    };
  }

  if (attachmentType === "place_on_surface") {
    if (!selectedAsset.product?.dimensionsMm) {
      return {
        enabled: false,
        tone: "blocked",
        reason: "선택한 제품에 실측 규격이 없어 정밀 배치할 수 없습니다"
      };
    }

    return {
      enabled: true,
      tone: "ready",
      reason: null
    };
  }

  if (!selectedRuntimeAsset) {
    return {
      enabled: false,
      tone: "blocked",
      reason: "선택한 제품의 설치 메타데이터가 아직 준비되지 않았습니다"
    };
  }

  const attachmentPoints = selectedRuntimeAsset.attachmentPoints.filter(
    (point) => point.type === attachmentType
  );
  if (attachmentPoints.length === 0) {
    return {
      enabled: false,
      tone: "blocked",
      reason: `선택한 제품은 ${resolveFocusPlacementAttachmentLabel(attachmentType)} 설치를 지원하지 않습니다`
    };
  }

  const compatiblePoints = attachmentPoints.filter(
    (point) =>
      point.compatibleWith.length === 0 ||
      point.compatibleWith.includes(surface.id) ||
      point.compatibleWith.includes(surface.type)
  );
  if (compatiblePoints.length === 0) {
    return {
      enabled: false,
      tone: "blocked",
      reason: "선택한 제품의 설치 포인트가 이 표면과 호환되지 않습니다"
    };
  }

  const constrainedThicknessPoints = compatiblePoints.filter(
    (point) => point.constraints.requiredThicknessMm
  );
  if (
    constrainedThicknessPoints.length > 0 &&
    typeof surface.thicknessMm === "number" &&
    !constrainedThicknessPoints.some((point) => {
      const range = point.constraints.requiredThicknessMm;
      return range && surface.thicknessMm >= range[0] && surface.thicknessMm <= range[1];
    })
  ) {
    return {
      enabled: false,
      tone: "blocked",
      reason: "표면 두께가 선택한 제품의 설치 조건과 맞지 않습니다"
    };
  }

  return {
    enabled: true,
    tone: "ready",
    reason: null
  };
}

export function resolveFocusSurfaceLabel(surface: SupportSurface) {
  switch (surface.type) {
    case "desktop_top":
      return "Desk Top";
    case "desk_edge":
      return "Desk Edge";
    case "desk_underside":
      return "Under Desk";
    case "wall":
      return "Wall";
    case "shelf_top":
      return "Shelf Top";
    case "monitor_back":
      return "Monitor Back";
    case "pegboard":
      return "Pegboard";
    case "floor":
      return "Floor";
    default:
      return surface.id;
  }
}

export function resolveFocusPlacementAvailability(
  candidates: FocusPlacementSurfaceCandidate[]
): FocusPlacementAvailability {
  if (candidates.length === 0) {
    return {
      enabled: false,
      hint: "이 표면은 아직 정밀 배치를 지원하지 않습니다",
      tone: "info"
    };
  }

  const firstReadyCandidate = candidates.find((candidate) => candidate.enabled);
  if (firstReadyCandidate) {
    return {
      enabled: true,
      hint: candidates.length > 1 ? "정밀 배치 · Tab으로 설치 방식 전환" : "정밀 배치",
      tone: "ready"
    };
  }

  return {
    enabled: false,
    hint: candidates[0]?.reason ?? "정밀 배치를 시작할 수 없습니다",
    tone: candidates[0]?.tone ?? "info"
  };
}

export function resolveFocusPlacementEntry(input: {
  selectedAsset: SceneAsset | null;
  selectedRuntimeAsset: RuntimeAsset | null;
  supportAsset: SceneAsset;
  supportSurfaces: SupportSurface[];
}): FocusPlacementEntry {
  const { selectedAsset, selectedRuntimeAsset, supportAsset, supportSurfaces } = input;
  const candidates = supportSurfaces
    .flatMap((surface) =>
      surface.allowedAttachments
        .filter(isFocusPlacementAttachmentType)
        .map((attachmentType) => {
          const state = resolveCandidateState({
            selectedAsset,
            selectedRuntimeAsset,
            supportAsset,
            surface,
            attachmentType
          });
          return {
            surfaceId: surface.id,
            surfaceLabel: resolveFocusSurfaceLabel(surface),
            surfaceType: surface.type,
            attachmentType,
            surfaceBoundsMm: surface.boundsMm,
            noPlaceZones: surface.noPlaceZones ?? [],
            preferredZones: surface.preferredZones ?? [],
            enabled: state.enabled,
            tone: state.tone,
            reason: state.reason
          } satisfies FocusPlacementSurfaceCandidate;
        })
    )
    .sort((left, right) => {
      if (left.enabled !== right.enabled) {
        return left.enabled ? -1 : 1;
      }

      return (
        resolveCandidatePriority(left, selectedRuntimeAsset) -
        resolveCandidatePriority(right, selectedRuntimeAsset)
      );
    });

  const preferredCandidateIndex = Math.max(
    0,
    candidates.findIndex((candidate) => candidate.enabled)
  );

  return {
    candidates,
    preferredCandidateIndex,
    availability: resolveFocusPlacementAvailability(candidates)
  };
}

export function resolveNextFocusPlacementCandidateIndex(
  candidates: FocusPlacementSurfaceCandidate[],
  activeIndex: number,
  direction: 1 | -1 = 1
) {
  if (candidates.length === 0) {
    return -1;
  }

  const normalizedIndex = ((activeIndex % candidates.length) + candidates.length) % candidates.length;
  return (normalizedIndex + direction + candidates.length) % candidates.length;
}

export function resolveFocusPlacementStepConfig(
  attachmentType: FocusPlacementAttachmentType,
  surfaceType: SupportSurface["type"]
) {
  if (
    attachmentType === "edge_clamp" ||
    surfaceType === "desk_edge" ||
    attachmentType === "underside_screw" ||
    surfaceType === "desk_underside" ||
    attachmentType === "wall_attach" ||
    surfaceType === "wall"
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

export function resolveFocusPlacementAttachmentLabel(
  attachmentType: FocusPlacementAttachmentType
) {
  switch (attachmentType) {
    case "edge_clamp":
      return "Edge Clamp";
    case "underside_screw":
      return "Under Desk";
    case "wall_attach":
      return "Wall Mount";
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
