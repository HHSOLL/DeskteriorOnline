import {
  buildRealtimeLabChannelName,
  buildRealtimePresenceMeta,
  createDefaultRealtimeLocalPresenceState,
  normalizeRealtimeLabRoomId,
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
      selectedAssetId: "p2s_ceramic_mug"
    }
  });

  const participants = resolveRealtimeParticipantsFromPresenceState({
    presenceState: {
      "session-self": { metas: [selfMeta] },
      "session-stale": { metas: [staleMeta] }
    },
    selfSessionKey: "session-self",
    now
  });

  assert(participants.length === 2, `expected 2 participants, received ${participants.length}`);
  assert(participants[0]?.isSelf === true, "self participant should be ranked first");
  assert(participants[0]?.stale === false, "self participant should be active");
  assert(participants[0]?.viewMode === "desk", "self participant view mode should roundtrip");
  assert(participants[0]?.selectedAssetId === "p2s_desk_oak", "self selection should roundtrip");
  assert(participants[0]?.cursor?.x === 0.24, "self cursor x should roundtrip");
  assert(participants[0]?.cursor?.y === 0.61, "self cursor y should roundtrip");
  assert(participants[1]?.stale === true, "stale participant should be marked stale");
  assert(participants[1]?.viewMode === "walk", "stale participant view mode should roundtrip");
  assert(participants[1]?.selectedAssetId === "p2s_ceramic_mug", "stale selection should roundtrip");

  console.log("realtime lab phase 2 ok");
  console.log(
    JSON.stringify(
      {
        roomId,
        participants
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
