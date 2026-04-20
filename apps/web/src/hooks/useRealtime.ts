"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabase/client";
import {
  buildRealtimeLabChannelName,
  buildRealtimePresenceMeta,
  createRealtimeLabLabel,
  REALTIME_LAB_STALE_AFTER_MS,
  resolveRealtimeParticipantsFromPresenceState,
  type RealtimeParticipant
} from "../lib/experiments/realtime-presence";

type RealtimeStatus = "idle" | "disabled" | "connecting" | "connected" | "error";

const REALTIME_HEARTBEAT_INTERVAL_MS = 15_000;

function getRealtimeSessionKey() {
  if (typeof window === "undefined") {
    return null;
  }

  const storageKey = "plan2space:realtime-lab-session";
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
  const selfJoinedAtRef = useRef<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const selfSessionKey = useMemo(() => getRealtimeSessionKey(), []);
  const selfLabel = useMemo(
    () => (selfSessionKey ? createRealtimeLabLabel(selfSessionKey) : null),
    [selfSessionKey]
  );
  const channelName = roomId ? buildRealtimeLabChannelName(roomId) : null;

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

    const sendHeartbeat = async () => {
      const now = Date.now();
      const meta = buildRealtimePresenceMeta({
        roomId,
        sessionKey: selfSessionKey,
        label: selfLabel,
        now,
        joinedAt: selfJoinedAtRef.current ?? undefined
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

    channel
      .on("presence", { event: "sync" }, syncSnapshot)
      .on("presence", { event: "join" }, syncSnapshot)
      .on("presence", { event: "leave" }, syncSnapshot)
      .subscribe(async (nextStatus) => {
        if (cancelled) {
          return;
        }

        if (nextStatus === "SUBSCRIBED") {
          try {
            await sendHeartbeat();
            syncSnapshot();
            setStatus("connected");
          } catch (subscribeError) {
            setStatus("error");
            setError(subscribeError instanceof Error ? subscribeError.message : "Realtime track failed.");
          }
          return;
        }

        if (nextStatus === "CHANNEL_ERROR" || nextStatus === "TIMED_OUT") {
          setStatus("error");
          setError(`Realtime channel status: ${nextStatus}`);
        }
      });

    const heartbeatTimer = window.setInterval(() => {
      void sendHeartbeat().then(syncSnapshot).catch((heartbeatError) => {
        if (!cancelled) {
          setStatus("error");
          setError(heartbeatError instanceof Error ? heartbeatError.message : "Realtime heartbeat failed.");
        }
      });
    }, REALTIME_HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(heartbeatTimer);
      selfJoinedAtRef.current = null;
      setParticipants([]);
      void channel.untrack().catch(() => undefined);
      void supabase.removeChannel(channel);
      if (channelRef.current === channel) {
        channelRef.current = null;
      }
    };
  }, [channelName, enabled, roomId, selfLabel, selfSessionKey]);

  const activeParticipants = useMemo(
    () => participants.filter((participant) => !participant.stale),
    [participants]
  );

  return {
    status,
    error,
    roomId,
    channelName,
    participants,
    activeParticipants,
    sessionKey: selfSessionKey,
    selfLabel,
    heartbeatAt,
    lastSyncAt
  };
}
