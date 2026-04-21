export type RealtimeViewMode = "room" | "desk" | "walk";
export type RealtimePresenterRole = "participant" | "presenter";

export type RealtimeCursor = {
  x: number;
  y: number;
  updatedAt: string;
};

export type LocalRealtimePresenceState = {
  viewMode: RealtimeViewMode;
  selectedAssetId: string | null;
  cursor: {
    x: number;
    y: number;
  } | null;
  role: RealtimePresenterRole;
  followingPresenterSessionKey: string | null;
  spotlightAssetId: string | null;
};

export type RealtimePresenceMeta = {
  sessionKey: string;
  label: string;
  roomId: string;
  joinedAt: string;
  heartbeatAt: string;
  accentColor: string;
  viewMode: RealtimeViewMode;
  selectedAssetId: string | null;
  cursor: RealtimeCursor | null;
  role: RealtimePresenterRole;
  followingPresenterSessionKey: string | null;
  spotlightAssetId: string | null;
};

export type RealtimeParticipant = {
  sessionKey: string;
  label: string;
  roomId: string;
  joinedAt: string;
  heartbeatAt: string;
  isSelf: boolean;
  stale: boolean;
  accentColor: string;
  viewMode: RealtimeViewMode;
  selectedAssetId: string | null;
  cursor: RealtimeCursor | null;
  role: RealtimePresenterRole;
  followingPresenterSessionKey: string | null;
  spotlightAssetId: string | null;
};

export type RealtimeBroadcastState = {
  presenter: RealtimeParticipant | null;
  spotlightAssetId: string | null;
};

export type RealtimeAttentionPing = {
  roomId: string;
  fromSessionKey: string;
  fromLabel: string;
  fromAccentColor: string;
  targetSessionKey: string | null;
  targetLabel: string | null;
  message: string;
  sentAt: string;
};

export const REALTIME_LAB_STALE_AFTER_MS = 45_000;
const REALTIME_ROOM_ID_PATTERN = /^[a-z0-9-]{4,32}$/;
const REALTIME_VIEW_MODES = new Set<RealtimeViewMode>(["room", "desk", "walk"]);
const REALTIME_PRESENTER_ROLES = new Set<RealtimePresenterRole>(["participant", "presenter"]);

function toIsoString(value: number) {
  return new Date(value).toISOString();
}

function clampNormalizedCoordinate(value: number) {
  return Math.min(1, Math.max(0, value));
}

function isRealtimeViewMode(value: unknown): value is RealtimeViewMode {
  return typeof value === "string" && REALTIME_VIEW_MODES.has(value as RealtimeViewMode);
}

function isRealtimePresenterRole(value: unknown): value is RealtimePresenterRole {
  return typeof value === "string" && REALTIME_PRESENTER_ROLES.has(value as RealtimePresenterRole);
}

export function normalizeRealtimeLabRoomId(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-");
  const compact = normalized.replace(/^-|-$/g, "");
  if (!REALTIME_ROOM_ID_PATTERN.test(compact)) {
    return null;
  }
  return compact;
}

export function createRealtimeLabRoomId(now = Date.now()) {
  const timeSeed = now.toString(36).slice(-5);
  const randomSeed = Math.random().toString(36).slice(2, 8);
  return normalizeRealtimeLabRoomId(`lab-${timeSeed}-${randomSeed}`) ?? `lab-${timeSeed}`;
}

export function createDefaultRealtimeLocalPresenceState(): LocalRealtimePresenceState {
  return {
    viewMode: "room",
    selectedAssetId: null,
    cursor: null,
    role: "participant",
    followingPresenterSessionKey: null,
    spotlightAssetId: null
  };
}

export function buildRealtimeLabChannelName(roomId: string) {
  return `deskterioronline:labs:presence:${roomId}`;
}

