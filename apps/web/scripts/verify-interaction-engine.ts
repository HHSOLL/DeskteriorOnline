import {
  createBlockedReason,
  createFocusPlacementMachine,
  rankInteractionCandidates,
  type InteractionSurfaceCandidate
} from "@deskterioronline/interaction-engine";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertPatchCount(result: { documentPatchCount: number }, expected: number, label: string) {
  assert(
    result.documentPatchCount === expected,
    `${label}: expected ${expected} document patches, got ${result.documentPatchCount}`
  );
}

const candidates: InteractionSurfaceCandidate[] = [
  {
    supportObjectId: "desk-1",
    surfaceId: "desktop_top",
    surfaceLabel: "Desk Top",
    surfaceType: "desktop_top",
    attachmentType: "place_on_surface",
    enabled: true,
    ranking: {
      rayHitConfidence: 0.9,
      attachmentCompatibility: 1,
      surfaceVisibility: 0.8,
      distancePriority: 0.7,
      preferredSurfaceBonus: 0.25
    }
  },
  {
    supportObjectId: "desk-1",
    surfaceId: "desk_underside",
    surfaceLabel: "Under Desk",
    surfaceType: "desk_underside",
    attachmentType: "underside_screw",
    enabled: false,
    reason: "선택한 제품의 설치 포인트가 이 표면과 호환되지 않습니다",
    ranking: {
      rayHitConfidence: 0.95,
      attachmentCompatibility: 0,
      surfaceVisibility: 0.6
    }
  }
];

const rankedCandidates = rankInteractionCandidates(candidates);
assert(rankedCandidates.length === 2, "candidate ranking should preserve all candidates");
assert(rankedCandidates[0]?.surfaceId === "desktop_top", "enabled desktop candidate should rank first");
assert(
  rankedCandidates[1]?.blockedReasons[0]?.code === "INCOMPATIBLE_ATTACHMENT",
  "disabled underside candidate should keep a blocked reason"
);

const machine = createFocusPlacementMachine({ mode: "walk" });

let result = machine.dispatch({
  type: "AIM_AT_SURFACE",
  payload: {
    objectId: "lamp-1",
    supportObjectId: "desk-1",
    candidates
  }
});
assert(result.state.status === "aiming", "aim event should enter aiming state");
assertPatchCount(result, 0, "aiming");

result = machine.dispatch({
  type: "START_PLACEMENT",
  objectId: "lamp-1",
  supportObjectId: "desk-1",
  candidates,
  preferredCandidateIndex: 0,
  initialLocalPose: {
    uMm: 10,
    vMm: 20,
    normalOffsetMm: 0,
    rotationMilliDeg: 0
  }
});
assert(result.state.status === "candidate_preview", "start should enter candidate preview");
assert(
  result.commands.some((command) => command.type === "BEGIN_PREVIEW"),
  "start should request a renderer preview"
);
assertPatchCount(result, 0, "candidate preview");

result = machine.dispatch({
  type: "NUDGE",
  axis: "u",
  deltaMm: 5
});
assert(result.state.status === "manipulating", "nudge should enter manipulating state");
assert(result.state.localPose.uMm === 15, "nudge should update local u offset");
assert(
  result.commands.some((command) => command.type === "UPDATE_PREVIEW_POSE"),
  "nudge should update the ghost preview"
);
assertPatchCount(result, 0, "manipulating");

result = machine.dispatch({
  type: "SWITCH_CANDIDATE",
  direction: 1
});
assert(result.state.status === "blocked", "switching to disabled candidate should be blocked");
assert(
  result.state.blockedReasons.some((reason) => reason.code === "INCOMPATIBLE_ATTACHMENT"),
  "disabled candidate should explain incompatibility"
);
assertPatchCount(result, 0, "blocked candidate switch");

result = machine.dispatch({ type: "COMMIT" });
assert(result.state.status === "blocked", "blocked candidate should not commit");
assertPatchCount(result, 0, "blocked commit");

result = machine.dispatch({
  type: "SWITCH_CANDIDATE",
  direction: 1
});
assert(result.state.status === "candidate_preview", "switching back should restore candidate preview");
assertPatchCount(result, 0, "candidate switch restore");

result = machine.dispatch({
  type: "APPLY_REPORTS",
  constraintReport: {
    valid: true,
    errors: [],
    warnings: [],
    score: 1
  },
  collisionReport: {
    collided: true,
    collisions: [
      {
        code: "same-surface-overlap",
        objectId: "keyboard-1",
        reason: "Footprint overlaps keyboard-1"
      }
    ]
  }
});
assert(result.state.status === "blocked", "collision report should block preview commit");
assert(
  result.state.blockedReasons.some((reason) => reason.code === "COLLISION"),
  "collision report should expose collision blocked reason"
);
assertPatchCount(result, 0, "collision blocked preview");

result = machine.dispatch({
  type: "APPLY_REPORTS",
  constraintReport: {
    valid: true,
    errors: [],
    warnings: [],
    score: 1
  },
  collisionReport: {
    collided: false,
    collisions: []
  }
});
assert(result.state.status === "manipulating", "valid reports should clear blocked state");
assertPatchCount(result, 0, "valid report preview");

result = machine.dispatch({ type: "COMMIT" });
assert(result.state.status === "committing", "commit should enter committing state");
assert(
  result.commands.filter((command) => command.type === "COMMIT_PLACEMENT_PATCH").length === 1,
  "commit should emit one placement patch command"
);
assertPatchCount(result, 1, "commit");

result = machine.dispatch({ type: "COMMIT_SUCCEEDED" });
assert(result.state.status === "committed", "successful adapter commit should enter committed state");
assertPatchCount(result, 0, "committed follow-up");

const readOnlyMachine = createFocusPlacementMachine({ mode: "viewer-shared", readOnly: true });
result = readOnlyMachine.dispatch({
  type: "START_PLACEMENT",
  objectId: "lamp-1",
  supportObjectId: "desk-1",
  candidates,
  readOnly: true
});
assert(result.state.status === "blocked", "read-only scene should block placement start");
assert(
  result.state.blockedReasons.some((reason) => reason.code === "READ_ONLY"),
  "read-only start should expose READ_ONLY"
);
assertPatchCount(result, 0, "read-only start");

result = machine.dispatch({ type: "CANCEL" });
assert(result.state.status === "cancelled", "cancel should enter cancelled state");
assert(
  result.commands.some((command) => command.type === "CANCEL_PREVIEW"),
  "cancel should dispose preview"
);
assertPatchCount(result, 0, "cancel");

const explicitReason = createBlockedReason("SCALE_LOCKED");
assert(explicitReason.code === "SCALE_LOCKED", "blocked reason helper should preserve code");

console.log("[verify:interaction-engine] PASS");
