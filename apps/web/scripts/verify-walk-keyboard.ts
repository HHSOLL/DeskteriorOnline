import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  WALK_KEYBOARD_RESET_EVENT,
  WALK_VIEWPORT_FOCUS_EVENT,
  isEditableWalkKeyboardTarget,
  isWalkInteractShortcut,
  isWalkInventoryShortcut,
  requestWalkKeyboardReset,
  requestWalkViewportFocus,
  resolveWalkMovementKey,
  type WalkKeyboardResetDetail
} from "../src/lib/runtime/walk-keyboard";
import { useInteractionStore } from "../src/lib/stores/useInteractionStore";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDir, "..");

function assertMatches(source: string, pattern: RegExp, label: string) {
  assert.match(source, pattern, label);
}

async function readWebFile(relativePath: string) {
  return fs.readFile(path.join(webRoot, relativePath), "utf8");
}

async function verifyShortcutContracts() {
  assert.equal(
    resolveWalkMovementKey({ code: "KeyW", key: "ㅈ" }),
    "forward",
    "walk movement should use KeyboardEvent.code so WASD survives non-English layouts"
  );
  assert.equal(
    resolveWalkMovementKey({ code: "ArrowLeft", key: "ArrowLeft" }),
    "left",
    "walk movement should keep arrow-key parity"
  );
  assert.equal(
    resolveWalkMovementKey({ code: "KeyD", key: "d", metaKey: true }),
    null,
    "walk movement should ignore modified shortcuts"
  );
  assert.equal(
    resolveWalkMovementKey({ code: "KeyD", key: "d", metaKey: true }, { allowModified: true }),
    "right",
    "walk keyup cleanup should still resolve movement with modifiers"
  );
  assert.equal(
    isWalkInventoryShortcut({ code: "KeyI", key: "ㅑ" }),
    true,
    "walk inventory shortcut should use physical KeyI"
  );
  assert.equal(
    isWalkInteractShortcut({ code: "KeyE", key: "ㄷ" }),
    true,
    "walk interaction shortcut should use physical KeyE"
  );
  assert.equal(
    isWalkInventoryShortcut({ code: "KeyI", key: "i", ctrlKey: true }),
    false,
    "walk inventory shortcut should not hijack modified shortcuts"
  );
  assert.equal(
    isEditableWalkKeyboardTarget({
      tagName: "textarea",
      isContentEditable: false
    } as unknown as EventTarget),
    true,
    "walk keyboard should ignore textarea targets"
  );
  assert.equal(
    isEditableWalkKeyboardTarget({
      tagName: "div",
      isContentEditable: true
    } as unknown as EventTarget),
    true,
    "walk keyboard should ignore contenteditable targets"
  );
  assert.equal(
    isEditableWalkKeyboardTarget({
      tagName: "button",
      isContentEditable: false
    } as unknown as EventTarget),
    false,
    "walk keyboard should still allow non-editable controls to route hotkeys"
  );
}

function verifyInteractionStorePointerLockState() {
  useInteractionStore.getState().setWalkPointerLockStatus({
    locked: true,
    blocked: false
  });
  assert.equal(
    useInteractionStore.getState().walkPointerLocked,
    true,
    "interaction store should expose active pointer lock"
  );
  assert.equal(
    useInteractionStore.getState().walkPointerLockBlocked,
    false,
    "interaction store should clear blocked state while locked"
  );

  useInteractionStore.getState().setWalkPointerLockStatus({
    locked: false,
    blocked: true
  });
  assert.equal(
    useInteractionStore.getState().walkPointerLocked,
    false,
    "interaction store should clear pointer lock when panels take focus"
  );
  assert.equal(
    useInteractionStore.getState().walkPointerLockBlocked,
    true,
    "interaction store should expose blocked walk keyboard guidance"
  );
}

