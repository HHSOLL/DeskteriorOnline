import {
  buildRealtimeDraftConflictEvent,
  buildRealtimeDraftLockEvent,
  buildRealtimeDraftMoveEvent,
  buildRealtimeDraftReleaseEvent,
  createRealtimeDraftState,
  transitionRealtimeDraftState
} from "../src/lib/experiments/realtime-draft";
import {
  buildRealtimeAttentionPing,
  buildRealtimeLabChannelName,
  buildRealtimePresenceMeta,
  createDefaultRealtimeLocalPresenceState,
  normalizeRealtimeLabRoomId,
  resolveRealtimeBroadcastState,
  resolveRealtimeParticipantsFromPresenceState
} from "../src/lib/experiments/realtime-presence";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const now = Date.parse("2026-04-20T14:30:00.000Z");

try {
  const roomId = normalizeRealtimeLabRoomId("  Demo Room 01 ");
  assert(roomId === "demo-room-01", `unexpected normalized room id: ${roomId}`);
  assert(
    buildRealtimeLabChannelName(roomId ?? "missing") === "plan2space:labs:presence:demo-room-01",
    "unexpected realtime channel name"
  );

  const selfMeta = buildRealtimePresenceMeta({
    roomId: roomId ?? "demo-room-01",
    sessionKey: "session-self",
    label: "guest-self",
    now,
    localState: {
      ...createDefaultRealtimeLocalPresenceState(),
      viewMode: "desk",
      selectedAssetId: "p2s_desk_oak",
      cursor: {
        x: 0.24,
        y: 0.61
      }
    }
  });
  const staleMeta = buildRealtimePresenceMeta({
    roomId: roomId ?? "demo-room-01",
    sessionKey: "session-stale",
    label: "guest-stale",
    now: now - 70_000,
    localState: {
      ...createDefaultRealtimeLocalPresenceState(),
      viewMode: "walk",
      selectedAssetId: "p2s_ceramic_mug",
      followingPresenterSessionKey: "session-self"
    }
  });
  const presenterMeta = buildRealtimePresenceMeta({
    roomId: roomId ?? "demo-room-01",
    sessionKey: "session-presenter",
    label: "guest-presenter",
    now: now - 10_000,
    localState: {
      viewMode: "walk",
      selectedAssetId: "p2s_desk_lamp_glow",
      cursor: {
        x: 0.77,
        y: 0.33
      },
      role: "presenter",
      followingPresenterSessionKey: null,
      spotlightAssetId: "p2s_desk_lamp_glow"
    }
  });

  const participants = resolveRealtimeParticipantsFromPresenceState({
    presenceState: {
      "session-self": { metas: [selfMeta] },
      "session-stale": { metas: [staleMeta] },
      "session-presenter": { metas: [presenterMeta] }
    },
    selfSessionKey: "session-self",
    now
  });

  assert(participants.length === 3, `expected 3 participants, received ${participants.length}`);
  assert(participants[0]?.isSelf === true, "self participant should be ranked first");
  assert(participants[0]?.stale === false, "self participant should be active");
  assert(participants[0]?.viewMode === "desk", "self participant view mode should roundtrip");
  assert(participants[0]?.selectedAssetId === "p2s_desk_oak", "self selection should roundtrip");
  assert(participants[0]?.cursor?.x === 0.24, "self cursor x should roundtrip");
  assert(participants[0]?.cursor?.y === 0.61, "self cursor y should roundtrip");
  const presenter = participants.find((participant) => participant.role === "presenter");
  assert(presenter?.sessionKey === "session-presenter", "presenter participant should roundtrip");
  assert(presenter?.spotlightAssetId === "p2s_desk_lamp_glow", "presenter spotlight should roundtrip");
  const staleParticipant = participants.find((participant) => participant.sessionKey === "session-stale");
  assert(staleParticipant?.stale === true, "stale participant should be marked stale");
  assert(staleParticipant?.viewMode === "walk", "stale participant view mode should roundtrip");
  assert(staleParticipant?.selectedAssetId === "p2s_ceramic_mug", "stale selection should roundtrip");
  assert(
    staleParticipant?.followingPresenterSessionKey === "session-self",
    "following presenter session key should roundtrip"
  );

  const broadcastState = resolveRealtimeBroadcastState({
    participants: participants.filter((participant) => !participant.stale)
  });
  assert(broadcastState.presenter?.sessionKey === "session-presenter", "broadcast presenter should resolve");
  assert(
    broadcastState.spotlightAssetId === "p2s_desk_lamp_glow",
    "broadcast spotlight asset should resolve"
  );

  const ping = buildRealtimeAttentionPing({
    roomId: roomId ?? "demo-room-01",
    fromSessionKey: "session-self",
    fromLabel: "guest-self",
    targetSessionKey: "session-presenter",
    targetLabel: "guest-presenter",
    message: "presenter sync requested",
    now
  });
  assert(ping.targetSessionKey === "session-presenter", "attention ping target should roundtrip");
  assert(ping.targetLabel === "guest-presenter", "attention ping target label should roundtrip");
  assert(ping.message === "presenter sync requested", "attention ping message should roundtrip");

  let draftState = createRealtimeDraftState(now);
  const lockEvent = buildRealtimeDraftLockEvent({
    roomId: roomId ?? "demo-room-01",
    assetId: "p2s_ceramic_mug",
    assetLabel: "Ceramic Mug",
    sessionKey: "session-self",
    label: "guest-self",
    accentColor: "hsl(355 76% 54%)",
    now
  });
  const lockTransition = transitionRealtimeDraftState(draftState, lockEvent);
  assert(lockTransition.accepted === true, "draft lock should be accepted");
  draftState = lockTransition.state;

  const moveEvent = buildRealtimeDraftMoveEvent({
    roomId: roomId ?? "demo-room-01",
    assetId: "p2s_ceramic_mug",
    assetLabel: "Ceramic Mug",
    sessionKey: "session-self",
    label: "guest-self",
    accentColor: "hsl(355 76% 54%)",
    x: 0.81,
    y: 0.22,
    now: now + 1_000
  });
  const moveTransition = transitionRealtimeDraftState(draftState, moveEvent);
  assert(moveTransition.accepted === true, "draft move should be accepted");
  draftState = moveTransition.state;
  assert(
    draftState.assets["p2s_ceramic_mug"]?.x === 0.81 && draftState.assets["p2s_ceramic_mug"]?.y === 0.22,
    "draft move position should roundtrip"
  );

  const conflictingLockEvent = buildRealtimeDraftLockEvent({
    roomId: roomId ?? "demo-room-01",
    assetId: "p2s_ceramic_mug",
    assetLabel: "Ceramic Mug",
    sessionKey: "session-presenter",
    label: "guest-presenter",
    accentColor: "hsl(105 76% 54%)",
    now: now + 2_000
  });
  const conflictTransition = transitionRealtimeDraftState(draftState, conflictingLockEvent);
  assert(conflictTransition.accepted === false, "later conflicting lock should be rejected");
  assert(conflictTransition.conflict?.holderSessionKey === "session-self", "draft conflict holder should resolve");
  draftState = conflictTransition.state;

  const conflictEvent = buildRealtimeDraftConflictEvent({
    roomId: roomId ?? "demo-room-01",
    assetId: "p2s_ceramic_mug",
    assetLabel: "Ceramic Mug",
    holderSessionKey: "session-self",
    holderLabel: "guest-self",
    challengerSessionKey: "session-presenter",
    challengerLabel: "guest-presenter",
    message: "Ceramic Mug는 이미 guest-self가 잡고 있습니다.",
    now: now + 2_000
  });
  const conflictEventTransition = transitionRealtimeDraftState(draftState, conflictEvent);
  assert(conflictEventTransition.accepted === true, "explicit conflict event should be accepted");
  draftState = conflictEventTransition.state;
  assert(draftState.lastConflict?.assetId === "p2s_ceramic_mug", "draft conflict should persist");

  const releaseEvent = buildRealtimeDraftReleaseEvent({
    roomId: roomId ?? "demo-room-01",
    assetId: "p2s_ceramic_mug",
    assetLabel: "Ceramic Mug",
    sessionKey: "session-self",
    label: "guest-self",
    accentColor: "hsl(355 76% 54%)",
    now: now + 3_000
  });
  const releaseTransition = transitionRealtimeDraftState(draftState, releaseEvent);
  assert(releaseTransition.accepted === true, "draft release should be accepted");
  draftState = releaseTransition.state;
  assert(!draftState.locks["p2s_ceramic_mug"], "draft lock should be cleared after release");

  console.log("realtime lab phase 4 ok");
  console.log(
    JSON.stringify(
      {
        roomId,
        participants,
        broadcastState,
        ping,
        draftState
      },
      null,
      2
    )
  );
} catch (error) {
  console.error("[verify-realtime-lab-foundation] failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
