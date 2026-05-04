import assert from "node:assert/strict";
import {
  createFocusPlacementMachine,
  createBlockedReason
} from "@deskterioronline/interaction-engine";
import { resolveFocusPlacementFeedback } from "../src/lib/runtime/focus-placement-session";
import {
  WALK_FOCUS_PLACEMENT_AIM_EVENT,
  dispatchWalkFocusPlacementAim,
  focusPlacementRequestToInteractionCandidates,
  resolveWalkFocusPlacementAimKey,
  withFocusPlacementAimMetadata,
  type WalkFocusPlacementAimDetail
} from "../src/lib/runtime/walk-focus-aim";
import {
  isEditableWalkKeyboardTarget,
  isWalkInteractShortcut,
  isWalkInventoryShortcut,
  resolveWalkMovementKey
} from "../src/lib/runtime/walk-keyboard";
import { useInteractionStore } from "../src/lib/stores/useInteractionStore";
import type { FocusPlacementRequest } from "../src/lib/stores/useFocusPlacementStore";

const request: FocusPlacementRequest = {
  objectId: "lamp-1",
  supportObjectId: "desk-1",
  surfaceId: "desktop_top",
  attachmentType: "place_on_surface",
  objectLabel: "Lamp",
  supportLabel: "Desk",
  surfaceLabel: "Desktop",
  surfaceType: "desktop_top",
  surfaceBoundsMm: {
    min: [-600, -300],
    max: [600, 300]
  },
  noPlaceZones: [],
  preferredZones: [],
  objectDimensionsMm: {
    width: 120,
    depth: 120,
    height: 380
  },
  preferredCandidateIndex: 0,
  surfaceCandidates: [
    {
      surfaceId: "desktop_top",
      surfaceLabel: "Desktop",
      surfaceType: "desktop_top",
      attachmentType: "place_on_surface",
      surfaceBoundsMm: {
        min: [-600, -300],
        max: [600, 300]
      },
      noPlaceZones: [],
      preferredZones: [],
      enabled: true,
      tone: "ready",
      reason: null,
      ranking: {
        attachmentCompatibility: 1,
        surfaceVisibility: 0.95,
        distancePriority: 0.9,
        preferredSurfaceBonus: 0.5
      },
      score: 0,
      rank: 0,
      blockedReasons: [],
      visualAffordance: {
        tone: "valid",
        outline: "surface-ring",
        label: "Desktop"
      }
    },
    {
      surfaceId: "desk_underside",
      surfaceLabel: "Underside",
      surfaceType: "desk_underside",
      attachmentType: "underside_screw",
      surfaceBoundsMm: {
        min: [-600, -300],
        max: [600, 300]
      },
      noPlaceZones: [],
      preferredZones: [],
      enabled: false,
      tone: "blocked",
      reason: "Lamp does not support underside screw mounting.",
      ranking: {
        attachmentCompatibility: 0,
        surfaceVisibility: 0.2,
        distancePriority: 0.3,
        outOfBoundsPenalty: 1
      },
      score: 0,
      rank: 1,
      blockedReasons: [
        createBlockedReason(
          "INCOMPATIBLE_ATTACHMENT",
          "Lamp does not support underside screw mounting.",
          "candidate"
        )
      ],
      visualAffordance: {
        tone: "blocked",
        outline: "ghost-only",
        label: "Underside"
      }
    }
  ]
};