function verifyWindowEvents() {
  let focusDetail: { reason: string } | null = null;
  let resetDetail: WalkKeyboardResetDetail | null = null;
  const previousWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    dispatchEvent: (event: Event) => {
      if (event.type === WALK_VIEWPORT_FOCUS_EVENT) {
        focusDetail = (event as CustomEvent<{ reason: string }>).detail;
      }
      if (event.type === WALK_KEYBOARD_RESET_EVENT) {
        resetDetail = (event as CustomEvent<WalkKeyboardResetDetail>).detail;
      }
      return true;
    }
  };

  try {
    requestWalkViewportFocus("verify-focus");
    requestWalkKeyboardReset("verify-reset", { focusViewport: true });
  } finally {
    (globalThis as { window?: unknown }).window = previousWindow;
  }

  assert.deepEqual(
    focusDetail,
    { reason: "verify-focus" },
    "walk viewport focus event should preserve its reason"
  );
  assert.deepEqual(
    resetDetail,
    { reason: "verify-reset", focusViewport: true },
    "walk keyboard reset event should preserve reset metadata"
  );
}

async function verifySourceWiring() {
  const [cameraRigSource, projectPageSource, interactionManagerSource, crosshairSource] = await Promise.all([
    readWebFile("src/components/canvas/core/CameraRig.tsx"),
    readWebFile("src/app/(editor)/project/[id]/page.tsx"),
    readWebFile("src/components/canvas/interaction/InteractionManager.tsx"),
    readWebFile("src/components/overlay/hud/Crosshair.tsx")
  ]);

  assertMatches(
    cameraRigSource,
    /window\.addEventListener\(WALK_KEYBOARD_RESET_EVENT,\s*handleResetKeyboard\)/,
    "CameraRig should listen for walk keyboard reset events"
  );
  assertMatches(
    cameraRigSource,
    /if \(blockPointerLock\) \{\s*resetMovementState\(/s,
    "CameraRig should block movement immediately while panels are open"
  );
  assertMatches(
    cameraRigSource,
    /moveState\.current = createEmptyMoveState\(\);/s,
    "CameraRig should clear keyboard movement state when walk mode resets"
  );
  assertMatches(
    cameraRigSource,
    /const canvasFocusLook =[\s\S]*ownerDocument\.activeElement === canvas[\s\S]*eventPath\.includes\(canvas\)/,
    "CameraRig should provide mouse-look fallback from canvas focus when pointer lock is denied"
  );
  assertMatches(
    cameraRigSource,
    /handlePointerLockError[\s\S]*setWalkPointerLockStatus\(\{\s*locked: false,\s*blocked: false\s*\}\)/,
    "CameraRig should not keep the HUD in blocked/unavailable state after a pointer lock denial"
  );
  assert.doesNotMatch(
    crosshairSource,
    /Mouse lock unavailable/,
    "walk HUD should not show a persistent unavailable warning when canvas-focus fallback is available"
  );
  assertMatches(
    crosshairSource,
    /Panel open · movement paused/,
    "walk HUD should reserve blocked state for actual panel-driven movement pauses"
  );
  assertMatches(
    projectPageSource,
    /requestWalkKeyboardReset\("close-panels",\s*\{\s*focusViewport:\s*true\s*\}\)/,
    "editor page should reset walk keyboard state when panels close"
  );
  assertMatches(
    projectPageSource,
    /requestWalkViewportFocus\("close-panels"\)/,
    "editor page should restore viewport focus when panels close"
  );
  assertMatches(
    projectPageSource,
    /requestWalkKeyboardReset\("open-assets-panel"\)/,
    "editor page should pause movement before opening inventory"
  );
  assertMatches(
    projectPageSource,
    /requestWalkKeyboardReset\("open-properties-panel"\)/,
    "editor page should pause movement before opening inspector"
  );
  assertMatches(
    interactionManagerSource,
    /isWalkInteractShortcut\(event\)/,
    "walk interaction manager should keep KeyE handling"
  );
  assertMatches(
    interactionManagerSource,
    /isEditableWalkKeyboardTarget\(event\.target\)/,
    "walk interaction manager should ignore editable targets"
  );
}

async function main() {
  await verifyShortcutContracts();
  verifyInteractionStorePointerLockState();
  verifyWindowEvents();
  await verifySourceWiring();

  useInteractionStore.setState({
    hint: null,
    walkPointerLocked: false,
    walkPointerLockBlocked: false
  });

  console.log(
    JSON.stringify(
      {
        status: "ok",
        verified: [
          "movement key resolution",
          "inventory/interact shortcuts",
          "editable target ignore rules",
          "pointer lock store state",
          "pointer lock denied canvas-focus mouse-look fallback",
          "viewport focus/reset events",
          "CameraRig/page/interaction hotkey wiring"
        ]
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
