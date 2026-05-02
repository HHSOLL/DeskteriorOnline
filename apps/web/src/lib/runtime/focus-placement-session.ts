import type {
  CollisionReport,
  ConstraintReport,
  PlacementTransactionState
} from "@deskterioronline/placement-kernel";
import {
  MonitorArmSolver,
  resolveLocalFootprintBounds,
  resolveSurfaceClearanceMm
} from "@deskterioronline/placement-kernel";
import type {
  RuntimeAsset,
  SurfaceLocalPose,
  SupportSurface
} from "@deskterioronline/scene-schema";
import {
  rankInteractionCandidates,
  type BlockedReason,
  type CandidateRankingSignals,
  type CandidateVisualAffordance,
  type RankedInteractionSurfaceCandidate
} from "@deskterioronline/interaction-engine";
import type { SceneAsset } from "../stores/useSceneStore";

export type FocusPlacementAttachmentType =
  | "place_on_surface"
  | "edge_clamp"
  | "underside_screw"
  | "grommet_hole"
  | "wall_screw"
  | "wall_attach"
  | "vesa_mount";

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
  ranking: CandidateRankingSignals;
  score: number;
  rank: number;
  blockedReasons: BlockedReason[];
  visualAffordance: CandidateVisualAffordance;
};

type FocusPlacementCandidateSeed = Omit<
  FocusPlacementSurfaceCandidate,
  "ranking" | "score" | "rank" | "blockedReasons" | "visualAffordance"
>;

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

export type FocusPlacementAxisLabels = {
  u: string;
  v: string;
  normal: string;
  rotation: string;
};

export type FocusPlacementWizardStep = {
  id: "clamp" | "vesa" | "target" | "commit";
  label: string;
  state: "done" | "active" | "blocked" | "pending";
};

export type FocusPlacementWizardJoint = {
  id: string;
  label: string;
  value: number;
  unit: "deg" | "mm";
};

export type FocusPlacementRequirement = {
  id: string;
  label: string;
  value: string;
  tone: "ready" | "warning" | "blocked" | "info";
};

export type FocusPlacementClearanceSummary = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  min: number;
};

export type FocusPlacementWizardState = {
  mode: "default" | "monitor_arm";
  title: string;
  subtitle: string | null;
  axisLabels: FocusPlacementAxisLabels;
  shortcutLines: string[];
  steps: FocusPlacementWizardStep[];
  joints: FocusPlacementWizardJoint[];
  requirements: FocusPlacementRequirement[];
  clearance: FocusPlacementClearanceSummary | null;
  detail: string | null;
  vesaPatternLabel: string | null;
  supportPatternLabel: string | null;
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
  "grommet_hole",
  "wall_screw",
  "wall_attach",
  "vesa_mount"
];

const DEFAULT_AXIS_LABELS: FocusPlacementAxisLabels = {
  u: "Offset U",
  v: "Offset V",
  normal: "Normal",
  rotation: "Rotation"
};

const MONITOR_ARM_AXIS_LABELS: FocusPlacementAxisLabels = {
  u: "Swing",
  v: "Height",
  normal: "Reach",
  rotation: "Roll"
};

const monitorArmSolver = new MonitorArmSolver();

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

function formatPatternLabel(pattern: [75, 75] | [100, 100] | [75, 100] | "both") {
  if (pattern === "both") {
    return "75x75 / 100x100";
  }
  return `${pattern[0]}x${pattern[1]}`;
}

