export type RealtimeDraftAsset = {
  id: string;
  label: string;
  x: number;
  y: number;
  updatedAt: string;
  updatedBySessionKey: string | null;
};

export type RealtimeDraftLock = {
  assetId: string;
  assetLabel: string;
  ownerSessionKey: string;
  ownerLabel: string;
  ownerAccentColor: string;
  lockedAt: string;
};

export type RealtimeDraftConflict = {
  assetId: string;
  assetLabel: string;
  holderSessionKey: string;
  holderLabel: string;
  challengerSessionKey: string;
  challengerLabel: string;
  occurredAt: string;
  message: string;
};

export type RealtimeDraftState = {
  assets: Record<string, RealtimeDraftAsset>;
  order: string[];
  locks: Record<string, RealtimeDraftLock>;
  lastConflict: RealtimeDraftConflict | null;
};

export type RealtimeDraftLockEvent = {
  type: "draft-lock";
  roomId: string;
  assetId: string;
  assetLabel: string;
  sessionKey: string;
  label: string;
  accentColor: string;
  sentAt: string;
};

export type RealtimeDraftMoveEvent = {
  type: "draft-move";
  roomId: string;
  assetId: string;
  assetLabel: string;
  sessionKey: string;
  label: string;
  accentColor: string;
  sentAt: string;
  x: number;
  y: number;
};

export type RealtimeDraftReleaseEvent = {
  type: "draft-release";
  roomId: string;
  assetId: string;
  assetLabel: string;
  sessionKey: string;
  label: string;
  accentColor: string;
  sentAt: string;
};

export type RealtimeDraftConflictEvent = {
  type: "draft-conflict";
  roomId: string;
  assetId: string;
  assetLabel: string;
  holderSessionKey: string;
  holderLabel: string;
  challengerSessionKey: string;
  challengerLabel: string;
  occurredAt: string;
  message: string;
};

export type RealtimeDraftEvent =
  | RealtimeDraftLockEvent
  | RealtimeDraftMoveEvent
  | RealtimeDraftReleaseEvent
  | RealtimeDraftConflictEvent;

export type RealtimeDraftTransition = {
  state: RealtimeDraftState;
  accepted: boolean;
  conflict: RealtimeDraftConflict | null;
};

const REALTIME_DRAFT_DEFAULT_LAYOUT = [
  { id: "p2s_desk_oak", label: "Desk Oak", x: 0.2, y: 0.28 },
  { id: "p2s_desk_lamp_glow", label: "Desk Lamp Glow", x: 0.72, y: 0.3 },
  { id: "p2s_ceramic_mug", label: "Ceramic Mug", x: 0.28, y: 0.72 },
  { id: "p2s_desk_planter_pilea", label: "Planter Pilea", x: 0.7, y: 0.72 }
] as const;

function toIsoString(value: number) {
  return new Date(value).toISOString();
}

function compareIsoTimestamp(left: string, right: string) {
  return new Date(left).getTime() - new Date(right).getTime();
}

function clampCoordinate(value: number) {
  if (!Number.isFinite(value)) {
    return 0.5;
  }
  return Math.min(0.94, Math.max(0.06, value));
}

function createEmptyState() {
  return {
    assets: {},
    order: [],
    locks: {},
    lastConflict: null
  } satisfies RealtimeDraftState;
}

export function getRealtimeDraftCatalog() {
  return [...REALTIME_DRAFT_DEFAULT_LAYOUT];
}

export function createRealtimeDraftState(now = Date.now()) {
  const state = createEmptyState();
  const updatedAt = toIsoString(now);

  for (const asset of REALTIME_DRAFT_DEFAULT_LAYOUT) {
    state.assets[asset.id] = {
      id: asset.id,
      label: asset.label,
      x: asset.x,
      y: asset.y,
      updatedAt,
      updatedBySessionKey: null
    };
    state.order.push(asset.id);
  }

  return state;
}

