import {
  REALTIME_LAB_STALE_AFTER_MS,
  type RealtimeParticipant
} from "./realtime-presence";

export const REALTIME_LAB_ARCHIVE_AFTER_MS = 5 * 60_000;

export type RealtimeLabHealthSnapshot = {
  activeParticipants: RealtimeParticipant[];
  staleVisibleParticipants: RealtimeParticipant[];
  visibleParticipants: RealtimeParticipant[];
  archivedParticipants: RealtimeParticipant[];
  activeCount: number;
  staleVisibleCount: number;
  archivedCount: number;
  reconnectCount: number;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastSyncAt: string | null;
  staleAfterMs: number;
  archiveAfterMs: number;
  canRetry: boolean;
  needsAttention: boolean;
};

export type RealtimeLabExitGateItem = {
  id: string;
  label: string;
  description: string;
  ok: boolean;
};

function getParticipantAgeMs(heartbeatAt: string, now: number) {
  const timestamp = Date.parse(heartbeatAt);
  if (Number.isNaN(timestamp)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, now - timestamp);
}

export function partitionRealtimeParticipants(input: {
  participants: RealtimeParticipant[];
  now?: number;
  archiveAfterMs?: number;
}) {
  const now = input.now ?? Date.now();
  const archiveAfterMs = input.archiveAfterMs ?? REALTIME_LAB_ARCHIVE_AFTER_MS;
  const activeParticipants: RealtimeParticipant[] = [];
  const staleVisibleParticipants: RealtimeParticipant[] = [];
  const archivedParticipants: RealtimeParticipant[] = [];

  for (const participant of input.participants) {
    const archived = participant.stale && getParticipantAgeMs(participant.heartbeatAt, now) >= archiveAfterMs;
    if (archived) {
      archivedParticipants.push(participant);
      continue;
    }

    if (participant.stale) {
      staleVisibleParticipants.push(participant);
      continue;
    }

    activeParticipants.push(participant);
  }

  return {
    activeParticipants,
    staleVisibleParticipants,
    visibleParticipants: [...activeParticipants, ...staleVisibleParticipants],
    archivedParticipants
  };
}

export function resolveRealtimeLabHealth(input: {
  participants: RealtimeParticipant[];
  reconnectCount: number;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  lastSyncAt: string | null;
  canRetry: boolean;
  needsAttention: boolean;
  now?: number;
  staleAfterMs?: number;
  archiveAfterMs?: number;
}): RealtimeLabHealthSnapshot {
  const staleAfterMs = input.staleAfterMs ?? REALTIME_LAB_STALE_AFTER_MS;
  const archiveAfterMs = input.archiveAfterMs ?? REALTIME_LAB_ARCHIVE_AFTER_MS;
  const buckets = partitionRealtimeParticipants({
    participants: input.participants,
    now: input.now,
    archiveAfterMs
  });

  return {
    ...buckets,
    activeCount: buckets.activeParticipants.length,
    staleVisibleCount: buckets.staleVisibleParticipants.length,
    archivedCount: buckets.archivedParticipants.length,
    reconnectCount: input.reconnectCount,
    lastConnectedAt: input.lastConnectedAt,
    lastDisconnectedAt: input.lastDisconnectedAt,
    lastSyncAt: input.lastSyncAt,
    staleAfterMs,
    archiveAfterMs,
    canRetry: input.canRetry,
    needsAttention: input.needsAttention
  };
}

export function resolveRealtimeLabExitGate(input: {
  localOnly: boolean;
  killSwitchReady: boolean;
  reconnectReady: boolean;
  staleCleanupReady: boolean;
  presenterReady: boolean;
  collaborativeDraftReady: boolean;
}): RealtimeLabExitGateItem[] {
  return [
    {
      id: "local-only",
      label: "Primary Flow Isolation",
      description: "realtime 실험은 hidden `/labs/realtime` local-only 경로에만 머문다.",
      ok: input.localOnly
    },
    {
      id: "kill-switch",
      label: "Kill Switch",
      description: "실패 시 runtime을 즉시 pause/resume 할 수 있다.",
      ok: input.killSwitchReady
    },
    {
      id: "reconnect",
      label: "Reconnect Control",
      description: "오류 후 수동 retry와 reconnect count를 확인할 수 있다.",
      ok: input.reconnectReady
    },
    {
      id: "stale-cleanup",
      label: "Stale Cleanup",
      description: "stale participant는 표시 후 archive 단계로 정리된다.",
      ok: input.staleCleanupReady
    },
    {
      id: "broadcast-draft",
      label: "Broadcast + Draft Coverage",
      description: "presenter broadcast와 collaborative draft가 hardening 이후에도 유지된다.",
      ok: input.presenterReady && input.collaborativeDraftReady
    }
  ];
}
