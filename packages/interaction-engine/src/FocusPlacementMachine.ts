import type { SnapRule } from "@deskterioronline/placement-kernel";
import type { SurfaceLocalPose } from "@deskterioronline/scene-schema";
import {
  createBlockedReason,
  rankInteractionCandidates,
  resolveBlockedReasonsFromReports
} from "./candidate-ranking";
import type {
  AimPayload,
  BlockedReason,
  FocusPlacementMachineState,
  InteractionCommand,
  InteractionEvent,
  InteractionMode,
  InteractionResult,
  RankedInteractionSurfaceCandidate
} from "./types";
import { ZERO_SURFACE_LOCAL_POSE } from "./types";

function clonePose(pose: SurfaceLocalPose): SurfaceLocalPose {
  return {
    uMm: pose.uMm,
    vMm: pose.vMm,
    normalOffsetMm: pose.normalOffsetMm,
    rotationMilliDeg: pose.rotationMilliDeg
  };
}

function mergePose(
  currentPose: SurfaceLocalPose,
  patch: Partial<SurfaceLocalPose> | undefined
): SurfaceLocalPose {
  return {
    ...currentPose,
    ...(typeof patch?.uMm === "number" && Number.isFinite(patch.uMm) ? { uMm: patch.uMm } : {}),
    ...(typeof patch?.vMm === "number" && Number.isFinite(patch.vMm) ? { vMm: patch.vMm } : {}),
    ...(typeof patch?.normalOffsetMm === "number" && Number.isFinite(patch.normalOffsetMm)
      ? { normalOffsetMm: patch.normalOffsetMm }
      : {}),
    ...(typeof patch?.rotationMilliDeg === "number" && Number.isFinite(patch.rotationMilliDeg)
      ? { rotationMilliDeg: patch.rotationMilliDeg }
      : {})
  };
}

function createInitialState(input?: {
  mode?: InteractionMode;
  readOnly?: boolean;
}): FocusPlacementMachineState {
  return {
    status: "idle",
    mode: input?.mode ?? "walk",
    objectId: null,
    supportObjectId: null,
    candidates: [],
    activeCandidateIndex: -1,
    localPose: clonePose(ZERO_SURFACE_LOCAL_POSE),
    blockedReasons: [],
    constraintReport: null,
    collisionReport: null,
    readOnly: input?.readOnly ?? false
  };
}

function getActiveCandidate(
  state: FocusPlacementMachineState
): RankedInteractionSurfaceCandidate | null {
  return state.candidates[state.activeCandidateIndex] ?? null;
}

function normalizeCandidateIndex(
  candidates: RankedInteractionSurfaceCandidate[],
  index: number | undefined
) {
  if (candidates.length === 0) {
    return -1;
  }
  if (typeof index === "number" && index >= 0 && index < candidates.length) {
    return index;
  }
  const firstEnabledIndex = candidates.findIndex((candidate) => candidate.enabled);
  return firstEnabledIndex >= 0 ? firstEnabledIndex : 0;
}

function buildPreviewCommands(
  state: FocusPlacementMachineState,
  candidate: RankedInteractionSurfaceCandidate | null,
  reason: "aim" | "preview" | "nudge" | "commit" | "cancel" = "preview",
  snapRule?: SnapRule
): InteractionCommand[] {
  if (!state.objectId || !candidate) {
    return [];
  }

  return [
    { type: "BEGIN_PREVIEW", objectId: state.objectId },
    {
      type: "SET_ACTIVE_CANDIDATE",
      candidate
    },
    {
      type: "UPDATE_PREVIEW_POSE",
      objectId: state.objectId,
      candidate,
      localPose: state.localPose,
      snapRule
    },
    { type: "INVALIDATE_RENDER", reason }
  ];
}

function withBlocked(
  state: FocusPlacementMachineState,
  reasons: BlockedReason[],
  commands: InteractionCommand[] = []
): InteractionResult {
  const nextState: FocusPlacementMachineState = {
    ...state,
    status: "blocked",
    blockedReasons: reasons
  };

  return {
    state: nextState,
    commands: [
      ...commands,
      {
        type: "REPORT_BLOCKED",
        reasons
      }
    ],
    documentPatchCount: 0
  };
}

function applyCandidateState(
  state: FocusPlacementMachineState,
  candidateIndex: number
): InteractionResult {
  const candidate = state.candidates[candidateIndex] ?? null;
  if (!candidate) {
    return withBlocked(state, [createBlockedReason("NO_SURFACE")]);
  }

  const blockedReasons = candidate.blockedReasons;
  const nextState: FocusPlacementMachineState = {
    ...state,
    activeCandidateIndex: candidateIndex,
    supportObjectId: candidate.supportObjectId,
    status: blockedReasons.length > 0 ? "blocked" : "candidate_preview",
    blockedReasons
  };
  const previewCommands = buildPreviewCommands(nextState, candidate);
  if (blockedReasons.length > 0) {
    return withBlocked(nextState, blockedReasons, previewCommands);
  }

  return {
    state: nextState,
    commands: previewCommands,
    documentPatchCount: 0
  };
}