function createConflict(input: {
  assetId: string;
  assetLabel: string;
  holderSessionKey: string;
  holderLabel: string;
  challengerSessionKey: string;
  challengerLabel: string;
  occurredAt: string;
  message: string;
}) {
  return {
    assetId: input.assetId,
    assetLabel: input.assetLabel,
    holderSessionKey: input.holderSessionKey,
    holderLabel: input.holderLabel,
    challengerSessionKey: input.challengerSessionKey,
    challengerLabel: input.challengerLabel,
    occurredAt: input.occurredAt,
    message: input.message
  } satisfies RealtimeDraftConflict;
}

function shouldReplaceLock(existing: RealtimeDraftLock, incoming: RealtimeDraftLockEvent) {
  const timestampDelta = compareIsoTimestamp(incoming.sentAt, existing.lockedAt);
  if (timestampDelta !== 0) {
    return timestampDelta < 0;
  }
  return incoming.sessionKey.localeCompare(existing.ownerSessionKey) < 0;
}

export function buildRealtimeDraftLockEvent(input: {
  roomId: string;
  assetId: string;
  assetLabel: string;
  sessionKey: string;
  label: string;
  accentColor: string;
  now?: number;
}) {
  return {
    type: "draft-lock",
    roomId: input.roomId,
    assetId: input.assetId,
    assetLabel: input.assetLabel,
    sessionKey: input.sessionKey,
    label: input.label,
    accentColor: input.accentColor,
    sentAt: toIsoString(input.now ?? Date.now())
  } satisfies RealtimeDraftLockEvent;
}

export function buildRealtimeDraftMoveEvent(input: {
  roomId: string;
  assetId: string;
  assetLabel: string;
  sessionKey: string;
  label: string;
  accentColor: string;
  x: number;
  y: number;
  now?: number;
}) {
  return {
    type: "draft-move",
    roomId: input.roomId,
    assetId: input.assetId,
    assetLabel: input.assetLabel,
    sessionKey: input.sessionKey,
    label: input.label,
    accentColor: input.accentColor,
    sentAt: toIsoString(input.now ?? Date.now()),
    x: clampCoordinate(input.x),
    y: clampCoordinate(input.y)
  } satisfies RealtimeDraftMoveEvent;
}

export function buildRealtimeDraftReleaseEvent(input: {
  roomId: string;
  assetId: string;
  assetLabel: string;
  sessionKey: string;
  label: string;
  accentColor: string;
  now?: number;
}) {
  return {
    type: "draft-release",
    roomId: input.roomId,
    assetId: input.assetId,
    assetLabel: input.assetLabel,
    sessionKey: input.sessionKey,
    label: input.label,
    accentColor: input.accentColor,
    sentAt: toIsoString(input.now ?? Date.now())
  } satisfies RealtimeDraftReleaseEvent;
}

export function buildRealtimeDraftConflictEvent(input: {
  roomId: string;
  assetId: string;
  assetLabel: string;
  holderSessionKey: string;
  holderLabel: string;
  challengerSessionKey: string;
  challengerLabel: string;
  message: string;
  now?: number;
}) {
  return {
    type: "draft-conflict",
    roomId: input.roomId,
    assetId: input.assetId,
    assetLabel: input.assetLabel,
    holderSessionKey: input.holderSessionKey,
    holderLabel: input.holderLabel,
    challengerSessionKey: input.challengerSessionKey,
    challengerLabel: input.challengerLabel,
    occurredAt: toIsoString(input.now ?? Date.now()),
    message: input.message
  } satisfies RealtimeDraftConflictEvent;
}

