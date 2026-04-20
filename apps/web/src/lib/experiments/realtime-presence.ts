export type RealtimePresenceMeta = {
  sessionKey: string;
  label: string;
  roomId: string;
  joinedAt: string;
  heartbeatAt: string;
};

export type RealtimeParticipant = {
  sessionKey: string;
  label: string;
  roomId: string;
  joinedAt: string;
  heartbeatAt: string;
  isSelf: boolean;
  stale: boolean;
};

export const REALTIME_LAB_STALE_AFTER_MS = 45_000;
const REALTIME_ROOM_ID_PATTERN = /^[a-z0-9-]{4,32}$/;

function toIsoString(value: number) {
  return new Date(value).toISOString();
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

export function buildRealtimeLabChannelName(roomId: string) {
  return `plan2space:labs:presence:${roomId}`;
}

export function buildRealtimePresenceMeta(input: {
  roomId: string;
  sessionKey: string;
  label: string;
  now?: number;
  joinedAt?: string;
}): RealtimePresenceMeta {
  const now = input.now ?? Date.now();
  return {
    sessionKey: input.sessionKey,
    label: input.label,
    roomId: input.roomId,
    joinedAt: input.joinedAt ?? toIsoString(now),
    heartbeatAt: toIsoString(now)
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

  return {
    sessionKey,
    roomId,
    label,
    joinedAt,
    heartbeatAt
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
  const participants: RealtimeParticipant[] = [];
  const presenceState = input.presenceState ?? {};

  for (const [presenceKey, value] of Object.entries(presenceState)) {
    for (const meta of value?.metas ?? []) {
      const normalized = normalizeParticipantMeta(meta, presenceKey);
      const heartbeatMs = new Date(normalized.heartbeatAt).getTime();
      const stale = !Number.isFinite(heartbeatMs) || now - heartbeatMs > staleAfterMs;
      participants.push({
        ...normalized,
        stale,
        isSelf: normalized.sessionKey === input.selfSessionKey
      });
    }
  }

  return participants.sort((left, right) => {
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