export class FocusPlacementMachine {
  private state: FocusPlacementMachineState;

  constructor(input?: { mode?: InteractionMode; readOnly?: boolean }) {
    this.state = createInitialState(input);
  }

  getState() {
    return this.state;
  }

  dispatch(event: InteractionEvent): InteractionResult {
    const result = this.reduce(event);
    this.state = result.state;
    return result;
  }

  private reduce(event: InteractionEvent): InteractionResult {
    switch (event.type) {
      case "AIM_AT_SURFACE":
        return this.handleAimAtSurface(event.payload);
      case "START_PLACEMENT":
        return this.handleStartPlacement(event);
      case "NUDGE":
        return this.handlePoseChange({
          ...this.state.localPose,
          ...(event.axis === "u" ? { uMm: this.state.localPose.uMm + event.deltaMm } : {}),
          ...(event.axis === "v" ? { vMm: this.state.localPose.vMm + event.deltaMm } : {}),
          ...(event.axis === "normal"
            ? { normalOffsetMm: this.state.localPose.normalOffsetMm + event.deltaMm }
            : {})
        }, event.snapRule);
      case "ROTATE":
        return this.handlePoseChange({
          ...this.state.localPose,
          rotationMilliDeg: this.state.localPose.rotationMilliDeg + event.deltaMilliDeg
        }, event.snapRule);
      case "SET_NUMERIC_POSE":
        return this.handlePoseChange(mergePose(this.state.localPose, event.pose), event.snapRule);
      case "SWITCH_CANDIDATE":
        return this.handleSwitchCandidate(event.direction);
      case "SELECT_CANDIDATE":
        return this.handleSelectCandidate(event.candidateIndex);
      case "APPLY_REPORTS":
        return this.handleApplyReports(event);
      case "COMMIT":
        return this.handleCommit();
      case "COMMIT_SUCCEEDED":
        return this.finishCommit("committed");
      case "COMMIT_FAILED":
        return withBlocked(
          {
            ...this.state,
            status: "blocked"
          },
          event.reasons
        );
      case "CANCEL":
        return this.handleCancel();
      default:
        return {
          state: this.state,
          commands: [],
          documentPatchCount: 0
        };
    }
  }

  private handleAimAtSurface(payload: AimPayload): InteractionResult {
    const rankedCandidates = payload.candidates
      ? rankInteractionCandidates(payload.candidates)
      : this.state.candidates;
    const nextState: FocusPlacementMachineState = {
      ...this.state,
      status: "aiming",
      objectId: payload.objectId ?? this.state.objectId,
      supportObjectId: payload.supportObjectId ?? this.state.supportObjectId,
      candidates: rankedCandidates,
      activeCandidateIndex:
        rankedCandidates.length > 0
          ? normalizeCandidateIndex(rankedCandidates, this.state.activeCandidateIndex)
          : -1,
      blockedReasons: []
    };

    return {
      state: nextState,
      commands: [{ type: "INVALIDATE_RENDER", reason: "aim" }],
      documentPatchCount: 0
    };
  }

  private handleStartPlacement(
    event: InteractionEvent & { type: "START_PLACEMENT" }
  ): InteractionResult {
    if (event.readOnly || this.state.readOnly) {
      return withBlocked(
        {
          ...this.state,
          readOnly: true,
          objectId: event.objectId,
          supportObjectId: event.supportObjectId
        },
        [createBlockedReason("READ_ONLY", undefined, "mode")]
      );
    }

    const rankedCandidates = rankInteractionCandidates(event.candidates);
    const activeCandidateIndex = normalizeCandidateIndex(
      rankedCandidates,
      event.preferredCandidateIndex
    );
    const nextState: FocusPlacementMachineState = {
      ...this.state,
      status: "candidate_preview",
      objectId: event.objectId,
      supportObjectId: event.supportObjectId,
      candidates: rankedCandidates,
      activeCandidateIndex,
      localPose: mergePose(ZERO_SURFACE_LOCAL_POSE, event.initialLocalPose),
      blockedReasons: [],
      readOnly: false,
      constraintReport: null,
      collisionReport: null
    };

    return applyCandidateState(nextState, activeCandidateIndex);
  }