function formatJointLabel(jointId: string) {
  return jointId
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatThicknessRangeLabel(range: [number, number]) {
  return `${range[0]}-${range[1]} mm`;
}

function resolveCompatibleAttachmentPoints(
  runtimeAsset: RuntimeAsset | null,
  attachmentType: FocusPlacementAttachmentType,
  surface: SupportSurface | null
) {
  if (!runtimeAsset) {
    return [];
  }

  return runtimeAsset.attachmentPoints.filter(
    (point) =>
      point.type === attachmentType &&
      (!surface ||
        point.compatibleWith.length === 0 ||
        point.compatibleWith.includes(surface.id) ||
        point.compatibleWith.includes(surface.type))
  );
}

function resolveDeclaredVesaPatternLabel(runtimeAsset: RuntimeAsset | null) {
  const patterns = Array.from(
    new Set(
      runtimeAsset?.attachmentPoints
        .filter((point) => point.type === "vesa_mount")
        .map((point) => point.constraints.vesaPatternMm)
        .filter((pattern): pattern is [75, 75] | [100, 100] | [75, 100] => Boolean(pattern))
        .map((pattern) => formatPatternLabel(pattern)) ?? []
    )
  );

  return patterns.length > 0 ? patterns.join(" / ") : "Missing";
}

function resolveSupportVesaPatternLabel(runtimeAsset: RuntimeAsset | null) {
  const patterns = new Set<string>();
  runtimeAsset?.attachmentPoints
    .filter((point) => point.type === "vesa_mount")
    .forEach((point) => {
      if (point.constraints.vesaPatternMm) {
        patterns.add(formatPatternLabel(point.constraints.vesaPatternMm));
      }
    });

  if (runtimeAsset?.articulation?.type === "monitor_arm") {
    patterns.add(formatPatternLabel(runtimeAsset.articulation.endEffector.compatiblePatternsMm));
  }

  return patterns.size > 0 ? Array.from(patterns).join(" / ") : "Missing";
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

function resolveSurfaceVisibilitySignal(surfaceType: SupportSurface["type"]) {
  switch (surfaceType) {
    case "desktop_top":
    case "shelf_top":
      return 0.92;
    case "wall":
    case "pegboard":
    case "monitor_back":
      return 0.78;
    case "desk_edge":
      return 0.72;
    case "floor":
      return 0.66;
    case "desk_underside":
      return 0.46;
    default:
      return 0.6;
  }
}

function resolveCandidateRankingSignals(input: {
  candidate: FocusPlacementCandidateSeed;
  selectedRuntimeAsset: RuntimeAsset | null;
  candidateIndex: number;
}) {
  const { candidate, selectedRuntimeAsset, candidateIndex } = input;
  const priority = resolveCandidatePriority(
    candidate as FocusPlacementSurfaceCandidate,
    selectedRuntimeAsset
  );

  return {
    rayHitConfidence: 0.72,
    attachmentCompatibility: candidate.enabled ? 1 : 0,
    surfaceVisibility: resolveSurfaceVisibilitySignal(candidate.surfaceType),
    distancePriority: Math.max(0.2, 1 - candidateIndex * 0.04),
    userSelectedSupportBonus: 0.2,
    preferredSurfaceBonus: Math.max(0, 0.65 - priority * 0.04),
    outOfBoundsPenalty: candidate.enabled ? 0 : 1
  } satisfies CandidateRankingSignals;
}

function resolveFocusCandidateTone(candidate: RankedInteractionSurfaceCandidate) {
  if (candidate.visualAffordance.tone === "valid") {
    return "ready" as const;
  }
  if (
    candidate.visualAffordance.tone === "blocked" ||
    candidate.blockedReasons.some((reason) => reason.severity === "error")
  ) {
    return "blocked" as const;
  }
  return "info" as const;
}

function fromRankedCandidate(candidate: RankedInteractionSurfaceCandidate): FocusPlacementSurfaceCandidate {
  return {
    surfaceId: candidate.surfaceId,
    surfaceLabel: candidate.surfaceLabel ?? candidate.surfaceId,
    surfaceType: candidate.surfaceType,
    attachmentType: candidate.attachmentType as FocusPlacementAttachmentType,
    surfaceBoundsMm: candidate.surfaceBoundsMm ?? { min: [0, 0], max: [0, 0] },
    noPlaceZones: candidate.noPlaceZones ?? [],
    preferredZones: candidate.preferredZones ?? [],
    enabled:
      candidate.enabled &&
      !candidate.blockedReasons.some((reason) => reason.severity === "error"),
    tone: resolveFocusCandidateTone(candidate),
    reason: candidate.blockedReasons[0]?.message ?? candidate.reason ?? null,
    ranking: candidate.ranking ?? {},
    score: candidate.score,
    rank: candidate.rank,
    blockedReasons: candidate.blockedReasons,
    visualAffordance: candidate.visualAffordance
  };
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
      hint:
        candidates.length > 1
          ? "정밀 배치 · Tab으로 설치 방식 전환"
          : firstReadyCandidate.attachmentType === "vesa_mount"
            ? "모니터암 정밀 배치"
            : "정밀 배치",
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
  const candidateSeeds: FocusPlacementCandidateSeed[] = supportSurfaces
    .flatMap((surface) =>
      surface.allowedAttachments
        .filter(isFocusPlacementAttachmentType)
        .map((attachmentType): FocusPlacementCandidateSeed => {
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
          };
        })
    );
  const candidates = rankInteractionCandidates(
    candidateSeeds.map((candidate, index) => ({
      ...candidate,
      supportObjectId: supportAsset.id,
      ranking: resolveCandidateRankingSignals({
        candidate,
        selectedRuntimeAsset,
        candidateIndex: index
      })
    }))
  ).map(fromRankedCandidate);

  const preferredCandidateIndex = Math.max(
    0,
    candidates.findIndex(
      (candidate) =>
        candidate.enabled &&
        !candidate.blockedReasons.some((reason) => reason.severity === "error")
    )
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
  if (attachmentType === "vesa_mount" || surfaceType === "monitor_back") {
    return {
      moveStepMm: 5,
      rotateStepMilliDeg: 1000
    };
  }

  if (
    attachmentType === "edge_clamp" ||
    surfaceType === "desk_edge" ||
    attachmentType === "underside_screw" ||
    surfaceType === "desk_underside" ||
    attachmentType === "grommet_hole" ||
    attachmentType === "wall_screw" ||
    attachmentType === "wall_attach" ||
    surfaceType === "wall"
  ) {
    return {
      moveStepMm: 5,
      rotateStepMilliDeg: 1000
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
    case "vesa_mount":
      return "VESA Mount";
    case "edge_clamp":
      return "Edge Clamp";
    case "underside_screw":
      return "Under Desk";
    case "grommet_hole":
      return "Grommet Hole";
    case "wall_screw":
      return "Wall Screw";
    case "wall_attach":
      return "Wall Mount";
    case "place_on_surface":
    default:
      return "Place On Surface";
  }
}

export function resolveFocusPlacementWizardState(input: {
  attachmentType: FocusPlacementAttachmentType;
  localPose: SurfaceLocalPose;
  selectedRuntimeAsset: RuntimeAsset | null;
  supportRuntimeAsset: RuntimeAsset | null;
  surfaceId?: string | null;
  constraintReport: ConstraintReport | null;
  collisionReport: CollisionReport | null;
}): FocusPlacementWizardState {
  const {
    attachmentType,
    localPose,
    selectedRuntimeAsset,
    supportRuntimeAsset,
    surfaceId,
    constraintReport,
    collisionReport
  } = input;
  const feedback = resolveFocusPlacementFeedback(constraintReport, collisionReport);
  const surface =
    (surfaceId
      ? supportRuntimeAsset?.supportSurfaces.find((candidate) => candidate.id === surfaceId)
      : null) ?? null;
  const compatibleAttachmentPoints = resolveCompatibleAttachmentPoints(
    selectedRuntimeAsset,
    attachmentType,
    surface
  );
  const requirements: FocusPlacementRequirement[] = [];
  const supportsFootprintClearance =
    attachmentType === "place_on_surface" ||
    attachmentType === "underside_screw" ||
    attachmentType === "grommet_hole" ||
    attachmentType === "wall_screw" ||
    attachmentType === "wall_attach";
  const footprint =
    selectedRuntimeAsset && surface && supportsFootprintClearance
      ? resolveLocalFootprintBounds(localPose, selectedRuntimeAsset.dimensionsMm, surface.type)
      : null;
  const clearance =
    footprint && surface ? resolveSurfaceClearanceMm(footprint, surface) : null;

  const thicknessRanges = compatibleAttachmentPoints
    .map((point) => point.constraints.requiredThicknessMm)
    .filter((range): range is [number, number] => Boolean(range));
  if (thicknessRanges.length > 0) {
    const range = thicknessRanges[0]!;
    const actualThickness = surface?.thicknessMm;
    const thicknessMatches =
      typeof actualThickness === "number" && actualThickness >= range[0] && actualThickness <= range[1];
    requirements.push({
      id: "surface-thickness",
      label: "Surface Thickness",
      value:
        typeof actualThickness === "number"
          ? `${actualThickness} mm / req ${formatThicknessRangeLabel(range)}`
          : `req ${formatThicknessRangeLabel(range)}`,
      tone: typeof actualThickness === "number" ? (thicknessMatches ? "ready" : "blocked") : "info"
    });
  }

  const minClearanceValues = compatibleAttachmentPoints
    .map((point) => point.constraints.minClearanceMm)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (minClearanceValues.length > 0) {
    const requiredClearance = Math.max(...minClearanceValues);
    const actualClearance = clearance?.min ?? null;
    const clearanceSatisfied =
      typeof actualClearance === "number" ? actualClearance >= requiredClearance : false;
    requirements.push({
      id: "edge-clearance",
      label: "Clearance",
      value:
        typeof actualClearance === "number"
          ? `${Math.round(actualClearance)} mm / req ${requiredClearance} mm`
          : `req ${requiredClearance} mm`,
      tone: typeof actualClearance === "number" ? (clearanceSatisfied ? "ready" : "blocked") : "info"
    });
  } else if (clearance) {
    requirements.push({
      id: "edge-clearance",
      label: "Clearance",
      value: `min ${Math.round(clearance.min)} mm`,
      tone: feedback.blocked ? "blocked" : feedback.tone === "warning" ? "warning" : "ready"
    });
  }

  const defaultWizardState: FocusPlacementWizardState = {
    mode: "default",
    title: "Focus Placement",
    subtitle: null,
    axisLabels: DEFAULT_AXIS_LABELS,
    shortcutLines: [
      "Arrow: 표면 위 이동",
      "Alt + Arrow: 1mm 미세 이동",
      "Q / E: 회전",
      "Tab: 설치 방식 전환, F: 기본 표면으로 복귀",
      "Enter: 확정, Esc: 취소"
    ],
    steps: [],
    joints: [],
    requirements,
    clearance: clearance
      ? {
          left: Math.round(clearance.left),
          right: Math.round(clearance.right),
          top: Math.round(clearance.top),
          bottom: Math.round(clearance.bottom),
          min: Math.round(clearance.min)
        }
      : null,
    detail: feedback.tone === "ready" ? null : feedback.detail,
    vesaPatternLabel: null,
    supportPatternLabel: null
  };

  if (
    attachmentType !== "vesa_mount" ||
    supportRuntimeAsset?.articulation?.type !== "monitor_arm"
  ) {
    return defaultWizardState;
  }

  const articulation = supportRuntimeAsset.articulation;
  const solveResult = monitorArmSolver.solve(articulation, {
    positionMm: [localPose.uMm, localPose.vMm, localPose.normalOffsetMm],
    rollDeg: localPose.rotationMilliDeg / 1000
  });
  const articulationBlocked = Boolean(
    constraintReport?.errors.some((issue) => issue.code === "ARTICULATION_TARGET_UNREACHABLE")
  );
  const vesaBlocked = Boolean(
    constraintReport?.errors.some((issue) =>
      [
        "VESA_PATTERN_MISSING",
        "SUPPORT_ATTACHMENT_TARGET_MISSING",
        "VESA_PATTERN_INCOMPATIBLE"
      ].includes(issue.code)
    )
  );
  const steps: FocusPlacementWizardStep[] = [
    {
      id: "clamp",
      label: "Clamp Base",
      state: "done"
    },
    {
      id: "vesa",
      label: "Match VESA",
      state: vesaBlocked ? "blocked" : "done"
    },
    {
      id: "target",
      label: "Target Pose",
      state: vesaBlocked ? "pending" : articulationBlocked ? "blocked" : "active"
    },
    {
      id: "commit",
      label: "Commit",
      state: feedback.blocked ? "blocked" : "active"
    }
  ];

  const reachJoint = articulation.joints.find((joint) => joint.type === "prismatic");
  if (reachJoint?.limitMm) {
    const actualReach = Math.round(localPose.normalOffsetMm);
    const reachMatches =
      actualReach >= reachJoint.limitMm[0] && actualReach <= reachJoint.limitMm[1];
    requirements.unshift({
      id: "arm-reach",
      label: "Arm Reach",
      value: `${actualReach} mm / ${reachJoint.limitMm[0]}-${reachJoint.limitMm[1]} mm`,
      tone: reachMatches ? "ready" : "blocked"
    });
  }

  requirements.unshift({
    id: "vesa-patterns",
    label: "VESA",
    value: `${resolveDeclaredVesaPatternLabel(selectedRuntimeAsset)} -> ${resolveSupportVesaPatternLabel(supportRuntimeAsset)}`,
    tone: vesaBlocked ? "blocked" : "ready"
  });

  return {
    mode: "monitor_arm",
    title: "Monitor Arm Wizard",
    subtitle: "모니터 target pose를 움직이면 arm joint가 따라옵니다.",
    axisLabels: MONITOR_ARM_AXIS_LABELS,
    shortcutLines: [
      "Arrow: Swing / Height 이동",
      "Alt + Arrow: 1mm 미세 이동",
      "PageUp / PageDown: Reach",
      "Q / E: Roll",
      "Enter: 확정, Esc: 취소"
    ],
    steps,
    joints: articulation.joints.map((joint) => ({
      id: joint.id,
      label: formatJointLabel(joint.id),
      value: Number((solveResult.joints[joint.id] ?? joint.defaultValue).toFixed(1)),
      unit: joint.type === "prismatic" ? "mm" : "deg"
    })),
    requirements,
    clearance: clearance
      ? {
          left: Math.round(clearance.left),
          right: Math.round(clearance.right),
          top: Math.round(clearance.top),
          bottom: Math.round(clearance.bottom),
          min: Math.round(clearance.min)
        }
      : null,
    detail:
      feedback.detail ??
      solveResult.errors[0]?.message ??
      "Target pose drives the arm automatically.",
    vesaPatternLabel: resolveDeclaredVesaPatternLabel(selectedRuntimeAsset),
    supportPatternLabel: resolveSupportVesaPatternLabel(supportRuntimeAsset)
  };
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
