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

function dispatchPoseInput(update: {
  uMm?: number;
  vMm?: number;
  normalOffsetMm?: number;
  rotationMilliDeg?: number;
}) {
  window.dispatchEvent(
    new CustomEvent("deskterioronline:focus-placement:set-local-pose", {
      detail: update
    })
  );
}

function dispatchPlacementAction(action: "commit" | "cancel") {
  window.dispatchEvent(new Event(`deskterioronline:focus-placement:${action}`));
}

function dispatchCandidateSelect(candidateIndex: number) {
  window.dispatchEvent(
    new CustomEvent("deskterioronline:focus-placement:select-candidate", {
      detail: { candidateIndex }
    })
  );
}

function resolveCandidateClassName(
  tone: "ready" | "blocked" | "info",
  isActive: boolean
) {
  const activeRing = isActive ? "ring-1 ring-white/45" : "";
  switch (tone) {
    case "ready":
      return `border-emerald-300/25 bg-emerald-400/10 text-emerald-100 ${activeRing}`;
    case "blocked":
      return `border-rose-300/25 bg-rose-500/10 text-rose-100 ${activeRing}`;
    case "info":
    default:
      return `border-white/12 bg-white/7 text-white/75 ${activeRing}`;
  }
}

function NumericPoseInput({
  label,
  value,
  step,
  unit,
  onValue
}: {
  label: string;
  value: number | string;
  step: number;
  unit: string;
  onValue: (value: number) => void;
}) {
  return (
    <label className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          value={value}
          step={step}
          onChange={(event) => {
            const numericValue = Number(event.currentTarget.value);
            if (Number.isFinite(numericValue)) {
              onValue(numericValue);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              dispatchPlacementAction("commit");
            }
            if (event.key === "Escape") {
              event.preventDefault();
              dispatchPlacementAction("cancel");
            }
          }}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/25 px-2 py-1 text-sm font-medium text-white outline-none transition focus:border-sky-300/45"
        />
        <span className="shrink-0 text-xs text-white/55">{unit}</span>
      </div>
    </label>
  );
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

function resolveRequirementClassName(tone: "ready" | "warning" | "blocked" | "info") {
  switch (tone) {
    case "ready":
      return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
    case "warning":
      return "border-amber-300/25 bg-amber-400/10 text-amber-100";
    case "blocked":
      return "border-rose-300/25 bg-rose-500/10 text-rose-100";
    case "info":
    default:
      return "border-white/12 bg-white/7 text-white/75";
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
  const requirements = wizardState?.requirements ?? [];
  const clearance = wizardState?.clearance;

  return (
    <div
      className="pointer-events-auto absolute right-4 top-4 z-40 w-[min(360px,calc(100%-2rem))] rounded-[24px] border border-white/14 bg-black/55 px-4 py-4 text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl"
      data-focus-placement-ui="true"
      data-testid="focus-placement-hud"
    >
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
        <span
          className="rounded-full border border-white/12 bg-white/7 px-2.5 py-1 text-white/70"
          data-testid="focus-placement-active-attachment"
        >
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
        <NumericPoseInput
          label={axisLabels?.u ?? "Offset U"}
          value={session.localPose.uMm}
          step={session.moveStepMm}
          unit="mm"
          onValue={(value) => dispatchPoseInput({ uMm: value })}
        />
        <NumericPoseInput
          label={axisLabels?.v ?? "Offset V"}
          value={session.localPose.vMm}
          step={session.moveStepMm}
          unit="mm"
          onValue={(value) => dispatchPoseInput({ vMm: value })}
        />
        <NumericPoseInput
          label={axisLabels?.rotation ?? "Rotation"}
          value={formatRotation(session.localPose.rotationMilliDeg)}
          step={session.rotateStepMilliDeg / 1000}
          unit="deg"
          onValue={(value) => dispatchPoseInput({ rotationMilliDeg: Math.round(value * 1000) })}
        />
        <NumericPoseInput
          label={axisLabels?.normal ?? "Normal"}
          value={session.localPose.normalOffsetMm}
          step={session.moveStepMm}
          unit="mm"
          onValue={(value) => dispatchPoseInput({ normalOffsetMm: value })}
        />
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

      {candidateCount > 1 ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Candidates</div>
            <div className="text-[10px] font-medium text-white/65">
              #{(session.surfaceCandidates[session.activeCandidateIndex]?.rank ?? session.activeCandidateIndex) + 1}
            </div>
          </div>
          <div className="grid gap-2">
            {session.surfaceCandidates.map((candidate, index) => {
              const isActive = index === session.activeCandidateIndex;
              const reason = candidate.blockedReasons[0]?.message ?? candidate.reason;
              return (
                <button
                  key={`${candidate.surfaceId}-${candidate.attachmentType}-${index}`}
                  type="button"
                  onClick={() => dispatchCandidateSelect(index)}
                  data-attachment-type={candidate.attachmentType}
                  data-testid="focus-placement-candidate"
                  className={`rounded-xl border px-3 py-2 text-left transition hover:bg-white/12 ${resolveCandidateClassName(
                    candidate.tone,
                    isActive
                  )}`}
                  aria-pressed={isActive}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold">{candidate.surfaceLabel}</span>
                    <span className="text-[10px] uppercase tracking-[0.18em] opacity-70">
                      {candidate.score.toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.18em] opacity-65">
                    {resolveFocusPlacementAttachmentLabel(candidate.attachmentType)}
                  </div>
                  {reason ? <div className="mt-1 text-xs opacity-80">{reason}</div> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {requirements.length > 0 ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Requirements</div>
          <div className="mt-2 grid gap-2">
            {requirements.map((requirement) => (
              <div
                key={requirement.id}
                className={`rounded-xl border px-3 py-2 ${resolveRequirementClassName(requirement.tone)}`}
              >
                <div className="text-[9px] uppercase tracking-[0.22em] text-white/45">{requirement.label}</div>
                <div className="mt-1 text-sm font-medium">{requirement.value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3">
        <FocusPlacementSurfaceGrid session={session} tone={feedback.tone} />
      </div>

      {clearance ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs leading-6 text-white/70">
          <div className="text-[10px] uppercase tracking-[0.24em] text-white/45">Clearance</div>
          <div className="mt-1">
            L {clearance.left} / R {clearance.right} / T {clearance.top} / B {clearance.bottom} mm
          </div>
          <div>Min {clearance.min} mm</div>
        </div>
      ) : null}

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

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => dispatchPlacementAction("cancel")}
          className="rounded-2xl border border-white/12 bg-white/8 px-3 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/12"
        >
          취소
        </button>
        <button
          type="button"
          disabled={feedback.tone === "blocked"}
          onClick={() => dispatchPlacementAction("commit")}
          className="rounded-2xl border border-emerald-300/35 bg-emerald-400/18 px-3 py-2 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-400/24 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/8 disabled:text-white/40"
        >
          확정
        </button>
      </div>
    </div>
  );
}
