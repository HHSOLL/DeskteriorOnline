import assert from "node:assert/strict";
import {
  DESK_PRECISION_HOTKEY_COMMIT_DELAY_MS,
  resolveDeskPrecisionHotkeyPreview
} from "../src/lib/editor/desk-precision-hotkeys";
import { resolveTopViewInteractionPolicy } from "../src/lib/editor/top-view-policy";

function main() {
  const roomPolicy = resolveTopViewInteractionPolicy("room");
  assert.equal(roomPolicy.allowTransformControls, false);
  assert.equal(roomPolicy.allowTransformHotkeys, false);

  const precisionPolicy = resolveTopViewInteractionPolicy("desk-precision");
  assert.equal(
    precisionPolicy.allowTransformControls,
    true,
    "desk precision should expose transform controls"
  );
  assert.equal(
    precisionPolicy.allowTransformHotkeys,
    true,
    "desk precision should expose keyboard nudge/rotate controls"
  );
  assert.equal(
    precisionPolicy.translationSnap,
    0.005,
    "desk precision default translation snap should be 5mm"
  );
  assert.equal(
    precisionPolicy.rotationSnap,
    Math.PI / 180,
    "desk precision default rotation snap should be 1deg"
  );
  assert.equal(
    precisionPolicy.preferredTransformSpace,
    "local",
    "desk precision should default to local transform space"
  );
  assert.equal(
    DESK_PRECISION_HOTKEY_COMMIT_DELAY_MS,
    280,
    "desk precision hotkeys should batch preview commits after a short idle window"
  );

  const baseAsset = {
    position: [1, 0.75, 2] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number]
  };
  const nudgePreview = resolveDeskPrecisionHotkeyPreview({
    event: { key: "ArrowRight" },
    asset: baseAsset,
    policy: precisionPolicy
  });
  assert.equal(
    nudgePreview?.commitMode,
    "preview-batched",
    "desk precision keyboard nudge should preview first and commit as a batch"
  );
  assert.equal(
    nudgePreview?.updates.position?.[0],
    1.005,
    "desk precision keyboard nudge should use 5mm default movement"
  );

  const fineNudgePreview = resolveDeskPrecisionHotkeyPreview({
    event: { key: "ArrowLeft", altKey: true },
    asset: baseAsset,
    policy: precisionPolicy
  });
  assert.equal(
    fineNudgePreview?.updates.position?.[0],
    0.999,
    "desk precision Alt+Arrow should use 1mm fine movement"
  );

  const rotatePreview = resolveDeskPrecisionHotkeyPreview({
    event: { key: "e" },
    asset: baseAsset,
    policy: precisionPolicy
  });
  assert.equal(
    rotatePreview?.commitMode,
    "preview-batched",
    "desk precision keyboard rotate should preview first and commit as a batch"
  );
  assert.equal(
    rotatePreview?.transformMode,
    "rotate",
    "desk precision Q/E should keep transform mode aligned with rotation"
  );

  const rotateRPreview = resolveDeskPrecisionHotkeyPreview({
    event: { key: "r" },
    asset: baseAsset,
    policy: precisionPolicy
  });
  assert.equal(
    rotateRPreview?.commitMode,
    "preview-batched",
    "desk precision R rotate should follow the same preview-batched contract"
  );
  assert.equal(
    rotateRPreview?.updates.rotation?.[1],
    Math.PI / 180,
    "desk precision R rotate should use the default 1deg rotation step"
  );

  console.log(
    JSON.stringify(
      {
        room: {
          transformControls: roomPolicy.allowTransformControls
        },
        deskPrecision: {
          transformControls: precisionPolicy.allowTransformControls,
          transformHotkeys: precisionPolicy.allowTransformHotkeys,
          translationSnapMm: precisionPolicy.translationSnap * 1000,
          rotationSnapDeg: precisionPolicy.rotationSnap * (180 / Math.PI),
          hotkeyCommitMode: nudgePreview?.commitMode,
          rHotkeyCommitMode: rotateRPreview?.commitMode,
          hotkeyCommitDelayMs: DESK_PRECISION_HOTKEY_COMMIT_DELAY_MS
        }
      },
      null,
      2
    )
  );
}

main();