export function createRealtimeLabAccentColor(sessionKey: string) {
  let hash = 0;
  for (const character of sessionKey) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue} 76% 54%)`;
}

function normalizeOptionalAssetId(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeOptionalSessionKey(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function buildRealtimePresenceMeta(input: {
  roomId: string;
  sessionKey: string;
  label: string;
  now?: number;
  joinedAt?: string;
  localState?: LocalRealtimePresenceState;
}): RealtimePresenceMeta {
  const now = input.now ?? Date.now();
  const localState = input.localState ?? createDefaultRealtimeLocalPresenceState();
  return {
    sessionKey: input.sessionKey,
    label: input.label,
    roomId: input.roomId,
    joinedAt: input.joinedAt ?? toIsoString(now),
    heartbeatAt: toIsoString(now),
    accentColor: createRealtimeLabAccentColor(input.sessionKey),
    viewMode: isRealtimeViewMode(localState.viewMode) ? localState.viewMode : "room",
    selectedAssetId: normalizeOptionalAssetId(localState.selectedAssetId),
    cursor: localState.cursor
      ? {
          x: clampNormalizedCoordinate(localState.cursor.x),
          y: clampNormalizedCoordinate(localState.cursor.y),
          updatedAt: toIsoString(now)
        }
      : null,
    role: isRealtimePresenterRole(localState.role) ? localState.role : "participant",
    followingPresenterSessionKey: normalizeOptionalSessionKey(localState.followingPresenterSessionKey),
    spotlightAssetId:
      localState.role === "presenter" ? normalizeOptionalAssetId(localState.spotlightAssetId) : null
  };
}

export function buildRealtimeAttentionPing(input: {
  roomId: string;
  fromSessionKey: string;
  fromLabel: string;
  targetSessionKey?: string | null;
  targetLabel?: string | null;
  message: string;
  now?: number;
}): RealtimeAttentionPing {
  const now = input.now ?? Date.now();
  return {
    roomId: input.roomId,
    fromSessionKey: input.fromSessionKey,
    fromLabel: input.fromLabel,
    fromAccentColor: createRealtimeLabAccentColor(input.fromSessionKey),
    targetSessionKey: normalizeOptionalSessionKey(input.targetSessionKey),
    targetLabel: typeof input.targetLabel === "string" && input.targetLabel.length > 0 ? input.targetLabel : null,
    message: input.message,
    sentAt: toIsoString(now)
  };
}

export function createRealtimeLabLabel(sessionKey: string) {
  return `guest-${sessionKey.slice(-4).toLowerCase()}`;
}

type PresenceStateLike = Record<
  string,
  {
    metas?: Array<Partial<RealtimePresenceMeta> & Record<string, unknown>>;
  }
>;

function normalizeRealtimeCursor(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<RealtimeCursor> & Record<string, unknown>;
  if (
    typeof candidate.x !== "number" ||
    typeof candidate.y !== "number" ||
    !Number.isFinite(candidate.x) ||
    !Number.isFinite(candidate.y)
  ) {
    return null;
  }

  const updatedAt =
    typeof candidate.updatedAt === "string" && !Number.isNaN(new Date(candidate.updatedAt).getTime())
      ? candidate.updatedAt
      : new Date(0).toISOString();

  return {
    x: clampNormalizedCoordinate(candidate.x),
    y: clampNormalizedCoordinate(candidate.y),
    updatedAt
  };
}

function normalizeParticipantMeta(
  entry: Partial<RealtimePresenceMeta> & Record<string, unknown>,
  fallbackKey: string
) {
  const sessionKey =
    typeof entry.sessionKey === "string" && entry.sessionKey.length > 0
      ? entry.sessionKey
      : fallbackKey;
  const roomId = typeof entry.roomId === "string" && entry.roomId.length > 0 ? entry.roomId : "unknown-room";
  const label =
    typeof entry.label === "string" && entry.label.length > 0
      ? entry.label
      : createRealtimeLabLabel(sessionKey);
  const joinedAt =
    typeof entry.joinedAt === "string" && !Number.isNaN(new Date(entry.joinedAt).getTime())
      ? entry.joinedAt
      : typeof entry.heartbeatAt === "string" && !Number.isNaN(new Date(entry.heartbeatAt).getTime())
        ? entry.heartbeatAt
        : new Date(0).toISOString();
  const heartbeatAt =
    typeof entry.heartbeatAt === "string" && !Number.isNaN(new Date(entry.heartbeatAt).getTime())
      ? entry.heartbeatAt
      : joinedAt;
  const accentColor =
    typeof entry.accentColor === "string" && entry.accentColor.length > 0
      ? entry.accentColor
      : createRealtimeLabAccentColor(sessionKey);
  const viewMode = isRealtimeViewMode(entry.viewMode) ? entry.viewMode : "room";
  const role = isRealtimePresenterRole(entry.role) ? entry.role : "participant";
  const selectedAssetId = normalizeOptionalAssetId(entry.selectedAssetId);
  const cursor = normalizeRealtimeCursor(entry.cursor);
  const followingPresenterSessionKey = normalizeOptionalSessionKey(entry.followingPresenterSessionKey);
  const spotlightAssetId = role === "presenter" ? normalizeOptionalAssetId(entry.spotlightAssetId) : null;

  return {
    sessionKey,
    roomId,
    label,
    joinedAt,
    heartbeatAt,
    accentColor,
    viewMode,
    selectedAssetId,
    cursor,
    role,
    followingPresenterSessionKey,
    spotlightAssetId
  };
}

export function resolveRealtimeParticipantsFromPresenceState(input: {
  presenceState: PresenceStateLike | null | undefined;
  selfSessionKey: string | null;
  now?: number;
  staleAfterMs?: number;
}) {
  const now = input.now ?? Date.now();
  const staleAfterMs = input.staleAfterMs ?? REALTIME_LAB_STALE_AFTER_MS;
  const participants = new Map<string, RealtimeParticipant>();
  const presenceState = input.presenceState ?? {};

  for (const [presenceKey, value] of Object.entries(presenceState)) {
    for (const meta of value?.metas ?? []) {
      const normalized = normalizeParticipantMeta(meta, presenceKey);
      const heartbeatMs = new Date(normalized.heartbeatAt).getTime();
      const stale = !Number.isFinite(heartbeatMs) || now - heartbeatMs > staleAfterMs;
      const nextParticipant: RealtimeParticipant = {
        ...normalized,
        stale,
        isSelf: normalized.sessionKey === input.selfSessionKey
      };
      const existing = participants.get(nextParticipant.sessionKey);
      if (!existing) {
        participants.set(nextParticipant.sessionKey, nextParticipant);
        continue;
      }

      const existingHeartbeatMs = new Date(existing.heartbeatAt).getTime();
      if (!Number.isFinite(existingHeartbeatMs) || heartbeatMs >= existingHeartbeatMs) {
        participants.set(nextParticipant.sessionKey, nextParticipant);
      }
    }
  }

  return [...participants.values()].sort((left, right) => {
    if (left.isSelf !== right.isSelf) {
      return left.isSelf ? -1 : 1;
    }
    if (left.stale !== right.stale) {
      return left.stale ? 1 : -1;
    }
    const heartbeatDelta = new Date(right.heartbeatAt).getTime() - new Date(left.heartbeatAt).getTime();
    if (!Number.isNaN(heartbeatDelta) && heartbeatDelta !== 0) {
      return heartbeatDelta;
    }
    return left.label.localeCompare(right.label);
  });
}

export function resolveRealtimeBroadcastState(input: {
  participants: RealtimeParticipant[];
}) {
  const presenters = input.participants.filter((participant) => !participant.stale && participant.role === "presenter");
  const presenter =
    presenters.sort(
      (left, right) => new Date(right.heartbeatAt).getTime() - new Date(left.heartbeatAt).getTime()
    )[0] ?? null;

  return {
    presenter,
    spotlightAssetId: presenter?.spotlightAssetId ?? null
  } satisfies RealtimeBroadcastState;
}
