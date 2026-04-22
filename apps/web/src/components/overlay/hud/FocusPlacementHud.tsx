"use client";

import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useFocusPlacementStore } from "../../../lib/stores/useFocusPlacementStore";

function formatRotation(rotationMilliDeg: number) {
  return (rotationMilliDeg / 1000).toFixed(1);
}

export default function FocusPlacementHud() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const session = useFocusPlacementStore((state) => state.activeSession);

  if (viewMode !== "walk" || !session) {
    return null;
  }

  const errorMessage = session.constraintReport?.errors[0]?.message ?? null;
  const warningMessage =
    session.collisionReport?.collided
      ? session.collisionReport.collisions[0]?.reason ?? "Collision detected."
      : session.constraintReport?.warnings[0]?.message ?? null;

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-40 w-[min(360px,calc(100%-2rem))] rounded-[24px] border border-white/14 bg-black/55 px-4 py-4 text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            Focus Placement
          </div>
          <div className="mt-1 text-sm font-semibold text-white">{session.objectLabel}</div>
        </div>
        <div
          className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${
            errorMessage
              ? "bg-rose-500/20 text-rose-100"
              : warningMessage
                ? "bg-amber-400/20 text-amber-100"
                : "bg-emerald-400/20 text-emerald-100"
          }`}
        >
          {errorMessage ? "Blocked" : warningMessage ? "Warning" : "Ready"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm text-white/78">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Surface</div>
          <div className="mt-1 font-medium text-white">
            {session.supportLabel} / {session.surfaceLabel}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Step</div>
          <div className="mt-1 font-medium text-white">
            {session.moveStepMm}mm / {(session.rotateStepMilliDeg / 1000).toFixed(1)}deg
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Offset U</div>
          <div className="mt-1 font-medium text-white">{session.localPose.uMm} mm</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Offset V</div>
          <div className="mt-1 font-medium text-white">{session.localPose.vMm} mm</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Rotation</div>
          <div className="mt-1 font-medium text-white">{formatRotation(session.localPose.rotationMilliDeg)} deg</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Normal</div>
          <div className="mt-1 font-medium text-white">{session.localPose.normalOffsetMm} mm</div>
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-3 rounded-2xl border border-rose-400/35 bg-rose-500/12 px-3 py-2 text-sm text-rose-100">
          {errorMessage}
        </div>
      ) : null}
      {!errorMessage && warningMessage ? (
        <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-400/12 px-3 py-2 text-sm text-amber-100">
          {warningMessage}
        </div>
      ) : null}

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs leading-6 text-white/70">
        <div>Arrow: 표면 위 이동</div>
        <div>Alt + Arrow: 1mm 미세 이동</div>
        <div>Q / E: 회전</div>
        <div>Enter: 확정, Esc: 취소</div>
      </div>
    </div>
  );
}
