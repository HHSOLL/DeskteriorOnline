"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createRealtimeLabRoomId,
  normalizeRealtimeLabRoomId
} from "../lib/experiments/realtime-presence";

export function useRealtimeSync(input: { enabled: boolean }) {
  const { enabled } = input;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryRoomId = normalizeRealtimeLabRoomId(searchParams.get("room"));
  const [draftRoomId, setDraftRoomId] = useState(queryRoomId ?? "");

  useEffect(() => {
    setDraftRoomId(queryRoomId ?? "");
  }, [queryRoomId]);

  const replaceRoomQuery = useCallback(
    (nextRoomId: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextRoomId) {
        params.set("room", nextRoomId);
      } else {
        params.delete("room");
      }
      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const createRoom = useCallback(() => {
    const nextRoomId = createRealtimeLabRoomId();
    replaceRoomQuery(nextRoomId);
    return nextRoomId;
  }, [replaceRoomQuery]);

  const joinRoom = useCallback(
    (value: string) => {
      const normalized = normalizeRealtimeLabRoomId(value);
      if (!normalized) {
        return null;
      }
      replaceRoomQuery(normalized);
      return normalized;
    },
    [replaceRoomQuery]
  );

  useEffect(() => {
    if (!enabled || queryRoomId) {
      return;
    }
    createRoom();
  }, [createRoom, enabled, queryRoomId]);

  const shareUrl = useMemo(() => {
    if (!queryRoomId) {
      return null;
    }
    return `${pathname}?room=${encodeURIComponent(queryRoomId)}`;
  }, [pathname, queryRoomId]);

  return {
    roomId: queryRoomId,
    draftRoomId,
    setDraftRoomId,
    createRoom,
    joinRoom,
    shareUrl
  };
}
