export type WalkMovementKey = "forward" | "backward" | "left" | "right";

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
