"use client";

import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useFocusPlacementStore } from "../../../lib/stores/useFocusPlacementStore";
import { useInteractionStore } from "../../../lib/stores/useInteractionStore";
import { useWalkInventoryStore } from "../../../lib/stores/useWalkInventoryStore";

export default function Crosshair() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const hint = useInteractionStore((state) => state.hint);
  const activeSession = useFocusPlacementStore((state) => state.activeSession);
  const placementDraft = useWalkInventoryStore((state) => state.placementDraft);
  if (viewMode !== "walk") return null;

  const badgeText = activeSession
    ? activeSession.wizardState?.mode === "monitor_arm"
      ? activeSession.surfaceCandidates.length > 1
        ? "Click/Enter — Confirm · PageUp/Down — Reach · Tab — Cycle · Esc — Cancel"
        : "Click/Enter — Confirm · PageUp/Down — Reach · Esc — Cancel"
      : activeSession.surfaceCandidates.length > 1
        ? "Click/Enter — Confirm · Tab — Cycle · F — Refocus · Esc — Cancel"
        : "Click/Enter — Confirm · Esc — Cancel"
    : hint
      ? hint.actionable
        ? `Click/E — ${hint.label}`
        : hint.label
      : placementDraft
        ? `${placementDraft.label} · 표면 조준`
        : "I — 인벤토리";
  const badgeClassName = activeSession
    ? "bg-white/10 border-white/20 text-white/80"
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
      </div>
    </div>
  );
}