  private handlePoseChange(
    nextLocalPose: SurfaceLocalPose,
    snapRule?: SnapRule
  ): InteractionResult {
    const activeCandidate = getActiveCandidate(this.state);
    if (!activeCandidate || !this.state.objectId) {
      return withBlocked(this.state, [createBlockedReason("NO_SURFACE")]);
    }
    if (this.state.readOnly) {
      return withBlocked(this.state, [createBlockedReason("READ_ONLY", undefined, "mode")]);
    }

    const nextState: FocusPlacementMachineState = {
      ...this.state,
      status: activeCandidate.blockedReasons.length > 0 ? "blocked" : "manipulating",
      localPose: nextLocalPose,
      blockedReasons: activeCandidate.blockedReasons
    };
    const commands = buildPreviewCommands(nextState, activeCandidate, "nudge", snapRule);

    if (activeCandidate.blockedReasons.length > 0) {
      return withBlocked(nextState, activeCandidate.blockedReasons, commands);
    }

    return {
      state: nextState,
      commands,
      documentPatchCount: 0
    };
  }

  private handleSwitchCandidate(direction: 1 | -1): InteractionResult {
    if (this.state.candidates.length === 0) {
      return withBlocked(this.state, [createBlockedReason("NO_SURFACE")]);
    }

    const currentIndex =
      this.state.activeCandidateIndex >= 0 ? this.state.activeCandidateIndex : 0;
    const nextCandidateIndex =
      (currentIndex + direction + this.state.candidates.length) % this.state.candidates.length;
    const nextState: FocusPlacementMachineState = {
      ...this.state,
      activeCandidateIndex: nextCandidateIndex
    };

    return applyCandidateState(nextState, nextCandidateIndex);
  }

  private handleSelectCandidate(candidateIndex: number): InteractionResult {
    if (this.state.candidates.length === 0) {
      return withBlocked(this.state, [createBlockedReason("NO_SURFACE")]);
    }

    const nextCandidateIndex = normalizeCandidateIndex(this.state.candidates, candidateIndex);
    const nextState: FocusPlacementMachineState = {
      ...this.state,
      activeCandidateIndex: nextCandidateIndex
    };

    return applyCandidateState(nextState, nextCandidateIndex);
  }

  private handleApplyReports(
    event: InteractionEvent & { type: "APPLY_REPORTS" }
  ): InteractionResult {
    const activeCandidate = getActiveCandidate(this.state);
    const reportReasons = resolveBlockedReasonsFromReports(
      event.constraintReport,
      event.collisionReport
    );
    const blockedReasons = [...(activeCandidate?.blockedReasons ?? []), ...reportReasons];
    const nextState: FocusPlacementMachineState = {
      ...this.state,
      status: blockedReasons.length > 0 ? "blocked" : "manipulating",
      localPose: event.localPose ?? this.state.localPose,
      blockedReasons,
      constraintReport: event.constraintReport,
      collisionReport: event.collisionReport
    };

    if (blockedReasons.length > 0) {
      return withBlocked(nextState, blockedReasons);
    }

    return {
      state: nextState,
      commands: [],
      documentPatchCount: 0
    };
  }

  private handleCommit(): InteractionResult {
    const activeCandidate = getActiveCandidate(this.state);
    if (this.state.readOnly) {
      return withBlocked(this.state, [createBlockedReason("READ_ONLY", undefined, "mode")]);
    }
    if (!activeCandidate || !this.state.objectId) {
      return withBlocked(this.state, [createBlockedReason("NO_SURFACE")]);
    }
    if (this.state.blockedReasons.length > 0 || activeCandidate.blockedReasons.length > 0) {
      return withBlocked(this.state, [
        ...activeCandidate.blockedReasons,
        ...this.state.blockedReasons
      ]);
    }

    const nextState: FocusPlacementMachineState = {
      ...this.state,
      status: "committing"
    };

    return {
      state: nextState,
      commands: [
        {
          type: "COMMIT_PLACEMENT_PATCH",
          objectId: this.state.objectId,
          candidate: activeCandidate,
          localPose: this.state.localPose,
          expectedPatchCount: 1
        },
        { type: "INVALIDATE_RENDER", reason: "commit" }
      ],
      documentPatchCount: 1
    };
  }

  private finishCommit(status: "committed"): InteractionResult {
    const nextState: FocusPlacementMachineState = {
      ...this.state,
      status,
      blockedReasons: []
    };
    return {
      state: nextState,
      commands: [],
      documentPatchCount: 0
    };
  }

  private handleCancel(): InteractionResult {
    const nextState: FocusPlacementMachineState = {
      ...this.state,
      status: "cancelled",
      blockedReasons: []
    };

    return {
      state: nextState,
      commands: [
        { type: "CANCEL_PREVIEW", objectId: this.state.objectId },
        { type: "INVALIDATE_RENDER", reason: "cancel" }
      ],
      documentPatchCount: 0
    };
  }
}

export function createFocusPlacementMachine(input?: {
  mode?: InteractionMode;
  readOnly?: boolean;
}) {
  return new FocusPlacementMachine(input);
}
