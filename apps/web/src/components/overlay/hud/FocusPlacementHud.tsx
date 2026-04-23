"use client";

import {
  resolveFocusPlacementAttachmentLabel,
  resolveFocusPlacementFeedback
} from "../../../lib/runtime/focus-placement-session";
import { useEditorStore } from "../../../lib/stores/useEditorStore";
import { useFocusPlacementStore } from "../../../lib/stores/useFocusPlacementStore";
import FocusPlacementSurfaceGrid from "./FocusPlacementSurfaceGrid";

function formatRotation(rotationMilliDeg: number) {
  return (rotationMilliDeg / 1000).toFixed(1);
}

function resolveStepClassName(state: "done" | "active" | "blocked" | "pending") {
  switch (state) {
    case "done":
      return "border-emerald-300/30 bg-emerald-400/12 text-emerald-100";
    case "active":
      return "border-sky-300/30 bg-sky-400/12 text-sky-100";
    case "blocked":
      return "border-rose-300/30 bg-rose-500/12 text-rose-100";
    case "pending":
    default:
      return "border-white/12 bg-white/7 text-white/65";
  }
}

export default function FocusPlacementHud() {
  const viewMode = useEditorStore((state) => state.viewMode);
  const session = useFocusPlacementStore((state) => state.activeSession);

  if (viewMode !== "walk" || !session) {
    return null;
  }

  const feedback = resolveFocusPlacementFeedback(session.constraintReport, session.collisionReport);
  const detailMessage = feedback.detail;
  const collisionCount = session.collisionReport?.collisions.length ?? 0;
  const warningCount = session.constraintReport?.warnings.length ?? 0;
  const attachmentLabel = resolveFocusPlacementAttachmentLabel(session.attachmentType);
  const candidateCount = session.surfaceCandidates.length;
  const wizardState = session.wizardState;
  const axisLabels = wizardState?.axisLabels;
  const shortcutLines = wizardState?.shortcutLines ?? [];
  const subtitle = wizardState?.subtitle;
  const showWizardPanels = wizardState?.mode === "monitor_arm";

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-40 w-[min(360px,calc(100%-2rem))] rounded-[24px] border border-white/14 bg-black/55 px-4 py-4 text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            {wizardState?.title ?? "Focus Placement"}
          </div>
          <div className="mt-1 text-sm font-semibold text-white">{session.objectLabel}</div>
          {subtitle ? <div className="mt-1 text-xs text-white/60">{subtitle}</div> : null}
        </div>
        <div
          className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] ${
            feedback.tone === "blocked"
              ? "bg-rose-500/20 text-rose-100"
              : feedback.tone === "warning"
                ? "bg-amber-400/20 text-amber-100"
                : "bg-emerald-400/20 text-emerald-100"
          }`}
        >
          {feedback.badgeLabel}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.22em]">
        <span className="rounded-full border border-white/12 bg-white/7 px-2.5 py-1 text-white/70">
          {attachmentLabel}
        </span>
        {candidateCount > 1 ? (
          <span className="rounded-full border border-white/12 bg-white/7 px-2.5 py-1 text-white/70">
            Mode {session.activeCandidateIndex + 1}/{candidateCount}
          </span>
        ) : null}
        <span className="rounded-full border border-white/12 bg-white/7 px-2.5 py-1 text-white/70">
          Preferred {session.preferredZones.length}
        </span>
        <span className="rounded-full border border-white/12 bg-white/7 px-2.5 py-1 text-white/70">
          No-Place {session.noPlaceZones.length}
        </span>
        {wizardState?.vesaPatternLabel ? (
          <span className="rounded-full border border-sky-300/25 bg-sky-500/12 px-2.5 py-1 text-sky-100">
            Panel {wizardState.vesaPatternLabel}
          </span>
        ) : null}
        {wizardState?.supportPatternLabel ? (
          <span className="rounded-full border border-sky-300/25 bg-sky-500/12 px-2.5 py-1 text-sky-100">
            Target {wizardState.supportPatternLabel}
          </span>
        ) : null}
        {collisionCount > 0 ? (
          <span className="rounded-full border border-rose-300/25 bg-rose-500/12 px-2.5 py-1 text-rose-100">
            Collision {collisionCount}
          </span>
        ) : null}
        {collisionCount === 0 && warningCount > 0 ? (
          <span className="rounded-full border border-amber-300/25 bg-amber-500/12 px-2.5 py-1 text-amber-100">
            Warning {warningCount}
          </span>
        ) : null}
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
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">{axisLabels?.u ?? "Offset U"}</div>
          <div className="mt-1 font-medium text-white">{session.localPose.uMm} mm</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">{axisLabels?.v ?? "Offset V"}</div>
          <div className="mt-1 font-medium text-white">{session.localPose.vMm} mm</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">{axisLabels?.rotation ?? "Rotation"}</div>
          <div className="mt-1 font-medium text-white">{formatRotation(session.localPose.rotationMilliDeg)} deg</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">{axisLabels?.normal ?? "Normal"}</div>
          <div className="mt-1 font-medium text-white">{session.localPose.normalOffsetMm} mm</div>
        </div>
      </div>

      {showWizardPanels ? (
        <>
          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Wizard</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em]">
              {wizardState.steps.map((step) => (
                <span
                  key={step.id}
                  className={`rounded-full border px-2.5 py-1 ${resolveStepClassName(step.state)}`}
                >
                  {step.label}
                </span>
              ))}
            </div>
          </div>

          {wizardState.joints.length > 0 ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Solved Joints</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-sm text-white/78">
                {wizardState.joints.map((joint) => (
                  <div key={joint.id} className="rounded-xl border border-white/10 bg-black/20 px-2.5 py-2">
                    <div className="text-[9px] uppercase tracking-[0.2em] text-white/45">{joint.label}</div>
                    <div className="mt-1 font-medium text-white">
                      {joint.value}
                      {joint.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="mt-3">
        <FocusPlacementSurfaceGrid session={session} tone={feedback.tone} />
      </div>

      {feedback.tone === "blocked" && detailMessage ? (
        <div className="mt-3 rounded-2xl border border-rose-400/35 bg-rose-500/12 px-3 py-2 text-sm text-rose-100">
          {detailMessage}
        </div>
      ) : null}
      {feedback.tone === "warning" && detailMessage ? (
        <div className="mt-3 rounded-2xl border border-amber-300/30 bg-amber-400/12 px-3 py-2 text-sm text-amber-100">
          {detailMessage}
        </div>
      ) : null}
      {feedback.tone === "ready" && wizardState?.detail && showWizardPanels ? (
        <div className="mt-3 rounded-2xl border border-sky-300/30 bg-sky-500/12 px-3 py-2 text-sm text-sky-100">
          {wizardState.detail}
        </div>
      ) : null}

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs leading-6 text-white/70">
        {shortcutLines.map((line) => (
          <div key={line}>{line}</div>
        ))}
        {shortcutLines.length === 0 ? (
          <>
            <div>Arrow: 표면 위 이동</div>
            <div>Alt + Arrow: 1mm 미세 이동</div>
            <div>Q / E: 회전</div>
            <div>Tab: 설치 방식 전환, F: 기본 표면으로 복귀</div>
            <div>Enter: 확정, Esc: 취소</div>
          </>
        ) : null}
      </div>
    </div>
  );
}
