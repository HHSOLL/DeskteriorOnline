"use client";

import { useMemo, useState } from "react";
import { Activity, Copy, RadioTower, RefreshCcw, Users } from "lucide-react";
import type { RealtimeLabsConfig } from "../../lib/experiments/realtime-labs";
import { useRealtime } from "../../hooks/useRealtime";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";

function formatTimestamp(value: string | null) {
  if (!value) return "없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "없음";
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function buildAbsoluteShareUrl(path: string | null) {
  if (!path || typeof window === "undefined") {
    return null;
  }
  return new URL(path, window.location.origin).toString();
}

export function RealtimeLabClient({ config }: { config: RealtimeLabsConfig }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [roomError, setRoomError] = useState<string | null>(null);
  const realtimeSync = useRealtimeSync({ enabled: config.enabled });
  const realtime = useRealtime({
    enabled: config.enabled,
    roomId: realtimeSync.roomId
  });
  const absoluteShareUrl = useMemo(
    () => buildAbsoluteShareUrl(realtimeSync.shareUrl),
    [realtimeSync.shareUrl]
  );

  const handleJoinRoom = () => {
    const joinedRoom = realtimeSync.joinRoom(realtimeSync.draftRoomId);
    if (!joinedRoom) {
      setRoomError("room id는 영문 소문자, 숫자, 하이픈만 사용하며 4~32자여야 합니다.");
      return;
    }
    setRoomError(null);
    setCopyState("idle");
  };

  const handleCopyLink = async () => {
    if (!absoluteShareUrl || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(absoluteShareUrl);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };

  return (
    <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_360px]">
      <div className="space-y-5">
        <div className="rounded-[24px] border border-black/10 bg-white/82 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
            <RadioTower className="h-4 w-4" />
            <span>Phase 1 Foundation</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#171411]">
            room bootstrap / heartbeat / occupancy snapshot
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#625a51]">
            이 단계는 local-only lab room에 참가자를 묶고, heartbeat와 occupancy snapshot을 안정적으로 보여주는
            기반만 다룬다. scene write, presenter broadcast, 공동 편집은 아직 포함하지 않는다.
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="rounded-[18px] border border-black/10 bg-[#faf7f1] px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e7367]">Lab Room</div>
              <input
                value={realtimeSync.draftRoomId}
                onChange={(event) => {
                  realtimeSync.setDraftRoomId(event.target.value);
                  setCopyState("idle");
                  setRoomError(null);
                }}
                placeholder="lab-room-id"
                className="mt-2 w-full bg-transparent text-sm font-semibold text-[#171411] outline-none"
              />
            </label>
            <button
              type="button"
              onClick={handleJoinRoom}
              disabled={!config.enabled}
              className="rounded-full border border-black/10 bg-white px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-[#171411] transition hover:bg-[#f4f4f1] disabled:cursor-not-allowed disabled:text-[#a79c90]"
            >
              참가
            </button>
            <button
              type="button"
              onClick={() => {
                realtimeSync.createRoom();
                setCopyState("idle");
              }}
              disabled={!config.enabled}
              className="inline-flex items-center gap-2 rounded-full bg-[#171411] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-[#8b8177]"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              새 room
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-[#625a51]">
            <span>상태 {realtime.status}</span>
            <span>활성 참가자 {realtime.activeParticipants.length}</span>
            <span>전체 스냅샷 {realtime.participants.length}</span>
            <span>마지막 sync {formatTimestamp(realtime.lastSyncAt)}</span>
            <span>최근 heartbeat {formatTimestamp(realtime.heartbeatAt)}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-black/10 bg-[#f4f4f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51]">
              session {realtime.sessionKey?.slice(-8) ?? "없음"}
            </div>
            <div className="rounded-full border border-black/10 bg-[#f4f4f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51]">
              self {realtime.selfLabel ?? "없음"}
            </div>
            {absoluteShareUrl ? (
              <button
                type="button"
                onClick={handleCopyLink}
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#171411] transition hover:bg-[#f4f4f1]"
              >
                <Copy className="h-3.5 w-3.5" />
                {copyState === "copied" ? "링크 복사됨" : copyState === "error" ? "복사 실패" : "Room 링크 복사"}
              </button>
            ) : null}
          </div>

          {roomError ? (
            <div className="mt-4 rounded-[18px] border border-amber-500/25 bg-amber-50 p-4 text-sm leading-6 text-[#7a4d17]">
              {roomError}
            </div>
          ) : null}

          {realtime.error ? (
            <div className="mt-4 rounded-[18px] border border-amber-500/25 bg-amber-50 p-4 text-sm leading-6 text-[#7a4d17]">
              {realtime.error}
            </div>
          ) : null}
        </div>

        <div className="rounded-[24px] border border-black/10 bg-white/82 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
            <Users className="h-4 w-4" />
            <span>Occupancy Snapshot</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {realtime.participants.length > 0 ? (
              realtime.participants.map((participant) => (
                <div
                  key={`${participant.sessionKey}-${participant.heartbeatAt}`}
                  className={`rounded-[18px] border p-4 ${
                    participant.stale
                      ? "border-amber-500/20 bg-amber-50"
                      : participant.isSelf
                        ? "border-emerald-500/20 bg-emerald-50"
                        : "border-black/10 bg-[#faf7f1]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[#171411]">{participant.label}</div>
                      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7e7367]">
                        {participant.sessionKey.slice(-8)}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {participant.isSelf ? (
                        <span className="rounded-full border border-emerald-500/25 bg-white/70 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                          self
                        </span>
                      ) : null}
                      <span
                        className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] ${
                          participant.stale
                            ? "border border-amber-500/25 bg-white/70 text-[#8a5c16]"
                            : "border border-black/10 bg-white/70 text-[#6c6258]"
                        }`}
                      >
                        {participant.stale ? "stale" : "active"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 space-y-1 text-[11px] leading-5 text-[#625a51]">
                    <div>room {participant.roomId}</div>
                    <div>joined {formatTimestamp(participant.joinedAt)}</div>
                    <div>heartbeat {formatTimestamp(participant.heartbeatAt)}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[18px] border border-black/10 bg-[#faf7f1] p-4 text-sm leading-6 text-[#625a51]">
                아직 참가자가 없습니다. enabled 상태에서 room을 만들거나 같은 room id로 다른 브라우저 창을 열어 보세요.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-[24px] border border-black/10 bg-[#191512] p-5 text-[#f9f4ec] shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.2em] text-[#ccb59b]">
            <Activity className="h-4 w-4" />
            <span>Phase 1 Scope</span>
          </div>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-[#e1d7cd]">
            <li>room id bootstrap와 shareable query 유지</li>
            <li>session key 기반 presence join/leave</li>
            <li>15초 heartbeat 갱신</li>
            <li>45초 stale participant 표시</li>
            <li>occupancy snapshot panel</li>
          </ul>
        </div>

        <div className="rounded-[24px] border border-black/10 bg-white/82 p-5 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
          <div className="text-[10px] font-semibold tracking-[0.2em] text-[#8a8177]">Phase 2 이후 범위</div>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-[#52483f]">
            <li>cursor presence</li>
            <li>camera/view mode presence</li>
            <li>presenter broadcast</li>
            <li>follow presenter</li>
            <li>lab-only collaborative edit draft</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
