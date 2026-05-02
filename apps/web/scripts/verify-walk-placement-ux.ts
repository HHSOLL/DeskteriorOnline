import assert from "node:assert/strict";
import { resolveFocusPlacementFeedback } from "../src/lib/runtime/focus-placement-session";
import { useInteractionStore } from "../src/lib/stores/useInteractionStore";

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

  useInteractionStore.setState({
    hint: null,
    walkPointerLocked: false,
    walkPointerLockBlocked: false
  });

  console.log(
    JSON.stringify(
      {
        pointerLockState: "verified",
        blockedFeedback: blockedFeedback.badgeLabel
      },
      null,
      2
    )
  );
}

main();