export function transitionRealtimeDraftState(state: RealtimeDraftState, event: RealtimeDraftEvent): RealtimeDraftTransition {
  const nextState: RealtimeDraftState = {
    assets: { ...state.assets },
    order: [...state.order],
    locks: { ...state.locks },
    lastConflict: state.lastConflict
  };

  if (event.type === "draft-conflict") {
    const conflict = createConflict({
      assetId: event.assetId,
      assetLabel: event.assetLabel,
      holderSessionKey: event.holderSessionKey,
      holderLabel: event.holderLabel,
      challengerSessionKey: event.challengerSessionKey,
      challengerLabel: event.challengerLabel,
      occurredAt: event.occurredAt,
      message: event.message
    });
    nextState.lastConflict = conflict;
    return { state: nextState, accepted: true, conflict };
  }

  const asset = nextState.assets[event.assetId];
  if (!asset) {
    return { state, accepted: false, conflict: null };
  }

  if (event.type === "draft-lock") {
    const existing = nextState.locks[event.assetId];
    if (!existing) {
      nextState.locks[event.assetId] = {
        assetId: event.assetId,
        assetLabel: event.assetLabel,
        ownerSessionKey: event.sessionKey,
        ownerLabel: event.label,
        ownerAccentColor: event.accentColor,
        lockedAt: event.sentAt
      };
      nextState.lastConflict = null;
      return { state: nextState, accepted: true, conflict: null };
    }

    if (existing.ownerSessionKey === event.sessionKey) {
      nextState.locks[event.assetId] = {
        ...existing,
        ownerLabel: event.label,
        ownerAccentColor: event.accentColor,
        lockedAt: event.sentAt
      };
      nextState.lastConflict = null;
      return { state: nextState, accepted: true, conflict: null };
    }

    if (shouldReplaceLock(existing, event)) {
      const conflict = createConflict({
        assetId: event.assetId,
        assetLabel: event.assetLabel,
        holderSessionKey: event.sessionKey,
        holderLabel: event.label,
        challengerSessionKey: existing.ownerSessionKey,
        challengerLabel: existing.ownerLabel,
        occurredAt: event.sentAt,
        message: `${event.assetLabel} 잠금 소유자가 ${event.label}로 교체되었습니다.`
      });
      nextState.locks[event.assetId] = {
        assetId: event.assetId,
        assetLabel: event.assetLabel,
        ownerSessionKey: event.sessionKey,
        ownerLabel: event.label,
        ownerAccentColor: event.accentColor,
        lockedAt: event.sentAt
      };
      nextState.lastConflict = conflict;
      return { state: nextState, accepted: true, conflict };
    }

    const conflict = createConflict({
      assetId: event.assetId,
      assetLabel: event.assetLabel,
      holderSessionKey: existing.ownerSessionKey,
      holderLabel: existing.ownerLabel,
      challengerSessionKey: event.sessionKey,
      challengerLabel: event.label,
      occurredAt: event.sentAt,
      message: `${event.assetLabel}는 이미 ${existing.ownerLabel}가 잡고 있습니다.`
    });
    nextState.lastConflict = conflict;
    return { state: nextState, accepted: false, conflict };
  }

  if (event.type === "draft-move") {
    const lock = nextState.locks[event.assetId];
    if (!lock || lock.ownerSessionKey !== event.sessionKey) {
      return { state, accepted: false, conflict: null };
    }

    nextState.assets[event.assetId] = {
      ...asset,
      x: clampCoordinate(event.x),
      y: clampCoordinate(event.y),
      updatedAt: event.sentAt,
      updatedBySessionKey: event.sessionKey
    };
    return { state: nextState, accepted: true, conflict: null };
  }

  const lock = nextState.locks[event.assetId];
  if (!lock || lock.ownerSessionKey !== event.sessionKey) {
    return { state, accepted: false, conflict: null };
  }

  delete nextState.locks[event.assetId];
  return { state: nextState, accepted: true, conflict: null };
}

export function dismissRealtimeDraftConflict(state: RealtimeDraftState) {
  if (!state.lastConflict) {
    return state;
  }
  return {
    ...state,
    lastConflict: null
  };
}

export function pruneRealtimeDraftLocks(state: RealtimeDraftState, activeSessionKeys: Set<string>) {
  const nextLocks: RealtimeDraftState["locks"] = {};
  let changed = false;

  for (const [assetId, lock] of Object.entries(state.locks)) {
    if (activeSessionKeys.has(lock.ownerSessionKey)) {
      nextLocks[assetId] = lock;
      continue;
    }
    changed = true;
  }

  if (!changed) {
    return state;
  }

  return {
    ...state,
    locks: nextLocks
  };
}
