import assert from "node:assert/strict";
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
          rotationSnapDeg: precisionPolicy.rotationSnap * (180 / Math.PI)
        }
      },
      null,
      2
    )
  );
}

main();
