"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase/client";
import {
  buildRealtimeDraftConflictEvent,
  buildRealtimeDraftLockEvent,
  buildRealtimeDraftMoveEvent,
  buildRealtimeDraftReleaseEvent,
  createRealtimeDraftState,
  dismissRealtimeDraftConflict,
  pruneRealtimeDraftLocks,
  transitionRealtimeDraftState,
  type RealtimeDraftEvent,
  type RealtimeDraftState
} from "../lib/experiments/realtime-draft";
import { resolveRealtimeLabHealth } from "../lib/experiments/realtime-health";
import {
  buildRealtimeAttentionPing,
  buildRealtimeLabChannelName,
  buildRealtimePresenceMeta,
  createDefaultRealtimeLocalPresenceState,
  createRealtimeLabLabel,
  REALTIME_LAB_STALE_AFTER_MS,
  resolveRealtimeBroadcastState,
  resolveRealtimeParticipantsFromPresenceState,
  type LocalRealtimePresenceState,
  type RealtimeAttentionPing,
  type RealtimeParticipant
} from "../lib/experiments/realtime-presence";
import type { RealtimePresenterRole, RealtimeViewMode } from "../lib/experiments/realtime-presence";

type RealtimeStatus = "idle" | "disabled" | "connecting" | "connected" | "error";

const REALTIME_HEARTBEAT_INTERVAL_MS = 15_000;
const REALTIME_PRESENCE_DEBOUNCE_MS = 120;
const REALTIME_CURSOR_EPSILON = 0.01;

