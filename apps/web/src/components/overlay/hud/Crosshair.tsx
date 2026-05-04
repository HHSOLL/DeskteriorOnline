"use client";

import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { resolveFocusPlacementFeedback } from "../../../lib/runtime/focus-placement-session";
import { useFocusPlacementStore } from "../../../lib/stores/useFocusPlacementStore";
import { useInteractionStore } from "../../../lib/stores/useInteractionStore";
import { useWalkInventoryStore } from "../../../lib/stores/useWalkInventoryStore";

function resolveActivePlacementText(input: {
  mode: "default" | "monitor_arm" | undefined;
  candidateCount: number;
  tone: "ready" | "warning" | "blocked";
  detail: string | null;
}) {
  if (input.tone === "blocked") {
    return `Blocked — ${input.detail ?? "Adjust placement"}`;
  }
  if (input.tone === "warning") {
    return `Warning — ${input.detail ?? "Review clearance"}`;
  }
  if (input.mode === "monitor_arm") {
    return input.candidateCount > 1
      ? "Click/Enter — Confirm · PageUp/Down — Reach · Tab — Cycle · Esc — Cancel"
      : "Click/Enter — Confirm · PageUp/Down — Reach · Esc — Cancel";
  }
  return input.candidateCount > 1
    ? "Click/Enter — Confirm · Tab — Cycle · F — Refocus · Esc — Cancel"
    : "Click/Enter — Confirm · Esc — Cancel";
}

export default function Crosshair() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const hint = useInteractionStore((state) => state.hint);
  const pointerLocked = useInteractionStore((state) => state.walkPointerLocked);
  const pointerLockBlocked = useInteractionStore((state) => state.walkPointerLockBlocked);
  const activeSession = useFocusPlacementStore((state) => state.activeSession);
  const placementDraft = useWalkInventoryStore((state) => state.placementDraft);
  if (viewMode !== "walk") return null;

  const activeFeedback = activeSession
    ? resolveFocusPlacementFeedback(activeSession.constraintReport, activeSession.collisionReport)
    : null;
  const badgeText = activeSession
    ? resolveActivePlacementText({
        mode: activeSession.wizardState?.mode,
        candidateCount: activeSession.surfaceCandidates.length,
        tone: activeFeedback?.tone ?? "ready",
        detail: activeFeedback?.detail ?? null
      })
    : hint
      ? hint.actionable
        ? `Click/E — ${hint.label}`
        : hint.label
      : placementDraft
        ? `${placementDraft.label} · 표면 조준`
        : "I — 인벤토리";
  const controlText = pointerLockBlocked
    ? "Mouse look paused · close panels or click scene"
    : pointerLocked
      ? "Mouse look active · WASD"
      : "Click scene · mouse look / WASD";
  const badgeClassName = activeSession
    ? activeFeedback?.tone === "blocked"
      ? "bg-rose-500/12 border-rose-300/30 text-rose-100"
      : activeFeedback?.tone === "warning"
        ? "bg-amber-400/12 border-amber-300/30 text-amber-100"
        : "bg-emerald-400/12 border-emerald-300/30 text-emerald-100"
    : hint?.tone === "blocked"
      ? "bg-rose-500/12 border-rose-300/30 text-rose-100"
      : hint?.tone === "ready"
        ? "bg-emerald-400/12 border-emerald-300/30 text-emerald-100"
        : "bg-white/10 border-white/20 text-white/80";

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div
          className={`h-2 w-2 rounded-full transition-colors ${
            badgeText ? "bg-white" : "bg-white/70"
          }`}
        />
        {badgeText ? (
          <div className={`px-3 py-1 rounded-full border text-[9px] uppercase tracking-[0.3em] ${badgeClassName}`}>
            {badgeText}
          </div>
        ) : null}
        <div className="rounded-full border border-white/12 bg-black/35 px-3 py-1 text-[9px] uppercase tracking-[0.26em] text-white/55">
          {controlText}
        </div>
      </div>
    </div>
  );
}
