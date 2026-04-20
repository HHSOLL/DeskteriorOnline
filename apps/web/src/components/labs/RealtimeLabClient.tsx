"use client";

import { useEffect, useMemo, useState, type PointerEvent } from "react";
import {
  Activity,
  BellRing,
  BoxSelect,
  Copy,
  Crown,
  Crosshair,
  Link2,
  Move,
  Monitor,
  Package,
  RadioTower,
  RefreshCcw,
  ShieldAlert,
  Users
} from "lucide-react";
import { getRealtimeDraftCatalog } from "../../lib/experiments/realtime-draft";
import type { RealtimeLabsConfig } from "../../lib/experiments/realtime-labs";
import type { RealtimeViewMode } from "../../lib/experiments/realtime-presence";
import { useRealtime } from "../../hooks/useRealtime";
import { useRealtimeSync } from "../../hooks/useRealtimeSync";

const VIEW_MODE_OPTIONS: Array<{ id: RealtimeViewMode; label: string }> = [
  { id: "room", label: "Room" },
  { id: "desk", label: "Desk" },
  { id: "walk", label: "Walk" }
];

const SAMPLE_ASSETS = getRealtimeDraftCatalog();

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

function formatAssetLabel(assetId: string | null) {
  if (!assetId) {
    return "선택 없음";
  }

  return SAMPLE_ASSETS.find((asset) => asset.id === assetId)?.label ?? assetId;
}