function main() {
  useInteractionStore.getState().setWalkPointerLockStatus({
    locked: true,
    blocked: false
  });
  assert.equal(
    useInteractionStore.getState().walkPointerLocked,
    true,
    "walk UX should expose pointer lock as active"
  );
  assert.equal(
    useInteractionStore.getState().walkPointerLockBlocked,
    false,
    "walk UX should not mark pointer lock blocked when locked"
  );

  useInteractionStore.getState().setWalkPointerLockStatus({
    locked: false,
    blocked: true
  });
  assert.equal(
    useInteractionStore.getState().walkPointerLocked,
    false,
    "walk UX should release pointer lock state when panels take focus"
  );
  assert.equal(
    useInteractionStore.getState().walkPointerLockBlocked,
    true,
    "walk UX should expose pointer lock blocked state for HUD guidance"
  );

  assert.equal(
    resolveWalkMovementKey({ code: "KeyW", key: "ㅈ" }),
    "forward",
    "walk WASD should use physical KeyboardEvent.code so non-English layouts still move"
  );
  assert.equal(
    resolveWalkMovementKey({ code: "KeyA", key: "ㅁ" }),
    "left",
    "walk strafe should survive IME/layout key labels"
  );
  assert.equal(
    resolveWalkMovementKey({ code: "", key: "ArrowUp" }),
    "forward",
    "walk movement should keep arrow-key fallback for browsers without code"
  );
  assert.equal(
    resolveWalkMovementKey({ code: "KeyW", key: "w", metaKey: true }),
    null,
    "walk movement should not hijack modified browser/system shortcuts"
  );
  assert.equal(
    resolveWalkMovementKey({ code: "KeyW", key: "w", metaKey: true }, { allowModified: true }),
    "forward",
    "walk keyup cleanup should still clear movement state if a modifier becomes active"
  );
  assert.equal(
    isWalkInventoryShortcut({ code: "KeyI", key: "ㅑ" }),
    true,
    "walk inventory shortcut should use physical KeyI, not only event.key"
  );
  assert.equal(
    isWalkInteractShortcut({ code: "KeyE", key: "ㄷ" }),
    true,
    "walk interact shortcut should use physical KeyE, not only event.key"
  );
  assert.equal(
    isWalkInventoryShortcut({ code: "KeyI", key: "i", ctrlKey: true }),
    false,
    "walk inventory shortcut should not hijack modified browser/system shortcuts"
  );
  assert.equal(
    isEditableWalkKeyboardTarget({
      tagName: "input",
      isContentEditable: false
    } as unknown as EventTarget),
    true,
    "walk keyboard should ignore editable fields"
  );

  const blockedFeedback = resolveFocusPlacementFeedback(
    {
      valid: false,
      errors: [
        {
          code: "OUT_OF_SURFACE_BOUNDS",
          message: "Footprint leaves support surface.",
          severity: "error"
        }
      ],
      warnings: [],
      score: 0.2
    },
    null
  );
  assert.equal(blockedFeedback.tone, "blocked");
  assert.equal(blockedFeedback.blocked, true);

  const aimKey = resolveWalkFocusPlacementAimKey(request);
  assert.equal(
    aimKey,
    "lamp-1:desk-1:desktop_top:place_on_surface",
    "walk aim should have a stable request key for crosshair de-duplication"
  );

  const interactionCandidates = focusPlacementRequestToInteractionCandidates(request, 0.96);
  assert.equal(
    interactionCandidates[0]?.ranking?.rayHitConfidence,
    0.96,
    "crosshair ray confidence should flow into candidate ranking"
  );

  const aimedRequest = withFocusPlacementAimMetadata(request, 0.91);
  assert.equal(
    aimedRequest.aimRayHitConfidence,
    0.91,
    "walk aim should persist ray confidence on the pending focus placement request"
  );
  assert.equal(
    focusPlacementRequestToInteractionCandidates(aimedRequest)[0]?.ranking?.rayHitConfidence,
    0.91,
    "pending focus placement start should keep the original crosshair ray confidence"
  );

  const machine = createFocusPlacementMachine({ mode: "walk" });
  let result = machine.dispatch({
    type: "AIM_AT_SURFACE",
    payload: {
      objectId: request.objectId,
      supportObjectId: request.supportObjectId,
      surfaceId: request.surfaceId,
      candidates: interactionCandidates,
      rayHitConfidence: 0.96
    }
  });
  assert.equal(result.state.status, "aiming", "crosshair target should move the machine into aiming");
  assert.equal(result.documentPatchCount, 0, "aiming must not mutate the scene document");
  assert.ok(
    result.commands.some((command) => command.type === "INVALIDATE_RENDER" && command.reason === "aim"),
    "aiming should explicitly invalidate demand-rendered surfaces"
  );

  result = machine.dispatch({
    type: "START_PLACEMENT",
    objectId: request.objectId,
    supportObjectId: request.supportObjectId,
    candidates: interactionCandidates,
    preferredCandidateIndex: request.preferredCandidateIndex
  });
  assert.equal(
    result.state.status,
    "candidate_preview",
    "crosshair start should enter candidate preview"
  );
  assert.equal(result.documentPatchCount, 0, "candidate preview must remain preview-only");
  assert.ok(
    result.commands.some((command) => command.type === "UPDATE_PREVIEW_POSE"),
    "candidate preview should emit a ghost preview pose"
  );

  result = machine.dispatch({ type: "COMMIT" });
  assert.equal(result.state.status, "committing", "valid walk preview should be commit-ready");
  assert.equal(result.documentPatchCount, 1, "valid walk commit should emit one patch intent");

  result = machine.dispatch({ type: "COMMIT_SUCCEEDED" });
  assert.equal(result.state.status, "committed", "walk commit success should close the machine");

  let receivedAimDetail: WalkFocusPlacementAimDetail | null = null;
  const previousWindow = (globalThis as { window?: unknown }).window;
  const listeners = new Map<string, EventListener>();
  (globalThis as { window?: unknown }).window = {
    addEventListener: (type: string, listener: EventListener) => {
      listeners.set(type, listener);
    },
    removeEventListener: (type: string) => {
      listeners.delete(type);
    },
    dispatchEvent: (event: Event) => {
      receivedAimDetail = (event as CustomEvent<WalkFocusPlacementAimDetail>).detail;
      listeners.get(event.type)?.(event);
      return true;
    }
  };
  try {
    dispatchWalkFocusPlacementAim({
      request,
      rayHitConfidence: 0.91,
      source: "crosshair",
      targetName: "Desk"
    });
  } finally {
    (globalThis as { window?: unknown }).window = previousWindow;
  }
  assert.equal(
    receivedAimDetail?.request.supportObjectId,
    "desk-1",
    "walk aim dispatch should carry the crosshair support request"
  );

  useInteractionStore.setState({
    hint: null,
    walkPointerLocked: false,
    walkPointerLockBlocked: false
  });

  console.log(
    JSON.stringify(
      {
        pointerLockState: "verified",
        blockedFeedback: blockedFeedback.badgeLabel,
        crosshairAim: {
          event: WALK_FOCUS_PLACEMENT_AIM_EVENT,
          candidateCount: interactionCandidates.length,
          preservedRayHitConfidence: aimedRequest.aimRayHitConfidence,
          patchCountBeforeCommit: 0,
          patchCountOnCommit: 1
        }
      },
      null,
      2
    )
  );
}

main();
