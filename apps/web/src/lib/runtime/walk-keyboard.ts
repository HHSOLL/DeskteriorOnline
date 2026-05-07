export type WalkMovementKey = "forward" | "backward" | "left" | "right";

export const WALK_VIEWPORT_FOCUS_EVENT = "deskterioronline:walk:focus-viewport";
export const WALK_KEYBOARD_RESET_EVENT = "deskterioronline:walk:reset-keyboard";

export type WalkKeyboardResetDetail = {
  reason: string;
  focusViewport: boolean;
};

type WalkKeyboardEventLike = {
  code?: string;
  key?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
};

type EditableTargetLike = {
  isContentEditable?: boolean;
  tagName?: string;
};

const MOVEMENT_BY_CODE: Record<string, WalkMovementKey> = {
  KeyW: "forward",
  ArrowUp: "forward",
  KeyS: "backward",
  ArrowDown: "backward",
  KeyA: "left",
  ArrowLeft: "left",
  KeyD: "right",
  ArrowRight: "right"
};

const MOVEMENT_BY_KEY: Record<string, WalkMovementKey> = {
  w: "forward",
  arrowup: "forward",
  s: "backward",
  arrowdown: "backward",
  a: "left",
  arrowleft: "left",
  d: "right",
  arrowright: "right"
};

export function isEditableWalkKeyboardTarget(target: EventTarget | null) {
  if (!target || typeof target !== "object") return false;

  const editableTarget = target as EditableTargetLike;
  const tagName = editableTarget.tagName?.toLowerCase();
  return (
    editableTarget.isContentEditable === true ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

function isModifiedShortcut(event: WalkKeyboardEventLike) {
  return event.ctrlKey === true || event.metaKey === true || event.altKey === true;
}

export function resolveWalkMovementKey(
  event: WalkKeyboardEventLike,
  options?: { allowModified?: boolean }
): WalkMovementKey | null {
  if (event.isComposing || (!options?.allowModified && isModifiedShortcut(event))) return null;

  const codeMatch = event.code ? MOVEMENT_BY_CODE[event.code] : undefined;
  if (codeMatch) return codeMatch;

  const key = event.key?.toLowerCase();
  return key ? MOVEMENT_BY_KEY[key] ?? null : null;
}

export function isWalkInventoryShortcut(event: WalkKeyboardEventLike) {
  if (event.isComposing || isModifiedShortcut(event)) return false;
  return event.code === "KeyI" || event.key?.toLowerCase() === "i";
}

export function isWalkInteractShortcut(event: WalkKeyboardEventLike) {
  if (event.isComposing || isModifiedShortcut(event)) return false;
  return event.code === "KeyE" || event.key?.toLowerCase() === "e";
}

export function requestWalkViewportFocus(reason: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(WALK_VIEWPORT_FOCUS_EVENT, {
      detail: { reason }
    })
  );
}

export function requestWalkKeyboardReset(
  reason: string,
  options?: { focusViewport?: boolean }
) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<WalkKeyboardResetDetail>(WALK_KEYBOARD_RESET_EVENT, {
      detail: {
        reason,
        focusViewport: options?.focusViewport ?? false
      }
    })
  );
}