export function RealtimeLabClient({ config }: { config: RealtimeLabsConfig }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [pingState, setPingState] = useState<"idle" | "sent" | "error">("idle");
  const [roomError, setRoomError] = useState<string | null>(null);
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null);
  const realtimeSync = useRealtimeSync({ enabled: config.enabled });
  const realtime = useRealtime({
    enabled: config.enabled,
    roomId: realtimeSync.roomId
  });
  const absoluteShareUrl = useMemo(
    () => buildAbsoluteShareUrl(realtimeSync.shareUrl),
    [realtimeSync.shareUrl]
  );
  const activeCursors = useMemo(
    () => realtime.activeParticipants.filter((participant) => participant.cursor),
    [realtime.activeParticipants]
  );
  const spotlightAssetLabel = formatAssetLabel(realtime.broadcastState.spotlightAssetId);
  const presenterLabel = realtime.currentPresenter?.label ?? "없음";
  const orderedDraftAssets = useMemo(
    () => realtime.draftState.order.map((assetId) => realtime.draftState.assets[assetId]).filter(Boolean),
    [realtime.draftState]
  );

  useEffect(() => {
    if (!draggingAssetId) {
      return;
    }

    const activeLock = realtime.draftState.locks[draggingAssetId];
    if (!activeLock || activeLock.ownerSessionKey !== realtime.sessionKey) {
      setDraggingAssetId(null);
    }
  }, [draggingAssetId, realtime.draftState.locks, realtime.sessionKey]);

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

  const handlePresenceSurfacePointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    realtime.setCursor({ x, y });
  };

  const handleDraftBoardPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingAssetId) {
      return;
    }

    const asset = realtime.draftState.assets[draggingAssetId];
    if (!asset) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    realtime.moveDraftAsset({
      assetId: asset.id,
      assetLabel: asset.label,
      x,
      y
    });
  };

  const finishDraftDrag = () => {
    if (!draggingAssetId) {
      return;
    }

    const asset = realtime.draftState.assets[draggingAssetId];
    if (asset) {
      realtime.releaseDraftAsset({
        assetId: asset.id,
        assetLabel: asset.label
      });
    }
    setDraggingAssetId(null);
  };

  const handleDraftAssetPointerDown = (assetId: string, assetLabel: string) => {
    const accepted = realtime.claimDraftAsset({
      assetId,
      assetLabel
    });
    if (accepted) {
      setDraggingAssetId(assetId);
    }
  };

  const handleAttentionPing = async (input: { message: string; targetSessionKey?: string | null; targetLabel?: string | null }) => {
    try {
      await realtime.sendAttentionPing(input);
      setPingState("sent");
    } catch {
      setPingState("error");
    }
  };

  return (
    <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_360px]">
      <div className="space-y-5">
        <div className="rounded-[24px] border border-black/10 bg-white/82 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
            <RadioTower className="h-4 w-4" />
            <span>Phase 4 Collaborative Draft</span>
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#171411]">
            lock / move / conflict / release
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#625a51]">
            Phase 3 broadcast state 위에 sample asset collaborative draft를 얹었다. 같은 room 안에서 lock owner,
            drag move intent, release, conflict banner까지 실험하지만, 이 보드는 local-only lab 상태일 뿐 저장도
            publish도 하지 않는다.
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
            <span>활성 커서 {activeCursors.length}</span>
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
            <div className="rounded-full border border-black/10 bg-[#f4f4f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51]">
              mode {realtime.localPresence.viewMode}
            </div>
            <div className="rounded-full border border-black/10 bg-[#f4f4f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51]">
              selected {formatAssetLabel(realtime.localPresence.selectedAssetId)}
            </div>
            <div className="rounded-full border border-black/10 bg-[#f4f4f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51]">
              presenter {presenterLabel}
            </div>
            <div className="rounded-full border border-black/10 bg-[#f4f4f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#625a51]">
              spotlight {spotlightAssetLabel}
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

          <div className="mt-6 grid gap-4 xl:grid-cols-3">
            <div className="rounded-[20px] border border-black/10 bg-[#faf7f1] p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e7367]">
                <Monitor className="h-4 w-4" />
                <span>View Mode Presence</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {VIEW_MODE_OPTIONS.map((option) => {
                  const active = realtime.localPresence.viewMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => realtime.setViewMode(option.id)}
                      className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                        active
                          ? "bg-[#171411] text-white"
                          : "border border-black/10 bg-white text-[#171411] hover:bg-[#f4f4f1]"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[20px] border border-black/10 bg-[#faf7f1] p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e7367]">
                <Package className="h-4 w-4" />
                <span>Selection Presence</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => realtime.setSelectedAssetId(null)}
                  className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                    realtime.localPresence.selectedAssetId === null
                      ? "bg-[#171411] text-white"
                      : "border border-black/10 bg-white text-[#171411] hover:bg-[#f4f4f1]"
                  }`}
                >
                  Clear
                </button>
                {SAMPLE_ASSETS.map((asset) => {
                  const active = realtime.localPresence.selectedAssetId === asset.id;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => realtime.setSelectedAssetId(asset.id)}
                      className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                        active
                          ? "bg-[#171411] text-white"
                          : "border border-black/10 bg-white text-[#171411] hover:bg-[#f4f4f1]"
                      }`}
                    >
                      {asset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[20px] border border-black/10 bg-[#faf7f1] p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e7367]">
                <Crown className="h-4 w-4" />
                <span>Broadcast State</span>
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[#625a51]">
                <div>presenter {presenterLabel}</div>
                <div>spotlight {spotlightAssetLabel}</div>
                <div>follow {realtime.isFollowingPresenter ? "on" : "off"}</div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {realtime.localPresence.role === "presenter" ? (
                  <button
                    type="button"
                    onClick={() => {
                      realtime.setPresenterRole("participant");
                      realtime.setSpotlightAssetId(null);
                    }}
                    className="rounded-full bg-[#171411] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-black"
                  >
                    Release Presenter
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      realtime.setPresenterRole("presenter");
                      realtime.setFollowingPresenterSessionKey(null);
                    }}
                    className="rounded-full bg-[#171411] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-black"
                  >
                    Take Presenter
                  </button>
                )}
                {realtime.currentPresenter && !realtime.currentPresenter.isSelf ? (
                  <button
                    type="button"
                    onClick={() =>
                      realtime.setFollowingPresenterSessionKey(
                        realtime.isFollowingPresenter ? null : realtime.currentPresenter?.sessionKey ?? null
                      )
                    }
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#171411] transition hover:bg-[#f4f4f1]"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    {realtime.isFollowingPresenter ? "Unfollow" : "Follow Presenter"}
                  </button>
                ) : null}
              </div>
              {realtime.localPresence.role === "presenter" ? (
                <div className="mt-4 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#7e7367]">Spotlight Asset</div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => realtime.setSpotlightAssetId(null)}
                      className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                        realtime.localPresence.spotlightAssetId === null
                          ? "bg-[#171411] text-white"
                          : "border border-black/10 bg-white text-[#171411] hover:bg-[#f4f4f1]"
                      }`}
                    >
                      Clear
                    </button>
                    {SAMPLE_ASSETS.map((asset) => {
                      const active = realtime.localPresence.spotlightAssetId === asset.id;
                      return (
                        <button
                          key={`spotlight-${asset.id}`}
                          type="button"
                          onClick={() => realtime.setSpotlightAssetId(asset.id)}
                          className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                            active
                              ? "bg-[#171411] text-white"
                              : "border border-black/10 bg-white text-[#171411] hover:bg-[#f4f4f1]"
                          }`}
                        >
                          {asset.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
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
            <Crosshair className="h-4 w-4" />
            <span>Presence Surface</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#625a51]">
            이 보드 안에서 포인터를 움직이면 같은 room 참가자에게 cursor presence가 전달된다. 아래 badge는 각
            참가자의 view mode와 selected asset 상태를 같이 보여준다.
          </p>
          <div
            onPointerMove={handlePresenceSurfacePointer}
            onPointerEnter={handlePresenceSurfacePointer}
            onPointerLeave={realtime.clearCursor}
            className="relative mt-5 h-[340px] overflow-hidden rounded-[24px] border border-black/10 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(242,236,228,0.92)_35%,_rgba(224,214,201,0.86)_100%)]"
          >
            <div className="absolute inset-0 bg-[linear-gradient(rgba(23,20,17,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(23,20,17,0.06)_1px,transparent_1px)] bg-[size:44px_44px]" />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6157]">
              <span>Cursor Presence</span>
              <span>{activeCursors.length} active markers / presenter {presenterLabel}</span>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-2 px-5 py-4">
              {realtime.activeParticipants.map((participant) => (
                <div
                  key={participant.sessionKey}
                  className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/82 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[#171411]"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: participant.accentColor }}
                  />
                  <span>{participant.label}</span>
                  {participant.role === "presenter" ? <span className="text-[#171411]">presenter</span> : null}
                  {participant.followingPresenterSessionKey ? (
                    <span className="text-[#71675d]">follow</span>
                  ) : null}
                  <span className="text-[#71675d]">{participant.viewMode}</span>
                  <span className="text-[#71675d]">{formatAssetLabel(participant.selectedAssetId)}</span>
                </div>
              ))}
            </div>

            {activeCursors.length > 0 ? (
              activeCursors.map((participant) => {
                if (!participant.cursor) {
                  return null;
                }

                return (
                  <div
                    key={`${participant.sessionKey}-${participant.cursor.updatedAt}`}
                    className="absolute"
                    style={{
                      left: `${participant.cursor.x * 100}%`,
                      top: `${participant.cursor.y * 100}%`,
                      transform: "translate(-50%, -50%)"
                    }}
                  >
                    <div className="relative">
                      <div
                        className="h-4 w-4 rounded-full border-2 border-white shadow-[0_10px_20px_rgba(0,0,0,0.18)]"
                        style={{ backgroundColor: participant.accentColor }}
                      />
                      <div className="mt-2 rounded-full bg-[#171411] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white shadow-[0_10px_20px_rgba(0,0,0,0.18)]">
                        {participant.label}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm leading-6 text-[#625a51]">
                아직 active cursor가 없다. 같은 room을 두 창에서 열고 이 보드 위로 포인터를 움직여 보세요.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-black/10 bg-white/82 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
            <BoxSelect className="h-4 w-4" />
            <span>Collaborative Draft Board</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#625a51]">
            이 보드는 lab-only 공동 편집 draft다. asset을 잡으면 낙관적으로 lock을 선점하고, 드래그 이동 중에는
            같은 room 참가자에게 move intent가 브로드캐스트된다. 이미 누가 잡고 있는 asset을 다시 잡으려 하면
            conflict banner가 뜬다.
          </p>

          {realtime.draftState.lastConflict ? (
            <div className="mt-4 flex items-start justify-between gap-4 rounded-[18px] border border-amber-500/25 bg-amber-50 p-4">
              <div className="flex items-start gap-3 text-sm leading-6 text-[#7a4d17]">
                <ShieldAlert className="mt-0.5 h-4 w-4 flex-none" />
                <div>
                  <div className="font-semibold">{realtime.draftState.lastConflict.assetLabel} lock conflict</div>
                  <div>{realtime.draftState.lastConflict.message}</div>
                  <div className="text-[11px] text-[#8a5c16]">
                    holder {realtime.draftState.lastConflict.holderLabel} / challenger{" "}
                    {realtime.draftState.lastConflict.challengerLabel}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={realtime.dismissDraftConflictBanner}
                className="rounded-full border border-amber-500/25 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7a4d17]"
              >
                dismiss
              </button>
            </div>
          ) : null}

          <div
            onPointerMove={handleDraftBoardPointerMove}
            onPointerUp={finishDraftDrag}
            onPointerLeave={finishDraftDrag}
            className="relative mt-5 h-[380px] overflow-hidden rounded-[24px] border border-black/10 bg-[linear-gradient(180deg,#faf7f1_0%,#efe6da_100%)]"
          >
            <div className="absolute inset-0 bg-[linear-gradient(rgba(23,20,17,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(23,20,17,0.06)_1px,transparent_1px)] bg-[size:56px_56px]" />
            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-4 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6b6157]">
              <span>Optimistic Lock / Drag Intent</span>
              <span>{draggingAssetId ? `dragging ${formatAssetLabel(draggingAssetId)}` : "idle"}</span>
            </div>

            {orderedDraftAssets.map((asset) => {
              const lock = realtime.draftState.locks[asset.id];
              const lockedBySelf = lock?.ownerSessionKey === realtime.sessionKey;
              const lockedByOther = Boolean(lock && lock.ownerSessionKey !== realtime.sessionKey);

              return (
                <button
                  key={asset.id}
                  type="button"
                  onPointerDown={() => handleDraftAssetPointerDown(asset.id, asset.label)}
                  className={`absolute min-w-[150px] rounded-[18px] border px-4 py-3 text-left shadow-[0_14px_26px_rgba(0,0,0,0.12)] transition ${
                    lockedBySelf
                      ? "border-emerald-500/25 bg-emerald-50"
                      : lockedByOther
                        ? "border-amber-500/25 bg-amber-50"
                        : "border-black/10 bg-white/92"
                  }`}
                  style={{
                    left: `${asset.x * 100}%`,
                    top: `${asset.y * 100}%`,
                    transform: "translate(-50%, -50%)",
                    cursor: lockedByOther ? "not-allowed" : draggingAssetId === asset.id ? "grabbing" : "grab"
                  }}
                >
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#7a7065]">
                    <Move className="h-3.5 w-3.5" />
                    <span>{lockedBySelf ? "locked by me" : lockedByOther ? "locked" : "available"}</span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[#171411]">{asset.label}</div>
                  <div className="mt-1 text-[11px] leading-5 text-[#625a51]">
                    pos {Math.round(asset.x * 100)} / {Math.round(asset.y * 100)}
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-[#625a51]">
                    owner {lock ? lock.ownerLabel : "none"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[24px] border border-black/10 bg-white/82 p-6 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
          <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.22em] text-[#8a8177]">
            <BellRing className="h-4 w-4" />
            <span>Attention Ping</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#625a51]">
            presenter나 room 전체에 attention ping을 보내고, 마지막 ping snapshot을 확인한다. 이는 ephemeral
            broadcast only이며 저장되지 않는다.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleAttentionPing({ message: "room focus requested" })}
              className="rounded-full bg-[#171411] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white transition hover:bg-black"
            >
              Ping Room
            </button>
            {realtime.currentPresenter && !realtime.currentPresenter.isSelf ? (
              <button
                type="button"
                onClick={() =>
                  void handleAttentionPing({
                    message: "presenter sync requested",
                    targetSessionKey: realtime.currentPresenter?.sessionKey ?? null,
                    targetLabel: realtime.currentPresenter?.label ?? null
                  })
                }
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#171411] transition hover:bg-[#f4f4f1]"
              >
                Ping Presenter
              </button>
            ) : null}
          </div>
          <div className="mt-4 text-[11px] text-[#625a51]">
            {pingState === "sent" ? "최근 ping 전송 완료" : pingState === "error" ? "ping 전송 실패" : "아직 ping 없음"}
          </div>
          <div className="mt-4 rounded-[18px] border border-black/10 bg-[#faf7f1] p-4 text-sm leading-6 text-[#52483f]">
            {realtime.lastAttentionPing ? (
              <>
                <div>from {realtime.lastAttentionPing.fromLabel}</div>
                <div>to {realtime.lastAttentionPing.targetLabel ?? "room"}</div>
                <div>message {realtime.lastAttentionPing.message}</div>
                <div>sent {formatTimestamp(realtime.lastAttentionPing.sentAt)}</div>
              </>
            ) : (
              <div>아직 attention ping이 없습니다.</div>
            )}
          </div>
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
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#171411]">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: participant.accentColor }}
                        />
                        <span>{participant.label}</span>
                      </div>
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
                    <div>role {participant.role}</div>
                    <div>follow {participant.followingPresenterSessionKey ?? "없음"}</div>
                    <div>spotlight {formatAssetLabel(participant.spotlightAssetId)}</div>
                    <div>mode {participant.viewMode}</div>
                    <div>selected {formatAssetLabel(participant.selectedAssetId)}</div>
                    <div>cursor {participant.cursor ? `${Math.round(participant.cursor.x * 100)} / ${Math.round(participant.cursor.y * 100)}` : "없음"}</div>
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
            <span>Phase 4 Scope</span>
          </div>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-[#e1d7cd]">
            <li>optimistic asset lock intent</li>
            <li>drag move broadcast on sample board</li>
            <li>lock collision / conflict banner</li>
            <li>selection handoff through lock owner</li>
            <li>still no persistence or production edit path</li>
          </ul>
        </div>

        <div className="rounded-[24px] border border-black/10 bg-white/82 p-5 shadow-[0_18px_46px_rgba(68,52,34,0.07)]">
          <div className="text-[10px] font-semibold tracking-[0.2em] text-[#8a8177]">Phase 5 이후 범위</div>
          <ul className="mt-4 space-y-2 text-sm leading-6 text-[#52483f]">
            <li>reconnect / hardening / kill switch</li>
            <li>stale participant cleanup hardening</li>
            <li>exit gate / go-no-go checklist</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
