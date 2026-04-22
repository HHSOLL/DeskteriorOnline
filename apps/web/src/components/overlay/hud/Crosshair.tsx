"use client";

import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useFocusPlacementStore } from "../../../lib/stores/useFocusPlacementStore";
import { useInteractionStore } from "../../../lib/stores/useInteractionStore";

export default function Crosshair() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const hint = useInteractionStore((state) => state.hint);
  const activeSession = useFocusPlacementStore((state) => state.activeSession);
  if (viewMode !== "walk") return null;

  const badgeText = activeSession ? "Enter — Confirm · Esc — Cancel" : hint ? `E — ${hint}` : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div
          className={`h-2 w-2 rounded-full transition-colors ${
            badgeText ? "bg-white" : "bg-white/70"
          }`}
        />
        {badgeText ? (
          <div className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-[9px] uppercase tracking-[0.3em] text-white/80">
            {badgeText}
          </div>
        ) : null}
      </div>
    </div>
  );
}