function getRealtimeSessionKey() {
  if (typeof window === "undefined") {
    return null;
  }

  const storageKey = "deskterioronline:realtime-lab-session";
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const generated =
    window.crypto?.randomUUID?.() ?? `rt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(storageKey, generated);
  return generated;
}

export function useRealtime(input: {
  enabled: boolean;
  roomId: string | null;
}) {
  const { enabled, roomId } = input;
  const [status, setStatus] = useState<RealtimeStatus>(enabled ? "connecting" : "disabled");
  const [participants, setParticipants] = useState<RealtimeParticipant[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [heartbeatAt, setHeartbeatAt] = useState<string | null>(null);
  const [reconnectCount, setReconnectCount] = useState(0);
  const [lastConnectedAt, setLastConnectedAt] = useState<string | null>(null);
  const [lastDisconnectedAt, setLastDisconnectedAt] = useState<string | null>(null);
  const [lastAttentionPing, setLastAttentionPing] = useState<RealtimeAttentionPing | null>(null);
  const [draftState, setDraftState] = useState<RealtimeDraftState>(() => createRealtimeDraftState());
  const [localPresence, setLocalPresence] = useState<LocalRealtimePresenceState>(() =>
    createDefaultRealtimeLocalPresenceState()
  );
  const [retryToken, setRetryToken] = useState(0);
  const selfJoinedAtRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const draftStateRef = useRef(draftState);
  const localPresenceRef = useRef(localPresence);
  const syncSnapshotRef = useRef<(() => void) | null>(null);
  const sendPresenceUpdateRef = useRef<(() => Promise<void>) | null>(null);
  const selfSessionKey = useMemo(() => getRealtimeSessionKey(), []);
  const selfLabel = useMemo(
    () => (selfSessionKey ? createRealtimeLabLabel(selfSessionKey) : null),
    [selfSessionKey]
  );
  const channelName = roomId ? buildRealtimeLabChannelName(roomId) : null;

  useEffect(() => {
    localPresenceRef.current = localPresence;
  }, [localPresence]);

  useEffect(() => {
    draftStateRef.current = draftState;
  }, [draftState]);

  useEffect(() => {
    const nextDraftState = createRealtimeDraftState();
    draftStateRef.current = nextDraftState;
    setDraftState(nextDraftState);
    setLastAttentionPing(null);
    setReconnectCount(0);
    setLastConnectedAt(null);
    setLastDisconnectedAt(null);
  }, [roomId]);

  const setViewMode = useCallback((viewMode: RealtimeViewMode) => {
    if (!enabled) {
      return;
    }
    setLocalPresence((previous) => {
      if (previous.viewMode === viewMode) {
        return previous;
      }
      return {
        ...previous,
        viewMode
      };
    });
  }, [enabled]);

  const setSelectedAssetId = useCallback((selectedAssetId: string | null) => {
    if (!enabled) {
      return;
    }
    setLocalPresence((previous) => {
      if (previous.selectedAssetId === selectedAssetId) {
        return previous;
      }
      return {
        ...previous,
        selectedAssetId
      };
    });
  }, [enabled]);

  const setCursor = useCallback((cursor: { x: number; y: number } | null) => {
    if (!enabled && cursor) {
      return;
    }
    setLocalPresence((previous) => {
      if (!cursor) {
        if (!previous.cursor) {
          return previous;
        }
        return {
          ...previous,
          cursor: null
        };
      }

      if (
        previous.cursor &&
        Math.abs(previous.cursor.x - cursor.x) < REALTIME_CURSOR_EPSILON &&
        Math.abs(previous.cursor.y - cursor.y) < REALTIME_CURSOR_EPSILON
      ) {
        return previous;
      }

      return {
        ...previous,
        cursor
      };
    });
  }, [enabled]);

  const clearCursor = useCallback(() => {
    setCursor(null);
  }, [setCursor]);

  const setPresenterRole = useCallback((role: RealtimePresenterRole) => {
    if (!enabled) {
      return;
    }
    setLocalPresence((previous) => {
      if (previous.role === role) {
        return previous;
      }

      return {
        ...previous,
        role,
        followingPresenterSessionKey: role === "presenter" ? null : previous.followingPresenterSessionKey,
        spotlightAssetId: role === "presenter" ? previous.spotlightAssetId : null
      };
    });
  }, [enabled]);

  const setFollowingPresenterSessionKey = useCallback((followingPresenterSessionKey: string | null) => {
    if (!enabled) {
      return;
    }
    setLocalPresence((previous) => {
      if (previous.followingPresenterSessionKey === followingPresenterSessionKey) {
        return previous;
      }
      return {
        ...previous,
        followingPresenterSessionKey
      };
    });
  }, [enabled]);

  const setSpotlightAssetId = useCallback((spotlightAssetId: string | null) => {
    if (!enabled) {
      return;
    }
    setLocalPresence((previous) => {
      if (previous.spotlightAssetId === spotlightAssetId) {
        return previous;
      }
      return {
        ...previous,
        spotlightAssetId
      };
    });
  }, [enabled]);

  const applyDraftEvent = useCallback((event: RealtimeDraftEvent) => {
    const transition = transitionRealtimeDraftState(draftStateRef.current, event);
    draftStateRef.current = transition.state;
    setDraftState(transition.state);
    return transition;
  }, []);

  const sendDraftEvent = useCallback((event: RealtimeDraftEvent) => {
    const channel = channelRef.current;
    if (!channel) {
      return;
    }

    const eventName: RealtimeDraftEvent["type"] = event.type;
    void channel
      .send({
        type: "broadcast",
        event: eventName,
        payload: event
      })
      .then((result) => {
        if (result !== "ok") {
          throw new Error(`Realtime draft broadcast failed: ${result}`);
        }
      })
      .catch((draftError) => {
        setError(draftError instanceof Error ? draftError.message : "Realtime draft broadcast failed.");
      });
  }, []);

  const claimDraftAsset = useCallback(
    (input: { assetId: string; assetLabel: string }) => {
      if (!enabled || !roomId || !selfSessionKey || !selfLabel) {
        return false;
      }

      setSelectedAssetId(input.assetId);
      const event = buildRealtimeDraftLockEvent({
        roomId,
        assetId: input.assetId,
        assetLabel: input.assetLabel,
        sessionKey: selfSessionKey,
        label: selfLabel,
        accentColor: buildRealtimePresenceMeta({
          roomId,
          sessionKey: selfSessionKey,
          label: selfLabel,
          localState: localPresenceRef.current
        }).accentColor
      });
      const transition = applyDraftEvent(event);
      if (transition.accepted) {
        sendDraftEvent(event);
      } else if (transition.conflict) {
        sendDraftEvent(
          buildRealtimeDraftConflictEvent({
            roomId,
            assetId: transition.conflict.assetId,
            assetLabel: transition.conflict.assetLabel,
            holderSessionKey: transition.conflict.holderSessionKey,
            holderLabel: transition.conflict.holderLabel,
            challengerSessionKey: transition.conflict.challengerSessionKey,
            challengerLabel: transition.conflict.challengerLabel,
            message: transition.conflict.message
          })
        );
      }
      return transition.accepted;
    },
    [applyDraftEvent, enabled, roomId, selfLabel, selfSessionKey, sendDraftEvent, setSelectedAssetId]
  );

  const moveDraftAsset = useCallback(
    (input: { assetId: string; assetLabel: string; x: number; y: number }) => {
      if (!enabled || !roomId || !selfSessionKey || !selfLabel) {
        return false;
      }

      const event = buildRealtimeDraftMoveEvent({
        roomId,
        assetId: input.assetId,
        assetLabel: input.assetLabel,
        sessionKey: selfSessionKey,
        label: selfLabel,
        accentColor: buildRealtimePresenceMeta({
          roomId,
          sessionKey: selfSessionKey,
          label: selfLabel,
          localState: localPresenceRef.current
        }).accentColor,
        x: input.x,
        y: input.y
      });
      const transition = applyDraftEvent(event);
      if (transition.accepted) {
        sendDraftEvent(event);
      }
      return transition.accepted;
    },
    [applyDraftEvent, enabled, roomId, selfLabel, selfSessionKey, sendDraftEvent]
  );

  const releaseDraftAsset = useCallback(
    (input: { assetId: string; assetLabel: string }) => {
      if (!enabled || !roomId || !selfSessionKey || !selfLabel) {
        return false;
      }

      const event = buildRealtimeDraftReleaseEvent({
        roomId,
        assetId: input.assetId,
        assetLabel: input.assetLabel,
        sessionKey: selfSessionKey,
        label: selfLabel,
        accentColor: buildRealtimePresenceMeta({
          roomId,
          sessionKey: selfSessionKey,
          label: selfLabel,
          localState: localPresenceRef.current
        }).accentColor
      });
      const transition = applyDraftEvent(event);
      if (transition.accepted) {
        sendDraftEvent(event);
      }
      return transition.accepted;
    },
    [applyDraftEvent, enabled, roomId, selfLabel, selfSessionKey, sendDraftEvent]
  );

  const dismissDraftConflictBanner = useCallback(() => {
    setDraftState((previous) => {
      const nextState = dismissRealtimeDraftConflict(previous);
      draftStateRef.current = nextState;
      return nextState;
    });
  }, []);

  const retryConnection = useCallback(() => {
    if (!enabled || !roomId || !selfSessionKey || !selfLabel) {
      return false;
    }

    setReconnectCount((previous) => previous + 1);
    setError(null);
    setStatus("connecting");
    setRetryToken((previous) => previous + 1);
    return true;
  }, [enabled, roomId, selfLabel, selfSessionKey]);

  useEffect(() => {
    if (!enabled) {
      setStatus("disabled");
      setParticipants([]);
      setError(null);
      return;
    }

    if (!roomId || !selfSessionKey || !selfLabel || !channelName) {
      setStatus("idle");
      setParticipants([]);
      setError(null);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setStatus("error");
      setError("Supabase browser client를 초기화할 수 없습니다.");
      setParticipants([]);
      return;
    }

    setStatus("connecting");
    setError(null);
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: selfSessionKey
        }
      }
    });
    channelRef.current = channel;
    let cancelled = false;

    const syncSnapshot = () => {
      const nextParticipants = resolveRealtimeParticipantsFromPresenceState({
        presenceState: channel.presenceState() as Record<string, { metas?: Array<Record<string, unknown>> }>,
        selfSessionKey,
        now: Date.now(),
        staleAfterMs: REALTIME_LAB_STALE_AFTER_MS
      });
      if (!cancelled) {
        setParticipants(nextParticipants);
        setLastSyncAt(new Date().toISOString());
      }
    };
    syncSnapshotRef.current = syncSnapshot;

    const sendPresenceUpdate = async () => {
      const now = Date.now();
      const meta = buildRealtimePresenceMeta({
        roomId,
        sessionKey: selfSessionKey,
        label: selfLabel,
        now,
        joinedAt: selfJoinedAtRef.current ?? undefined,
        localState: localPresenceRef.current
      });
      if (!selfJoinedAtRef.current) {
        selfJoinedAtRef.current = meta.joinedAt;
      }
      setHeartbeatAt(meta.heartbeatAt);
      const result = await channel.track(meta);
      if (result !== "ok") {
        throw new Error(`Realtime heartbeat failed: ${result}`);
      }
    };
    sendPresenceUpdateRef.current = sendPresenceUpdate;

    channel
      .on("presence", { event: "sync" }, syncSnapshot)
      .on("presence", { event: "join" }, syncSnapshot)
      .on("presence", { event: "leave" }, syncSnapshot)
      .on("broadcast", { event: "draft-lock" }, ({ payload }) => {
        if (cancelled || !payload || typeof payload !== "object") {
          return;
        }
        applyDraftEvent(payload as RealtimeDraftEvent);
      })
      .on("broadcast", { event: "draft-move" }, ({ payload }) => {
        if (cancelled || !payload || typeof payload !== "object") {
          return;
        }
        applyDraftEvent(payload as RealtimeDraftEvent);
      })
      .on("broadcast", { event: "draft-release" }, ({ payload }) => {
        if (cancelled || !payload || typeof payload !== "object") {
          return;
        }
        applyDraftEvent(payload as RealtimeDraftEvent);
      })
      .on("broadcast", { event: "draft-conflict" }, ({ payload }) => {
        if (cancelled || !payload || typeof payload !== "object") {
          return;
        }
        applyDraftEvent(payload as RealtimeDraftEvent);
      })
      .on("broadcast", { event: "attention-ping" }, ({ payload }) => {
        if (cancelled || !payload || typeof payload !== "object") {
          return;
        }
        const ping = payload as Partial<RealtimeAttentionPing> & Record<string, unknown>;
        if (
          typeof ping.roomId !== "string" ||
          typeof ping.fromSessionKey !== "string" ||
          typeof ping.fromLabel !== "string" ||
          typeof ping.message !== "string" ||
          typeof ping.sentAt !== "string"
        ) {
          return;
        }
        setLastAttentionPing({
          roomId,
          fromSessionKey: ping.fromSessionKey,
          fromLabel: ping.fromLabel,
          fromAccentColor:
            typeof ping.fromAccentColor === "string" ? ping.fromAccentColor : "hsl(32 76% 54%)",
          targetSessionKey: typeof ping.targetSessionKey === "string" ? ping.targetSessionKey : null,
          targetLabel: typeof ping.targetLabel === "string" ? ping.targetLabel : null,
          message: ping.message,
          sentAt: ping.sentAt
        });
      })
      .subscribe(async (nextStatus) => {
        if (cancelled) {
          return;
        }

        if (nextStatus === "SUBSCRIBED") {
          try {
            await sendPresenceUpdate();
            syncSnapshot();
            setStatus("connected");
            setLastConnectedAt(new Date().toISOString());
          } catch (subscribeError) {
            setStatus("error");
            setLastDisconnectedAt(new Date().toISOString());
            setError(subscribeError instanceof Error ? subscribeError.message : "Realtime track failed.");
          }
          return;
        }

        if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT" || nextStatus === "CLOSED") {
          setStatus("error");
          setLastDisconnectedAt(new Date().toISOString());
          setError(`Realtime channel status: ${nextStatus}`);
        }
      });

    const heartbeatTimer = window.setInterval(() => {
      void sendPresenceUpdate().then(syncSnapshot).catch((heartbeatError) => {
        if (!cancelled) {
          setStatus("error");
          setLastDisconnectedAt(new Date().toISOString());
          setError(heartbeatError instanceof Error ? heartbeatError.message : "Realtime heartbeat failed.");
        }
      });
    }, REALTIME_HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatTimer);
      selfJoinedAtRef.current = null;
      setParticipants([]);
      setLastAttentionPing(null);
      syncSnapshotRef.current = null;
      sendPresenceUpdateRef.current = null;
      void channel.untrack().catch(() => undefined);
      void supabase.removeChannel(channel);
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [applyDraftEvent, channelName, enabled, retryToken, roomId, selfLabel, selfSessionKey]);

  useEffect(() => {
    if (status !== "connected") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const sendPresenceUpdate = sendPresenceUpdateRef.current;
      if (!sendPresenceUpdate) {
        return;
      }
      void sendPresenceUpdate()
        .then(() => syncSnapshotRef.current?.())
        .catch((presenceError) => {
          setStatus("error");
          setLastDisconnectedAt(new Date().toISOString());
          setError(presenceError instanceof Error ? presenceError.message : "Realtime presence update failed.");
        });
    }, REALTIME_PRESENCE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [localPresence, status]);

  const health = useMemo(
    () =>
      resolveRealtimeLabHealth({
        participants,
        reconnectCount,
        lastConnectedAt,
        lastDisconnectedAt,
        lastSyncAt,
        canRetry: enabled && Boolean(roomId),
        needsAttention: status === "error" || Boolean(error)
      }),
    [enabled, error, lastConnectedAt, lastDisconnectedAt, lastSyncAt, participants, reconnectCount, roomId, status]
  );
  const activeParticipants = health.activeParticipants;

  useEffect(() => {
    const activeSessionKeys = new Set(activeParticipants.map((participant) => participant.sessionKey));
    const nextState = pruneRealtimeDraftLocks(draftStateRef.current, activeSessionKeys);
    if (nextState === draftStateRef.current) {
      return;
    }
    draftStateRef.current = nextState;
    setDraftState(nextState);
  }, [activeParticipants]);

  const broadcastState = useMemo(
    () => resolveRealtimeBroadcastState({ participants: activeParticipants }),
    [activeParticipants]
  );
  const currentPresenter = broadcastState.presenter;
  const isFollowingPresenter = Boolean(
    currentPresenter &&
      !currentPresenter.isSelf &&
      localPresence.followingPresenterSessionKey === currentPresenter.sessionKey
  );

  useEffect(() => {
    if (!currentPresenter) {
      return;
    }
    if (!isFollowingPresenter) {
      return;
    }

    const nextSelectedAssetId = currentPresenter.spotlightAssetId ?? currentPresenter.selectedAssetId;
    setLocalPresence((previous) => {
      if (
        previous.viewMode === currentPresenter.viewMode &&
        previous.selectedAssetId === nextSelectedAssetId
      ) {
        return previous;
      }

      return {
        ...previous,
        viewMode: currentPresenter.viewMode,
        selectedAssetId: nextSelectedAssetId
      };
    });
  }, [currentPresenter, isFollowingPresenter]);

  useEffect(() => {
    if (!localPresence.followingPresenterSessionKey) {
      return;
    }
    if (currentPresenter && currentPresenter.sessionKey === localPresence.followingPresenterSessionKey) {
      return;
    }
    setFollowingPresenterSessionKey(null);
  }, [currentPresenter, localPresence.followingPresenterSessionKey, setFollowingPresenterSessionKey]);

  const sendAttentionPing = useCallback(
    async (input: { message: string; targetSessionKey?: string | null; targetLabel?: string | null }) => {
      if (!enabled || !roomId || !selfSessionKey || !selfLabel || !channelRef.current) {
        return false;
      }

      const ping = buildRealtimeAttentionPing({
        roomId,
        fromSessionKey: selfSessionKey,
        fromLabel: selfLabel,
        targetSessionKey: input.targetSessionKey,
        targetLabel: input.targetLabel,
        message: input.message
      });

      const result = await channelRef.current.send({
        type: "broadcast",
        event: "attention-ping",
        payload: ping
      });

      if (result !== "ok") {
        throw new Error(`Realtime attention ping failed: ${result}`);
      }

      setLastAttentionPing(ping);
      return true;
    },
    [enabled, roomId, selfLabel, selfSessionKey]
  );

  return {
    status,
    error,
    roomId,
    channelName,
    participants: health.visibleParticipants,
    activeParticipants,
    archivedParticipants: health.archivedParticipants,
    sessionKey: selfSessionKey,
    selfLabel,
    heartbeatAt,
    lastSyncAt,
    lastConnectedAt,
    lastDisconnectedAt,
    reconnectCount,
    health,
    localPresence,
    broadcastState,
    currentPresenter,
    isFollowingPresenter,
    lastAttentionPing,
    draftState,
    setViewMode,
    setSelectedAssetId,
    setCursor,
    clearCursor,
    setPresenterRole,
    setFollowingPresenterSessionKey,
    setSpotlightAssetId,
    sendAttentionPing,
    retryConnection,
    claimDraftAsset,
    moveDraftAsset,
    releaseDraftAsset,
    dismissDraftConflictBanner
  };
}
